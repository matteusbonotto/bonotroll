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
  // Quebra mais fina de "Mercado" — usadas pela categorização automática da
  // lista de compras (ver guessCategoryByName em services/shoppingList.js).
  { nome: 'Laticínios', cor: '#38BDF8', icone: 'bi-cup-fill' },
  { nome: 'Padaria', cor: '#B45309', icone: 'bi-basket2-fill' },
  { nome: 'Açougue', cor: '#DC2626', icone: 'bi-shop' },
  { nome: 'Hortifruti', cor: '#65A30D', icone: 'bi-apple' },
  { nome: 'Limpeza', cor: '#06B6D4', icone: 'bi-droplet' },
  { nome: 'Higiene', cor: '#EC4899', icone: 'bi-droplet-half' },
  { nome: 'Bebidas', cor: '#D97706', icone: 'bi-cup-straw' },
  { nome: 'Saúde', cor: '#F43F5E', icone: 'bi-heart-pulse' },
  { nome: 'Beleza', cor: '#D946EF', icone: 'bi-magic' },
  // A fatura do cartão é reconhecida pelo NOME desta categoria (não por um
  // campo próprio na transação) — ver isCartaoCreditoBill em
  // js/services/transactions.js. Precisa existir por padrão, senão marcar
  // uma despesa como "cartão de crédito" não teria fatura nenhuma pra
  // agrupar dentro.
  { nome: 'Cartão de crédito', cor: '#7C3AED', icone: 'bi-credit-card' },
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

// "Top up" em vez de "só semeia se estiver vazia": contas criadas antes de
// novas entradas serem adicionadas em DEFAULT_CATEGORIES (ex.: Laticínios/
// Padaria/Açougue/Hortifruti, adicionadas pra dar suporte à categorização
// automática da lista de compras) também recebem as que estão faltando,
// comparando por nome — nunca duplica o que a pessoa já tem.
export async function ensureDefaultCategories(ownerId, groupId) {
  const existing = await listCategories({ ownerId, groupId });
  const nomesExistentes = new Set(existing.map((c) => c.nome.trim().toLowerCase()));
  const faltando = DEFAULT_CATEGORIES.filter((c) => !nomesExistentes.has(c.nome.toLowerCase()));
  if (!faltando.length) return existing;

  const criadas = [];
  for (const c of faltando) {
    try {
      criadas.push(await createCategory({ ...c, ownerId, groupId }));
    } catch (e) {
      // 23505 = unique_violation — outra aba/carregamento concorrente já
      // criou essa categoria primeiro; seguro ignorar.
      if (e?.code !== '23505') throw e;
    }
  }
  return [...existing, ...criadas];
}

export async function deleteCategory(id) {
  if (isDemoMode()) return mockDb.remove('categories', id);
  const supabase = await getSupabase();
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw error;
}
