import { test, expect } from '@playwright/test';

// Atalhos (2026-10-04): N abre nova despesa; / vai para Transações e foca a busca; nada disso enquanto se digita.
test('atalhos de teclado N e / funcionam fora de campos de texto', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await expect.poll(() => page.evaluate(() => !!Alpine.store('app').profile)).toBe(true);
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press('n');
  await expect.poll(() => page.evaluate(() => Alpine.store('txModal').open)).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => Alpine.store('txModal').open)).toBe(false);
  await page.keyboard.press('/');
  await expect.poll(() => page.evaluate(() => Alpine.store('app').view)).toBe('transacoes');
  const busca = page.locator('section[x-data^="transactionsView"] input[type="search"]').first();
  await expect(busca).toBeFocused();
  await busca.type('n');
  expect(await page.evaluate(() => Alpine.store('txModal').open)).toBe(false);
});
