// Cria/atualiza no Stripe os planos de js/data/planos.js (idempotente):
// 1 produto por plano pago, 2 preços (mensal e anual com 20% off, achados
// pela lookup_key) e 1 Payment Link por preço. Grava as URLs públicas em
// js/data/stripeLinks.js (seguro no frontend — são links de checkout).
//   node scripts/stripe-planos.mjs          (usa STRIP_STOKEN do .env)
// Chave sk_test → modo de teste; sk_live → produção. Nunca imprime a chave.
import fs from 'node:fs';
import path from 'node:path';
import { lerEnv, RAIZ } from './env.mjs';
import { TODOS_OS_PLANOS, precoAnualCentavos } from '../js/data/planos.js';

const env = lerEnv();
const CHAVE = env.STRIP_STOKEN;
if (!CHAVE || !/^sk_(test|live)_/.test(CHAVE)) throw new Error('STRIP_STOKEN ausente ou inválida no .env (precisa ser sk_test_… ou sk_live_…).');
const MODO = CHAVE.startsWith('sk_live_') ? 'live' : 'test';
const BASE_APP = 'https://bnttapp.web.app';

function form(obj, prefixo = '', saida = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    const nome = prefixo ? `${prefixo}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (typeof v === 'object') form(v, nome, saida);
    else saida.append(nome, String(v));
  }
  return saida;
}

async function stripe(metodo, rota, corpo) {
  const r = await fetch(`https://api.stripe.com/v1/${rota}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${CHAVE}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2024-06-20' },
    body: corpo ? form(corpo) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`Stripe ${metodo} ${rota}: ${j.error?.message || r.status}`);
  return j;
}

async function produtoDoPlano(plano) {
  const busca = await stripe('GET', `products/search?query=${encodeURIComponent(`metadata['bntt_plano']:'${plano.id}'`)}`);
  const linha = plano.id.startsWith('home') ? 'BNTT Home' : 'BNTT Business';
  const dados = { name: `${linha} — ${plano.nome}`, description: plano.destaques.join(' · '), metadata: { bntt_plano: plano.id } };
  if (busca.data[0]) return stripe('POST', `products/${busca.data[0].id}`, { name: dados.name, description: dados.description });
  return stripe('POST', 'products', dados);
}

async function precoDoPlano(plano, produto, ciclo) {
  const lookup = `${plano.id}_${ciclo}`;
  const valor = ciclo === 'anual' ? precoAnualCentavos(plano.mensal) : plano.mensal;
  const existentes = await stripe('GET', `prices?lookup_keys[]=${lookup}&active=true`);
  const atual = existentes.data[0];
  if (atual && atual.unit_amount === valor && atual.product === produto.id) return atual;
  // Preço mudou: cria outro e transfere a lookup_key (o antigo é arquivado).
  const novo = await stripe('POST', 'prices', {
    product: produto.id,
    currency: 'brl',
    unit_amount: valor,
    recurring: { interval: ciclo === 'anual' ? 'year' : 'month' },
    lookup_key: lookup,
    transfer_lookup_key: true,
    metadata: { bntt_plano: plano.id, bntt_ciclo: ciclo },
  });
  if (atual) await stripe('POST', `prices/${atual.id}`, { active: false });
  return novo;
}

async function linkDoPreco(plano, preco, ciclo) {
  const lista = await stripe('GET', 'payment_links?active=true&limit=100');
  for (const l of lista.data) {
    if (l.metadata?.bntt_preco === preco.id) return l;
  }
  return stripe('POST', 'payment_links', {
    line_items: { 0: { price: preco.id, quantity: 1 } },
    metadata: { bntt_plano: plano.id, bntt_ciclo: ciclo, bntt_preco: preco.id },
    subscription_data: { metadata: { bntt_plano: plano.id, bntt_ciclo: ciclo } },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    after_completion: { type: 'redirect', redirect: { url: `${BASE_APP}/app?assinatura=ok&plano=${plano.id}` } },
  });
}

const links = {};
for (const plano of TODOS_OS_PLANOS.filter((p) => p.mensal > 0)) {
  const produto = await produtoDoPlano(plano);
  links[plano.id] = {};
  for (const ciclo of ['mensal', 'anual']) {
    const preco = await precoDoPlano(plano, produto, ciclo);
    const link = await linkDoPreco(plano, preco, ciclo);
    links[plano.id][ciclo] = { url: link.url, preco: preco.id, valor: preco.unit_amount };
    console.log(`${plano.id.padEnd(18)} ${ciclo.padEnd(6)} R$ ${(preco.unit_amount / 100).toFixed(2).padStart(8)}  ${link.url}`);
  }
}

const arquivo = path.join(RAIZ, 'js', 'data', 'stripeLinks.js');
fs.writeFileSync(arquivo, `// GERADO por scripts/stripe-planos.mjs — não editar à mão.
// Links públicos de checkout (Stripe Payment Links), modo: ${MODO}.
export const MODO_STRIPE = '${MODO}';
export const LINKS_STRIPE = ${JSON.stringify(links, null, 2)};
`);
console.log(`\nModo ${MODO}. Links gravados em js/data/stripeLinks.js.`);
