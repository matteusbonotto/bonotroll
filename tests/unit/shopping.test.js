import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeItemSubtotal,
  computeListSummary,
  historicoMercados,
  filterHistoricoEntries,
  computeHistoricoSummary,
  groupHistoricoByMonth,
} from '../../js/services/shoppingList.js';

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

// ---------- Histórico (TASK-043): filtro + agrupamento por mês ----------

function entry(id, { nomeMercado = null, finalizadoEm, totalItens = 2, itensComprados = 2, valorTotal = 10 } = {}) {
  return {
    list: { id, nome: `Lista ${id}`, nome_mercado: nomeMercado, finalizado_em: finalizadoEm },
    resumo: { totalItens, itensComprados, valorTotal },
  };
}

const ENTRIES = [
  entry('ago-1', { nomeMercado: 'Supermercado Bairro Novo', finalizadoEm: '2026-08-05T10:00:00.000Z', valorTotal: 50 }),
  entry('ago-2', { nomeMercado: 'Empório Dona Rita', finalizadoEm: '2026-08-20T10:00:00.000Z', valorTotal: 30 }),
  entry('jul-1', { nomeMercado: 'Supermercado Bairro Novo', finalizadoEm: '2026-07-10T10:00:00.000Z', valorTotal: 20 }),
  entry('sem-mercado', { nomeMercado: null, finalizadoEm: '2026-06-01T10:00:00.000Z', valorTotal: 15 }),
];

test('historicoMercados: nomes únicos, ordenados, ignorando lista sem nome_mercado', () => {
  const r = historicoMercados(ENTRIES);
  assert.deepEqual(r, ['Empório Dona Rita', 'Supermercado Bairro Novo']);
});

test('filterHistoricoEntries: sem filtro devolve tudo', () => {
  assert.equal(filterHistoricoEntries(ENTRIES, {}).length, ENTRIES.length);
});

test('filterHistoricoEntries: filtra por mercado (igualdade exata)', () => {
  const r = filterHistoricoEntries(ENTRIES, { mercado: 'Supermercado Bairro Novo' });
  assert.deepEqual(r.map((e) => e.list.id), ['ago-1', 'jul-1']);
});

test('filterHistoricoEntries: filtra por intervalo de data (finalizado_em)', () => {
  const r = filterHistoricoEntries(ENTRIES, { dataInicio: '2026-08-01', dataFim: '2026-08-31' });
  assert.deepEqual(r.map((e) => e.list.id), ['ago-1', 'ago-2']);
});

test('filterHistoricoEntries: mercado + data combinados (E lógico, não OU)', () => {
  const r = filterHistoricoEntries(ENTRIES, { mercado: 'Supermercado Bairro Novo', dataInicio: '2026-08-01' });
  assert.deepEqual(r.map((e) => e.list.id), ['ago-1']);
});

test('computeHistoricoSummary: agrega totalListas/itens/valor sem erro de float', () => {
  const r = computeHistoricoSummary(Array(10).fill(entry('x', { valorTotal: 3.33 })));
  assert.equal(r.totalListas, 10);
  assert.equal(r.valorTotal, 33.3);
});

test('groupHistoricoByMonth: agrupa por mês (mês atual primeiro), decora resumo por grupo', () => {
  const labelMes = (anoMes) => (anoMes === 'sem-data' ? 'Sem data' : anoMes);
  const grupos = groupHistoricoByMonth(ENTRIES, { mesAtualIso: '2026-08', labelMes });
  assert.deepEqual(grupos.map((g) => g.chave), ['2026-08', '2026-07', '2026-06']);
  const ago = grupos[0];
  assert.equal(ago.isAtual, true);
  assert.equal(ago.resumo.totalListas, 2);
  assert.equal(ago.resumo.valorTotal, 80);
});

test('groupHistoricoByMonth: respeita o filtro aplicado antes (não reagrupa listas filtradas fora)', () => {
  const labelMes = (anoMes) => anoMes;
  const filtradas = filterHistoricoEntries(ENTRIES, { mercado: 'Empório Dona Rita' });
  const grupos = groupHistoricoByMonth(filtradas, { mesAtualIso: '2026-08', labelMes });
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].linhas.length, 1);
  assert.equal(grupos[0].linhas[0].list.id, 'ago-2');
});
