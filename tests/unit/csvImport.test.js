// normalizarDataCsv — bug real reportado pelo usuário: um CSV com datas em
// dd/mm/aaaa (formato padrão de qualquer export de Excel/Sheets em pt-BR) ia
// direto pro banco como string crua, sem conversão nenhuma. Ver
// js/services/csvImport.js e js/components/csvImportModal.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarDataCsv } from '../../js/services/csvImport.js';

test('normalizarDataCsv aceita aaaa-mm-dd (formato ISO já esperado) sem alterar', () => {
  assert.equal(normalizarDataCsv('2026-09-01'), '2026-09-01');
});

test('normalizarDataCsv converte dd/mm/aaaa pra aaaa-mm-dd', () => {
  assert.equal(normalizarDataCsv('01/09/2026'), '2026-09-01');
  assert.equal(normalizarDataCsv('31/12/2027'), '2027-12-31');
});

test('normalizarDataCsv: vazio/null/undefined vira null, nunca lança', () => {
  assert.equal(normalizarDataCsv(''), null);
  assert.equal(normalizarDataCsv(null), null);
  assert.equal(normalizarDataCsv(undefined), null);
  assert.equal(normalizarDataCsv('   '), null);
});

test('normalizarDataCsv: data impossível ou formato desconhecido vira null em vez de string crua', () => {
  assert.equal(normalizarDataCsv('32/13/2026'), null);
  assert.equal(normalizarDataCsv('não é uma data'), null);
  assert.equal(normalizarDataCsv('2026/09/01'), null);
});

test('normalizarDataCsv tolera espaço em volta do valor', () => {
  assert.equal(normalizarDataCsv('  01/09/2026  '), '2026-09-01');
  assert.equal(normalizarDataCsv('  2026-09-01  '), '2026-09-01');
});

test('parseValorBR entende os formatos de planilha pt-BR e nunca zera em silêncio (revisão 2026-10-04)', async () => {
  const { parseValorBR } = await import('../../js/services/csvImport.js');
  const casos = {
    '1.234,56': 1234.56, '1234,56': 1234.56, 'R$ 10,00': 10, '10,00 R$': 10, '1,234.56': 1234.56,
    '34.9': 34.9, '34.90': 34.9, '1.234': 1234, '1.234.567': 1234567, '-50': -50, '(50,00)': -50,
    '50,00-': -50, 'R$ 1.234.567,89': 1234567.89, '0': 0,
  };
  for (const [entrada, esperado] of Object.entries(casos)) assert.equal(parseValorBR(entrada), esperado, entrada);
  assert.equal(parseValorBR(''), null);
  assert.equal(parseValorBR(undefined), null);
  assert.throws(() => parseValorBR('abc'), /não entendido/);
  assert.throws(() => parseValorBR('1,2,3'), /não entendido/);
});
