import { isDemoMode } from '../data/config.js';
import { mockDb } from '../data/mockDb.js';
import { getSupabase } from '../data/supabaseClient.js';
import { computeStatus } from '../utils/status.js';
import { todayIso } from '../utils/format.js';

export function withStatus(rows) {
  return rows.map((r) => ({ ...r, _status: computeStatus(r) }));
}

// ownerId = usuário logado · groupId = grupo dele (opcional). Traz tudo que é dele
// OU do grupo, e depois aplica os filtros (tipo, categoria, responsável, status...) em memória.
export async function listTransactions({ ownerId, groupId, filters = {} } = {}) {
  let rows;
  if (isDemoMode()) {
    rows = await mockDb.list('transactions', (t) => t.owner_id === ownerId || (groupId && t.group_id === groupId));
  } else {
    const supabase = await getSupabase();
    let query = supabase.from('transactions').select('*');
    query = groupId ? query.or(`owner_id.eq.${ownerId},group_id.eq.${groupId}`) : query.eq('owner_id', ownerId);
    const { data, error } = await query;
    if (error) throw error;
    rows = data;
  }

  rows = withStatus(rows);
  if (filters.tipo) rows = rows.filter((r) => r.tipo === filters.tipo);
  if (filters.categoriaId) rows = rows.filter((r) => r.categoria_id === filters.categoriaId);
  if (filters.responsavelId) rows = rows.filter((r) => r.responsavel_id === filters.responsavelId);
  if (filters.status) rows = rows.filter((r) => r._status === filters.status);
  if (filters.tipoDespesa) rows = rows.filter((r) => r.tipo_despesa === filters.tipoDespesa);
  if (filters.busca) {
    const termo = filters.busca.toLowerCase();
    rows = rows.filter(
      (r) => r.titulo.toLowerCase().includes(termo) || (r.empresa_servico || '').toLowerCase().includes(termo)
    );
  }

  return rows.sort((a, b) => (b.data_cadastro || '').localeCompare(a.data_cadastro || ''));
}

export async function createTransaction(data) {
  const row = { data_cadastro: todayIso(), ...data };
  if (isDemoMode()) return mockDb.insert('transactions', row);
  const supabase = await getSupabase();
  const { data: created, error } = await supabase.from('transactions').insert(row).select().single();
  if (error) throw error;
  return created;
}

export async function updateTransaction(id, patch) {
  if (isDemoMode()) return mockDb.update('transactions', id, patch);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('transactions').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTransaction(id) {
  if (isDemoMode()) return mockDb.remove('transactions', id);
  const supabase = await getSupabase();
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
}

export function markAsPaid(id) {
  return updateTransaction(id, { data_pagamento: todayIso() });
}

export function markAsUnpaid(id) {
  return updateTransaction(id, { data_pagamento: null });
}

// Cálculo puro (sem I/O) — reaproveitado pela Home (pessoal/grupo) e pelos gráficos.
export function computeSummary(transactions) {
  let entradas = 0;
  let saidas = 0;
  let maiorGasto = null;

  for (const t of transactions) {
    const valor = Number(t.valor) || 0;
    if (t.tipo === 'entrada') {
      entradas += valor;
    } else {
      saidas += valor;
      if (!maiorGasto || valor > Number(maiorGasto.valor)) maiorGasto = t;
    }
  }

  return { entradas, saidas, saldo: entradas - saidas, maiorGasto };
}

export function groupByCategory(transactions, categorias) {
  const porCategoria = new Map();
  for (const t of transactions) {
    if (t.tipo !== 'saida') continue;
    const cat = categorias.find((c) => c.id === t.categoria_id);
    const key = cat?.id || 'sem-categoria';
    const atual = porCategoria.get(key) || { nome: cat?.nome || 'Sem categoria', cor: cat?.cor || '#94A3B8', total: 0 };
    atual.total += Number(t.valor) || 0;
    porCategoria.set(key, atual);
  }
  return [...porCategoria.values()].sort((a, b) => b.total - a.total);
}
