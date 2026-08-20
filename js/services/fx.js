// Cotação em tempo real pra converter caixinhas em moeda estrangeira pra
// BRL (exibida pequena/discreta embaixo do valor — nunca troca o valor
// principal, que continua sempre na moeda de verdade da caixinha). Duas
// fontes gratuitas, sem chave: Frankfurter (câmbio do BCE, moedas fiduciárias)
// e CoinGecko (preço simples, cripto/stablecoin) — cada uma só é chamada
// pras moedas que ela realmente cobre. Falha de rede/API não deve nunca
// quebrar a tela: qualquer erro aqui vira "sem cotação agora" em silêncio.

const CRIPTO = { USDT: 'tether', BTC: 'bitcoin', ETH: 'ethereum' };

// Cache de 5 min por moeda — a cotação não precisa ser "ao vivo ao vivo"
// pra um saldo guardado, e evita bater na API a cada render/re-render.
const cache = new Map(); // codigo -> { taxa, expiraEm }
const TTL_MS = 5 * 60 * 1000;

async function buscarTaxaFiat(codigo) {
  const resp = await fetch(`https://api.frankfurter.app/latest?from=${codigo}&to=BRL`);
  if (!resp.ok) throw new Error('Frankfurter respondeu ' + resp.status);
  const data = await resp.json();
  return data.rates?.BRL ?? null;
}

async function buscarTaxaCripto(codigo) {
  const id = CRIPTO[codigo];
  const resp = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=brl`);
  if (!resp.ok) throw new Error('CoinGecko respondeu ' + resp.status);
  const data = await resp.json();
  return data[id]?.brl ?? null;
}

// Retorna quantos BRL vale 1 unidade da moeda, ou null se não conseguir
// (moeda é BRL, API falhou, offline etc.) — o chamador decide o que fazer
// com null (tipicamente: não mostrar nada).
export async function taxaParaBRL(codigoMoeda) {
  if (!codigoMoeda || codigoMoeda === 'BRL') return null;
  const cached = cache.get(codigoMoeda);
  if (cached && cached.expiraEm > Date.now()) return cached.taxa;

  try {
    const taxa = CRIPTO[codigoMoeda] ? await buscarTaxaCripto(codigoMoeda) : await buscarTaxaFiat(codigoMoeda);
    if (taxa) cache.set(codigoMoeda, { taxa, expiraEm: Date.now() + TTL_MS });
    return taxa || null;
  } catch {
    return null;
  }
}
