// Armazenamento local do modo offline (2026-10-11): IndexedDB, UM banco por
// usuário (`bntt-offline-<uid>`), apagado no logout (ver offline.js).
//
// O que fica aqui: cópia das listas já carregadas (para abrir sem internet)
// e a fila de operações pendentes. O que NUNCA fica: documentos, fotos,
// PDFs, tokens de login (o supabase-js guarda a sessão dele, como sempre),
// chaves de API.
//
// Tudo é cifrado com AES-GCM por uma chave gerada no aparelho, NÃO
// extraível (mesmo padrão de js/services/cofre.js). Isso impede ler os
// dados copiando os arquivos do perfil do navegador sem o navegador, mas
// não protege contra código rodando na própria página — a defesa contra
// isso continua sendo a CSP do firebase.json. Validade: 30 dias.
const VERSAO_BANCO = 1;
const VERSAO_DADOS = 1; // subir quando o formato das linhas mudar → invalida o cache
export const VALIDADE_CACHE_MS = 30 * 24 * 60 * 60 * 1000;

const nomeDoBanco = (uid) => `bntt-offline-${uid}`;

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function abrir(uid) {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(nomeDoBanco(uid), VERSAO_BANCO);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('chave')) db.createObjectStore('chave');
      if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache', { keyPath: 'chave' });
      if (!db.objectStoreNames.contains('fila')) db.createObjectStore('fila', { keyPath: 'id' });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function loja(db, nome, modo = 'readonly') {
  return db.transaction(nome, modo).objectStore(nome);
}

async function chaveDoAparelho(db) {
  const existente = await req(loja(db, 'chave').get('aes'));
  if (existente) return existente;
  const nova = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await req(loja(db, 'chave', 'readwrite').put(nova, 'aes'));
  return nova;
}

async function cifrar(chave, valor) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, new TextEncoder().encode(JSON.stringify(valor)));
  return { iv, dados };
}

async function decifrar(chave, { iv, dados }) {
  const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, chave, dados);
  return JSON.parse(new TextDecoder().decode(claro));
}

export async function abrirArmazenamento(uid) {
  if (!uid || typeof indexedDB === 'undefined' || !globalThis.crypto?.subtle) return null;
  const db = await abrir(uid);
  const chave = await chaveDoAparelho(db);

  return {
    async lerCache(nome) {
      const reg = await req(loja(db, 'cache').get(nome));
      if (!reg || reg.versao !== VERSAO_DADOS || Date.now() - reg.salvoEm > VALIDADE_CACHE_MS) return null;
      try {
        return { valor: await decifrar(chave, reg.cifra), salvoEm: reg.salvoEm };
      } catch {
        return null; // chave trocada/dado corrompido: trata como sem cache
      }
    },
    async gravarCache(nome, valor) {
      const cifra = await cifrar(chave, valor);
      await req(loja(db, 'cache', 'readwrite').put({ chave: nome, versao: VERSAO_DADOS, salvoEm: Date.now(), cifra }));
    },
    fila: {
      async listar() {
        const regs = await req(loja(db, 'fila').getAll());
        const ops = [];
        for (const r of regs) {
          try {
            ops.push(await decifrar(chave, r.cifra));
          } catch { /* ignora registro ilegível */ }
        }
        return ops;
      },
      async gravar(op) {
        await req(loja(db, 'fila', 'readwrite').put({ id: op.id, cifra: await cifrar(chave, op) }));
      },
      async remover(id) {
        await req(loja(db, 'fila', 'readwrite').delete(id));
      },
    },
    fechar() {
      db.close();
    },
  };
}

export function apagarArmazenamento(uid) {
  if (!uid || typeof indexedDB === 'undefined') return Promise.resolve();
  return new Promise((resolve) => {
    const r = indexedDB.deleteDatabase(nomeDoBanco(uid));
    r.onsuccess = r.onerror = r.onblocked = () => resolve();
  });
}
