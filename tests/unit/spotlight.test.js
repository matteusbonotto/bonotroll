// Geometria pura do spotlight do passo-a-passo interativo de onboarding —
// ver js/utils/spotlight.js. É a única parte do mecanismo sem DOM/Alpine,
// e por isso a única testável aqui sem simular um navegador inteiro.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSpotlightGeometry, computeBalloonGeometry } from '../../js/utils/spotlight.js';

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

test('computeBalloonGeometry: fica embaixo do alvo quando sobra espaço', () => {
  const g = computeBalloonGeometry({ top: 100, left: 50, width: 120, height: 40 }, { width: 400, height: 800 });
  assert.equal(g.placement, 'bottom');
  assert.equal(g.balloon.top, g.ring.top + g.ring.height + 10);
});

test('computeBalloonGeometry: inverte pra cima quando não sobra espaço embaixo', () => {
  const g = computeBalloonGeometry({ top: 700, left: 50, width: 120, height: 40 }, { width: 400, height: 780 });
  assert.equal(g.placement, 'top');
  assert.equal(g.balloon.bottom, 780 - g.ring.top + 10);
});

test('computeBalloonGeometry: nunca deixa o balão vazar pra fora da largura da tela', () => {
  const g = computeBalloonGeometry({ top: 100, left: 350, width: 40, height: 30 }, { width: 400, height: 800 });
  assert.ok(g.balloon.left + g.balloon.maxWidth <= 400 - 12 + 0.001);
  assert.ok(g.balloon.left >= 12);
});

// BUG REAL relatado em uso no celular (2026-09-15): a decisão de lado usava
// uma altura de balão CHUTADA (~130px) — errada pra qualquer guia com texto
// mais comprido, o que podia colocar o balão embaixo mesmo sem caber de
// verdade, cobrindo o próprio botão "Próximo". `balloonHeight` (altura
// medida de verdade, ver ResizeObserver em onboarding.js) corrige os dois
// problemas: a decisão de lado E o clamp final.
test('computeBalloonGeometry: usa a altura REAL do balão (não uma estimativa) pra decidir o lado', () => {
  // Só 104px de sobra embaixo — não cabe um balão de 220px (medido de
  // verdade), mesmo que a estimativa antiga (~130px) achasse que cabia
  // ("bottom" venceria por espaço bruto, 104 > 0, sem considerar a altura
  // real). Em cima sobra de sobra (494px) — o lado certo.
  const g = computeBalloonGeometry({ top: 500, left: 50, width: 120, height: 40 }, { width: 400, height: 650 }, { balloonHeight: 220 });
  assert.equal(g.placement, 'top');
});

test('computeBalloonGeometry: clamp nunca deixa o balão vazar pra fora da altura da tela (alvo perto do rodapé, ou teclado do celular reduzindo a área visível)', () => {
  const g = computeBalloonGeometry({ top: 750, left: 50, width: 120, height: 40 }, { width: 400, height: 800 }, { balloonHeight: 220 });
  if (g.placement === 'bottom') {
    assert.ok(g.balloon.top + 220 <= 800 - 12 + 0.001);
  } else {
    assert.ok(g.balloon.bottom >= 12 - 0.001);
    assert.ok(800 - g.balloon.bottom - 220 >= 12 - 0.001);
  }
});
