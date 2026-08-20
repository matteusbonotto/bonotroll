// Regressão: "Caixinhas" em Perfil deixou de só navegar pra tela de
// Caixinhas ($store.app.setView('caixinhas')) e virou um modal de gerenciar
// (criar/editar/excluir) ali mesmo, no mesmo padrão de Empresas/Categorias
// (Alpine.store('caixinhaModal'), ver js/components/caixinhaManager.js).
// Cobre: abrir o modal a partir de Perfil, editar uma caixinha existente, e
// confirmar que a mudança aparece na tela de Caixinhas (evento
// 'cg:caixinhas-changed' fazendo caixinhasView recarregar).
import { test, expect } from '@playwright/test';

test('Perfil → Caixinhas abre modal de gerenciar e edita sem navegar pra tela de Caixinhas', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Perfil' }).first().click();
  await page.waitForTimeout(300);

  await page.locator('.cg-list-flat', { has: page.getByRole('heading', { name: 'Caixinhas' }) }).click();

  const modal = page.locator('.cg-modal-backdrop', { has: page.getByRole('heading', { name: 'Caixinhas', exact: true }) });
  await expect(modal).toBeVisible();
  // Continua em Perfil — não navegou pra tela de Caixinhas.
  await expect(page.locator('.cg-sidebar__item.is-active').first()).toHaveText(/Perfil/);

  const row = modal.locator('.cg-manager-row', { hasText: 'Nubank' });
  await row.getByRole('button', { name: /Editar/ }).click();
  const metaInput = modal.locator('input[type=number]');
  await metaInput.fill('9999');
  await modal.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText('Caixinha atualizada.')).toBeVisible();

  await modal.locator('.btn-close').click();
  await expect(modal).toBeHidden();

  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Caixinhas' }).first().click();
  await page.waitForTimeout(300);
  await page.locator('.cg-room-tile', { hasText: 'Nubank' }).click();
  await expect(page.getByText('R$ 9.999,00')).toBeVisible();
});
