// Regressão pra Fase 2 (DESIGN-SYSTEM-2027.md §9): antes, nenhum dos ~12
// modais/drawers do app fechava com Esc — cada um reimplementava
// abrir/fechar isoladamente e ninguém tinha implementado essa tecla em
// nenhum. Corrigido de forma centralizada em js/app.js (setupOverlayBehavior),
// sem tocar em nenhum store de modal individualmente.
import { test, expect } from '@playwright/test';

test('Esc fecha o modal de nova despesa e devolve o foco pro botão que abriu', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();

  const abrirBtn = page.getByRole('button', { name: 'Nova despesa' }).first();
  await abrirBtn.click();

  const backdrop = page.locator('.cg-modal-backdrop[x-show="$store.txModal.open"]');
  await expect(backdrop).toBeVisible({ timeout: 5000 });

  await page.keyboard.press('Escape');
  await expect(backdrop).toBeHidden({ timeout: 5000 });

  await expect(abrirBtn).toBeFocused();
});
