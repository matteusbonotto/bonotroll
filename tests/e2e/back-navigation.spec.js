// Regressão Fase 2 (DESIGN-SYSTEM-2027.md §4): os 3 back-buttons do app
// (Recursos x2, Caixinhas x1) agora usam o componente único .cg-back em vez
// de 3 implementações divergentes de <button btn-outline-secondary>. Este
// teste cobre o drill-down de Recursos, que exercita os dois níveis.
import { test, expect } from '@playwright/test';

test('.cg-back em Recursos volta cômodo → grade e subcategoria → cômodo', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Recursos' }).first().click();
  await page.waitForTimeout(400);

  const primeiroComodo = page.locator('.cg-room-tile').first();
  await expect(primeiroComodo).toBeVisible({ timeout: 5000 });
  await primeiroComodo.click();

  const voltarComodos = page.locator('.cg-back', { hasText: 'Cômodos' });
  await expect(voltarComodos).toBeVisible({ timeout: 5000 });
  await expect(voltarComodos.locator('i.bi-chevron-left')).toBeVisible();

  await voltarComodos.click();
  await expect(page.locator('.cg-room-tile').first()).toBeVisible({ timeout: 5000 });
});
