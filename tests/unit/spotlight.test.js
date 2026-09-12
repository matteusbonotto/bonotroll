// Geometria pura do spotlight do passo-a-passo interativo de onboarding —
// ver js/utils/spotlight.js. É a única parte do mecanismo sem DOM/Alpine,
// e por isso a única testável aqui sem simular um navegador inteiro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSpotlightGeometry } from '../../js/utils/spotlight.js';

test('computeSpotlightGeometry: aplica o respiro (padding) em volta do retângulo real', () => {
  const g = computeSpotlightGeometry({ top: 100, left: 50, width: 120, height: 40 }, 8);
  assert.deepEqual(g.hole, { top: 92, left: 42, width: 136, height: 56 });
});

test('computeSpotlightGeometry: os 4 retângulos de escurecer cercam exatamente o buraco', () => {
  const g = computeSpotlightGeometry({ top: 100, left: 50, width: 120, height: 40 }, 8);
  // topo: do topo da tela até o topo do buraco
  assert.deepEqual(g.dims.top, { top: 0, left: 0, right: 0, height: 92 });
  // baixo: do fim do buraco até o fim da tela (bottom:0 deixa a altura livre)
  assert.deepEqual(g.dims.bottom, { top: 92 + 56, left: 0, right: 0, bottom: 0 });
  // esquerda/direita: mesma faixa vertical do buraco, só a largura muda
  assert.deepEqual(g.dims.left, { top: 92, left: 0, width: 42, height: 56 });
  assert.deepEqual(g.dims.right, { top: 92, left: 42 + 136, right: 0, height: 56 });
});

test('computeSpotlightGeometry: nunca deixa a moldura negativa quando o elemento já está colado numa borda', () => {
  const g = computeSpotlightGeometry({ top: 2, left: 0, width: 100, height: 30 }, 8);
  assert.equal(g.hole.top, 0); // 2 - 8 seria negativo — trava em 0
  assert.equal(g.hole.left, 0); // 0 - 8 seria negativo — trava em 0
  // largura/altura do buraco continuam somando o padding normalmente, mesmo
  // com o clamp do lado top/left (não têm porquê depender um do outro).
  assert.equal(g.hole.width, 116);
  assert.equal(g.hole.height, 46);
});

test('computeSpotlightGeometry: padding default é 8px quando não informado', () => {
  const g = computeSpotlightGeometry({ top: 50, left: 50, width: 10, height: 10 });
  assert.equal(g.hole.top, 42);
  assert.equal(g.hole.left, 42);
});
