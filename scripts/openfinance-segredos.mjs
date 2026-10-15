// Envia os segredos do Open Finance (Pluggy) do .env para a Edge Function
// "openfinance" no Supabase — sem nunca passar o valor na linha de comando
// (iria parar no histórico do shell / lista de processos): grava um
// arquivo temporário com permissão restrita, usa --env-file e apaga.
//
// .env (nunca versionado):
//   PLUGGY_CLIENT_ID     = "..."   (dashboard.pluggy.ai → Aplicação)
//   PLUGGY_CLIENT_SECRET = "..."
//   PLUGGY_USUARIOS      = "uuid-do-titular"   (auth.users.id; vírgula para mais de um)
//
// Uso: node scripts/openfinance-segredos.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { RAIZ, lerEnv } from './env.mjs';

const env = lerEnv();
const nomes = ['PLUGGY_CLIENT_ID', 'PLUGGY_CLIENT_SECRET', 'PLUGGY_USUARIOS'];
const faltando = nomes.filter((n) => !env[n]);
if (faltando.length) {
  console.error(`Faltam no .env: ${faltando.join(', ')}`);
  process.exit(1);
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!env.PLUGGY_USUARIOS.split(/[\s,;]+/).filter(Boolean).every((u) => uuid.test(u))) {
  console.error('PLUGGY_USUARIOS deve ter só ids de usuário (uuid) separados por vírgula.');
  process.exit(1);
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bntt-of-'));
const arquivo = path.join(dir, 'segredos.env');
try {
  fs.writeFileSync(arquivo, nomes.map((n) => `${n}=${env[n]}`).join('\n') + '\n', { mode: 0o600 });
  // No Windows o npx só roda via shell — aspas por causa do espaço no caminho
  // do usuário ("C:\Users\Nome Sobrenome\...").
  const win = process.platform === 'win32';
  const r = spawnSync('npx', ['supabase', 'secrets', 'set', '--env-file', win ? `"${arquivo}"` : arquivo], { cwd: RAIZ, stdio: 'inherit', shell: win });
  process.exitCode = r.status ?? 1;
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
if (process.exitCode === 0) console.log(`Segredos enviados: ${nomes.join(', ')} (valores não exibidos).`);
