// Regressão da migração pro Money Engine (Fase 3) — computeSummary/
// splitEqually/groupBy* trocaram acumulador += Number(...) por somar()
// centavo-a-centavo (ver js/services/transactions.js). Comportamento
// precisa continuar idêntico ao de antes, só a aritmética interna mudou.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeSummary, splitEqually, groupByCategory, groupByCompany, groupByPeriod,
} from '../../js/services/transactions.js';

test('computeSummary soma entradas/saídas e acha o maior gasto', () => {
  const txs = [
    { tipo: 'entrada', valor: 1000 },
    { tipo: 'saida', valor: 300.5 },
    { tipo: 'saida', valor: 45.25 },
  ];
  const r = computeSummary(txs);
  assert.equal(r.entradas, 1000);
  assert.equal(r.saidas, 345.75);
  assert.equal(r.saldo, 654.25);
  assert.equal(r.maiorGasto.valor, 300.5);
});

test('computeSummary sem transação nenhuma não quebra (saldo 0, sem maior gasto)', () => {
  const r = computeSummary([]);
  assert.deepEqual(r, { entradas: 0, saidas: 0, saldo: 0, maiorGasto: null });
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
