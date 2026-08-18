import { isDemoMode } from '../data/config.js';
import { mockDb } from '../data/mockDb.js';
import { getSupabase } from '../data/supabaseClient.js';

// "Empresa/Serviço" deixou de ser só texto livre: cada nome distinto vira uma
// linha em `companies` (criada sob demanda), que pode carregar um logo — daí
// o mesmo nome digitado de novo já reaproveita o logo salvo antes.
export async function listCompanies({ ownerId, groupId }) {
  if (isDemoMode()) {
    return mockDb.list('companies', (c) => c.owner_id === ownerId || (groupId && c.group_id === groupId));
  }
  const supabase = await getSupabase();
  let query = supabase.from('companies').select('*');
  query = groupId ? query.or(`owner_id.eq.${ownerId},group_id.eq.${groupId}`) : query.eq('owner_id', ownerId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createCompany({ nome, logoUrl, ownerId, groupId }) {
  const row = { nome, logo_url: logoUrl || null, owner_id: ownerId, group_id: groupId || null };
  if (isDemoMode()) return mockDb.insert('companies', row);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('companies').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateCompany(id, patch) {
  if (isDemoMode()) return mockDb.update('companies', id, patch);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('companies').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// Acha por nome (case-insensitive) dentro do escopo owner/grupo já
// carregado — evita duplicar "iFood" e "ifood" como empresas diferentes.
export function findCompanyByName(companies, nome) {
  const alvo = (nome || '').trim().toLowerCase();
  if (!alvo) return null;
  return companies.find((c) => c.nome.trim().toLowerCase() === alvo) || null;
}

// Reaproveita exatamente o padrão de uploadCategoryIcon (services/categories.js):
// bucket "avatars" (mesmas policies, sem precisar criar bucket novo), data URL
// base64 em modo demo.
export async function uploadCompanyLogo(userId, file) {
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
  const path = `${userId}/empresa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file);
  if (error) throw error;
  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
  return pub.publicUrl;
}
