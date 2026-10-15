// Open Finance (Pluggy): núcleo da Edge Function com fetch simulado — nenhuma
// chamada real à Pluggy aqui.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ErroOpenFinance, criarClientePluggy, normalizarTransacao, resumoConta, resumoItem, usuariosPermitidos, validarPedido,
} from '../../supabase/functions/_shared/openfinanceNucleo.js';

const ITEM = '0b7f3a1e-2c4d-4e5f-8a9b-1c2d3e4f5a6b';
const erroCom = (codigo) => (e) => e instanceof ErroOpenFinance && e.codigo === codigo;

test('pedido: só ações conhecidas e itemId em formato UUID', () => {
  assert.throws(() => validarPedido(null), erroCom('pedido_invalido'));
  assert.throws(() => validarPedido([]), erroCom('pedido_invalido'));
  assert.throws(() => validarPedido({ acao: 'pagar' }), erroCom('acao_desconhecida'));
  assert.throws(() => validarPedido({ acao: '__proto__' }), erroCom('acao_desconhecida'));
  assert.throws(() => validarPedido({ acao: 'vincular', itemId: '../accounts' }), erroCom('item_invalido'));
  assert.throws(() => validarPedido({ acao: 'vincular', itemId: `${ITEM}?x=1` }), erroCom('item_invalido'));
  assert.deepEqual(validarPedido({ acao: 'vincular', itemId: ITEM.toUpperCase(), apelido: '  Nubank  ' }), { acao: 'vincular', itemId: ITEM, apelido: 'Nubank' });
  assert.deepEqual(validarPedido({ acao: 'status', extra: 1 }), { acao: 'status' });
});

test('pedido: período validado (formato, ordem, futuro, tamanho)', () => {
  const hoje = '2026-10-15';
  assert.throws(() => validarPedido({ acao: 'transacoes', de: '2026-02-30', ate: '2026-03-01' }, hoje), erroCom('periodo_invalido'));
  assert.throws(() => validarPedido({ acao: 'transacoes', de: '2026-10-10', ate: '2026-10-01' }, hoje), erroCom('periodo_invalido'));
  assert.throws(() => validarPedido({ acao: 'transacoes', de: '2026-10-10', ate: '2026-10-16' }, hoje), erroCom('periodo_invalido'));
  assert.throws(() => validarPedido({ acao: 'transacoes', de: '2025-01-01', ate: '2026-10-01' }, hoje), erroCom('periodo_longo'));
  assert.throws(() => validarPedido({ acao: 'transacoes', de: "2026-01-01' or 1=1", ate: '2026-10-01' }, hoje), erroCom('periodo_invalido'));
  assert.deepEqual(validarPedido({ acao: 'transacoes', de: '2026-09-01', ate: '2026-10-15' }, hoje), { acao: 'transacoes', de: '2026-09-01', ate: '2026-10-15' });
});

test('lista de liberados: só uuids; vazia = ninguém', () => {
  assert.equal(usuariosPermitidos('').size, 0);
  assert.equal(usuariosPermitidos(undefined).size, 0);
  const s = usuariosPermitidos(`${ITEM.toUpperCase()}, lixo ;*`);
  assert.deepEqual([...s], [ITEM]);
});

test('normalização: débito/crédito, cartão pendente, parcelas, texto limpo', () => {
  const conta = { type: 'BANK', name: 'Conta Corrente' };
  const saida = normalizarTransacao({ id: 't1', date: '2026-10-01T03:00:00.000Z', description: ' Padaria\u0000  Pão\n', amount: -12.345, type: 'DEBIT', status: 'POSTED', merchant: { businessName: 'Padaria LTDA' } }, conta);
  assert.equal(saida.externo_id, 'pluggy:t1');
  assert.equal(saida.tipo, 'saida');
  assert.equal(saida.titulo, 'Padaria Pão');
  assert.equal(saida.valor, '12.35');
  assert.equal(saida.data_pagamento, '2026-10-01');
  assert.equal(saida.status, 'pago');
  assert.equal(saida.empresa_servico, 'Padaria LTDA');

  const entrada = normalizarTransacao({ id: 't2', date: '2026-10-02', description: 'PIX', amount: 100, type: 'CREDIT' }, conta);
  assert.equal(entrada.tipo, 'entrada');

  const cartao = normalizarTransacao({ id: 't3', date: '2026-10-03', description: 'Loja', amount: 50, type: 'DEBIT', creditCardMetadata: { installmentNumber: 2, totalInstallments: 6 } }, { type: 'CREDIT', name: 'Cartão X' });
  assert.equal(cartao.tipo, 'saida');
  assert.equal(cartao.status, 'pendente');
  assert.equal(cartao.data_pagamento, '');
  assert.equal(cartao.parcela_atual, '2');
  assert.equal(cartao.parcela_total, '6');
  assert.equal(cartao.observacoes, 'Open Finance · Cartão X');

  const pendente = normalizarTransacao({ id: 't4', date: '2026-10-04', amount: -5, type: 'DEBIT', status: 'PENDING' }, conta);
  assert.equal(pendente.status, 'pendente');
  assert.equal(pendente.titulo, 'Saída');

  assert.equal(normalizarTransacao({ id: 't5', date: '2026-10-04', amount: 0 }, conta), null);
  assert.equal(normalizarTransacao({ id: 't6', date: 'ontem', amount: 1 }, conta), null);
  assert.equal(normalizarTransacao({ date: '2026-10-04', amount: 1 }, conta), null);
});

test('resumos não expõem número completo nem logo fora de https', () => {
  assert.equal(resumoConta({ id: 'a', number: '0001/12345-6', type: 'BANK', balance: 10 }).final, '45-6');
  assert.equal(resumoItem({ connector: { name: 'Banco', imageUrl: 'javascript:alert(1)' } }).logo, '');
});

function fetchFalso(rotas) {
  const chamadas = [];
  const fn = async (url, init = {}) => {
    chamadas.push({ url, init });
    const caminho = url.replace('https://api.pluggy.ai', '');
    const rota = rotas.find(([prefixo]) => caminho.startsWith(prefixo));
    const [status, corpo] = rota ? rota[1](caminho, init) : [404, {}];
    return { ok: status >= 200 && status < 300, status, json: async () => corpo };
  };
  fn.chamadas = chamadas;
  return fn;
}

test('cliente: reaproveita a apiKey, só faz GET, segue o cursor sem sair do host', async () => {
  const fetch = fetchFalso([
    ['/auth', () => [200, { apiKey: 'k1' }]],
    ['/accounts', () => [200, { results: [{ id: 'c1' }] }]],
    ['/v2/transactions?accountId=c1&dateFrom', () => [200, { results: [{ id: 'a' }], next: '?accountId=c1&after=xyz' }]],
    ['/v2/transactions?accountId=c1&after=xyz', () => [200, { results: [{ id: 'b' }], next: 'https://evil.example/?x' }]],
  ]);
  const cli = criarClientePluggy({ clientId: 'id', clientSecret: 'seg', fetch });
  assert.equal((await cli.contas(ITEM)).length, 1);
  const r = await cli.transacoes('c1', '2026-10-01', '2026-10-15');
  assert.deepEqual(r.transacoes.map((t) => t.id), ['a', 'b']);
  assert.equal(r.truncado, false);
  assert.equal(fetch.chamadas.filter((c) => c.url.endsWith('/auth')).length, 1);
  for (const c of fetch.chamadas.filter((c) => !c.url.endsWith('/auth'))) {
    assert.equal(c.init.method, undefined);
    assert.equal(c.init.headers['X-API-KEY'], 'k1');
    assert.ok(c.url.startsWith('https://api.pluggy.ai/'));
  }
});

test('cliente: credencial recusada, 429 e item inexistente viram erros claros', async () => {
  const recusa = criarClientePluggy({ clientId: 'x', clientSecret: 'y', fetch: fetchFalso([['/auth', () => [401, {}]]]) });
  await assert.rejects(recusa.contas(ITEM), erroCom('pluggy_credencial'));

  const limite = criarClientePluggy({ clientId: 'x', clientSecret: 'y', fetch: fetchFalso([['/auth', () => [200, { apiKey: 'k' }]], ['/accounts', () => [429, {}]]]) });
  await assert.rejects(limite.contas(ITEM), erroCom('pluggy_limite'));

  const sem = criarClientePluggy({ clientId: 'x', clientSecret: 'y', fetch: fetchFalso([['/auth', () => [200, { apiKey: 'k' }]], ['/items', () => [404, {}]]]) });
  assert.equal(await sem.item(ITEM), null);
});
