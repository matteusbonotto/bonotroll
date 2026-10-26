// Nota do mercado → compra salva (pedido de 25/10/2026: "ler notas fiscais de
// mercado e salvar as compras numa lista feita no mercado X, dia X").
//
// Dois caminhos de leitura, a pessoa sempre confere antes de salvar:
//  1. QR code da NFC-e (preciso): a Edge Function "nfce-itens" busca os itens
//     na consulta pública da SEFAZ (o navegador não consegue, CORS).
//  2. Foto do cupom (reserva): OCR do aparelho, linha a linha.
// Ao salvar: uma lista de compras ENCERRADA (mercado, data, itens com preço —
// aparece no Histórico de compras e alimenta o histórico de preços) e, se a
// pessoa quiser, UM lançamento de saída (cartão ⇒ entra na fatura).
import { SUPABASE_ANON_KEY, SUPABASE_URL, isDemoMode } from '../data/config.js';
import { getSupabase } from '../data/supabaseClient.js';
import * as sl from './shoppingList.js';
import { createTransaction, listTransactions } from './transactions.js';
import { parseNfceQr } from './barcode.js';

// Chave de acesso de uma NFC-e (modelo 65) no texto do QR, ou null.
export function chaveDaUrl(texto) {
  const nota = parseNfceQr(texto);
  return nota?.modelo === 'NFC-e' ? nota.chave : null;
}

export class FalhaNota extends Error {
  constructor(codigo, mensagem) {
    super(mensagem);
    this.codigo = codigo;
  }
}

// Nota de exemplo do modo demonstração (sem servidor): mostra o fluxo inteiro.
function notaDemo(url) {
  const hoje = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return {
    chave: chaveDaUrl(url) || '35261012345678000190650010000123451000123450',
    mercado: 'Supermercado Bom Preço',
    cnpj: '12345678000190',
    emissao: `${hoje.getFullYear()}-${p(hoje.getMonth() + 1)}-${p(hoje.getDate())}T10:30:00-03:00`,
    formaPagamento: 'credito',
    itens: [
      { nome: 'ARROZ TIPO 1 5KG', codigo: '7896006716112', quantidade: 1, unidade: 'un', unidadeNota: 'UN', valorUnitario: 27.9, valorTotal: 27.9 },
      { nome: 'FEIJAO CARIOCA 1KG', codigo: '7896006744115', quantidade: 2, unidade: 'un', unidadeNota: 'UN', valorUnitario: 8.49, valorTotal: 16.98 },
      { nome: 'LEITE INTEGRAL 1L', codigo: '7891000100103', quantidade: 6, unidade: 'un', unidadeNota: 'UN', valorUnitario: 4.79, valorTotal: 28.74 },
      { nome: 'BANANA PRATA', codigo: null, quantidade: 1.235, unidade: 'kg', unidadeNota: 'KG', valorUnitario: 6.99, valorTotal: 8.63 },
      { nome: 'DETERGENTE LIQUIDO 500ML', codigo: '7891024134702', quantidade: 3, unidade: 'un', unidadeNota: 'UN', valorUnitario: 2.39, valorTotal: 7.17 },
    ],
    total: 89.42,
  };
}

// deps: testes injetam fetch/token/demo.
export async function lerNotaPeloQr(url, deps = {}) {
  if (!chaveDaUrl(url)) throw new FalhaNota('sem_chave', 'Esse QR code não é de uma nota fiscal do consumidor (NFC-e).');
  if (deps.demo ?? isDemoMode()) return notaDemo(url);
  let token = deps.token;
  if (!token) {
    const supabase = await getSupabase();
    token = (await supabase.auth.getSession()).data.session?.access_token;
  }
  if (!token) throw new FalhaNota('sessao', 'Sua sessão expirou. Entre de novo.');
  let r;
  try {
    r = await (deps.fetch || fetch)(`${SUPABASE_URL}/functions/v1/nfce-itens`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ url }),
    });
  } catch {
    throw new FalhaNota('sem_rede', 'Sem internet. Tente de novo ou use a foto do cupom.');
  }
  const corpo = await r.json().catch(() => null);
  if (r.status === 404 && !corpo?.codigo) throw new FalhaNota('funcao_ausente', 'A leitura pelo QR ainda não foi publicada no servidor. Use a foto do cupom.');
  if (!r.ok || !corpo?.ok) throw new FalhaNota(corpo?.codigo || 'erro', corpo?.erro || 'Não consegui ler essa nota. Use a foto do cupom.');
  return corpo.nota;
}

// ---------- Foto do cupom (OCR) ----------
// Linhas típicas do cupom: "001 7891234567890 ARROZ TIPO 1 5KG 1 UN X 27,90 27,90"
// ou "ARROZ TIPO 1 5KG 1UN x 27,90 27,90" ou "BANANA 1,235 KG X 6,99 8,63".
const LINHA_ITEM = /^(?:\d{1,3}\s+)?(?:\d{6,14}\s+)?(.+?)\s+(\d+(?:[.,]\d{1,3})?)\s*(UN|UND|KG|G|L|LT|ML|PC|PCT|CX|FD)?\s*[xX×*]\s*(\d+[.,]\d{2})\s+(?:[A-Z]\d{0,2}\s+)?(\d+[.,]\d{2})\b/i;
const num = (s) => Number(String(s).replace(/\./g, '').replace(',', '.'));
const UNID = { KG: 'kg', G: 'g', L: 'l', LT: 'l', ML: 'ml' };

export function itensDoCupomPorTexto(texto) {
  const itens = [];
  for (const linha of String(texto || '').split(/\r?\n/)) {
    const m = linha.trim().match(LINHA_ITEM);
    if (!m) continue;
    const nome = m[1].replace(/^\d{6,14}\s+/, '').replace(/\s+/g, ' ').trim();
    const quantidade = num(m[2]);
    const valorTotal = num(m[5]);
    if (!nome || nome.length < 2 || !(valorTotal > 0) || /total|subtotal|troco|desconto/i.test(nome)) continue;
    const un = (m[3] || 'UN').toUpperCase();
    itens.push({ nome, codigo: null, quantidade: quantidade > 0 ? quantidade : 1, unidade: UNID[un] || 'un', unidadeNota: un, valorUnitario: num(m[4]), valorTotal });
  }
  return itens;
}

export function dadosDoCupomPorTexto(texto) {
  const t = String(texto || '');
  const linhas = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const data = t.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  const total = t.match(/(?:valor\s+a\s+pagar|total)\s*R?\$?\s*:?\s*(\d+[.,]\d{2})/i);
  return {
    mercado: linhas.find((l) => /[a-z]{3,}/i.test(l) && !/cnpj|cupom|documento|nfc|danfe/i.test(l)) || null,
    emissao: data ? `${data[3]}-${data[2]}-${data[1]}T12:00:00-03:00` : null,
    total: total ? num(total[1]) : null,
    itens: itensDoCupomPorTexto(t),
  };
}

// ---------- Salvar ----------
export async function notaJaSalva(chave, { ownerId, groupId }) {
  if (!chave) return null;
  const txs = await listTransactions({ ownerId, groupId }).catch(() => []);
  return txs.find((t) => (t.qrcode_dados || '').includes(chave)) || null;
}

const arred = (n) => Math.round(n * 100) / 100;

// itens: os da conferência (só os marcados). pagamento: { lancar, cartaoId, categoriaId, responsavelId }.
export async function salvarCompraDaNota({ ownerId, groupId, mercado, data, itens, codigoQr, pagamento = {} }) {
  if (!itens?.length) throw new FalhaNota('sem_itens', 'Marque pelo menos um item.');
  const nomeMercado = (mercado || '').trim() || 'Mercado';
  const quando = data ? new Date(`${data}T12:00:00`).toISOString() : new Date().toISOString();
  const lista = await sl.criarCompraEncerrada({ ownerId, groupId, nome: nomeMercado, nomeMercado, finalizadoEm: quando });
  for (const i of itens) {
    const porPeso = i.unidade !== 'un';
    await sl.addItem(lista.id, {
      nome: i.nome,
      categoria_id: i.categoria_id || null,
      unidade: i.unidade || 'un',
      quantidade: Number(i.quantidade) || 1,
      preco_unitario: porPeso ? null : Number(i.valorUnitario) || arred((Number(i.valorTotal) || 0) / (Number(i.quantidade) || 1)),
      preco_por_kg: porPeso ? Number(i.valorUnitario) || null : null,
      codigo_barras: i.codigo || null,
      comprado: true,
    });
  }
  const total = arred(itens.reduce((s, i) => s + (Number(i.valorTotal) || 0), 0));
  let transacao = null;
  if (pagamento.lancar && total > 0) {
    const dia = (data || new Date().toISOString()).slice(0, 10);
    transacao = await createTransaction({
      tipo: 'saida',
      titulo: `Mercado — ${nomeMercado}`,
      empresa_servico: nomeMercado,
      categoria_id: pagamento.categoriaId || null,
      tipo_despesa: 'variavel',
      valor: total,
      responsavel_id: pagamento.responsavelId || ownerId,
      owner_id: ownerId,
      group_id: groupId ?? null,
      data_cadastro: dia,
      data_vencimento: dia,
      data_pagamento: dia, // a compra já aconteceu; no cartão quem fica "a pagar" é a fatura
      cartao_credito: !!pagamento.cartaoId,
      cartao_id: pagamento.cartaoId || null,
      qrcode_dados: codigoQr || null,
    });
    await sl.linkListToTransaction(lista.id, transacao.id);
  }
  return { lista, transacao, total };
}
