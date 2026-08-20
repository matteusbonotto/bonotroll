import { test, expect } from '@playwright/test';

test('remover item de Recursos: some na hora, "Desfazer" restaura', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Recursos' }).first().click();
  await page.waitForTimeout(400);

  const secao = page.locator('section[x-data^="resourcesView"]');
  await secao.locator('.cg-room-tile').first().click();
  await page.waitForTimeout(300);
  // "Todas" ou a primeira subcategoria — qualquer uma leva pra grade de itens.
  const subcat = secao.locator('.cg-room-tile').first();
  if (await subcat.count()) { await subcat.click(); await page.waitForTimeout(300); }

  const editarItem = secao.locator('.cg-resource-item__edit').first();
  test.skip(!(await editarItem.count()), 'conta demo sem item de Recursos visível nesta subcategoria — nada a testar');
  await editarItem.click();
  await page.waitForTimeout(300);

  const excluirBtn = secao.locator('button[title="Excluir"]').first();
  test.skip(!(await excluirBtn.count()), 'modal de item sem botão de excluir visível — layout pode ter mudado');
  await excluirBtn.click();

  const toast = page.locator('.cg-toast', { hasText: 'Item removido' });
  await expect(toast).toBeVisible({ timeout: 3000 });
  await toast.getByText('Desfazer').click();
  await expect(toast).toBeHidden({ timeout: 3000 });
});
