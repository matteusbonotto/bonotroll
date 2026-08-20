// Regressão: Transações reestruturou 4 modos soltos (lista/tabela/grade/
// compacta) em 2 eixos independentes (layout: lista|grade, densidade:
// normal|compacta), combináveis livremente.
import { test, expect } from '@playwright/test';

test('layout e densidade combinam livremente em Transações', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Transações' }).first().click();
  await page.waitForTimeout(400);

  // .cg-grid-view/.cg-scroll-x são reaproveitados por Compras também (as
  // duas telas ficam permanentemente montadas), então escopar pela section
  // de Transações — mesmo cuidado já documentado noutros testes desta suíte.
  const secao = page.locator('section[x-data^="transactionsView"]');
  const grade = page.getByTitle('Grade', { exact: true }).first();
  const compacta = page.getByTitle('Compacta', { exact: true }).first();
  const gridView = secao.locator('.cg-grid-view');
  const tabela = secao.locator('.cg-scroll-x table.cg-table');

  // lista normal (default): tabela visível, grade não
  await expect(tabela).toBeVisible();

  // grade + normal
  await grade.click();
  await page.waitForTimeout(200);
  await expect(gridView).toBeVisible();
  await expect(gridView).not.toHaveClass(/cg-grid-view--compact/);

  // grade + compacta (os dois eixos combinam)
  await compacta.click();
  await page.waitForTimeout(200);
  await expect(gridView).toHaveClass(/cg-grid-view--compact/);

  // volta pra lista SEM perder a densidade compacta escolhida (eixos independentes)
  await page.getByTitle('Lista', { exact: true }).first().click();
  await page.waitForTimeout(200);
  await expect(tabela).toBeVisible();
  await expect(secao.locator('.cg-scroll-x')).toHaveClass(/cg-table--compact/);
});
