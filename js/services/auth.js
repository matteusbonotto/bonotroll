import { isDemoMode } from '../data/config.js';
import { mockDb, mockSession } from '../data/mockDb.js';
import { getSupabase } from '../data/supabaseClient.js';

// Perfis disponíveis para acesso rápido no modo demonstração (tela de login).
export async function getDemoProfiles() {
  return mockDb.list('profiles');
}

export async function getSession() {
  if (isDemoMode()) {
    const id = mockSession.getUserId();
    return id ? { user: { id } } : null;
  }
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signInDemo(profileId) {
  mockSession.setUserId(profileId);
  return mockDb.get('profiles', profileId);
}

export async function signInWithPassword(email, password) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

// O perfil é criado automaticamente por um trigger no banco (ver supabase/schema.sql),
// que lê o nome em raw_user_meta_data — por isso ele vai em options.data aqui.
export async function signUp(email, password, nome) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nome } } });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  if (isDemoMode()) {
    mockSession.clear();
    return;
  }
  const supabase = await getSupabase();
  await supabase.auth.signOut();
}

// Retorna uma função de "unsubscribe". Em modo demonstração não há eventos assíncronos
// de sessão (login/logout são sempre ações diretas do próprio app), então é um no-op.
export function onAuthStateChange(callback) {
  if (isDemoMode()) return () => {};
  let unsubscribeFn = () => {};
  getSupabase().then((supabase) => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => callback(event, session));
    unsubscribeFn = () => data.subscription.unsubscribe();
  });
  return () => unsubscribeFn();
}

export async function getProfile(userId) {
  if (isDemoMode()) return mockDb.get('profiles', userId);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId, patch) {
  if (isDemoMode()) return mockDb.update('profiles', userId, patch);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select().single();
  if (error) throw error;
  return data;
}

export async function uploadAvatar(userId, file) {
  if (isDemoMode()) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    return updateProfile(userId, { avatar_url: dataUrl });
  }
  const supabase = await getSupabase();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userId}/avatar.${ext}`;
  const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, cacheControl: '3600' });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
  // cache-bust: o caminho é fixo por usuário, então uma nova foto reusa a
  // mesma URL — sem isso o navegador continuaria mostrando a imagem antiga.
  return updateProfile(userId, { avatar_url: `${pub.publicUrl}?t=${Date.now()}` });
}
