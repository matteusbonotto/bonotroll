import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANOS, planoEmVigor, precoAnualCentavos, planoPorId } from '../../js/data/planos.js';

const dia = 86400000;
const agora = new Date('2026-10-05T12:00:00Z');

test('anual sai 20% mais barato que 12 meses', () => {
  assert.equal(precoAnualCentavos(990), 9504);
  assert.equal(precoAnualCentavos(11990), 115104);
});

test('cada linha tem 4 planos, o primeiro grátis', () => {
  for (const linha of ['home', 'business']) {
    assert.equal(PLANOS[linha].length, 4);
    assert.equal(PLANOS[linha][0].mensal, 0);
    assert.ok(PLANOS[linha].every((p) => p.id.startsWith(linha)));
  }
});

test('conta nova: 30 dias com o plano mais completo da linha', () => {
  const home = planoEmVigor({ tipo: 'home', criadaEm: new Date(agora - 3 * dia) }, agora);
  assert.equal(home.id, 'home_familia');
  assert.equal(home.emTeste, true);
  assert.equal(home.diasRestantes, 27);
  const business = planoEmVigor({ tipo: 'business', criadaEm: agora }, agora);
  assert.equal(business.id, 'business_expansao');
});

test('depois dos 30 dias sem assinatura: plano grátis com limites', () => {
  const p = planoEmVigor({ tipo: 'home', criadaEm: new Date(agora - 31 * dia) }, agora);
  assert.equal(p.id, 'home_gratis');
  assert.equal(p.limites.lancamentosMes, 30);
  assert.equal(p.recursos.saude, false);
});

test('assinatura ativa (ou cortesia) vale mais que o teste', () => {
  const p = planoEmVigor({ tipo: 'home', plano: 'home_casal', assinaturaAtiva: true, criadaEm: agora }, agora);
  assert.equal(p.id, 'home_casal');
  assert.equal(p.emTeste, false);
});

test('assinatura cancelada volta ao grátis (passado o teste)', () => {
  const p = planoEmVigor({ tipo: 'business', plano: 'business_rede', assinaturaAtiva: false, criadaEm: new Date(agora - 90 * dia) }, agora);
  assert.equal(p.id, 'business_largada');
});

test('conta antiga sem tipo é Home', () => {
  assert.equal(planoPorId(planoEmVigor({ criadaEm: new Date(agora - 400 * dia) }, agora).id).id, 'home_gratis');
});
