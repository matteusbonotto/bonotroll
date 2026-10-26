import { test, expect } from '@playwright/test';

// Nota do mercado (2026-10-25): QR da NFC-e → conferir itens → a compra vai
// para o Histórico com mercado, dia e itens, e vira um gasto. No modo demo a
// "SEFAZ" é uma nota de exemplo (js/services/notaMercado.js); a câmera é
// pulada chamando o mesmo método que o leitor de QR chama.
const URL_QR = 'https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=35261012345678000190650010000123451000123450|2|1|1|ABC';

test('ler a nota do mercado salva a compra no histórico e lança o gasto', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await expect.poll(() => page.evaluate(() => !!Alpine.store('app').profile)).toBe(true);
  await page.evaluate(() => { Alpine.store('app').view = 'compras'; });
  const secao = page.locator('section[x-data^="shoppingView"]');
  await secao.getByTestId('ler-nota').click();
  const modal = page.getByRole('dialog', { name: 'Ler nota do mercado' });
  await expect(modal.getByText('QR code do cupom')).toBeVisible();

  await page.evaluate((url) => Alpine.$data(document.querySelector('section[x-data^="shoppingView"]')).onQrNota(url), URL_QR);
  const conferir = page.getByRole('dialog', { name: 'Confira a compra' });
  await expect(conferir.getByLabel('Mercado')).toHaveValue('Supermercado Bom Preço');
  await expect(conferir.getByText('5 de 5 itens')).toBeVisible();
  await conferir.getByLabel('Incluir DETERGENTE LIQUIDO 500ML').uncheck();
  await expect(conferir.getByText('4 de 5 itens')).toBeVisible();
  await expect(conferir.getByText('R$ 82,25')).toBeVisible();
  await conferir.getByLabel('Como pagou?').selectOption('avista');
  await conferir.getByRole('button', { name: 'Salvar compra' }).click();

  const historico = page.locator('.cg-modal').filter({ hasText: 'Histórico de compras' });
  await expect(historico.locator('.cg-list-row').filter({ hasText: 'Supermercado Bom Preço' })).toBeVisible();
  await expect(historico.getByText('4/4 itens')).toBeVisible();

  const gasto = await page.evaluate(async () => {
    const { listTransactions } = await import('/js/services/transactions.js');
    const s = Alpine.store('app');
    const txs = await listTransactions({ ownerId: s.profile.id, groupId: s.group?.group?.id });
    return txs.find((t) => t.titulo === 'Mercado — Supermercado Bom Preço');
  });
  expect(gasto.valor).toBe(82.25);
  expect(gasto.data_pagamento).toBeTruthy();

  // ler a mesma nota de novo avisa que já foi lançada
  await page.evaluate(() => Alpine.$data(document.querySelector('section[x-data^="shoppingView"]')).abrirNota());
  await page.evaluate((url) => Alpine.$data(document.querySelector('section[x-data^="shoppingView"]')).onQrNota(url), URL_QR);
  await expect(page.getByText('Esta nota já foi lançada antes.')).toBeVisible();
});
