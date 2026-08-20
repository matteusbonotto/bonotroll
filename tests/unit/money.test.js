// Testes de regressão pra bugs de dinheiro/data já corrigidos e documentados
// no RAIO-X (ver docs/RAIO-X-2.0.md §5) — o histórico real mostra que esses
// dois já quebraram mais de uma vez em produção, então são o ponto de maior
// retorno pra uma primeira rede de testes (ver docs/BONOTTO-2027-BLUEPRINT.md
// §15, Fase 1). Precisa do stub de localStorage de ./_setup.js carregado
// ANTES deste arquivo (ver package.json, script "test:unit") — js/data/
// mockDb.js lê localStorage no escopo do módulo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { somaSaldos, computeTotais, computeProgresso } from '../../js/services/caixinhas.js';
import { todayIso } from '../../js/utils/format.js';
import { computeStatus, severidadeDe } from '../../js/utils/status.js';

test('computeTotais soma guardado/retirado/saldo a partir do histórico bruto', () => {
  const movs = [
    { tipo: 'guardado', valor: 500 },
    { tipo: 'guardado', valor: 300 },
    { tipo: 'retirado', valor: 100 },
  ];
  assert.deepEqual(computeTotais(movs), { guardado: 800, retirado: 100, saldo: 700 });
});

test('computeProgresso é null sem meta (não "0%" — não faz sentido comparar com nada)', () => {
  assert.equal(computeProgresso(500, null), null);
  assert.equal(computeProgresso(500, 0), null);
});

test('computeProgresso nunca passa de 100 mesmo com saldo acima da meta', () => {
  assert.equal(computeProgresso(1500, 1000), 100);
});

// Regressão do bug real documentado em RAIO-X §20.5: 1ª versão somava o
// saldo BRUTO de qualquer caixinha, então US$ 903 virava R$ 903 no total.
test('somaSaldos NUNCA soma valor de moeda estrangeira como se fosse BRL', () => {
  const caixinhas = [{ id: 'a', moeda: 'BRL' }, { id: 'b', moeda: 'USD' }];
  const movByCaixinha = {
    a: [{ tipo: 'guardado', valor: 3800 }],
    b: [{ tipo: 'guardado', valor: 903 }],
  };
  // sem cotação carregada ainda: só soma o que sabe converter (BRL) — nunca
  // inventa um número pra moeda estrangeira sem taxa real por trás.
  assert.equal(somaSaldos(caixinhas, movByCaixinha, {}), 3800);
});

// Regressão do 2º bug (mesma seção do RAIO-X): filtrar a moeda estrangeira
// pra FORA do total também está errado — precisa ENTRAR convertida.
test('somaSaldos soma a moeda estrangeira convertida assim que a cotação existe', () => {
  const caixinhas = [{ id: 'a', moeda: 'BRL' }, { id: 'b', moeda: 'USD' }];
  const movByCaixinha = {
    a: [{ tipo: 'guardado', valor: 3800 }],
    b: [{ tipo: 'guardado', valor: 903 }],
  };
  const total = somaSaldos(caixinhas, movByCaixinha, { USD: 5.2 });
  // 3800 + 903 * 5,20 = 8495,60
  assert.ok(Math.abs(total - 8495.6) < 0.01, `esperava ~8495.60, veio ${total}`);
});

// todayIso() — bug real documentado em RAIO-X §14.7: toISOString() converte
// pra UTC, o que troca o dia perto da virada da noite em fuso negativo
// (Brasil). O contrato certo é sempre bater com os campos LOCAIS do
// relógio da máquina, nunca com o UTC.
test('todayIso() usa o calendário local, nunca UTC', () => {
  const d = new Date();
  const esperado = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  assert.equal(todayIso(), esperado);
});

test('computeStatus: pago vence tudo, mesmo com data_vencimento no passado', () => {
  assert.equal(computeStatus({ data_pagamento: '2026-01-01', data_vencimento: '2020-01-01' }), 'pago');
});

test('computeStatus: sem vencimento e sem pagamento é pendente, nunca vencido', () => {
  assert.equal(computeStatus({ data_pagamento: null, data_vencimento: null }), 'pendente');
});

test('computeStatus: vencimento no passado sem pagamento é vencido', () => {
  assert.equal(computeStatus({ data_pagamento: null, data_vencimento: '2000-01-01' }), 'vencido');
});

test('severidadeDe: pagamento é sempre info (notícia neutra/positiva)', () => {
  assert.equal(severidadeDe({ tipo: 'pagamento', titulo: 'x' }), 'info');
});

test('severidadeDe: estoque em falta é attention, não crítico (chato, não é crise)', () => {
  assert.equal(severidadeDe({ tipo: 'estoque', titulo: '"Arroz" está em falta' }), 'attention');
});

test('severidadeDe: despesa já vencida é critical', () => {
  assert.equal(severidadeDe({ tipo: 'vencimento_despesa', titulo: '"Aluguel" está vencida' }), 'critical');
});

test('severidadeDe: despesa a vencer (ainda dá tempo) é warning, não critical', () => {
  assert.equal(severidadeDe({ tipo: 'vencimento_despesa', titulo: '"Aluguel" vence em breve' }), 'warning');
});

test('severidadeDe: item de Recursos já vencido é critical', () => {
  assert.equal(severidadeDe({ tipo: 'validade', titulo: '"Leite" venceu' }), 'critical');
});

test('severidadeDe: item de Recursos vencendo é warning', () => {
  assert.equal(severidadeDe({ tipo: 'validade', titulo: '"Leite" está vencendo' }), 'warning');
});

test('computeStatus: vencimento dentro de 7 dias é a_vencer', () => {
  const em3dias = new Date();
  em3dias.setDate(em3dias.getDate() + 3);
  const iso = `${em3dias.getFullYear()}-${String(em3dias.getMonth() + 1).padStart(2, '0')}-${String(em3dias.getDate()).padStart(2, '0')}`;
  assert.equal(computeStatus({ data_pagamento: null, data_vencimento: iso }), 'a_vencer');
});
