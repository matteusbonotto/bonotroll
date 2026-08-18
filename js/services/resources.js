import { isDemoMode } from '../data/config.js';
import { mockDb } from '../data/mockDb.js';
import { getSupabase } from '../data/supabaseClient.js';

// Cômodos e subcategorias são listas FIXAS (o usuário não cria/exclui
// cômodo) — só os produtos dentro delas são livres. Escritório/Sala/
// Lavanderia não tinham subcategoria pedida explicitamente, então caem
// todas em "Outros" (renomeável/expansível depois direto no banco, se
// quiser — não é uma trava de UI).
export const DEFAULT_ROOMS = [
  { nome: 'Quarto', icone: 'bi-door-closed', ordem: 1 },
  { nome: 'Escritório', icone: 'bi-briefcase', ordem: 2 },
  { nome: 'Cozinha', icone: 'bi-cup-hot', ordem: 3 },
  { nome: 'Banheiro', icone: 'bi-droplet', ordem: 4 },
  { nome: 'Sala', icone: 'bi-tv', ordem: 5 },
  { nome: 'Lavanderia', icone: 'bi-basket2', ordem: 6 },
];

export const DEFAULT_ROOM_CATEGORIES = {
  Quarto: ['Guarda-roupas'],
  Escritório: ['Outros'],
  Cozinha: ['Armário', 'Geladeira'],
  Banheiro: ['Armário', 'Prateleira'],
  Sala: ['Outros'],
  Lavanderia: ['Outros'],
};

export async function listRooms({ ownerId, groupId }) {
  if (isDemoMode()) {
    const rows = await mockDb.list('resource_rooms', (r) => r.owner_id === ownerId || (groupId && r.group_id === groupId));
    return rows.sort((a, b) => a.ordem - b.ordem);
  }
  const supabase = await getSupabase();
  let query = supabase.from('resource_rooms').select('*').order('ordem');
  query = groupId ? query.or(`owner_id.eq.${ownerId},group_id.eq.${groupId}`) : query.eq('owner_id', ownerId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function listRoomCategories(roomId) {
  if (isDemoMode()) {
    const rows = await mockDb.list('resource_categories', (c) => c.room_id === roomId);
    return rows.sort((a, b) => a.ordem - b.ordem);
  }
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('resource_categories').select('*').eq('room_id', roomId).order('ordem');
  if (error) throw error;
  return data;
}

function isUniqueViolation(e) {
  // 23505 = unique_violation (SQLSTATE do Postgres, exposto pelo
  // supabase-js em error.code) — quer dizer que outra chamada concorrente
  // (dois acessos à tela de Recursos antes do primeiro terminar de seedar)
  // já criou essa linha primeiro. Ignorar é seguro: o objetivo já foi
  // cumprido por quem chegou antes.
  return e?.code === '23505';
}

// Roda no primeiro acesso à tela de Recursos, igual ensureDefaultCategories.
export async function ensureDefaultRooms(ownerId, groupId) {
  const existentes = await listRooms({ ownerId, groupId });
  if (existentes.length) return existentes;

  for (const room of DEFAULT_ROOMS) {
    const linha = { nome: room.nome, icone: room.icone, ordem: room.ordem, owner_id: ownerId, group_id: groupId || null };
    let roomCriado;
    try {
      roomCriado = isDemoMode() ? await mockDb.insert('resource_rooms', linha) : await criarRoomReal(linha);
    } catch (e) {
      if (isUniqueViolation(e)) continue;
      throw e;
    }

    const categorias = DEFAULT_ROOM_CATEGORIES[room.nome] || [];
    for (let i = 0; i < categorias.length; i++) {
      const catLinha = { room_id: roomCriado.id, nome: categorias[i], ordem: i + 1 };
      try {
        if (isDemoMode()) await mockDb.insert('resource_categories', catLinha);
        else await criarCategoriaReal(catLinha);
      } catch (e) {
        if (!isUniqueViolation(e)) throw e;
      }
    }
  }

  // Busca do banco de novo em vez de confiar no que foi criado nesta
  // chamada — se outra chamada concorrente ganhou a corrida em algum
  // cômodo, a lista acumulada localmente ficaria incompleta.
  return listRooms({ ownerId, groupId });
}

async function criarRoomReal(linha) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('resource_rooms').insert(linha).select().single();
  if (error) throw error;
  return data;
}
async function criarCategoriaReal(linha) {
  const supabase = await getSupabase();
  const { error } = await supabase.from('resource_categories').insert(linha);
  if (error) throw error;
}

// ---------- CRUD de cômodos e subcategorias (o usuário pode criar os
// próprios, além dos padrão semeados por ensureDefaultRooms acima) ----------

export async function createRoom({ nome, icone, ownerId, groupId }) {
  const existentes = await listRooms({ ownerId, groupId });
  const ordem = existentes.length ? Math.max(...existentes.map((r) => r.ordem)) + 1 : 1;
  const row = { nome, icone: icone || 'bi-door-open', ordem, owner_id: ownerId, group_id: groupId || null };
  if (isDemoMode()) return mockDb.insert('resource_rooms', row);
  return criarRoomReal(row);
}

export async function updateRoom(id, patch) {
  if (isDemoMode()) return mockDb.update('resource_rooms', id, patch);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('resource_rooms').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// A FK de resource_categories/resource_items pra room_id é "on delete
// cascade" (ver supabase/schema.sql) — excluir o cômodo já leva junto as
// subcategorias e itens dele, sem precisar apagar um por um aqui.
export async function deleteRoom(id) {
  if (isDemoMode()) {
    const categorias = await mockDb.list('resource_categories', (c) => c.room_id === id);
    for (const c of categorias) await mockDb.remove('resource_categories', c.id);
    const itens = await mockDb.list('resource_items', (i) => i.room_id === id);
    for (const i of itens) await mockDb.remove('resource_items', i.id);
    return mockDb.remove('resource_rooms', id);
  }
  const supabase = await getSupabase();
  const { error } = await supabase.from('resource_rooms').delete().eq('id', id);
  if (error) throw error;
}

export async function createRoomCategory({ roomId, nome }) {
  const existentes = await listRoomCategories(roomId);
  const ordem = existentes.length ? Math.max(...existentes.map((c) => c.ordem)) + 1 : 1;
  const row = { room_id: roomId, nome, ordem };
  if (isDemoMode()) return mockDb.insert('resource_categories', row);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('resource_categories').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function updateRoomCategory(id, patch) {
  if (isDemoMode()) return mockDb.update('resource_categories', id, patch);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('resource_categories').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// FK de resource_items pra category_id é "on delete set null" — itens dessa
// subcategoria não somem, só voltam a aparecer em "Todas" sem subcategoria.
export async function deleteRoomCategory(id) {
  if (isDemoMode()) {
    const itens = await mockDb.list('resource_items', (i) => i.category_id === id);
    for (const i of itens) await mockDb.update('resource_items', i.id, { category_id: null });
    return mockDb.remove('resource_categories', id);
  }
  const supabase = await getSupabase();
  const { error } = await supabase.from('resource_categories').delete().eq('id', id);
  if (error) throw error;
}

// ---------- Itens ----------

export async function listItems({ roomId, categoryId } = {}) {
  if (isDemoMode()) {
    return mockDb.list('resource_items', (i) => {
      if (roomId && i.room_id !== roomId) return false;
      if (categoryId && i.category_id !== categoryId) return false;
      return true;
    });
  }
  const supabase = await getSupabase();
  let query = supabase.from('resource_items').select('*');
  if (roomId) query = query.eq('room_id', roomId);
  if (categoryId) query = query.eq('category_id', categoryId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Todos os itens do usuário/grupo, pra "Sugestões" (em falta/vencendo) — não
// dá pra filtrar isso no banco (a regra combina quantidade e data), então
// traz tudo e filtra no cliente com computeExpiryStatus.
export async function listAllItems({ ownerId, groupId }) {
  if (isDemoMode()) {
    return mockDb.list('resource_items', (i) => i.owner_id === ownerId || (groupId && i.group_id === groupId));
  }
  const supabase = await getSupabase();
  let query = supabase.from('resource_items').select('*');
  query = groupId ? query.or(`owner_id.eq.${ownerId},group_id.eq.${groupId}`) : query.eq('owner_id', ownerId);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createItem(data) {
  const row = { quantidade: 0, data_validade: null, foto_url: null, category_id: null, ...data };
  if (isDemoMode()) return mockDb.insert('resource_items', row);
  const supabase = await getSupabase();
  const { data: created, error } = await supabase.from('resource_items').insert(row).select().single();
  if (error) throw error;
  return created;
}

export async function updateItem(id, patch) {
  if (isDemoMode()) return mockDb.update('resource_items', id, patch);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('resource_items').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteItem(id) {
  if (isDemoMode()) return mockDb.remove('resource_items', id);
  const supabase = await getSupabase();
  const { error } = await supabase.from('resource_items').delete().eq('id', id);
  if (error) throw error;
}

// Nunca deixa ir abaixo de 0 — "0" é o próprio sinal de "em falta/acabou",
// não faz sentido negativo.
export function ajustarQuantidade(item, delta) {
  return Math.max(0, (Number(item.quantidade) || 0) + delta);
}

// Reaproveita o mesmo padrão de uploadCategoryIcon/uploadCompanyLogo.
export async function uploadItemPhoto(userId, file) {
  if (isDemoMode()) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
  const supabase = await getSupabase();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userId}/recurso-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file);
  if (error) throw error;
  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
  return pub.publicUrl;
}
