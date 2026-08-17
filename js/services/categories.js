import { isDemoMode } from '../data/config.js';
import { mockDb } from '../data/mockDb.js';
import { getSupabase } from '../data/supabaseClient.js';

export const DEFAULT_CATEGORIES = [
  { nome: 'Assinaturas', cor: '#0EA5E9', icone: 'bi-collection-play' },
  { nome: 'Curso', cor: '#22C55E', icone: 'bi-mortarboard' },
  { nome: 'Casa', cor: '#A855F7', icone: 'bi-house-door' },
  { nome: 'Carro', cor: '#6366F1', icone: 'bi-car-front' },
  { nome: 'Pet', cor: '#EF4444', icone: 'bi-heart' },
  { nome: 'Delivery', cor: '#F97316', icone: 'bi-bicycle' },
  { nome: 'Mercado', cor: '#16A34A', icone: 'bi-basket' },
  { nome: 'Outro', cor: '#64748B', icone: 'bi-three-dots' },
  { nome: 'Salário', cor: '#EAB308', icone: 'bi-cash-coin' },
];

export async function listCategories({ ownerId, groupId }) {
  if (isDemoMode()) {
    return mockDb.list('categories', (c) => c.owner_id === ownerId || (groupId && c.group_id === groupId));
  }
  const supabase = await getSupabase();
  let query = supabase.from('categories').select('*');
  query = groupId ? query.or(`owner_id.eq.${ownerId},group_id.eq.${groupId}`) : query.eq('owner_id', ownerId);
  const { data, error } = await query.order('nome');
  if (error) throw error;
  return data;
}

export async function createCategory({ nome, cor, icone, iconeUrl, ownerId, groupId }) {
  const row = {
    nome,
    cor: cor || '#64748B',
    icone: icone || 'bi-tag',
    owner_id: ownerId,
    group_id: groupId ?? null,
  };
  // Só manda icone_url quando tem valor: mandar a chave com null quebra em
  // qualquer banco que ainda não rodou a migration que adiciona essa coluna
  // (PostgREST rejeita insert citando coluna que não existe no cache do
  // schema) — assim o resto do app (ex.: ensureDefaultCategories, que nunca
  // passa iconeUrl) continua funcionando mesmo antes da migration rodar.
  if (iconeUrl) row.icone_url = iconeUrl;
  if (isDemoMode()) return mockDb.insert('categories', row);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('categories').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateCategory(id, patch) {
  if (isDemoMode()) return mockDb.update('categories', id, patch);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('categories').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// Reaproveita o bucket público "avatars" (mesma pasta por usuário, mesmas
// policies já existentes) em vez de criar um bucket só pra isso.
export async function uploadCategoryIcon(userId, file) {
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
  const path = `${userId}/categoria-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file);
  if (error) throw error;
  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
  return pub.publicUrl;
}

export async function ensureDefaultCategories(ownerId, groupId) {
  const existing = await listCategories({ ownerId, groupId });
  if (existing.length > 0) return existing;
  const created = [];
  for (const c of DEFAULT_CATEGORIES) {
    created.push(await createCategory({ ...c, ownerId, groupId }));
  }
  return created;
}

export async function deleteCategory(id) {
  if (isDemoMode()) return mockDb.remove('categories', id);
  const supabase = await getSupabase();
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}
