// Extraído de gruposPorPeriodo (js/components/transactionTable.js) pra
// virar Ano > Mês (ver js/utils/periodo.js pro raciocínio de arquitetura).
// Mesmas regras já testadas em produção pra 1 nível, estendidas pra 2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ordenarChavesPeriodo, agruparPorAnoMes } from '../../js/utils/periodo.js';

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
function labelMes(anoMes) {
  if (anoMes === 'sem-data') return 'Sem data';
  const [ano, mes] = anoMes.split('-');
  return `${MESES_ABREV[Number(mes) - 1]}/${ano.slice(2)}`;
}
function computeResumo(linhas) {
  return { total: linhas.length };
}
function extrairData(t) {
  return t.data_vencimento || t.data_cadastro || null;
}

// ---------- ordenarChavesPeriodo ----------

test('ordenarChavesPeriodo: mês atual aparece primeiro mesmo com mês futuro (recorrência antecipada) na lista', () => {
  const chaves = ['2026-07', '2026-09', '2026-08']; // set/26 é textualmente "maior" que ago/26
  const r = ordenarChavesPeriodo(chaves, '2026-08');
  assert.equal(r[0], '2026-08');
  assert.deepEqual(r, ['2026-08', '2026-09', '2026-07']);
});

test('ordenarChavesPeriodo: ano atual aparece primeiro mesmo com ano futuro na lista', () => {
  const chaves = ['2025-12', '2027-01', '2026-03'];
  const r = ordenarChavesPeriodo(chaves, '2026-03');
  // 2026 (ano atual) primeiro; resto (2027, 2025) desce do mais recente pro mais antigo
  assert.deepEqual(r, ['2026-03', '2027-01', '2025-12']);
});

test('ordenarChavesPeriodo: "sem-data" sempre por último, mesmo com ano/mês futuro na lista', () => {
  const chaves = ['sem-data', '2027-01', '2026-08'];
  const r = ordenarChavesPeriodo(chaves, '2026-08');
  assert.equal(r[r.length - 1], 'sem-data');
  assert.deepEqual(r, ['2026-08', '2027-01', 'sem-data']);
});

test('ordenarChavesPeriodo: virada de ano — dezembro do ano anterior não fura a frente de janeiro do ano atual', () => {
  const chaves = ['2025-12', '2026-01'];
  const r = ordenarChavesPeriodo(chaves, '2026-01');
  assert.deepEqual(r, ['2026-01', '2025-12']);
});

test('ordenarChavesPeriodo: dentro do ano atual, resto dos meses ordena do mais recente pro mais antigo em volta do mês atual', () => {
  const chaves = ['2026-01', '2026-08', '2026-05', '2026-10'];
  const r = ordenarChavesPeriodo(chaves, '2026-08');
  assert.deepEqual(r, ['2026-08', '2026-10', '2026-05', '2026-01']);
});

test('ordenarChavesPeriodo: anos sem o ano atual ordenam só do mais recente pro mais antigo', () => {
  const chaves = ['2023-01', '2025-06', '2024-12'];
  const r = ordenarChavesPeriodo(chaves, '2026-08'); // ano atual (2026) nem aparece na lista
  assert.deepEqual(r, ['2025-06', '2024-12', '2023-01']);
});

// ---------- agruparPorAnoMes ----------

function txVenc(id, dataVencimento) {
  return { id, data_vencimento: dataVencimento };
}

test('agruparPorAnoMes: mês/ano atual sempre primeiro, "sem data" sempre por último, resto decrescente', () => {
  const txs = [
    txVenc('futuro-ano', '2027-01-10'),
    txVenc('atual', '2026-08-05'),
    txVenc('passado', '2025-12-01'),
    { id: 'sem-data' }, // nem vencimento nem cadastro
    txVenc('futuro-mes', '2026-09-01'), // recorrência antecipada, mesmo ano do atual
  ];
  const grupos = agruparPorAnoMes(txs, { mesAtualIso: '2026-08', extrairData, computeResumo, labelMes });

  assert.deepEqual(grupos.map((g) => g.chave), ['2026-08', '2026-09', '2027-01', '2025-12', 'sem-data']);
  assert.equal(grupos[0].isAtual, true);
  assert.equal(grupos[0].abertoPorPadrao, true);
  assert.equal(grupos[1].isAtual, false);
  assert.equal(grupos[grupos.length - 1].chave, 'sem-data');
});

test('agruparPorAnoMes: decora com metadados de ano (ano/isAnoAtual/anoLabel/primeiroDoAno)', () => {
  const txs = [
    txVenc('a', '2026-08-01'),
    txVenc('b', '2026-09-01'),
    txVenc('c', '2025-06-01'),
  ];
  const grupos = agruparPorAnoMes(txs, { mesAtualIso: '2026-08', extrairData, computeResumo, labelMes });

  const [ago26, set26, jun25] = grupos;
  assert.equal(ago26.ano, '2026');
  assert.equal(ago26.isAnoAtual, true);
  assert.equal(ago26.anoLabel, '2026');
  assert.equal(ago26.primeiroDoAno, true); // primeira seção do ano 2026 na ordem final

  assert.equal(set26.ano, '2026');
  assert.equal(set26.isAnoAtual, true);
  assert.equal(set26.primeiroDoAno, false); // já teve um "2026" antes (ago/26)

  assert.equal(jun25.ano, '2025');
  assert.equal(jun25.isAnoAtual, false);
  assert.equal(jun25.anoLabel, '2025');
  assert.equal(jun25.primeiroDoAno, true); // primeira (e única) seção do ano 2025
});

test('agruparPorAnoMes: balde "sem-data" tem anoLabel null (cabeçalho de ano não duplica "Sem data") mas ainda é primeiroDoAno', () => {
  const txs = [txVenc('a', '2026-08-01'), { id: 'x' }];
  const grupos = agruparPorAnoMes(txs, { mesAtualIso: '2026-08', extrairData, computeResumo, labelMes });
  const semData = grupos.find((g) => g.chave === 'sem-data');
  assert.equal(semData.ano, 'sem-data');
  assert.equal(semData.anoLabel, null);
  assert.equal(semData.isAnoAtual, false);
  assert.equal(semData.primeiroDoAno, true);
  assert.equal(semData.label, 'Sem data');
});

test('agruparPorAnoMes: "sem data" sempre por último tanto no conjunto todo quanto isolado dentro do seu próprio balde (nunca se mistura com um ano de verdade)', () => {
  const txs = [
    { id: 'x1' },
    txVenc('a', '2026-08-01'),
    { id: 'x2' },
    txVenc('b', '2025-01-01'),
  ];
  const grupos = agruparPorAnoMes(txs, { mesAtualIso: '2026-08', extrairData, computeResumo, labelMes });
  assert.equal(grupos[grupos.length - 1].chave, 'sem-data');
  assert.equal(grupos[grupos.length - 1].linhas.length, 2); // x1 e x2 juntos no mesmo balde, não duplicado
});

test('agruparPorAnoMes: meses/anos sem nenhuma transação não aparecem (não inventa grupo vazio)', () => {
  const txs = [txVenc('a', '2026-08-01'), txVenc('b', '2026-08-15')];
  const grupos = agruparPorAnoMes(txs, { mesAtualIso: '2026-08', extrairData, computeResumo, labelMes });
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].chave, '2026-08');
  assert.equal(grupos[0].linhas.length, 2);
});

test('agruparPorAnoMes: usa data_cadastro quando não tem data_vencimento (mesmo fallback de hoje)', () => {
  const txs = [{ id: 'a', data_cadastro: '2026-08-01' }, { id: 'b', data_vencimento: '2026-08-10' }];
  const grupos = agruparPorAnoMes(txs, { mesAtualIso: '2026-08', extrairData, computeResumo, labelMes });
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].linhas.length, 2);
});

test('agruparPorAnoMes: resumo é calculado por computeResumo injetado, por grupo', () => {
  const txs = [txVenc('a', '2026-08-01'), txVenc('b', '2026-08-02'), txVenc('c', '2026-07-01')];
  const grupos = agruparPorAnoMes(txs, { mesAtualIso: '2026-08', extrairData, computeResumo, labelMes });
  assert.equal(grupos.find((g) => g.chave === '2026-08').resumo.total, 2);
  assert.equal(grupos.find((g) => g.chave === '2026-07').resumo.total, 1);
});
