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
// tipoConta: 'home' | 'business' — escolhido na LP; só define a "linha" do
// app. Plano/assinatura nunca vêm daqui (o usuário poderia editar
// user_metadata): ficam em app_metadata, escrito só pelo servidor/Stripe.
export async function signUp(email, password, nome, tipoConta = 'home') {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nome, tipo_conta: tipoConta === 'business' ? 'business' : 'home' }, emailRedirectTo: `${location.origin}/app` },
  });
  if (error) throw error;
  return data.session;
}

// Recuperação de senha (2026-10-04 — o app não tinha). O link do e-mail volta
// para a raiz do app; o supabase-js reconhece o token e dispara o evento
// PASSWORD_RECOVERY (ver store.js), que abre a tela "Definir nova senha".
export async function sendPasswordReset(email) {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/app` });
  if (error) throw error;
}

export async function updatePassword(novaSenha) {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.updateUser({ password: novaSenha });
  if (error) throw error;
}

// Mensagens do Supabase Auth em português, claras para quem não é técnico.
export function mensagemErroAuth(e) {
  const m = (e?.message || '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos. Se esqueceu a senha, use "Esqueci minha senha".';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (m.includes('rate limit')) return 'Muitas tentativas de envio de e-mail. Aguarde cerca de 1 hora e tente de novo.';
  if (m.includes('user already registered')) return 'Já existe uma conta com este e-mail. Entre ou use "Esqueci minha senha".';
  if (m.includes('password should be at least') || m.includes('weak password')) return 'Senha fraca: use pelo menos 8 caracteres, misturando letras e números.';
  if (m.includes('same password') || m.includes('different from the old')) return 'A nova senha precisa ser diferente da atual.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
  return e?.message || 'Não foi possível concluir. Tente novamente.';
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

// Busca a sessão de novo no servidor (ex.: depois do pagamento, quando o
// webhook já gravou o plano em app_metadata).
export async function atualizarSessao() {
  if (isDemoMode()) return null;
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.refreshSession();
  if (error) throw error;
  return data.session;
}
