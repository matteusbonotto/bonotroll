// Open Finance: cliente do navegador (js/services/openFinance.js) com fetch
// simulado — nenhuma chamada real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chamarOpenFinance, FalhaOpenFinance, paraPlanilha, COLUNAS_OPEN_FINANCE } from '../../js/services/openFinance.js';
import { IMPORT_TARGETS } from '../../js/services/csvImport.js';

const deps = (status, corpo) => {
  const d = {
    demo: false, url: 'https://x.supabase.co', apikey: 'pub', token: async () => 'tok',
    fetch: async (url, init) => { d.visto = { url, init }; return { status, ok: status < 300, json: async () => corpo }; },
  };
  return d;
};

test('colunas do Open Finance existem no importador de transações', () => {
  const keys = IMPORT_TARGETS.transacoes.fields.map((f) => f.key);
  for (const c of COLUNAS_OPEN_FINANCE) assert.ok(keys.includes(c), c);
});

test('chamada leva token e ação; nunca credencial da Pluggy', async () => {
  const d = deps(200, { ok: true, conexoes: [] });
  await chamarOpenFinance('status', {}, d);
  assert.equal(d.visto.url, 'https://x.supabase.co/functions/v1/openfinance');
  assert.equal(d.visto.init.headers.authorization, 'Bearer tok');
  assert.deepEqual(JSON.parse(d.visto.init.body), { acao: 'status' });
});

test('erros viram FalhaOpenFinance com mensagem clara', async () => {
  await assert.rejects(chamarOpenFinance('status', {}, deps(403, { ok: false, codigo: 'of_nao_liberado' })), (e) => e instanceof FalhaOpenFinance && e.codigo === 'of_nao_liberado');
  await assert.rejects(chamarOpenFinance('status', {}, deps(404, null)), (e) => e.codigo === 'funcao_ausente');
  await assert.rejects(chamarOpenFinance('status', {}, { ...deps(200, {}), token: async () => null }), (e) => e.codigo === 'sessao');
});

test('paraPlanilha deixa de fora o que já foi importado e mantém externo_id', () => {
  const r = paraPlanilha([
    { externo_id: 'pluggy:a', tipo: 'saida', titulo: 'A', valor: '1.00', ja_importada: true },
    { externo_id: 'pluggy:b', tipo: 'entrada', titulo: 'B', valor: '2.00', ja_importada: false },
  ]);
  assert.equal(r.jaImportadas, 1);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].externo_id, 'pluggy:b');
  assert.equal(r.rows[0].titulo, 'B');
  assert.deepEqual(r.headers, COLUNAS_OPEN_FINANCE);
});
