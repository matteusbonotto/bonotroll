// Regressão: "Adicionar item" em Compras deixou de ser um formulário inline
// expansível e virou um modal padrão (mesmo componente cg-modal-backdrop/
// cg-modal usado no resto do app) — cobre abrir pelo FAB, adicionar um item
// (o modal continua aberto pra facilitar adicionar vários seguidos) e fechar.
import { test, expect } from '@playwright/test';

test('Adicionar item em Compras abre como modal, adiciona e fecha', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Compras' }).first().click();
  await page.waitForTimeout(400);

  const modal = page.locator('.cg-modal-backdrop', { has: page.getByRole('heading', { name: 'Adicionar item' }) });
  await expect(modal).toBeHidden();

  await page.locator('.cg-fab').click();
  await expect(modal).toBeVisible();

  const nomeInput = modal.locator('input[placeholder="Ex: Arroz 5kg"]');
  await expect(nomeInput).toBeFocused();
  await nomeInput.fill('Item de teste do modal');
  await modal.getByRole('button', { name: 'Adicionar' }).click();

  // Fica aberto entre adições (fluxo de adicionar vários itens seguidos).
  await expect(modal).toBeVisible();
  await expect(nomeInput).toHaveValue('');

  const secao = page.locator('section.cg-view-compras');
  await expect(secao.getByText('Item de teste do modal').first()).toBeVisible();

  await modal.getByRole('button', { name: 'Fechar', exact: true }).last().click();
  await expect(modal).toBeHidden();
});
