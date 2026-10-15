// Edge Function "stripe-webhook" — ativa/atualiza/cancela o plano da conta
// quando o Stripe avisa (assinatura criada, renovada, trocada ou cancelada).
//
// Segurança:
//   - só aceita eventos com assinatura válida do Stripe (HMAC-SHA256 do corpo
//     com STRIPE_WEBHOOK_SECRET, tolerância de 5 min contra repetição);
//   - publicar com --no-verify-jwt (quem chama é o Stripe, não um usuário);
//   - grava SÓ em app_metadata (o usuário não consegue editar), via service role.
//
// Secrets: STRIPE_WEBHOOK_SECRET (whsec_…) e STRIPE_SECRET_KEY (sk_…).
// Publicar: npx supabase functions deploy stripe-webhook --no-verify-jwt
// Mesma regra de negócio de scripts/stripe-sincronizar.mjs (mantenha iguais).
import { createClient } from 'npm:@supabase/supabase-js@2';

const SEGREDO = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const CHAVE_STRIPE = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const TOLERANCIA_S = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_STRIPE = /^[A-Za-z0-9_]{1,255}$/;

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });

async function assinaturaValida(corpo: string, cabecalho: string | null): Promise<boolean> {
  if (!cabecalho || !SEGREDO) return false;
  const partes = Object.fromEntries(cabecalho.split(',').map((p) => p.split('=') as [string, string]));
  const t = Number(partes.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > TOLERANCIA_S) return false;
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(SEGREDO), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', chave, new TextEncoder().encode(`${t}.${corpo}`));
  const esperado = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const recebidas = cabecalho.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  // comparação em tempo constante
  return recebidas.some((v) => v.length === esperado.length && [...v].reduce((d, c, i) => d | (c.charCodeAt(0) ^ esperado.charCodeAt(i)), 0) === 0);
}

async function stripeGet(rota: string) {
  const r = await fetch(`https://api.stripe.com/v1/${rota}`, { headers: { Authorization: `Bearer ${CHAVE_STRIPE}` } });
  if (!r.ok) throw new Error(`Stripe ${rota}: ${r.status}`);
  return r.json();
}

// Quem é o usuário desta assinatura: client_reference_id do checkout
// (o app manda o id da conta no link de pagamento).
async function usuarioDaAssinatura(assinaturaId: string): Promise<string | null> {
  const sessoes = await stripeGet(`checkout/sessions?subscription=${assinaturaId}&limit=1`);
  return sessoes.data?.[0]?.client_reference_id ?? null;
}

function metadadosDoPlano(sub: Record<string, any>) {
  const ativa = ['active', 'trialing', 'past_due'].includes(sub.status);
  const plano = sub.metadata?.bntt_plano ?? sub.items?.data?.[0]?.price?.metadata?.bntt_plano ?? null;
  return {
    plano,
    tipo: plano?.startsWith('business') ? 'business' : 'home',
    ciclo: sub.metadata?.bntt_ciclo ?? (sub.items?.data?.[0]?.price?.recurring?.interval === 'year' ? 'anual' : 'mensal'),
    assinatura_ativa: ativa,
    stripe_customer: sub.customer,
    stripe_subscription: sub.id,
    assinatura_status: sub.status,
    assinatura_ate: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: false }, 405);
  const corpo = await req.text();
  if (!(await assinaturaValida(corpo, req.headers.get('stripe-signature')))) return json({ ok: false, erro: 'assinatura inválida' }, 400);

  let evento: Record<string, any>;
  try {
    evento = JSON.parse(corpo);
  } catch {
    return json({ ok: false, erro: 'corpo inválido' }, 400);
  }
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let sub: Record<string, any> | null = null;
  let userId: string | null = null;
  // Sempre relê a assinatura no Stripe (estado ATUAL): os eventos podem chegar
  // fora de ordem ou repetidos, e um "updated" antigo não pode desfazer um
  // estado mais novo.
  const objeto = evento.data?.object ?? {};
  if (evento.type === 'checkout.session.completed' && typeof objeto.subscription === 'string' && ID_STRIPE.test(objeto.subscription)) {
    // client_reference_id vem do link de pagamento (o navegador pode trocá-lo):
    // no máximo alguém paga um plano para outra conta — a guarda abaixo impede
    // que isso derrube a assinatura que a outra conta já tem.
    userId = objeto.client_reference_id;
    sub = await stripeGet(`subscriptions/${objeto.subscription}`);
  } else if (typeof evento.type === 'string' && evento.type.startsWith('customer.subscription.') && typeof objeto.id === 'string' && ID_STRIPE.test(objeto.id)) {
    sub = await stripeGet(`subscriptions/${objeto.id}`);
    userId = sub?.metadata?.bntt_usuario ?? (await usuarioDaAssinatura(objeto.id));
  } else {
    return json({ ok: true, ignorado: evento.type });
  }
  if (!userId || !sub) return json({ ok: true, aviso: 'assinatura sem conta do BNTT' });
  if (typeof userId !== 'string' || !UUID.test(userId)) return json({ ok: true, aviso: 'conta inválida' });

  const { data: atual, error: erroBusca } = await supabase.auth.admin.getUserById(userId);
  if (erroBusca || !atual?.user) return json({ ok: false, erro: 'conta não encontrada' }, 404);

  // Uma assinatura DIFERENTE e inativa (cancelada, expirada, de outra pessoa
  // que pôs o id desta conta no link) nunca derruba a assinatura ativa que a
  // conta já tem.
  const novo = metadadosDoPlano(sub);
  const meta = atual.user.app_metadata ?? {};
  if (meta.assinatura_ativa && meta.stripe_subscription && meta.stripe_subscription !== sub.id && !novo.assinatura_ativa) {
    return json({ ok: true, ignorado: 'assinatura antiga/diferente inativa' });
  }
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { ...meta, ...novo, cortesia: false },
  });
  // Mensagem genérica (o Stripe reenvia sozinho); o detalhe fica só no log.
  if (error) {
    console.error('stripe-webhook: falha ao gravar plano', error.message);
    return json({ ok: false, erro: 'falha ao gravar' }, 500);
  }
  return json({ ok: true });
});
