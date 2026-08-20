// Regressão Fase 2 (DESIGN-SYSTEM-2027.md §7): Perfil → Preferências era 6
// .cg-card empilhados ("card dentro de card"); virou 1 .cg-card com linhas
// .cg-list-flat divididas por borda. Garante que a interatividade (clique
// abre o modal certo) sobreviveu à troca de wrapper.
import { test, expect } from '@playwright/test';

test('linha "Categorias" em Perfil continua abrindo o gerenciador de categorias', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Perfil' }).first().click();
  await page.waitForTimeout(400);

  // filtra pelo <h2> (título da linha), não pelo texto da linha inteira —
  // a descrição de "Exportar meus dados" também menciona "categorias".
  await page.locator('.cg-list-flat').filter({ has: page.locator('h2', { hasText: 'Categorias' }) }).click();
  await expect(page.locator('.cg-modal-backdrop[x-show="$store.categoryModal.open"]')).toBeVisible({ timeout: 5000 });
});
