import { test, expect } from '@playwright/test';

// Recorrência (2026-10-25): uma conta mensal lançada hoje já aparece no mês
// seguinte (a vencer), sem passar do fim dele, e leva o cartão junto.
test('recorrente mensal gera a do mês seguinte e para no fim dele', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await expect.poll(() => page.evaluate(() => !!Alpine.store('app').profile)).toBe(true);
  const r = await page.evaluate(async () => {
    const { createTransaction, listTransactions } = await import('/js/services/transactions.js');
    const { gerarRecorrentesPendentes, horizonteRecorrencia } = await import('/js/services/recurring.js');
    const { todayIso } = await import('/js/utils/format.js');
    const s = Alpine.store('app');
    const serie = crypto.randomUUID();
    const hoje = todayIso();
    await createTransaction({ tipo: 'saida', titulo: 'Academia teste', valor: 99, owner_id: s.profile.id, responsavel_id: s.profile.id, data_cadastro: hoje, data_vencimento: hoje, recorrente: true, recorrencia_tipo: 'mensal', recorrencia_serie_id: serie, cartao_credito: true, cartao_id: 'cartao-x' });
    await gerarRecorrentesPendentes({ ownerId: s.profile.id, groupId: s.group?.group?.id });
    await gerarRecorrentesPendentes({ ownerId: s.profile.id, groupId: s.group?.group?.id }); // de novo: não duplica
    const txs = (await listTransactions({ ownerId: s.profile.id, groupId: s.group?.group?.id })).filter((t) => t.recorrencia_serie_id === serie);
    return { hoje, horizonte: horizonteRecorrencia(hoje), datas: txs.map((t) => t.data_cadastro).sort(), cartoes: txs.map((t) => t.cartao_id), pagas: txs.filter((t) => t.data_pagamento).length };
  });
  expect(r.datas.length).toBe(2);
  expect(r.datas[1].slice(0, 7)).not.toBe(r.hoje.slice(0, 7));
  expect(r.datas[1] <= r.horizonte).toBe(true);
  expect(r.cartoes).toEqual(['cartao-x', 'cartao-x']);
  expect(r.pagas).toBe(0);
});
