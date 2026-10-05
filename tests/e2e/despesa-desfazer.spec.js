import { test, expect } from '@playwright/test';

// Fluxo A (Palm, fase 7): Adicionar → Despesa → nome/valor → Salvar, com "Desfazer".
test('salvar despesa nova mostra "Desfazer", que apaga o lançamento de verdade', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.evaluate(() => localStorage.setItem('bonotto_onboarding_v2_seen', '1'));
  await page.reload();
  await expect(page.locator('.cg-hero-balance').first()).toBeVisible({ timeout: 10000 });
  const contar = () => page.evaluate(() => JSON.parse(localStorage.getItem('bonotto_demo_db_v4')).transactions.filter((t) => t.titulo === 'Pão de teste').length);

  await page.evaluate(() => Alpine.store('txModal').openNew('saida'));
  await page.getByLabel('Título', { exact: true }).fill('Pão de teste');
  await page.getByLabel('Valor (R$)').fill('7.50');
  await page.locator('.cg-modal:visible').getByRole('button', { name: 'Salvar', exact: true }).click();

  const toast = page.getByText('Despesa salva.');
  await expect(toast).toBeVisible();
  expect(await contar()).toBe(1);
  await page.getByRole('button', { name: 'Desfazer' }).last().click();
  await expect.poll(contar).toBe(0);
});
