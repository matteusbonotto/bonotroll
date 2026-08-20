// Regressão: "modo compacto não funciona no mobile" — o card de transação
// mobile (.cg-card.cg-card--compact) tinha o padding sempre travado em
// 20px/16px por causa de outras declarações soltas de ".cg-card" no mesmo
// arquivo CSS, com a MESMA especificidade mas vindo depois na cascata —
// alternar densidade normal/compacta nunca mudava nada visível de verdade.
// Corrigido subindo a especificidade de .cg-card--compact/.cg-card--dense
// pra seletores compostos (.cg-card.cg-card--compact etc.).
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 844 } });

test('densidade compacta reduz o padding do card de transação no mobile', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.getByLabel('Abrir menu').click();
  await page.locator('.cg-drawer a', { hasText: 'Transações' }).first().click();
  await page.waitForTimeout(400);

  const secao = page.locator('section[x-data^="transactionsView"]');
  const card = secao.locator('.cg-card.cg-card--compact').first();
  await expect(card).toBeVisible();

  const paddingNormal = await card.evaluate((el) => getComputedStyle(el).padding);

  await secao.getByTitle('Compacta', { exact: true }).click();
  await page.waitForTimeout(200);
  await expect(card).toHaveClass(/cg-card--dense/);
  const paddingCompacto = await card.evaluate((el) => getComputedStyle(el).padding);

  expect(paddingCompacto).not.toBe(paddingNormal);
  // 8px de padding vertical na densidade compacta (era travado em 16-20px
  // antes da correção, remessa nunca menor que isso).
  expect(paddingCompacto).toContain('8px');
});
