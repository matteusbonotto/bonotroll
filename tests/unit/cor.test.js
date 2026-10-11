import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexParaRgb, contraste, corDoTexto, TEXTO_CLARO, TEXTO_ESCURO } from '../../js/utils/cor.js';
import { DEFAULT_CATEGORIES } from '../../js/services/categories.js';

test('hex curto, longo e inválido', () => {
  assert.deepEqual(hexParaRgb('#fff'), [255, 255, 255]);
  assert.deepEqual(hexParaRgb('16A34A'), [22, 163, 74]);
  assert.equal(hexParaRgb('vermelho'), null);
  assert.equal(hexParaRgb(''), null);
});

test('contraste: preto x branco = 21, cor igual = 1, inválido não quebra', () => {
  assert.equal(Math.round(contraste('#000', '#fff')), 21);
  assert.equal(contraste('#16A34A', '#16A34A'), 1);
  assert.equal(contraste('???', '#fff'), 1);
});

test('fundo claro (amarelo, azul-claro) ganha texto escuro; fundo escuro ganha branco', () => {
  assert.equal(corDoTexto('#EAB308'), TEXTO_ESCURO);
  assert.equal(corDoTexto('#38BDF8'), TEXTO_ESCURO);
  assert.equal(corDoTexto('#7C3AED'), TEXTO_CLARO);
  assert.equal(corDoTexto('#0F172A'), TEXTO_CLARO);
});

test('toda categoria padrão: ícone com contraste ≥ 3:1 (WCAG para elemento gráfico)', () => {
  for (const c of DEFAULT_CATEGORIES) {
    const r = contraste(c.cor, corDoTexto(c.cor));
    assert.ok(r >= 3, `${c.nome} (${c.cor}) tem contraste ${r.toFixed(2)}`);
  }
});

test('categorias padrão: ícone e cor nunca repetidos (não depende só da cor nem confunde ícones)', () => {
  const icones = DEFAULT_CATEGORIES.map((c) => c.icone);
  assert.equal(new Set(icones).size, icones.length, `ícone repetido: ${icones.filter((x, i) => icones.indexOf(x) !== i)}`);
  const cores = DEFAULT_CATEGORIES.map((c) => c.cor.toUpperCase());
  assert.equal(new Set(cores).size, cores.length, `cor repetida: ${cores.filter((x, i) => cores.indexOf(x) !== i)}`);
});
