import { isDemoMode } from '../data/config.js';
import { mockDb } from '../data/mockDb.js';
import { getSupabase } from '../data/supabaseClient.js';
import { comFallbackDeColuna } from '../utils/dbFallback.js';
import { semAcento } from '../utils/format.js';
import { somar } from '../utils/money.js';

// Calcula o subtotal de um item: por unidade (quantidade × preço unitário)
// ou por peso (quantidade em kg/g × preço por kg/g).
export function computeItemSubtotal(item) {
  const qty = Number(item.quantidade) || 0;
  const preco = item.unidade === 'un' ? Number(item.preco_unitario) || 0 : Number(item.preco_por_kg) || 0;
  return Math.round(qty * preco * 100) / 100;
}

export function computeListSummary(items) {
  const totalItens = items.length;
  const itensComprados = items.filter((i) => i.comprado).length;
  const valorTotal = somar(...items.map((i) => i.subtotal));
  return { totalItens, itensComprados, valorTotal };
}

export async function listLists({ ownerId, groupId }) {
  if (isDemoMode()) {
    const rows = await mockDb.list('shopping_lists', (l) => l.owner_id === ownerId || (groupId && l.group_id === groupId));
    return rows.sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || ''));
  }
  const supabase = await getSupabase();
  let query = supabase.from('shopping_lists').select('*');
  query = groupId ? query.or(`owner_id.eq.${ownerId},group_id.eq.${groupId}`) : query.eq('owner_id', ownerId);
  const { data, error } = await query.order('criado_em', { ascending: false });
  if (error) throw error;
  return data;
}

// Retorna a lista ativa mais recente (não finalizada) ou cria uma nova em
// branco — herdando o limite de gasto da lista anterior mais recente (se
// tinha um), pra funcionar como um "limite padrão" sem precisar de uma
// tabela de preferência separada. Sempre editável depois, por lista.
export async function getOrCreateActiveList({ ownerId, groupId }) {
  const lists = await listLists({ ownerId, groupId });
  const active = lists.find((l) => l.status !== 'finalizada');
  if (active) return active;
  const limiteAnterior = lists.find((l) => l.limite_gasto)?.limite_gasto ?? null;
  return createList({ ownerId, groupId, nome: 'Lista de Compras', limiteGasto: limiteAnterior });
}

export async function createList({ ownerId, groupId, nome, limiteGasto }) {
  const row = {
    owner_id: ownerId,
    group_id: groupId ?? null,
    nome: nome || 'Lista de Compras',
    status: 'planejando',
    iniciado_em: null,
    finalizado_em: null,
    transacao_id: null,
    nome_mercado: null,
    limite_gasto: limiteGasto ?? null,
  };
  if (isDemoMode()) return mockDb.insert('shopping_lists', row);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('shopping_lists').insert(row).select().single();
  if (error) throw error;
  return data;
}

async function updateList(id, patch) {
  if (isDemoMode()) return mockDb.update('shopping_lists', id, patch);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('shopping_lists').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export const startShopping = (id) => updateList(id, { status: 'comprando', iniciado_em: new Date().toISOString() });
export const pauseShopping = (id) => updateList(id, { status: 'pausada' });
export const resumeShopping = (id) => updateList(id, { status: 'comprando' });
// "Cancelar" uma compra pausada: SÓ tira do estado "pausada", nunca mexe nos
// itens nem cria lista nova — a lista e tudo que já foi adicionado continuam
// exatamente como estavam, só editáveis de novo (mesmo status de antes de
// iniciar a compra). Só "Encerrar Compra" (finishShopping) de fato encerra/
// esvazia — pedido explícito: "caso eu clique em cancelar, não deve limpar
// a lista de compras, só limpa se encerrar as compras".
export const cancelPausedShopping = (id) => updateList(id, { status: 'planejando', iniciado_em: null });
export const finishShopping = (id) => updateList(id, { status: 'finalizada', finalizado_em: new Date().toISOString() });
export const linkListToTransaction = (id, transacaoId) => updateList(id, { transacao_id: transacaoId });
export const setNomeMercado = (id, nomeMercado) => updateList(id, { nome_mercado: nomeMercado || null });
export const setLimiteGasto = (id, limiteGasto) => updateList(id, { limite_gasto: limiteGasto || null });

// 4 níveis (pedido explícito: "padrão verde, próximo amarelo, atingiu
// laranja, passou vermelho pulsante") conforme o total da lista se
// aproxima/atinge/passa do limite — usado só aqui (Compras); orçamento por
// categoria (computeBudgetProgress em budgets.js) continua com a régua
// própria dele, sem mudança.
export function computeListLimitStatus(total, limite) {
  if (!limite) return null;
  const percentual = Math.round((total / limite) * 100);
  const nivel = percentual >= 110 ? 'passou' : percentual >= 100 ? 'atingiu' : percentual >= 80 ? 'proximo' : 'ok';
  return { percentual, nivel };
}

export async function listItems(listId) {
  if (isDemoMode()) return mockDb.list('shopping_list_items', (i) => i.list_id === listId);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('shopping_list_items').select('*').eq('list_id', listId).order('criado_em');
  if (error) throw error;
  return data;
}

// Preço já é aceito aqui (opcional) — antes só dava pra preencher durante
// "Comprando" no mercado; agora dá pra informar de cara se a pessoa já
// sabe o valor (etiqueta, app do mercado, lembrança de compra anterior).
export async function addItem(listId, { nome, categoria_id, unidade = 'un', quantidade = 1, prioridade = 3, preco_unitario, preco_por_kg, data_validade, codigo_barras, foto_url }) {
  const row = {
    list_id: listId,
    nome,
    // "|| null" (não "?? null"): categoria_id é uma coluna uuid — string
    // vazia '' (valor "nenhuma categoria" nos <select> do formulário) não é
    // null/undefined, então "??" deixava passar e o Postgres rejeitava com
    // "invalid input syntax for type uuid" (bug invisível em modo demo, que
    // não valida tipo de coluna nenhum). categoria_id nunca é um uuid válido
    // e falsy ao mesmo tempo, então "||" é seguro aqui.
    categoria_id: categoria_id || null,
    unidade,
    quantidade,
    prioridade,
    preco_unitario: preco_unitario || null,
    preco_por_kg: preco_por_kg || null,
    subtotal: 0,
    comprado: false,
    codigo_barras: codigo_barras || null,
    data_validade: data_validade || null,
    foto_url: foto_url || null,
  };
  row.subtotal = computeItemSubtotal(row);
  if (isDemoMode()) return mockDb.insert('shopping_list_items', row);
  const supabase = await getSupabase();
  return comFallbackDeColuna(
    (obj) => supabase.from('shopping_list_items').insert(obj).select().single(),
    row
  );
}

// ---------- Categorização automática ----------
// Sugere uma categoria pelo NOME digitado, comparando com uma lista de
// palavras-chave por categoria (só sugere se essa categoria já existir na
// conta — nunca cria categoria nova sozinho). Sempre editável manualmente
// depois — isso aqui só preenche o campo, não trava ele. Cada regra aceita
// mais de um nome de categoria possível porque o modo demo (mockDb.js) e o
// modo real (DEFAULT_CATEGORIES em services/categories.js) não usam
// exatamente os mesmos nomes pra "mercado em geral" (Alimentos x Mercado).
const REGRAS_CATEGORIA = [
  { nomes: ['Laticínios'], palavras: ['leite', 'queijo', 'requeijao', 'requeijão', 'iogurte', 'manteiga', 'margarina', 'nata', 'creme de leite'] },
  { nomes: ['Padaria'], palavras: ['pao', 'pão', 'baguete', 'croissant', 'bolo', 'biscoito', 'bolacha', 'torrada', 'rosca'] },
  { nomes: ['Açougue'], palavras: ['carne', 'frango', 'peixe', 'linguica', 'linguiça', 'bacon', 'salsicha', 'costela', 'picanha', 'file', 'filé'] },
  { nomes: ['Hortifruti'], palavras: ['banana', 'maca', 'maçã', 'laranja', 'tomate', 'alface', 'cebola', 'batata', 'cenoura', 'limao', 'limão', 'uva', 'mamao', 'mamão', 'abacate', 'pepino', 'pimentao', 'pimentão', 'alho', 'morango'] },
  { nomes: ['Limpeza'], palavras: ['detergente', 'sabao em po', 'sabão em pó', 'desinfetante', 'agua sanitaria', 'água sanitária', 'amaciante', 'esponja', 'papel toalha', 'multiuso'] },
  { nomes: ['Higiene'], palavras: ['papel higienico', 'papel higiênico', 'sabonete', 'shampoo', 'condicionador', 'creme dental', 'pasta de dente', 'escova de dente', 'absorvente', 'desodorante', 'fralda'] },
  { nomes: ['Bebidas'], palavras: ['refrigerante', 'suco', 'agua', 'água', 'cerveja', 'vinho', 'cafe', 'café', 'cha', 'chá', 'energetico', 'energético'] },
  { nomes: ['Mercado', 'Alimentos'], palavras: ['arroz', 'feijao', 'feijão', 'macarrao', 'macarrão', 'acucar', 'açúcar', ' sal', 'oleo', 'óleo', 'farinha'] },
];

export function guessCategoryByName(nome, categories) {
  const alvo = semAcento((nome || '').trim().toLowerCase());
  if (!alvo) return null;
  for (const regra of REGRAS_CATEGORIA) {
    if (!regra.palavras.some((p) => alvo.includes(semAcento(p)))) continue;
    for (const nomeCat of regra.nomes) {
      const achada = categories.find((c) => c.nome.trim().toLowerCase() === nomeCat.toLowerCase());
      if (achada) return achada;
    }
  }
  return null;
}

// Faz merge do patch com o item atual e recalcula o subtotal automaticamente
// (preço/quantidade/unidade podem mudar juntos ou em passos separados na UI).
export async function updateItem(id, patch) {
  // Mesma normalização de addItem (ver comentário lá): só mexe em
  // categoria_id se o patch realmente veio com essa chave.
  if ('categoria_id' in patch) patch = { ...patch, categoria_id: patch.categoria_id || null };
  if (isDemoMode()) {
    const current = await mockDb.get('shopping_list_items', id);
    const merged = { ...current, ...patch };
    return mockDb.update('shopping_list_items', id, { ...patch, subtotal: computeItemSubtotal(merged) });
  }
  const supabase = await getSupabase();
  const { data: current, error: getErr } = await supabase.from('shopping_list_items').select('*').eq('id', id).single();
  if (getErr) throw getErr;
  const merged = { ...current, ...patch };
  const patchCompleto = { ...patch, subtotal: computeItemSubtotal(merged) };
  return comFallbackDeColuna(
    (obj) => supabase.from('shopping_list_items').update(obj).eq('id', id).select().single(),
    patchCompleto
  );
}

export async function removeItem(id) {
  if (isDemoMode()) return mockDb.remove('shopping_list_items', id);
  const supabase = await getSupabase();
  const { error } = await supabase.from('shopping_list_items').delete().eq('id', id);
  if (error) throw error;
}
