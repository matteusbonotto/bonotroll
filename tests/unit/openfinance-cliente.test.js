// Open Finance: cliente do navegador (js/services/openFinance.js) com fetch
// simulado — nenhuma chamada real.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chamarOpenFinance, FalhaOpenFinance, paraPlanilha, resumoSaldos, COLUNAS_OPEN_FINANCE } from '../../js/services/openFinance.js';
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

test('resumoSaldos: soma só contas em BRL; cartão é fatura, fica à parte; sem saldo é ignorado', () => {
  const r = resumoSaldos([
    { item_id: 'i1', banco: 'Nubank', apelido: null, contas: [
      { id: 'a', nome: 'Conta', tipo: 'conta', final: '1234', saldo: 1000.1, moeda: 'BRL' },
      { id: 'b', nome: 'Cartão', tipo: 'cartao', final: '9999', saldo: 350.5, moeda: 'BRL' },
      { id: 'c', nome: 'Sem saldo', tipo: 'conta', saldo: null },
    ] },
    { item_id: 'i2', banco: 'Itaú', apelido: 'Salário', contas: [
      { id: 'd', nome: 'Corrente', tipo: 'conta', saldo: 200.2, moeda: 'BRL' },
      { id: 'e', nome: 'Global', tipo: 'conta', saldo: 50, moeda: 'USD' },
    ] },
  ]);
  assert.equal(r.contas.length, 4);
  assert.equal(r.totalContas, 1200.3);
  assert.equal(r.totalCartoes, 350.5);
  assert.equal(r.contas.find((c) => c.nome === 'Corrente').banco, 'Salário');
  assert.deepEqual(resumoSaldos(undefined), { contas: [], bancos: [], totalContas: 0, totalCartoes: 0 });
  // Um grupo por banco, com saldo em conta e fatura separados.
  assert.deepEqual(r.bancos.map((b) => [b.banco, b.total, b.fatura]), [['Nubank', 1000.1, 350.5], ['Salário', 200.2, 0]]);
});

test('resumoSaldos: no Meu Pluggy o banco vem da conta, nunca "MeuPluggy"', () => {
  const r = resumoSaldos([{ item_id: 'i', banco: 'Nubank · Itaú', apelido: null, logo: '', contas: [
    { id: 'a', banco: 'Nubank', logo: 'https://x/nu.svg', nome: 'Conta', tipo: 'conta', saldo: 10, moeda: 'BRL' },
    { id: 'b', banco: 'Itaú', logo: '', nome: 'Corrente', tipo: 'conta', saldo: 5, moeda: 'BRL' },
  ] }]);
  assert.deepEqual(r.bancos.map((b) => [b.banco, b.logo, b.total]), [['Nubank', 'https://x/nu.svg', 10], ['Itaú', '', 5]]);
});
