import { test, expect } from '@playwright/test';

// Regressão (2026-09-01, bug real relatado em uso): usuários mirando
// "Comprar" acertavam "Excluir" do lado (erro de dedo numa fileira
// apertada) e o item sumia de vez, sem chance de reverter. Corrigido com o
// mesmo padrão de "Desfazer" já usado em Recursos/Caixinha/Transações.
test('remover item de Compras: some na hora, "Desfazer" restaura', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Compras' }).first().click();
  await page.waitForTimeout(400);

  const secao = page.locator('section[x-data^="shoppingView"]');
  const primeiraLinha = secao.locator('.cg-item-row').first();
  test.skip(!(await primeiraLinha.count()), 'conta demo sem item de Compras visível — nada a testar');
  const nomeItem = (await primeiraLinha.locator('.cg-item-row__nome').innerText()).trim();

  await primeiraLinha.locator('button[title="Remover"]').click();

  const toast = page.locator('.cg-toast', { hasText: 'Item removido' });
  await expect(toast).toBeVisible({ timeout: 3000 });
  // Sumiu da lista na hora (otimista), antes mesmo de clicar Desfazer.
  await expect(secao.locator('.cg-item-row__nome', { hasText: nomeItem })).toHaveCount(0);

  await toast.getByText('Desfazer').click();
  await expect(toast).toBeHidden({ timeout: 3000 });
  // Voltou pra lista (id novo, mesmo nome).
  await expect(secao.locator('.cg-item-row__nome', { hasText: nomeItem })).toHaveCount(1, { timeout: 3000 });
});
