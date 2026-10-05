// Sincroniza as assinaturas do Stripe com o plano de cada conta do BNTT
// (app_metadata no Supabase Auth). Faz o mesmo que a Edge Function
// supabase/functions/stripe-webhook — use enquanto ela não estiver
// publicada, ou para corrigir algo que o webhook perdeu.
//   node scripts/stripe-sincronizar.mjs            (aplica)
//   node scripts/stripe-sincronizar.mjs --simular  (só mostra)
// Nunca imprime chaves nem e-mails completos.
import { lerEnv, configPublica } from './env.mjs';

const env = lerEnv();
const SIMULAR = process.argv.includes('--simular');
const STRIPE = env.STRIP_STOKEN;
const SB_URL = configPublica(env)?.url;
const SB_SK = env.SB_SK;
if (!STRIPE || !SB_URL || !SB_SK) throw new Error('Faltam STRIP_STOKEN, SB_PROJ_ID/SB_PB ou SB_SK no .env.');

const stripe = async (rota) => {
  const r = await fetch(`https://api.stripe.com/v1/${rota}`, { headers: { Authorization: `Bearer ${STRIPE}` } });
  const j = await r.json();
  if (!r.ok) throw new Error(`Stripe ${rota}: ${j.error?.message || r.status}`);
  return j;
};
const admin = async (metodo, rota, corpo) => {
  const r = await fetch(`${SB_URL}/auth/v1/admin/${rota}`, {
    method: metodo,
    headers: { apikey: SB_SK, Authorization: `Bearer ${SB_SK}`, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Supabase admin ${rota}: ${j.msg || j.message || r.status}`);
  return j;
};

function metadadosDoPlano(sub) {
  const preco = sub.items?.data?.[0]?.price;
  const plano = sub.metadata?.bntt_plano ?? preco?.metadata?.bntt_plano ?? null;
  return {
    plano,
    tipo: plano?.startsWith('business') ? 'business' : 'home',
    ciclo: sub.metadata?.bntt_ciclo ?? (preco?.recurring?.interval === 'year' ? 'anual' : 'mensal'),
    assinatura_ativa: ['active', 'trialing', 'past_due'].includes(sub.status),
    stripe_customer: sub.customer,
    stripe_subscription: sub.id,
    assinatura_status: sub.status,
    assinatura_ate: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
  };
}

let depois;
let total = 0;
do {
  const pagina = await stripe(`subscriptions?status=all&limit=100${depois ? `&starting_after=${depois}` : ''}`);
  for (const sub of pagina.data) {
    const sessoes = await stripe(`checkout/sessions?subscription=${sub.id}&limit=1`);
    const userId = sessoes.data[0]?.client_reference_id;
    if (!userId) { console.log(`${sub.id}: sem conta do BNTT (ignorada)`); continue; }
    const novo = metadadosDoPlano(sub);
    const { app_metadata: atual = {}, email = '' } = await admin('GET', `users/${userId}`);
    const mascarado = email.replace(/^(.).*(@.*)$/, '$1***$2');
    console.log(`${mascarado}: ${novo.plano} (${novo.ciclo}) — ${sub.status}${SIMULAR ? ' [simulação]' : ''}`);
    if (!SIMULAR) await admin('PUT', `users/${userId}`, { app_metadata: { ...atual, ...novo, cortesia: false } });
    total++;
  }
  depois = pagina.has_more ? pagina.data.at(-1).id : null;
} while (depois);
console.log(`${total} assinatura(s) ${SIMULAR ? 'verificadas' : 'sincronizadas'}.`);
