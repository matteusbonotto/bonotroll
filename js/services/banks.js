import { isDemoMode } from '../data/config.js';
import { mockDb } from '../data/mockDb.js';
import { getSupabase } from '../data/supabaseClient.js';

// Bancos das Caixinhas: mesmo problema que "empresa/serviço" resolvia em
// companies.js — antes cada caixinha guardava banco_nome + icone/icone_url
// PRÓPRIOS, então "Nubank" da Matheus e "Nubank" da Beatriz eram duas linhas
// sem relação nenhuma (bug relatado: cadastrar a segunda "criava um banco
// novo" em vez de reaproveitar o logo já cadastrado na primeira). Agora
// banco é uma entidade compartilhada (como companies): um nome, um logo,
// reaproveitado por quantas caixinhas quiserem usá-lo — caixinhas continuam
// guardando só `banco_nome` (texto), e resolvem o logo por nome contra esta
// lista (ver bankByName em store.js), o mesmo padrão de companyByName.
export async function listBanks({ ownerId, groupId }) {
  if (isDemoMode()) {
    return mockDb.list('banks', (b) => b.owner_id === ownerId || (groupId && b.group_id === groupId));
  }
  const supabase = await getSupabase();
  let query = supabase.from('banks').select('*');
  query = groupId ? query.or(`owner_id.eq.${ownerId},group_id.eq.${groupId}`) : query.eq('owner_id', ownerId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createBank({ nome, logoUrl, ownerId, groupId }) {
  const row = { nome, logo_url: logoUrl || null, owner_id: ownerId, group_id: groupId || null };
  if (isDemoMode()) return mockDb.insert('banks', row);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('banks').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateBank(id, patch) {
  if (isDemoMode()) return mockDb.update('banks', id, patch);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('banks').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteBank(id) {
  if (isDemoMode()) return mockDb.remove('banks', id);
  const supabase = await getSupabase();
  const { error } = await supabase.from('banks').delete().eq('id', id);
  if (error) throw error;
}

// Acha por nome (case-insensitive) dentro da lista já carregada — mesmo
// padrão de findCompanyByName.
export function findBankByName(banks, nome) {
  const alvo = (nome || '').trim().toLowerCase();
  if (!alvo) return null;
  return banks.find((b) => b.nome.trim().toLowerCase() === alvo) || null;
}

// "Não pode haver bancos duplicados" (pedido explícito): centraliza
// find-or-create aqui em vez de deixar cada tela reimplementar o check —
// se já existe um banco com esse nome (mesmo grupo/dono), reaproveita a
// linha (atualiza o logo só se um novo foi enviado e o banco ainda não
// tinha nenhum); nunca insere uma segunda linha pro mesmo nome.
export async function findOrCreateBank({ nome, logoUrl, ownerId, groupId, existingBanks }) {
  const existente = findBankByName(existingBanks, nome);
  if (existente) {
    if (logoUrl && logoUrl !== existente.logo_url) {
      return updateBank(existente.id, { logo_url: logoUrl });
    }
    return existente;
  }
  return createBank({ nome, logoUrl, ownerId, groupId });
}

// Reaproveita exatamente o padrão de uploadCompanyLogo.
export async function uploadBankLogo(userId, file) {
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
  const path = `${userId}/banco-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file);
  if (error) throw error;
  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
  return pub.publicUrl;
}
