import { test, expect } from '@playwright/test';

// Histórico de preços da casa (2026-10-04): item já comprado numa compra
// encerrada mostra o menor preço pago e onde; o chip abre o histórico.
test('item já comprado antes mostra o menor preço pago e abre o histórico', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await expect.poll(() => page.evaluate(() => !!Alpine.store('app').profile)).toBe(true);
  await page.evaluate(() => { Alpine.store('app').view = 'compras'; });
  const secao = page.locator('section[x-data^="shoppingView"]');
  await secao.locator('.cg-lista-tile').first().click();
  await page.evaluate(async () => {
    const sl = await import('/js/services/shoppingList.js');
    const comp = Alpine.$data(document.querySelector('section[x-data^="shoppingView"]'));
    await sl.addItem(comp.list.id, { nome: 'Café', unidade: 'un', quantidade: 1 });
    window.dispatchEvent(new CustomEvent('cg:shopping-changed'));
  });
  const chip = secao.locator('.cg-preco-chip').first();
  await expect(chip).toContainText('Menor que você pagou');
  await expect(chip).toContainText('Empório Dona Rita');
  await chip.click();
  const modal = page.getByRole('dialog', { name: 'Preços de Café' });
  await expect(modal).toBeVisible();
  await expect(modal.getByText('Menor preço')).toBeVisible();
});
