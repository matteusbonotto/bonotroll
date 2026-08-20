// Regressão Fase 6 (BONOTTO-2027-BLUEPRINT.md §12): "Exportar meus dados"
// baixa um JSON de verdade com o formato esperado.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('Perfil → Exportar meus dados baixa um JSON com transações/categorias/caixinhas', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Perfil' }).first().click();
  await page.waitForTimeout(400);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('.cg-list-row', { hasText: 'Exportar meus dados' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/^bonotto-meus-dados-\d{4}-\d{2}-\d{2}\.json$/);

  const caminho = await download.path();
  const conteudo = JSON.parse(fs.readFileSync(caminho, 'utf-8'));
  expect(conteudo).toHaveProperty('perfil.id');
  expect(Array.isArray(conteudo.transacoes)).toBe(true);
  expect(Array.isArray(conteudo.categorias)).toBe(true);
  expect(Array.isArray(conteudo.caixinhas)).toBe(true);
});
