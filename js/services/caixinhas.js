import { isDemoMode } from '../data/config.js';
import { mockDb } from '../data/mockDb.js';
import { getSupabase } from '../data/supabaseClient.js';

// Caixinhas: dinheiro guardado em bancos/corretoras, uma linha por banco
// (nome, moeda, meta) + um histórico de movimentações (guardado/retirado).
// Igual a status em transactions/resource_items, valor guardado/retirado/
// saldo NUNCA são colunas — são sempre somados a partir de
// caixinha_movimentacoes (ver computeTotais abaixo), pra nunca ter duas
// fontes de verdade divergentes sobre "quanto tem guardado".

export async function listCaixinhas({ ownerId, groupId }) {
  if (isDemoMode()) {
    return mockDb.list('caixinhas', (c) => c.owner_id === ownerId || (groupId && c.group_id === groupId));
  }
  const supabase = await getSupabase();
  let query = supabase.from('caixinhas').select('*');
  query = groupId ? query.or(`owner_id.eq.${ownerId},group_id.eq.${groupId}`) : query.eq('owner_id', ownerId);
  const { data, error } = await query.order('criado_em');
  if (error) throw error;
  return data;
}

export async function createCaixinha({ bancoNome, moeda, meta, icone, iconeUrl, ownerId, groupId }) {
  const row = {
    banco_nome: bancoNome,
    moeda: moeda || 'BRL',
    meta: meta || null,
    icone: icone || 'bi-piggy-bank',
    icone_url: iconeUrl || null,
    owner_id: ownerId,
    group_id: groupId || null,
  };
  if (isDemoMode()) return mockDb.insert('caixinhas', row);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('caixinhas').insert(row).select().single();
  if (error) throw error;
  return data;
}

// Reaproveita exatamente o padrão de uploadCompanyLogo/uploadCategoryIcon:
// bucket "avatars" (mesmas policies, sem precisar criar bucket novo), data
// URL base64 em modo demo. A pessoa escolhe upload OU URL — nunca uma
// imagem adivinhada/buscada pelo sistema.
export async function uploadCaixinhaIcone(userId, file) {
  if (isDemoMode()) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
  const supabase = await getSupabase();
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${userId}/caixinha-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file);
  if (error) throw error;
  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
  return pub.publicUrl;
}

export async function updateCaixinha(id, patch) {
  if (isDemoMode()) return mockDb.update('caixinhas', id, patch);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('caixinhas').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCaixinha(id) {
  if (isDemoMode()) {
    const movs = await mockDb.list('caixinha_movimentacoes', (m) => m.caixinha_id === id);
    for (const m of movs) await mockDb.remove('caixinha_movimentacoes', m.id);
    return mockDb.remove('caixinhas', id);
  }
  const supabase = await getSupabase();
  const { error } = await supabase.from('caixinhas').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Movimentações (aportes/retiradas) ----------

export async function listMovimentacoes(caixinhaId) {
  let rows;
  if (isDemoMode()) {
    rows = await mockDb.list('caixinha_movimentacoes', (m) => m.caixinha_id === caixinhaId);
  } else {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('caixinha_movimentacoes').select('*').eq('caixinha_id', caixinhaId);
    if (error) throw error;
    rows = data;
  }
  return rows.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
}

// Todas as movimentações de todas as caixinhas visíveis de uma vez (evita
// N+1 ao montar as métricas agregadas da tela toda) — mesmo padrão de
// listPayersFor em services/transactions.js.
export async function listMovimentacoesFor(caixinhaIds) {
  const ids = caixinhaIds.filter(Boolean);
  const map = new Map();
  if (!ids.length) return map;

  let rows;
  if (isDemoMode()) {
    rows = await mockDb.list('caixinha_movimentacoes', (m) => ids.includes(m.caixinha_id));
  } else {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('caixinha_movimentacoes').select('*').in('caixinha_id', ids);
    if (error) throw error;
    rows = data;
  }
  for (const row of rows) {
    const atual = map.get(row.caixinha_id) || [];
    atual.push(row);
    map.set(row.caixinha_id, atual);
  }
  return map;
}

export async function createMovimentacao({ caixinhaId, tipo, valor, data, observacoes }) {
  const row = { caixinha_id: caixinhaId, tipo, valor: Number(valor), data: data || new Date().toISOString().slice(0, 10), observacoes: observacoes || null };
  if (isDemoMode()) return mockDb.insert('caixinha_movimentacoes', row);
  const supabase = await getSupabase();
  const { data: created, error } = await supabase.from('caixinha_movimentacoes').insert(row).select().single();
  if (error) throw error;
  return created;
}

export async function deleteMovimentacao(id) {
  if (isDemoMode()) return mockDb.remove('caixinha_movimentacoes', id);
  const supabase = await getSupabase();
  const { error } = await supabase.from('caixinha_movimentacoes').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Cálculos puros (sem I/O) ----------

// guardado/retirado/saldo de UMA caixinha a partir do histórico dela.
export function computeTotais(movimentacoes) {
  let guardado = 0;
  let retirado = 0;
  for (const m of movimentacoes) {
    if (m.tipo === 'guardado') guardado += Number(m.valor) || 0;
    else retirado += Number(m.valor) || 0;
  }
  return { guardado, retirado, saldo: guardado - retirado };
}

// 0–100 (ou null se a caixinha não tem meta definida — "progresso" não faz
// sentido sem uma meta pra comparar).
export function computeProgresso(saldo, meta) {
  if (!meta || meta <= 0) return null;
  return Math.max(0, Math.min(100, Math.round((saldo / meta) * 100)));
}

// Soma o saldo de um grupo de caixinhas (todas juntas, ou já filtradas por
// banco/responsável antes de chamar) — usado pros totalizadores "soma dos
// bancos" e "por responsável" da tela.
//
// Bug real corrigido (2026-08-20): essa função somava o saldo BRUTO de
// QUALQUER caixinha passada, sem olhar pra moeda — uma caixinha de US$ 903
// entrava na conta como se fosse R$ 903, inflando o "total em BRL" errado.
// O filtro fica AQUI DENTRO (não em quem chama) de propósito: depender de
// cada chamador lembrar de filtrar por moeda antes foi exatamente o que deu
// errado da primeira vez — `porResponsavel` filtrava, `somaGeral` não.
// Moeda estrangeira não entra na soma (sem conversão embutida aqui; quem
// quiser o valor convertido usa taxaParaBRL/conversaoBRLFor por caixinha).
export function somaSaldos(caixinhas, movByCaixinha) {
  return caixinhas
    .filter((c) => !c.moeda || c.moeda === 'BRL')
    .reduce((acc, c) => acc + computeTotais(movByCaixinha[c.id] || []).saldo, 0);
}
