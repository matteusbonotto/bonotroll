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

  const evento = JSON.parse(corpo);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  let sub: Record<string, any> | null = null;
  let userId: string | null = null;
  if (evento.type === 'checkout.session.completed' && evento.data.object.subscription) {
    userId = evento.data.object.client_reference_id;
    sub = await stripeGet(`subscriptions/${evento.data.object.subscription}`);
  } else if (evento.type.startsWith('customer.subscription.')) {
    sub = evento.data.object;
    userId = sub.metadata?.bntt_usuario ?? (await usuarioDaAssinatura(sub.id));
  } else {
    return json({ ok: true, ignorado: evento.type });
  }
  if (!userId || !sub) return json({ ok: true, aviso: 'assinatura sem conta do BNTT' });

  const { data: atual, error: erroBusca } = await supabase.auth.admin.getUserById(userId);
  if (erroBusca || !atual?.user) return json({ ok: false, erro: 'conta não encontrada' }, 404);
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { ...atual.user.app_metadata, ...metadadosDoPlano(sub), cortesia: false },
  });
  if (error) return json({ ok: false, erro: error.message }, 500);
  return json({ ok: true });
});
