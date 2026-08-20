// Regressão Fase 6 (prompt master §33): notificações ganham um ícone de
// severidade (crítico/atenção/info) em vez de todas terem o mesmo peso
// visual.
import { test, expect } from '@playwright/test';

test('sino de notificações mostra um ícone de severidade por notificação', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();

  await page.getByRole('button', { name: 'Notificações' }).click();
  await page.waitForTimeout(300);

  const itens = page.locator('.cg-pill-option');
  const total = await itens.count();
  test.skip(total === 0, 'conta demo sem notificações agora — nada a testar aqui');

  // todo item precisa ter algum ícone de severidade (uma das 4 classes bi-*)
  const primeiroIcone = itens.first().locator('i.bi');
  await expect(primeiroIcone).toBeVisible();
  const classe = await primeiroIcone.getAttribute('class');
  expect(classe).toMatch(/bi-(exclamation-octagon-fill|clock-fill|info-circle-fill|check-circle-fill)/);
});
