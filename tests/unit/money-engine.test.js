import { test } from 'node:test';
import assert from 'node:assert/strict';
import { somar, subtrair, dividirIgualmente, iguais, maiorQue, percentual } from '../../js/utils/money.js';

test('somar evita o erro clássico de ponto flutuante (0.1 + 0.2)', () => {
  assert.equal(somar(0.1, 0.2), 0.3); // Number(0.1 + 0.2) === 0.30000000000000004
});

test('somar acumula centenas de parcelas pequenas sem desviar', () => {
  const parcelas = Array(500).fill(19.9);
  assert.equal(somar(...parcelas), 9950);
});

test('subtrair pelo mesmo princípio', () => {
  assert.equal(subtrair(10, 0.3), 9.7);
});

test('dividirIgualmente sempre soma de volta o total exato, mesmo sem divisão exata', () => {
  const partes = dividirIgualmente(100, 3);
  assert.deepEqual(partes, [33.34, 33.33, 33.33]);
  assert.equal(somar(...partes), 100);
});

test('dividirIgualmente com valor que divide certinho', () => {
  assert.deepEqual(dividirIgualmente(90, 3), [30, 30, 30]);
});

test('iguais compara pelo centavo, não por igualdade de float', () => {
  assert.equal(iguais(0.1 + 0.2, 0.3), true);
  assert.equal(iguais(10, 10.01), false);
});

test('maiorQue', () => {
  assert.equal(maiorQue(10.01, 10), true);
  assert.equal(maiorQue(10, 10), false);
});

test('percentual: 0 no total nunca gera NaN/Infinity', () => {
  assert.equal(percentual(50, 0), 0);
});

test('percentual: caso normal', () => {
  assert.equal(percentual(72, 100), 72);
  assert.equal(percentual(1, 3), 33.33);
});
