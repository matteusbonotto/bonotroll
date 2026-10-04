import { test, expect } from '@playwright/test';

// Migração de planilha (2026-10-04): colar linhas do Excel/Google Planilhas,
// colunas reconhecidas pelos nomes comuns, validação antes de importar.
test('colar linhas da planilha: reconhece colunas, valida e importa com o valor certo', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await expect.poll(() => page.evaluate(() => !!Alpine.store('app').profile)).toBe(true);
  await page.evaluate(() => Alpine.store('csvModal').openFor('transacoes'));
  const modal = page.locator('.cg-modal-backdrop', { has: page.locator('#cg-csv-colar') });
  await modal.locator('#cg-csv-colar').fill('Data\tDescrição\tValor\tD/C\n05/10/2026\tPlanilha teste mercado\t1.234,56\tD\n06/10/2026\t\tabc\tD');
  await modal.getByRole('button', { name: 'Usar o que colei' }).click();
  await expect.poll(() => page.evaluate(() => Alpine.store('csvModal').step)).toBe('map');
  const mapa = await page.evaluate(() => ({ ...Alpine.store('csvModal').mapping }));
  expect(mapa).toMatchObject({ data_vencimento: 'Data', titulo: 'Descrição', valor: 'Valor', tipo: 'D/C' });
  await page.evaluate(() => Alpine.store('csvModal').avancarPreview());
  await expect(page.getByText('1 linha(s) prontas')).toBeVisible();
  await expect(page.getByText(/Linha 3:/)).toBeVisible();
  await page.getByRole('button', { name: 'Importar agora' }).click();
  await expect.poll(() => page.evaluate(() => Alpine.store('csvModal').step), { timeout: 10000 }).toBe('resultado');
  const valor = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('bonotto_demo_db_v2'));
    return db.transactions.find((t) => t.titulo === 'Planilha teste mercado')?.valor;
  });
  expect(Number(valor)).toBe(1234.56);
});
