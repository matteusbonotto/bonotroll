import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NUMEROS_EMERGENCIA, TOPICOS_PRIMEIROS_SOCORROS, filtrarTopicos } from '../../js/data/primeirosSocorros.js';

test('números de emergência essenciais presentes (SAMU 192 em destaque)', () => {
  const nums = NUMEROS_EMERGENCIA.map((n) => n.numero);
  for (const n of ['192', '193', '190']) assert.ok(nums.includes(n), n);
  assert.equal(NUMEROS_EMERGENCIA.find((n) => n.destaque)?.numero, '192');
});

test('todo tópico tem passos, "não faça" e manda chamar ajuda', () => {
  for (const t of TOPICOS_PRIMEIROS_SOCORROS) {
    assert.ok(t.passos.length >= 3, t.id);
    assert.ok(t.naoFaca.length >= 1, t.id);
    assert.match(t.passos.join(' '), /192|193|0800|hospital/, t.id);
  }
});

test('busca ignora acento e maiúsculas', () => {
  assert.deepEqual(filtrarTopicos(TOPICOS_PRIMEIROS_SOCORROS, 'QUEIMADURA').map((t) => t.id), ['queimadura']);
  assert.ok(filtrarTopicos(TOPICOS_PRIMEIROS_SOCORROS, 'convulsao').some((t) => t.id === 'convulsao'));
  assert.equal(filtrarTopicos(TOPICOS_PRIMEIROS_SOCORROS, '').length, TOPICOS_PRIMEIROS_SOCORROS.length);
});
