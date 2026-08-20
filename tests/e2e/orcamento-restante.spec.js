// Regressão Fase 4 (BONOTTO-2027-BLUEPRINT.md, Conflito 2): "quanto ainda
// posso gastar" precisa aparecer discretamente no card de saldo quando uma
// categoria já está a 80%+ do limite. O próprio seed de demo já tem
// categorias estouradas (Assinaturas/Delivery) — o teste usa esse dado
// real em vez de injetar estado sintético (tentei; corre risco de race
// contra o load() assíncrono do próprio dashboard, que resseta o estado
// injetado assim que a busca real termina).
import { test, expect } from '@playwright/test';

test('linha de orçamento aparece com categoria estourada, formatada corretamente', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await expect(page.locator('.cg-hero-balance').first()).toBeVisible({ timeout: 10000 });

  const linha = page.locator('.cg-hero-balance__row', { hasText: 'Orçamento de' });
  await expect(linha).toBeVisible({ timeout: 5000 });
  await expect(linha).toContainText('já passou do limite');
  await expect(linha).toContainText('%');
});
