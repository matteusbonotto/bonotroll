// `node scripts/definir-senha.mjs <email>` — define a senha de uma conta do
// BNTT direto pela API admin do Supabase Auth (usa SB_SK do .env, que nunca
// sai desta máquina). Existe porque a migração para o projeto appbntt
// (2026-09) não tinha como copiar os hashes de senha do banco antigo — as
// contas foram recriadas com o MESMO UUID e uma senha temporária aleatória —
// e o app não tem tela de "trocar senha"/"esqueci a senha".
//
// A senha é digitada sem eco no terminal e nunca é gravada em lugar nenhum.
import readline from 'node:readline';
import { lerEnv, configPublica } from './env.mjs';

const email = process.argv[2];
if (!email) {
  console.error('Uso: node scripts/definir-senha.mjs <email>');
  process.exit(1);
}

const env = lerEnv();
const publica = configPublica(env);
if (!publica || !env.SB_SK) {
  console.error('Faltam SB_PROJ_ID/SB_PB/SB_SK no .env.');
  process.exit(1);
}
const admin = { apikey: env.SB_SK, Authorization: `Bearer ${env.SB_SK}`, 'Content-Type': 'application/json' };

// Um único readline para as duas perguntas (abrir um por pergunta perde a
// segunda resposta: o primeiro já consumiu o buffer da entrada). O eco é
// suprimido enquanto a pessoa digita — só o texto da pergunta aparece.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
rl._writeToOutput = () => {}; // nada do que é digitado aparece na tela
const linhas = rl[Symbol.asyncIterator]();
async function perguntarEscondido(pergunta) {
  process.stdout.write(pergunta);
  const { value } = await linhas.next();
  process.stdout.write('\n');
  return value ?? '';
}

const lista = await (await fetch(`${publica.url}/auth/v1/admin/users?per_page=1000`, { headers: admin })).json();
const usuario = (lista.users || []).find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!usuario) {
  console.error(`Nenhuma conta com o e-mail ${email} em ${publica.url}.`);
  process.exit(1);
}

const senha = await perguntarEscondido('Nova senha (mín. 8 caracteres): ');
const confirmacao = await perguntarEscondido('Repita a senha: ');
rl.close();
if (senha.length < 8) {
  console.error('Senha curta demais — nada foi alterado.');
  process.exit(1);
}
if (confirmacao !== senha) {
  console.error('As senhas não conferem — nada foi alterado.');
  process.exit(1);
}

const r = await fetch(`${publica.url}/auth/v1/admin/users/${usuario.id}`, {
  method: 'PUT',
  headers: admin,
  body: JSON.stringify({ password: senha }),
});
if (!r.ok) {
  console.error(`Falhou (${r.status}): ${await r.text()}`);
  process.exit(1);
}
console.log(`Senha de ${email} atualizada.`);
