// Fichas de saúde das pessoas da casa (Palm Business, fase 8). Cada ficha é
// UM texto cifrado (ver cofre.js) — o servidor não vê nome, tipo sanguíneo,
// alergias, remédios nem contatos. Funciona igual no modo demonstração.
import { isDemoMode } from '../data/config.js';
import { mockDb } from '../data/mockDb.js';
import { getSupabase } from '../data/supabaseClient.js';
import { cifrar, decifrar } from './cofre.js';

export const TIPOS_SANGUINEOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Texto "uma por linha ou separado por vírgula" -> lista limpa.
export function paraLista(texto) {
  return (texto || '')
    .split(/[\n,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export function idade(nascimentoIso, hoje = new Date()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nascimentoIso || '');
  if (!m) return null;
  let anos = hoje.getFullYear() - Number(m[1]);
  const mes = hoje.getMonth() + 1;
  if (mes < Number(m[2]) || (mes === Number(m[2]) && hoje.getDate() < Number(m[3]))) anos--;
  return anos >= 0 && anos < 130 ? anos : null;
}

// Ficha vazia com todos os campos (ordem = ordem de importância numa emergência).
export function fichaVazia() {
  return {
    nome: '',
    nascimento: '',
    tipo_sanguineo: '',
    alergias: [],
    medicamentos: [],
    condicoes: [],
    contato_nome: '',
    contato_telefone: '',
    telefone: '',
    observacoes: '',
  };
}

export async function listarFichas(chave, { ownerId, groupId }) {
  let linhas;
  if (isDemoMode()) {
    linhas = await mockDb.list('fichas_saude', (f) => f.owner_id === ownerId || (groupId && f.group_id === groupId));
  } else {
    const supabase = await getSupabase();
    let q = supabase.from('fichas_saude').select('*').order('criado_em');
    q = groupId ? q.or(`owner_id.eq.${ownerId},group_id.eq.${groupId}`) : q.eq('owner_id', ownerId);
    const { data, error } = await q;
    if (error) throw error;
    linhas = data;
  }
  const fichas = [];
  for (const l of linhas) {
    try {
      fichas.push({ id: l.id, ...(await decifrar(chave, l.cifrado)) });
    } catch {
      fichas.push({ id: l.id, ilegivel: true, nome: 'Ficha protegida por outra senha' });
    }
  }
  return fichas.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
}

export async function salvarFicha(chave, { id, ownerId, groupId, dados }) {
  const cifrado = await cifrar(chave, dados);
  if (isDemoMode()) {
    return id
      ? mockDb.update('fichas_saude', id, { cifrado, atualizado_em: new Date().toISOString() })
      : mockDb.insert('fichas_saude', { owner_id: ownerId, group_id: groupId ?? null, cifrado });
  }
  const supabase = await getSupabase();
  if (id) {
    const { error } = await supabase.from('fichas_saude').update({ cifrado, atualizado_em: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    return { id };
  }
  const { data, error } = await supabase.from('fichas_saude').insert({ owner_id: ownerId, group_id: groupId ?? null, cifrado }).select().single();
  if (error) throw error;
  return data;
}

export async function excluirFicha(id) {
  if (isDemoMode()) return mockDb.remove('fichas_saude', id);
  const supabase = await getSupabase();
  const { error } = await supabase.from('fichas_saude').delete().eq('id', id);
  if (error) throw error;
}
