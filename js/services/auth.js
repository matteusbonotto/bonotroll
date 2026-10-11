import { isDemoMode } from '../data/config.js';
import { mockDb, mockSession } from '../data/mockDb.js';
import { getSupabase } from '../data/supabaseClient.js';

// Perfis disponíveis para acesso rápido no modo demonstração (tela de login).
export async function getDemoProfiles() {
  return mockDb.list('profiles');
}

// Papel de cada perfil de demonstração em cada linha (para a tela de entrada).
export async function getDemoPapeis() {
  const grupos = await mockDb.list('groups');
  const papeis = {};
  for (const m of await mockDb.list('group_members')) {
    const linha = grupos.find((g) => g.id === m.group_id)?.linha || 'home';
    papeis[m.profile_id] = { ...(papeis[m.profile_id] || {}), [linha]: m.papel };
  }
  return papeis;
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
  const situacao = situacaoDoCadastro(data);
  if (situacao === 'confirmar_email') registrarEnvioConfirmacao(email);
  return { session: data.session, situacao };
}

// O que aconteceu num signUp que NÃO deu erro (2026-10-11 — bug do "e-mail
// que nunca chega"): com a confirmação de e-mail ligada, o Supabase responde
// SUCESSO para um e-mail que já tem conta, mas devolve user.identities = [] e
// não envia nada (é proposital: não revela quem é cliente). A tela dizia
// "Conta criada! Enviamos um link…" e a pessoa ficava esperando para sempre.
//   'logado'          — confirmação desligada: já veio sessão
//   'ja_existe'       — e-mail já cadastrado, nenhum e-mail foi enviado
//   'confirmar_email' — conta nova, e-mail de confirmação enviado
export function situacaoDoCadastro(data) {
  if (data?.session) return 'logado';
  const identidades = data?.user?.identities;
  if (Array.isArray(identidades) && identidades.length === 0) return 'ja_existe';
  return 'confirmar_email';
}

// Confirma o cadastro pelo código do e-mail (alternativa ao link: antivírus
// e pré-visualização de alguns provedores "gastam" o link de uso único antes
// da pessoa tocar nele). Quem valida é o servidor — nada é aceito aqui.
export async function verificarCodigoCadastro(email, codigo) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.verifyOtp({ email, token: codigo, type: 'signup' });
  if (error) throw error;
  return data.session;
}

// Código como a pessoa digitou ("123 456", "123-456") → só dígitos. O
// tamanho é configurável no Supabase (6 por padrão, até 10).
export function normalizarCodigo(texto) {
  const digitos = String(texto || '').replace(/\D/g, '');
  return digitos.length >= 6 && digitos.length <= 10 ? digitos : null;
}

// Espera entre envios do e-mail de confirmação — o Supabase recusa um novo
// envio para o mesmo e-mail antes de 60 s. Fica no localStorage (antes ficava
// só na memória e um F5 "zerava" a espera, gerando erro de limite). A chave
// guarda um resumo do e-mail, nunca o e-mail em si.
export const ESPERA_REENVIO_MS = 60_000;
const CHAVE_REENVIOS = 'bonotto_reenvio_confirmacao';

function resumoDoEmail(email) {
  let h = 5381;
  for (const c of String(email || '').trim().toLowerCase()) h = ((h * 33) ^ c.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

function lerReenvios(storage) {
  try {
    return JSON.parse(storage.getItem(CHAVE_REENVIOS) || '{}') || {};
  } catch {
    return {};
  }
}

export function registrarEnvioConfirmacao(email, agora = Date.now(), storage = globalThis.localStorage) {
  try {
    const mapa = lerReenvios(storage);
    // Só o que ainda está dentro da espera — o mapa não cresce para sempre.
    for (const [k, t] of Object.entries(mapa)) if (agora - t >= ESPERA_REENVIO_MS) delete mapa[k];
    mapa[resumoDoEmail(email)] = agora;
    storage.setItem(CHAVE_REENVIOS, JSON.stringify(mapa));
  } catch {
    // localStorage indisponível — o servidor continua aplicando o limite
  }
}

export function segundosParaReenviar(email, agora = Date.now(), storage = globalThis.localStorage) {
  try {
    const ultimo = lerReenvios(storage)[resumoDoEmail(email)];
    if (!ultimo) return 0;
    return Math.max(0, Math.ceil((ESPERA_REENVIO_MS - (agora - ultimo)) / 1000));
  } catch {
    return 0;
  }
}

// Erro que volta do link do e-mail no endereço (#error=…&error_code=…&
// error_description=…), ex.: link expirado ou já usado. Sem isto o app abria
// a tela de entrada sem dizer nada.
export function erroDoRetornoAuth(hash) {
  const texto = String(hash || '').replace(/^#\/?/, '');
  if (!/(^|&)error(_code|_description)?=/.test(texto)) return null;
  const p = new URLSearchParams(texto);
  return { code: p.get('error_code') || p.get('error') || '', message: p.get('error_description') || '' };
}

// Entrar / criar conta com o Google (2026-10-11). É o mesmo botão para os
// dois casos: o Supabase cria a conta na primeira vez. Volta para /app com a
// sessão no endereço (flowType 'implicit', ver supabaseClient.js). O destino
// é fixo — nunca vem da URL, para não virar redirecionamento aberto.
export async function signInWithGoogle() {
  const supabase = await getSupabase();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${location.origin}/app`, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw error;
}

// O que falta gravar numa conta criada pelo Google: o OAuth não leva o
// options.data do signUp, então o tipo de conta escolhido na LP (Home ou
// Business) e o nome ficariam vazios. Devolve o patch de user_metadata, ou
// null se não falta nada. Função pura — quem grava é completarCadastroOAuth.
export function patchCadastroOAuth(user, tipoEscolhido) {
  const usr = user?.user_metadata || {};
  const app = user?.app_metadata || {};
  if (!user || (app.provider || 'email') === 'email') return null;
  const patch = {};
  if (!usr.tipo_conta && !app.tipo) patch.tipo_conta = tipoEscolhido === 'business' ? 'business' : 'home';
  const nome = usr.full_name || usr.name;
  if (!usr.nome && nome) patch.nome = nome;
  return Object.keys(patch).length ? patch : null;
}

export async function completarCadastroOAuth(session, tipoEscolhido) {
  const patch = patchCadastroOAuth(session?.user, tipoEscolhido);
  if (!patch) return null;
  const supabase = await getSupabase();
  const { data, error } = await supabase.auth.updateUser({ data: patch });
  if (error) throw error;
  return { user: data.user, patch };
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
// Olha o `code` (supabase-js recente) e o texto (fluxos/versões antigas, e o
// error_description que volta no endereço depois do link do e-mail).
export function mensagemErroAuth(e) {
  const m = (e?.message || '').toLowerCase();
  const code = (e?.code || '').toLowerCase();
  const esperar = m.match(/after (\d+) seconds?/);
  if (esperar) return `Por segurança, espere ${esperar[1]} segundos antes de pedir outro e-mail.`;
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos. Se esqueceu a senha, use "Esqueci minha senha".';
  if (code === 'email_not_confirmed' || m.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar: toque no link que enviamos ou digite o código.';
  if (code === 'otp_expired' || m.includes('expired') || (m.includes('invalid') && /token|otp|link/.test(m)))
    return 'Código ou link expirado ou inválido. Peça um novo e-mail e use o mais recente.';
  if (m.includes('already confirmed') || m.includes('already been confirmed')) return 'Seu e-mail já está confirmado. É só entrar com e-mail e senha.';
  if (code.includes('rate_limit') || m.includes('rate limit')) return 'Muitas tentativas de envio de e-mail. Aguarde cerca de 1 hora e tente de novo.';
  if (m.includes('error sending')) return 'Não conseguimos enviar o e-mail agora (falha no serviço de e-mail). Tente "Reenviar" em alguns minutos.';
  if (code === 'user_already_exists' || code === 'email_exists' || m.includes('user already registered')) return 'Já existe uma conta com este e-mail. Entre ou use "Esqueci minha senha".';
  if (code === 'email_address_invalid' || (m.includes('email address') && m.includes('invalid'))) return 'Este e-mail não parece válido. Confira se digitou certo.';
  if (code === 'signup_disabled' || m.includes('signups not allowed')) return 'O cadastro está temporariamente fechado. Tente mais tarde.';
  if (m.includes('access_denied') || code === 'access_denied') return 'O acesso foi cancelado. Tente de novo.';
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

// Excluir a própria conta (LGPD). Pede a senha de novo antes — uma sessão
// esquecida aberta não basta para apagar tudo. Quem apaga é a função
// supabase/functions/excluir-conta (cancela o Stripe, apaga arquivos e conta).
export async function excluirMinhaConta(senha) {
  const supabase = await getSupabase();
  const { data: atual } = await supabase.auth.getUser();
  const email = atual?.user?.email;
  if (!email) throw new Error('Entre na sua conta de novo e tente outra vez.');
  const { error: erroSenha } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (erroSenha) throw new Error('Senha incorreta.');
  const { data, error } = await supabase.functions.invoke('excluir-conta', { method: 'POST' });
  if (error || !data?.ok) {
    let msg = data?.erro;
    try { msg = msg || (await error?.context?.json?.())?.erro; } catch { /* sem corpo */ }
    throw new Error(msg || 'Não consegui excluir agora. Tente de novo em alguns minutos.');
  }
  await supabase.auth.signOut().catch(() => {});
}

// Reenvia o e-mail de confirmação de cadastro. Recusa antes de ir ao servidor
// se a espera de 60 s ainda não passou (o servidor recusaria do mesmo jeito).
export async function reenviarConfirmacao(email) {
  const falta = segundosParaReenviar(email);
  if (falta > 0) throw new Error(`For security purposes, you can only request this after ${falta} seconds.`);
  const supabase = await getSupabase();
  const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: `${location.origin}/app` } });
  if (error) throw error;
  registrarEnvioConfirmacao(email);
}
