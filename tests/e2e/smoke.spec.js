// Smoke test: login em modo demo (via ?demo=1 — ver js/data/config.js, nunca
// troca credenciais reais) + navega pelas telas principais, checando ausência
// de erro de console/página. Barato de rodar, pega quebra grosseira cedo.
import { test, expect } from '@playwright/test';

test('login demo + navega pelas telas sem erro de console', async ({ page }) => {
  const erros = [];
  page.on('console', (msg) => { if (msg.type() === 'error') erros.push(msg.text()); });
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));

  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await expect(page.locator('.cg-hero-balance, [class*="hero-balance"]').first()).toBeVisible({ timeout: 10000 });

  const destinos = ['Transações', 'Compras', 'Recursos', 'Caixinhas', 'Grupo', 'Perfil'];
  for (const destino of destinos) {
    const link = page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: destino }).first();
    if (await link.count()) {
      await link.click();
      await page.waitForTimeout(400);
    }
  }

  expect(erros, `erros de console encontrados: ${JSON.stringify(erros)}`).toEqual([]);
});
