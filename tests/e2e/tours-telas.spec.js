import { test, expect } from '@playwright/test';

// Tutorial curto na 1ª visita a cada tela (2026-10-05). Em teste automatizado
// ele fica desligado, a não ser com bntt_tours_forcar=1 (este teste).
test('primeira visita a uma tela abre o tutorial dela; a segunda, não', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bonotto_onboarding_v2_seen', '1');
    localStorage.setItem('bntt_tours_forcar', '1');
  });
  await page.goto('/app?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await expect(page.locator('.cg-hero-balance').first()).toBeVisible({ timeout: 10000 });
  await page.evaluate(() => Alpine.store('app').setView('transacoes'));
  const balao = page.locator('.cg-tour-balloon');
  await expect(balao.getByText('Lançar em segundos')).toBeVisible({ timeout: 5000 });
  await page.evaluate(() => Alpine.store('onboarding').pular());

  await page.evaluate(() => Alpine.store('app').setView('home'));
  await page.evaluate(() => Alpine.store('app').setView('transacoes'));
  await page.waitForTimeout(1500);
  await expect(page.locator('.cg-tour-balloon')).toBeHidden();
});
