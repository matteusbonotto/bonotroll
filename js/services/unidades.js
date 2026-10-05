// BNTT Business: unidades (filiais) e papéis da equipe. Mesma forma de dado
// no modo demonstração (mockDb) e no Supabase (supabase/business-2026-10.sql).
import { isDemoMode } from '../data/config.js';
import { mockDb } from '../data/mockDb.js';
import { getSupabase } from '../data/supabaseClient.js';

export const PAPEIS = [
  { id: 'dono', rotulo: 'Dono', descricao: 'Vê e muda tudo, inclusive papéis' },
  { id: 'gerente', rotulo: 'Gerente', descricao: 'Vê e muda tudo, cuida das unidades' },
  { id: 'funcionario', rotulo: 'Funcionário', descricao: 'Lança e muda só o que ele lançou' },
  { id: 'contador', rotulo: 'Contador', descricao: 'Só consulta e exporta' },
];

// Papéis antigos das contas Home valem como os novos.
export function papelEfetivo(papel) {
  if (papel === 'admin') return 'dono';
  if (papel === 'membro') return 'gerente';
  return PAPEIS.some((p) => p.id === papel) ? papel : 'gerente';
}

export const rotuloDoPapel = (papel) => PAPEIS.find((p) => p.id === papelEfetivo(papel))?.rotulo || 'Gerente';

// Banco ainda sem a migração do Business: mensagem clara, sem jargão.
export function mensagemDeUnidades(e) {
  const m = (e?.message || '').toLowerCase();
  if (m.includes('unidades') && (m.includes('does not exist') || m.includes('schema cache') || m.includes('relation'))) {
    return 'As unidades ainda estão sendo ativadas no servidor. Tente de novo mais tarde.';
  }
  if (m.includes('só o dono')) return 'Só o dono pode mudar papéis.';
  if (m.includes('pelo menos um dono')) return 'A empresa precisa de pelo menos um dono.';
  if (m.includes('duplicate') || m.includes('unique')) return 'Já existe uma unidade com esse nome.';
  return e?.message || 'Não foi possível concluir agora.';
}

export async function listarUnidades(groupId) {
  if (!groupId) return [];
  if (isDemoMode()) return (await mockDb.list('unidades', (u) => u.group_id === groupId)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('unidades').select('*').eq('group_id', groupId).order('nome');
  if (error) throw error;
  return data;
}

export async function criarUnidade(groupId, nome, criadoPor) {
  const row = { group_id: groupId, nome: nome.trim(), criado_por: criadoPor };
  if (isDemoMode()) {
    const existe = (await mockDb.list('unidades', (u) => u.group_id === groupId)).some((u) => u.nome.toLowerCase() === row.nome.toLowerCase());
    if (existe) throw new Error('duplicate');
    return mockDb.insert('unidades', row);
  }
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('unidades').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function renomearUnidade(id, nome) {
  if (isDemoMode()) return mockDb.update('unidades', id, { nome: nome.trim() });
  const supabase = await getSupabase();
  const { error } = await supabase.from('unidades').update({ nome: nome.trim() }).eq('id', id);
  if (error) throw error;
}

export async function excluirUnidade(id) {
  if (isDemoMode()) {
    for (const t of await mockDb.list('transactions', (t) => t.unidade_id === id)) await mockDb.update('transactions', t.id, { unidade_id: null });
    return mockDb.remove('unidades', id);
  }
  const supabase = await getSupabase();
  const { error } = await supabase.from('unidades').delete().eq('id', id);
  if (error) throw error;
}

export async function definirPapel(groupId, profileId, papel, unidadeId = null) {
  if (isDemoMode()) {
    const linha = (await mockDb.list('group_members', (m) => m.group_id === groupId && m.profile_id === profileId))[0];
    if (!linha) throw new Error('Pessoa fora da empresa.');
    const donos = (await mockDb.list('group_members', (m) => m.group_id === groupId)).filter((m) => papelEfetivo(m.papel) === 'dono');
    if (papel !== 'dono' && papelEfetivo(linha.papel) === 'dono' && donos.length <= 1) throw new Error('pelo menos um dono');
    return mockDb.updateWhere('group_members', (m) => m.group_id === groupId && m.profile_id === profileId, { papel, unidade_id: unidadeId });
  }
  const supabase = await getSupabase();
  const { error } = await supabase.rpc('definir_papel', { gid: groupId, pid: profileId, novo_papel: papel, nova_unidade: unidadeId });
  if (error) throw error;
}
