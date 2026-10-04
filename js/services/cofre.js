// Cofre da família — criptografia ponta a ponta das fichas de saúde (Palm
// Business, fase 8, 2026-10-04). O servidor só guarda texto embaralhado.
//
// Modelo (padrão de gerenciador de senhas):
// - uma CHAVE DE DADOS aleatória (AES-256-GCM) cifra as fichas;
// - ela vai ao servidor só "embrulhada" duas vezes: pela SENHA DA FAMÍLIA e
//   por um CÓDIGO DE RECUPERAÇÃO mostrado uma única vez (PBKDF2-SHA256);
// - cada aparelho, depois de desbloquear, guarda a chave em IndexedDB como
//   NÃO extraível — numa emergência a ficha abre sem digitar a senha.
// Perder a senha E o código = perder as fichas (ninguém, nem o Palm, recupera).
import { isDemoMode } from '../data/config.js';
import { mockDb } from '../data/mockDb.js';
import { getSupabase } from '../data/supabaseClient.js';

const ITERACOES = 310000;
const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const deB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

function aleatorio(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

// Código de recuperação legível: 6 grupos de 4 (sem 0/O/1/I).
export function gerarCodigoRecuperacao() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = aleatorio(24);
  const letras = [...bytes].map((b) => alfabeto[b % alfabeto.length]).join('');
  return letras.match(/.{4}/g).join('-');
}

function normalizarCodigo(codigo) {
  return (codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function derivarChaveEmbrulho(segredo, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(segredo), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERACOES, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['wrapKey', 'unwrapKey'],
  );
}

async function embrulhar(chaveDados, segredo) {
  const salt = aleatorio(16);
  const iv = aleatorio(12);
  const kek = await derivarChaveEmbrulho(segredo, salt);
  const embrulhada = await crypto.subtle.wrapKey('raw', chaveDados, kek, { name: 'AES-GCM', iv });
  return `${b64(salt)}.${b64(iv)}.${b64(embrulhada)}`;
}

async function desembrulhar(pacote, segredo, extraivel = false) {
  const [salt, iv, dados] = pacote.split('.').map(deB64);
  const kek = await derivarChaveEmbrulho(segredo, salt);
  return crypto.subtle.unwrapKey('raw', dados, kek, { name: 'AES-GCM', iv }, { name: 'AES-GCM', length: 256 }, extraivel, ['encrypt', 'decrypt']);
}

export async function cifrar(chave, objeto) {
  const iv = aleatorio(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, enc.encode(JSON.stringify(objeto)));
  return `v1.${b64(iv)}.${b64(ct)}`;
}

export async function decifrar(chave, texto) {
  const [versao, iv, ct] = (texto || '').split('.');
  if (versao !== 'v1') throw new Error('Formato de ficha desconhecido.');
  const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(iv) }, chave, deB64(ct));
  return JSON.parse(dec.decode(claro));
}

// Cria as duas "embalagens" da chave de dados (puro, testável).
export async function criarMaterialDoCofre(senha) {
  const chaveDados = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const codigo = gerarCodigoRecuperacao();
  return {
    codigo,
    chaveDados,
    pela_senha: await embrulhar(chaveDados, senha),
    pelo_codigo: await embrulhar(chaveDados, normalizarCodigo(codigo)),
  };
}

export async function abrirComSenha(cofre, senha) {
  try {
    return await desembrulhar(cofre.pela_senha, senha);
  } catch {
    throw new Error('Senha da família incorreta.');
  }
}

export async function abrirComCodigo(cofre, codigo) {
  try {
    return await desembrulhar(cofre.pelo_codigo, normalizarCodigo(codigo));
  } catch {
    throw new Error('Código de recuperação incorreto.');
  }
}

// Troca a senha: re-embrulha a mesma chave (as fichas não mudam).
export async function reembrulharComNovaSenha(cofre, codigoOuSenhaAtual, novaSenha, viaCodigo = false) {
  const pacote = viaCodigo ? cofre.pelo_codigo : cofre.pela_senha;
  const segredo = viaCodigo ? normalizarCodigo(codigoOuSenhaAtual) : codigoOuSenhaAtual;
  const extraivel = await desembrulhar(pacote, segredo, true).catch(() => {
    throw new Error(viaCodigo ? 'Código de recuperação incorreto.' : 'Senha atual incorreta.');
  });
  return embrulhar(extraivel, novaSenha);
}

// ── Persistência do cofre (1 por grupo; sem grupo, 1 por pessoa) ─────────
export async function buscarCofre({ ownerId, groupId }) {
  if (isDemoMode()) {
    const rows = await mockDb.list('cofres', (c) => (groupId ? c.group_id === groupId : c.owner_id === ownerId && !c.group_id));
    return rows[0] || null;
  }
  const supabase = await getSupabase();
  let q = supabase.from('cofres').select('*').limit(1);
  q = groupId ? q.eq('group_id', groupId) : q.eq('owner_id', ownerId).is('group_id', null);
  const { data, error } = await q;
  if (error) throw error;
  return data?.[0] || null;
}

export async function salvarCofre({ ownerId, groupId, pela_senha, pelo_codigo }) {
  const row = { owner_id: ownerId, group_id: groupId ?? null, pela_senha, pelo_codigo };
  if (isDemoMode()) return mockDb.insert('cofres', row);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('cofres').insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function atualizarSenhaDoCofre(id, pela_senha) {
  if (isDemoMode()) return mockDb.update('cofres', id, { pela_senha });
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('cofres').update({ pela_senha }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ── Chave aberta neste aparelho (IndexedDB, não extraível) ───────────────
const BANCO = 'palm-cofre';
function abrirBanco() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('chaves');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function lembrarChaveNoAparelho(cofreId, chave) {
  try {
    // Re-importa como NÃO extraível antes de guardar (se veio extraível da criação).
    let guardar = chave;
    if (chave.extractable) {
      const bruta = await crypto.subtle.exportKey('raw', chave);
      guardar = await crypto.subtle.importKey('raw', bruta, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    }
    const db = await abrirBanco();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('chaves', 'readwrite');
      tx.objectStore('chaves').put(guardar, cofreId);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    return guardar;
  } catch {
    return chave; // sem IndexedDB: vale só nesta sessão
  }
}

export async function chaveDoAparelho(cofreId) {
  try {
    const db = await abrirBanco();
    return await new Promise((resolve) => {
      const req = db.transaction('chaves').objectStore('chaves').get(cofreId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function esquecerChaveDoAparelho(cofreId) {
  try {
    const db = await abrirBanco();
    db.transaction('chaves', 'readwrite').objectStore('chaves').delete(cofreId);
  } catch {
    /* nada a apagar */
  }
}
