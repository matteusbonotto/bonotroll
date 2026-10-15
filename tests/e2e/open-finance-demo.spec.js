import { test, expect } from '@playwright/test';

// Open Finance (Pluggy) no modo demo: conexões fictícias, busca, revisão,
// importação e — o mais importante — reimportar não duplica.
test('open finance: busca, importa e não duplica na segunda vez', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await expect.poll(() => page.evaluate(() => !!Alpine.store('app').profile)).toBe(true);
  await page.evaluate(() => Alpine.store('app').setView('transacoes'));
  await page.getByTestId('abrir-open-finance').click();
  // O modal troca de conteúdo a cada passo — escopo pelo título fixo dele.
  const modal = page.locator('.cg-modal-backdrop').filter({ hasText: 'Importar CSV' });
  await expect(modal.getByText('Exemplo · Banco de Exemplo')).toBeVisible();
  await modal.getByRole('button', { name: /Buscar transações/ }).click();
  await expect(page.getByText('3 linha(s) prontas')).toBeVisible();
  await page.getByRole('button', { name: 'Importar agora' }).click();
  await expect.poll(() => page.evaluate(() => Alpine.store('csvModal').step), { timeout: 10000 }).toBe('resultado');
  const importadas = () => page.evaluate(() => JSON.parse(localStorage.getItem('bonotto_demo_db_v5')).transactions.filter((t) => (t.externo_id || '').startsWith('pluggy:demo-')));
  const primeira = await importadas();
  expect(primeira).toHaveLength(3);
  expect(Number(primeira.find((t) => t.titulo === 'Supermercado Exemplo').valor)).toBe(152.3);
  expect(primeira.find((t) => t.titulo === 'PIX recebido').tipo).toBe('entrada');

  await page.evaluate(() => Alpine.store('csvModal').openFor('transacoes'));
  await modal.getByRole('button', { name: /Buscar do banco/ }).click();
  await modal.getByRole('button', { name: /Buscar transações/ }).click();
  await expect(modal.getByText('Tudo deste período já foi importado.')).toBeVisible();
  expect(await importadas()).toHaveLength(3);
});
