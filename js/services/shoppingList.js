import { isDemoMode } from '../data/config.js';
import { mockDb } from '../data/mockDb.js';
import { getSupabase } from '../data/supabaseClient.js';

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
  const valorTotal = items.reduce((sum, i) => sum + (Number(i.subtotal) || 0), 0);
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

// Retorna a lista ativa mais recente (não finalizada) ou cria uma nova em branco.
export async function getOrCreateActiveList({ ownerId, groupId }) {
  const lists = await listLists({ ownerId, groupId });
  const active = lists.find((l) => l.status !== 'finalizada');
  if (active) return active;
  return createList({ ownerId, groupId, nome: 'Lista de Compras' });
}

export async function createList({ ownerId, groupId, nome }) {
  const row = { owner_id: ownerId, group_id: groupId ?? null, nome: nome || 'Lista de Compras', status: 'planejando', iniciado_em: null, finalizado_em: null, transacao_id: null };
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
export const finishShopping = (id) => updateList(id, { status: 'finalizada', finalizado_em: new Date().toISOString() });
export const linkListToTransaction = (id, transacaoId) => updateList(id, { transacao_id: transacaoId });

export async function listItems(listId) {
  if (isDemoMode()) return mockDb.list('shopping_list_items', (i) => i.list_id === listId);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('shopping_list_items').select('*').eq('list_id', listId).order('criado_em');
  if (error) throw error;
  return data;
}

export async function addItem(listId, { nome, categoria_id, unidade = 'un', quantidade = 1 }) {
  const row = { list_id: listId, nome, categoria_id: categoria_id ?? null, unidade, quantidade, preco_unitario: null, preco_por_kg: null, subtotal: 0, comprado: false, codigo_barras: null, foto_url: null };
  if (isDemoMode()) return mockDb.insert('shopping_list_items', row);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('shopping_list_items').insert(row).select().single();
  if (error) throw error;
  return data;
}

// Faz merge do patch com o item atual e recalcula o subtotal automaticamente
// (preço/quantidade/unidade podem mudar juntos ou em passos separados na UI).
export async function updateItem(id, patch) {
  if (isDemoMode()) {
    const current = await mockDb.get('shopping_list_items', id);
    const merged = { ...current, ...patch };
    return mockDb.update('shopping_list_items', id, { ...patch, subtotal: computeItemSubtotal(merged) });
  }
  const supabase = await getSupabase();
  const { data: current, error: getErr } = await supabase.from('shopping_list_items').select('*').eq('id', id).single();
  if (getErr) throw getErr;
  const merged = { ...current, ...patch };
  const { data, error } = await supabase
    .from('shopping_list_items')
    .update({ ...patch, subtotal: computeItemSubtotal(merged) })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function removeItem(id) {
  if (isDemoMode()) return mockDb.remove('shopping_list_items', id);
  const supabase = await getSupabase();
  const { error } = await supabase.from('shopping_list_items').delete().eq('id', id);
  if (error) throw error;
}
