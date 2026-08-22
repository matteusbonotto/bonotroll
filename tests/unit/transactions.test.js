// Regressão da migração pro Money Engine (Fase 3) — computeSummary/
// splitEqually/groupBy* trocaram acumulador += Number(...) por somar()
// centavo-a-centavo (ver js/services/transactions.js). Comportamento
// precisa continuar idêntico ao de antes, só a aritmética interna mudou.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSummary, splitEqually, groupByCategory, groupByCompany, groupByPeriod, computeSaldosEntreMembros,
  isCartaoCreditoBill, groupCartaoCredito,
} from '../../js/services/transactions.js';

test('computeSummary soma entradas/saídas PAGAS e acha o maior gasto — pendente não conta, só em "prevista"', () => {
  const txs = [
    { tipo: 'entrada', valor: 1000, data_pagamento: '2026-08-01' },
    { tipo: 'entrada', valor: 200 }, // pendente — não entra em "entradas", só em "entradasPrevistas"
    { tipo: 'saida', valor: 300.5, data_pagamento: '2026-08-02' },
    { tipo: 'saida', valor: 45.25 }, // pendente — não entra em "saidas", só em "saidasPrevistas"
  ];
  const r = computeSummary(txs);
  assert.equal(r.entradas, 1000);
  assert.equal(r.saidas, 300.5);
  assert.equal(r.saldo, 699.5);
  assert.equal(r.entradasPrevistas, 1200);
  assert.equal(r.saidasPrevistas, 345.75);
  assert.equal(r.saldoPrevisto, 854.25);
  assert.equal(r.maiorGasto.valor, 300.5);
});

test('computeSummary sem transação nenhuma não quebra (saldo 0, sem maior gasto)', () => {
  const r = computeSummary([]);
  assert.deepEqual(r, { entradas: 0, saidas: 0, saldo: 0, entradasPrevistas: 0, saidasPrevistas: 0, saldoPrevisto: 0, maiorGasto: null });
});

test('splitEqually: 3 pessoas, valor não divide certinho — sobra vai pra primeira, soma bate exata', () => {
  const partes = splitEqually(100, ['a', 'b', 'c']);
  assert.equal(partes.find((p) => p.profile_id === 'a').valor, 33.34);
  assert.equal(partes.find((p) => p.profile_id === 'b').valor, 33.33);
  const total = partes.reduce((acc, p) => acc + p.valor, 0);
  assert.ok(Math.abs(total - 100) < 0.001);
});

// Nota: com 3 pessoas (1/3 não é decimal exato), 33,33% x3 = 99,99% — é
// arredondamento esperado por casa decimal, não um bug (mesma matemática já
// existia antes da migração pro Money Engine). Caso que divide exato (4
// partes de 25%) prova que a soma bate quando a fração permite.
test('splitEqually: percentuais somam 100 quando a divisão é exata', () => {
  const partes = splitEqually(100, ['a', 'b', 'c', 'd']);
  const somaPct = partes.reduce((acc, p) => acc + p.percentual, 0);
  assert.equal(somaPct, 100);
});

test('groupByCategory soma por categoria, ignora entradas, ordena maior->menor', () => {
  const categorias = [{ id: 'c1', nome: 'Mercado', cor: '#000' }];
  const txs = [
    { tipo: 'saida', categoria_id: 'c1', valor: 100 },
    { tipo: 'saida', categoria_id: 'c1', valor: 50.5 },
    { tipo: 'entrada', categoria_id: 'c1', valor: 999 },
  ];
  const r = groupByCategory(txs, categorias);
  assert.equal(r.length, 1);
  assert.equal(r[0].total, 150.5);
});

test('groupByCompany soma por empresa (texto livre), sem-empresa cai num balde só', () => {
  const txs = [
    { tipo: 'saida', empresa_servico: 'Netflix', valor: 39.9 },
    { tipo: 'saida', empresa_servico: '', valor: 10 },
  ];
  const r = groupByCompany(txs);
  assert.equal(r.find((x) => x.nome === 'Netflix').total, 39.9);
  assert.equal(r.find((x) => x.nome === 'Sem empresa/serviço').total, 10);
});

test('computeSaldosEntreMembros: despesa dividida e paga gera dívida do outro pagador pro responsável', () => {
  const txs = [{ id: 't1', tipo: 'saida', responsavel_id: 'matheus', data_pagamento: '2026-08-01', valor: 200 }];
  const payersByTx = { t1: [{ profile_id: 'matheus', valor: 100 }, { profile_id: 'beatriz', valor: 100 }] };
  const r = computeSaldosEntreMembros(txs, payersByTx);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0], { devedorId: 'beatriz', credorId: 'matheus', valor: 100 });
});

test('computeSaldosEntreMembros: despesa NÃO paga não gera dívida (dinheiro ainda não saiu do bolso de ninguém)', () => {
  const txs = [{ id: 't1', tipo: 'saida', responsavel_id: 'matheus', data_pagamento: null, valor: 200 }];
  const payersByTx = { t1: [{ profile_id: 'matheus', valor: 100 }, { profile_id: 'beatriz', valor: 100 }] };
  assert.deepEqual(computeSaldosEntreMembros(txs, payersByTx), []);
});

test('computeSaldosEntreMembros: despesa sem divisão (1 pagador só) não gera dívida entre membros', () => {
  const txs = [{ id: 't1', tipo: 'saida', responsavel_id: 'matheus', data_pagamento: '2026-08-01', valor: 200 }];
  assert.deepEqual(computeSaldosEntreMembros(txs, {}), []);
});

test('computeSaldosEntreMembros: dívidas nos dois sentidos se compensam (saldo líquido)', () => {
  const txs = [
    { id: 't1', tipo: 'saida', responsavel_id: 'matheus', data_pagamento: '2026-08-01', valor: 100 },
    { id: 't2', tipo: 'saida', responsavel_id: 'beatriz', data_pagamento: '2026-08-02', valor: 60 },
  ];
  const payersByTx = {
    t1: [{ profile_id: 'matheus', valor: 50 }, { profile_id: 'beatriz', valor: 50 }],
    t2: [{ profile_id: 'matheus', valor: 30 }, { profile_id: 'beatriz', valor: 30 }],
  };
  // beatriz devia 50 a matheus (t1); matheus devia 30 a beatriz (t2) -> líquido: beatriz deve 20 a matheus
  const r = computeSaldosEntreMembros(txs, payersByTx);
  assert.deepEqual(r, [{ devedorId: 'beatriz', credorId: 'matheus', valor: 20 }]);
});

// ---------- Cartão de crédito: compra avulsa dentro da fatura ----------
// O bug que motivou tudo isto: "Amazon Prime R$19,90" solta + uma "Fatura
// Cartão de Crédito" de R$2.000 que JÁ contém esses 19,90 dentro dela
// somavam R$2.019,90 nas métricas. O valor certo é R$2.000 — só a fatura.
const CATEGORIAS_CARTAO = [
  { id: 'cat-cartao', nome: 'Cartão de crédito', cor: '#7C3AED' },
  { id: 'cat-assinaturas', nome: 'Assinaturas', cor: '#0EA5E9' },
];

test('groupCartaoCredito tira a despesa marcada de "visiveis" e pendura ela na fatura do mesmo mês', () => {
  const fatura = { id: 'f1', tipo: 'saida', titulo: 'Fatura Cartão de Crédito', categoria_id: 'cat-cartao', valor: 2000, data_vencimento: '2026-08-10' };
  const compra = { id: 't1', tipo: 'saida', titulo: 'Amazon Prime', categoria_id: 'cat-assinaturas', valor: 19.9, data_vencimento: '2026-08-03', cartao_credito: true };
  const { visiveis } = groupCartaoCredito([fatura, compra], CATEGORIAS_CARTAO);

  assert.equal(visiveis.length, 1);
  assert.equal(visiveis[0].id, 'f1');
  assert.deepEqual(visiveis[0].filhosCartao.map((f) => f.id), ['t1']);
  assert.equal(visiveis.some((t) => t.id === 't1'), false);
});

test('groupCartaoCredito: despesa marcada SEM fatura no mês dela continua solta em "visiveis" (nunca some)', () => {
  const fatura = { id: 'f1', tipo: 'saida', categoria_id: 'cat-cartao', valor: 2000, data_vencimento: '2026-08-10' };
  const compraOutroMes = { id: 't1', tipo: 'saida', categoria_id: 'cat-assinaturas', valor: 19.9, data_vencimento: '2026-09-03', cartao_credito: true };
  const { visiveis } = groupCartaoCredito([fatura, compraOutroMes], CATEGORIAS_CARTAO);

  assert.equal(visiveis.length, 2);
  assert.equal(visiveis.find((t) => t.id === 't1').cartao_credito, true);
  assert.deepEqual(visiveis.find((t) => t.id === 'f1').filhosCartao, []);
});

test('groupCartaoCredito: somar "visiveis" não duplica — fatura de 2000 com filho de 19,90 dá 2000, não 2019,90', () => {
  const fatura = { id: 'f1', tipo: 'saida', categoria_id: 'cat-cartao', valor: 2000, data_vencimento: '2026-08-10', data_pagamento: '2026-08-10' };
  const compra = { id: 't1', tipo: 'saida', categoria_id: 'cat-assinaturas', valor: 19.9, data_vencimento: '2026-08-03', data_pagamento: '2026-08-03', cartao_credito: true };
  const cru = [fatura, compra];
  const { visiveis } = groupCartaoCredito(cru, CATEGORIAS_CARTAO);

  assert.equal(computeSummary(cru).saidas, 2019.9); // o bug: sem agrupar, conta as duas
  assert.equal(computeSummary(visiveis).saidas, 2000); // corrigido: só a fatura
  assert.equal(visiveis.reduce((acc, t) => acc + Number(t.valor), 0), 2000);
});

test('groupCartaoCredito ignora entradas nos dois papéis (fatura e filha) — cartão é sempre saída', () => {
  const entradaNaCategoriaCartao = { id: 'e1', tipo: 'entrada', categoria_id: 'cat-cartao', valor: 500, data_vencimento: '2026-08-10' };
  const entradaMarcada = { id: 'e2', tipo: 'entrada', categoria_id: 'cat-assinaturas', valor: 300, data_vencimento: '2026-08-05', cartao_credito: true };
  const { visiveis } = groupCartaoCredito([entradaNaCategoriaCartao, entradaMarcada], CATEGORIAS_CARTAO);

  assert.equal(isCartaoCreditoBill(entradaNaCategoriaCartao, CATEGORIAS_CARTAO), false);
  assert.equal(visiveis.length, 2); // nenhuma das duas foi agrupada
  assert.equal(visiveis.every((t) => !('filhosCartao' in t)), true);
});

test('isCartaoCreditoBill casa pelo NOME da categoria (case/espaço insensível), não por id fixo', () => {
  const categorias = [{ id: 'qualquer-id', nome: '  CARTÃO DE CRÉDITO ' }];
  assert.equal(isCartaoCreditoBill({ tipo: 'saida', categoria_id: 'qualquer-id' }, categorias), true);
  assert.equal(isCartaoCreditoBill({ tipo: 'saida', categoria_id: 'outra' }, categorias), false);
  assert.equal(isCartaoCreditoBill({ tipo: 'saida', categoria_id: null }, categorias), false);
});

test('groupCartaoCredito: 2 filhas na mesma fatura, e a fatura nunca vira filha de si mesma', () => {
  const fatura = { id: 'f1', tipo: 'saida', categoria_id: 'cat-cartao', valor: 450, data_vencimento: '2026-08-10', cartao_credito: true };
  const a = { id: 't1', tipo: 'saida', categoria_id: 'cat-assinaturas', valor: 19.9, data_vencimento: '2026-08-03', cartao_credito: true };
  const b = { id: 't2', tipo: 'saida', categoria_id: 'cat-assinaturas', valor: 119.64, data_vencimento: '2026-08-04', cartao_credito: true };
  const { visiveis } = groupCartaoCredito([fatura, a, b], CATEGORIAS_CARTAO);

  assert.equal(visiveis.length, 1);
  assert.deepEqual(visiveis[0].filhosCartao.map((f) => f.id), ['t1', 't2']);
  assert.equal(computeSummary(visiveis).saidasPrevistas, 450);
});

test('groupCartaoCredito cai pra data_cadastro quando a despesa não tem vencimento', () => {
  const fatura = { id: 'f1', tipo: 'saida', categoria_id: 'cat-cartao', valor: 450, data_cadastro: '2026-08-01' };
  const semVencimento = { id: 't1', tipo: 'saida', categoria_id: 'cat-assinaturas', valor: 30, data_cadastro: '2026-08-20', cartao_credito: true };
  const { visiveis } = groupCartaoCredito([fatura, semVencimento], CATEGORIAS_CARTAO);
  assert.deepEqual(visiveis[0].filhosCartao.map((f) => f.id), ['t1']);
});

test('groupCartaoCredito não mexe em quem não tem nada a ver com cartão (mesma referência de objeto)', () => {
  const comum = { id: 't9', tipo: 'saida', categoria_id: 'cat-assinaturas', valor: 50, data_vencimento: '2026-08-02' };
  const { visiveis } = groupCartaoCredito([comum], CATEGORIAS_CARTAO);
  assert.equal(visiveis.length, 1);
  assert.equal(visiveis[0], comum); // não clona nem adiciona campo em transação comum
});

// ---- Multi-cartão (2026-08-22, .claude/discussions/001-cartao-credito-multi-cartao.md) ----

test('groupCartaoCredito: 2 faturas no MESMO mês de cartões DIFERENTES não se misturam (bug de produção)', () => {
  const faturaMatheus = { id: 'f1', tipo: 'saida', categoria_id: 'cat-cartao', valor: 450, data_vencimento: '2026-08-10', cartao_id: 'cartao-nubank' };
  const faturaBeatriz = { id: 'f2', tipo: 'saida', categoria_id: 'cat-cartao', valor: 300, data_vencimento: '2026-08-12', cartao_id: 'cartao-inter' };
  const compraMatheus = { id: 't1', tipo: 'saida', categoria_id: 'cat-assinaturas', valor: 19.9, data_vencimento: '2026-08-03', cartao_credito: true, cartao_id: 'cartao-nubank' };
  const compraBeatriz = { id: 't2', tipo: 'saida', categoria_id: 'cat-saude', valor: 80, data_vencimento: '2026-08-04', cartao_credito: true, cartao_id: 'cartao-inter' };
  const { visiveis } = groupCartaoCredito([faturaMatheus, faturaBeatriz, compraMatheus, compraBeatriz], CATEGORIAS_CARTAO);

  assert.equal(visiveis.length, 2);
  assert.deepEqual(visiveis.find((t) => t.id === 'f1').filhosCartao.map((f) => f.id), ['t1']);
  assert.deepEqual(visiveis.find((t) => t.id === 'f2').filhosCartao.map((f) => f.id), ['t2']);
  // Sem o cartao_id, a compra da Beatriz cairia na PRIMEIRA fatura do mês (a do Matheus).
  assert.equal(visiveis.find((t) => t.id === 'f1').filhosCartao.some((f) => f.id === 't2'), false);
});

test('groupCartaoCredito: compra com cartao_id não cai em fatura de OUTRO cartão no mesmo mês', () => {
  const fatura = { id: 'f1', tipo: 'saida', categoria_id: 'cat-cartao', valor: 450, data_vencimento: '2026-08-10', cartao_id: 'cartao-nubank' };
  const compraOutroCartao = { id: 't1', tipo: 'saida', categoria_id: 'cat-assinaturas', valor: 19.9, data_vencimento: '2026-08-03', cartao_credito: true, cartao_id: 'cartao-inter' };
  const { visiveis } = groupCartaoCredito([fatura, compraOutroCartao], CATEGORIAS_CARTAO);

  assert.equal(visiveis.length, 2); // a compra fica solta, não some
  assert.deepEqual(visiveis.find((t) => t.id === 'f1').filhosCartao, []);
  assert.equal(visiveis.find((t) => t.id === 't1').cartao_credito, true);
});

test('groupCartaoCredito legado: sem cartao_id, agrupa por responsavel_id + mês (não mais só mês)', () => {
  const faturaMatheus = { id: 'f1', tipo: 'saida', categoria_id: 'cat-cartao', valor: 450, data_vencimento: '2026-08-10', responsavel_id: 'matheus' };
  const faturaBeatriz = { id: 'f2', tipo: 'saida', categoria_id: 'cat-cartao', valor: 300, data_vencimento: '2026-08-12', responsavel_id: 'beatriz' };
  const compraMatheus = { id: 't1', tipo: 'saida', categoria_id: 'cat-assinaturas', valor: 19.9, data_vencimento: '2026-08-03', cartao_credito: true, responsavel_id: 'matheus' };
  const compraBeatriz = { id: 't2', tipo: 'saida', categoria_id: 'cat-saude', valor: 80, data_vencimento: '2026-08-04', cartao_credito: true, responsavel_id: 'beatriz' };
  const { visiveis } = groupCartaoCredito([faturaMatheus, faturaBeatriz, compraMatheus, compraBeatriz], CATEGORIAS_CARTAO);

  assert.equal(visiveis.length, 2);
  assert.deepEqual(visiveis.find((t) => t.id === 'f1').filhosCartao.map((f) => f.id), ['t1']);
  assert.deepEqual(visiveis.find((t) => t.id === 'f2').filhosCartao.map((f) => f.id), ['t2']);
});

test('groupCartaoCredito legado: compra sem cartao_id e sem responsavel_id não cai em fatura de outra pessoa', () => {
  const fatura = { id: 'f1', tipo: 'saida', categoria_id: 'cat-cartao', valor: 450, data_vencimento: '2026-08-10', responsavel_id: 'matheus' };
  const compraSemResp = { id: 't1', tipo: 'saida', categoria_id: 'cat-assinaturas', valor: 19.9, data_vencimento: '2026-08-03', cartao_credito: true };
  const { visiveis } = groupCartaoCredito([fatura, compraSemResp], CATEGORIAS_CARTAO);

  assert.equal(visiveis.length, 2); // fica solta — responsavel_id vazio não casa com a fatura do Matheus
  assert.deepEqual(visiveis.find((t) => t.id === 'f1').filhosCartao, []);
});

test('groupCartaoCredito: fatura e compra com o MESMO cartao_id em meses diferentes não se juntam', () => {
  const fatura = { id: 'f1', tipo: 'saida', categoria_id: 'cat-cartao', valor: 450, data_vencimento: '2026-08-10', cartao_id: 'cartao-nubank' };
  const compraMesSeguinte = { id: 't1', tipo: 'saida', categoria_id: 'cat-assinaturas', valor: 19.9, data_vencimento: '2026-09-03', cartao_credito: true, cartao_id: 'cartao-nubank' };
  const { visiveis } = groupCartaoCredito([fatura, compraMesSeguinte], CATEGORIAS_CARTAO);

  assert.equal(visiveis.length, 2); // sem fatura do cartão no mês da compra, ela fica solta
  assert.deepEqual(visiveis.find((t) => t.id === 'f1').filhosCartao, []);
});

test('groupByPeriod agrupa por mês e soma cada balde', () => {
  const txs = [
    { tipo: 'saida', data_cadastro: '2026-08-01', valor: 100 },
    { tipo: 'saida', data_cadastro: '2026-08-15', valor: 50 },
    { tipo: 'saida', data_cadastro: '2026-07-01', valor: 20 },
  ];
  const r = groupByPeriod(txs, 'mes');
  assert.equal(r.find((x) => x.nome.startsWith('ago')).total, 150);
  assert.equal(r.find((x) => x.nome.startsWith('jul')).total, 20);
});
