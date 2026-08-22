import { isDemoMode } from '../data/config.js';
import { mockDb } from '../data/mockDb.js';
import { getSupabase } from '../data/supabaseClient.js';

// Cartões de crédito como entidade própria (2026-08-22) — ver
// .claude/discussions/001-cartao-credito-multi-cartao.md. Antes "isso é uma
// fatura"/"essa compra está numa fatura" dependia só do NOME da categoria
// ("Cartão de crédito") + do booleano cartao_credito em transactions, sem
// jeito de saber DE QUEM é o cartão nem QUAL cartão (cada pessoa pode ter
// mais de um, em bancos diferentes) — groupCartaoCredito agrupava pela
// primeira fatura encontrada no mês, ignorando responsavel_id, o que
// juntava a fatura de uma pessoa com a compra de outra.
//
// Diferente de banks/categories/companies (compartilhados por grupo), um
// cartão é uma identidade PESSOAL (owner-scoped): o índice único é
// (owner_id, lower(nome)), sem group_id. A leitura é compartilhada (Beatriz
// vê o cartão do Matheus ao navegar pelas transações do grupo), mas a
// escrita é só do dono — mesmo padrão de RLS de banks, com a nuance de que
// o nome é único por dono, não por grupo.
export async function listCartoes({ ownerId, groupId }) {
  if (isDemoMode()) {
    return mockDb.list('cartoes', (c) => c.owner_id === ownerId || (groupId && c.group_id === groupId));
  }
  const supabase = await getSupabase();
  let query = supabase.from('cartoes').select('*');
  query = groupId ? query.or(`owner_id.eq.${ownerId},group_id.eq.${groupId}`) : query.eq('owner_id', ownerId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createCartao({ nome, bancoId, ownerId, groupId }) {
  const row = { nome, banco_id: bancoId || null, owner_id: ownerId, group_id: groupId || null };
  if (isDemoMode()) return mockDb.insert('cartoes', row);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('cartoes').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateCartao(id, patch) {
  if (isDemoMode()) return mockDb.update('cartoes', id, patch);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('cartoes').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCartao(id) {
  if (isDemoMode()) return mockDb.remove('cartoes', id);
  const supabase = await getSupabase();
  const { error } = await supabase.from('cartoes').delete().eq('id', id);
  if (error) throw error;
}

// Acha por nome (case-insensitive) dentro da lista já carregada — mesmo
// padrão de findBankByName/findCompanyByName.
export function findCartaoByName(cartoes, nome) {
  const alvo = (nome || '').trim().toLowerCase();
  if (!alvo) return null;
  return cartoes.find((c) => c.nome.trim().toLowerCase() === alvo) || null;
}

// "Não pode haver cartões duplicados" (mesmo princípio de bancos): se já
// existe um cartão com esse nome do MESMO dono, reaproveita a linha em vez
// de inserir uma segunda pro mesmo nome. O nome de cartão é mais pessoal
// que o de banco, mas a regra anti-duplicata se aplica igual — o índice
// único cartoes_owner_nome_uniq no banco já impede a duplicata de qualquer
// jeito; aqui só evitamos o erro de constraint no cliente.
export async function findOrCreateCartao({ nome, bancoId, ownerId, groupId, existingCartoes }) {
  const existente = findCartaoByName(existingCartoes, nome);
  if (existente) return existente;
  return createCartao({ nome, bancoId, ownerId, groupId });
}
