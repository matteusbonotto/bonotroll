import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeItemSubtotal, computeListSummary } from '../../js/services/shoppingList.js';

test('computeItemSubtotal por unidade (quantidade x preço unitário)', () => {
  assert.equal(computeItemSubtotal({ unidade: 'un', quantidade: 3, preco_unitario: 4.5 }), 13.5);
});

test('computeItemSubtotal por peso (kg)', () => {
  assert.equal(computeItemSubtotal({ unidade: 'kg', quantidade: 1.5, preco_por_kg: 32.9 }), 49.35);
});

test('computeListSummary soma subtotal de muitos itens sem desviar por float', () => {
  const items = Array(30).fill({ subtotal: 3.33, comprado: false });
  const r = computeListSummary(items);
  assert.equal(r.totalItens, 30);
  assert.equal(r.valorTotal, 99.9);
});
