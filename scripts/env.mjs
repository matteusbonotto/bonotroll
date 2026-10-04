// Leitura do .env e separação PÚBLICO × SECRETO — única fonte de configuração
// do frontend para o dev server (scripts/dev-server.mjs) e para o build de
// produção (scripts/build.mjs). O navegador nunca lê o .env direto: só os
// valores PÚBLICOS abaixo são injetados em js/data/config.js, e só nas cópias
// servidas/geradas — o arquivo-fonte continua com os placeholders (que ligam
// o modo demonstração sozinho, ver js/data/config.js::isDemoMode).
//
// Classificação das variáveis do .env (nomes, nunca valores):
//   SB_PROJ_ID          PÚBLICO — ref do projeto Supabase, monta a URL da API
//   SB_PB               PÚBLICO — publishable key (sb_publishable_…), feita pra ir ao navegador; RLS protege os dados
//   URL_BASE_FIREBASE   PÚBLICO — URL do Firebase Hosting (só documentação/checagem, o app usa caminhos relativos)
//   FIREBASE_API_KEY    PÚBLICO — não usada: o app só usa o Firebase Hosting, nenhum SDK do Firebase no navegador
//   SB_SK               SECRETO — secret key (sb_secret_…), equivale à service_role: NUNCA no frontend
//   STRIP_TOKEN         SECRETO — token do Stripe (futuro billing): NUNCA no frontend
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const VARIAVEIS_SECRETAS = ['SB_SK', 'STRIP_TOKEN'];

// Aceita tanto CHAVE=valor quanto CHAVE = "valor" (o .env atual usa espaços e
// aspas, formato que o `source` do shell não entende).
export function lerEnv(arquivo = path.join(RAIZ, '.env')) {
  const env = {};
  if (fs.existsSync(arquivo)) {
    for (const linha of fs.readFileSync(arquivo, 'utf8').split(/\r?\n/)) {
      const m = linha.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  // Variável de ambiente real (ex.: CI) tem prioridade sobre o arquivo.
  for (const nome of ['SB_PROJ_ID', 'SB_PB', 'SB_SK', 'STRIP_TOKEN']) {
    if (process.env[nome]) env[nome] = process.env[nome];
  }
  return env;
}

// Decodifica o payload de um JWT legado (anon/service_role) sem validar
// assinatura — só pra saber o "role" e barrar service_role.
function roleDoJwt(chave) {
  const partes = chave.split('.');
  if (partes.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')).role ?? null;
  } catch {
    return null;
  }
}

// Devolve { url, chave } públicos, ou null se o .env não tiver o necessário
// (aí o app fica em modo demonstração). Lança erro se a chave configurada
// como pública for, na verdade, uma chave privilegiada.
export function configPublica(env = lerEnv()) {
  const ref = env.SB_PROJ_ID;
  const chave = env.SB_PB;
  if (!ref || !chave) return null;
  if (!/^[a-z0-9]{20}$/.test(ref)) throw new Error('SB_PROJ_ID não parece um ref de projeto Supabase (20 caracteres a-z0-9).');
  if (chave.startsWith('sb_secret_')) throw new Error('SB_PB contém uma SECRET key (sb_secret_…) — ela nunca pode ir para o frontend.');
  if (roleDoJwt(chave) === 'service_role') throw new Error('SB_PB contém uma chave service_role — ela nunca pode ir para o frontend.');
  if (!chave.startsWith('sb_publishable_') && roleDoJwt(chave) !== 'anon') {
    throw new Error('SB_PB não é nem uma publishable key (sb_publishable_…) nem uma anon key legada.');
  }
  return { url: `https://${ref}.supabase.co`, chave };
}

// Valores secretos presentes no .env — usados pela varredura do dist/ pra
// garantir que nenhum deles vazou para os artefatos publicados.
export function valoresSecretos(env = lerEnv()) {
  return VARIAVEIS_SECRETAS.map((nome) => [nome, env[nome]]).filter(([, v]) => v && v.length >= 8);
}

// Troca os placeholders de js/data/config.js pelos valores públicos.
export function injetarConfig(fonteConfigJs, publica) {
  if (!publica) return fonteConfigJs;
  const saida = fonteConfigJs
    .replace(/export const SUPABASE_URL = '[^']*';/, `export const SUPABASE_URL = ${JSON.stringify(publica.url)};`)
    .replace(/export const SUPABASE_ANON_KEY = '[^']*';/, `export const SUPABASE_ANON_KEY = ${JSON.stringify(publica.chave)};`);
  if (!saida.includes(publica.url) || !saida.includes(publica.chave)) {
    throw new Error('Não achei as constantes SUPABASE_URL/SUPABASE_ANON_KEY em js/data/config.js para injetar a configuração.');
  }
  return saida;
}
