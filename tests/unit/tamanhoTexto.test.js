import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESCALAS, normalizarEscala, proximaEscala, podeAumentar, podeDiminuir } from '../../js/utils/tamanhoTexto.js';

test('A+ e A− andam um passo por toque', () => {
  assert.equal(proximaEscala(100, 1), 112.5);
  assert.equal(proximaEscala(112.5, -1), 100);
});

test('nos limites o tamanho não passa do mínimo nem do máximo', () => {
  assert.equal(proximaEscala(ESCALAS.at(-1), 1), 150);
  assert.equal(proximaEscala(ESCALAS[0], -1), 87.5);
  assert.equal(podeAumentar(150), false);
  assert.equal(podeDiminuir(87.5), false);
  assert.equal(podeAumentar(100), true);
});

test('valores antigos e inválidos viram um passo válido', () => {
  assert.equal(normalizarEscala('grande'), 112.5);
  assert.equal(normalizarEscala('muito-grande'), 125);
  assert.equal(normalizarEscala('normal'), 100);
  assert.equal(normalizarEscala('lixo'), 100);
  assert.equal(normalizarEscala(null), 100);
  assert.equal(normalizarEscala('300'), 150);
  assert.equal(normalizarEscala('118'), 112.5);
});
