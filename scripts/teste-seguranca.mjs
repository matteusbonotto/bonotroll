// Teste de invasão POR FORA (sem login, com a chave pública do site): tenta
// ler/escrever tabelas, chamar funções do banco e as Edge Functions.
// Esperado: tudo BLOQUEADO.   node scripts/teste-seguranca.mjs
// O teste COMO USUÁRIO LOGADO fica em supabase/testes/invasao-logado.sql
// (roda com: npx supabase db query --linked -f ...; desfaz tudo no final).
import { lerEnv, configPublica } from './env.mjs';
const { url, chave } = configPublica(lerEnv());
const h = { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' };
const tabelas = ['transactions', 'profiles', 'groups', 'group_members', 'fichas_saude', 'cofres', 'push_subscriptions', 'notifications', 'unidades', 'shopping_lists', 'categories'];
let falhas = 0;
const ok = (cond, txt) => { console.log(`${cond ? 'BLOQUEADO' : '*** ABERTO ***'}  ${txt}`); if (!cond) falhas++; };
for (const t of tabelas) {
  const r = await fetch(`${url}/rest/v1/${t}?select=*&limit=5`, { headers: h });
  const corpo = await r.text();
  ok(r.status >= 400 || corpo === '[]', `ler ${t} sem login → ${r.status} ${corpo.slice(0, 60)}`);
}
for (const [t, row] of [['group_members', { group_id: '00000000-0000-0000-0000-000000000000', profile_id: '00000000-0000-0000-0000-000000000000' }], ['transactions', { titulo: 'x', valor: 1 }], ['profiles', { id: '00000000-0000-0000-0000-000000000000', nome: 'x' }]]) {
  const r = await fetch(`${url}/rest/v1/${t}`, { method: 'POST', headers: h, body: JSON.stringify(row) });
  ok(r.status >= 400, `inserir em ${t} sem login → ${r.status}`);
}
for (const [fn, args] of [['bntt_plano_da_conta', { uid: '00000000-0000-0000-0000-000000000000' }], ['bntt_meu_plano', {}], ['create_group', { p_nome: 'x' }], ['join_group_by_code', { p_codigo: 'AAAA' }], ['definir_papel', { gid: '00000000-0000-0000-0000-000000000000', pid: '00000000-0000-0000-0000-000000000000', novo_papel: 'dono', nova_unidade: null }]]) {
  const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: h, body: JSON.stringify(args) });
  const corpo = await r.text();
  ok(r.status >= 400 || corpo === 'null', `RPC ${fn} sem login → ${r.status} ${corpo.slice(0, 70)}`);
}
// Edge functions sem credencial
for (const f of ['notify-scan', 'notify-payment', 'keepalive', 'stripe-webhook']) {
  const r = await fetch(`${url}/functions/v1/${f}`, { method: 'POST', headers: { apikey: chave, 'Content-Type': 'application/json' }, body: '{}' });
  ok(r.status >= 400, `função ${f} sem credencial → ${r.status}`);
}
// Anexos privados
const r = await fetch(`${url}/storage/v1/object/list/anexos`, { method: 'POST', headers: h, body: JSON.stringify({ prefix: '' }) });
const c = await r.text();
ok(r.status >= 400 || c === '[]', `listar anexos sem login → ${r.status} ${c.slice(0, 40)}`);
console.log(falhas ? `\n${falhas} BRECHA(S)` : '\nNenhuma brecha por fora.');
process.exitCode = falhas ? 1 : 0;
