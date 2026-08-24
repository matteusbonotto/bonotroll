// Regressão de bug relatado em uso real (2026-08-23): "quando eu encerro a
// compra e tem itens que não foram marcados como comprado, eles não devem
// ser removidos da lista de compras". Investigando o código, finishShopping()
// (js/services/shoppingList.js) só muda o status da lista pra "finalizada" —
// nunca apaga nenhuma linha de shopping_list_items — e o detalhe do
// histórico (verDetalheHistorico) carrega TODOS os itens, comprados ou não.
// Este teste prova isso na prática: encerra uma compra com itens não
// marcados e confirma que TODOS continuam aparecendo no histórico depois.
import { test, expect } from '@playwright/test';

test('encerrar a compra mantém no histórico os itens que não foram marcados como comprado', async ({ page }) => {
  page.on('dialog', async (dialog) => {
    if (dialog.message().startsWith('Encerrar a compra?')) await dialog.accept();
    else await dialog.dismiss(); // "lançar como despesa?" — dispensa, não é o foco deste teste
  });

  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Compras' }).first().click();
  await page.waitForTimeout(400);

  const secao = page.locator('section.cg-view-compras');
  const linhasLista = secao.locator('.cg-notebook .cg-item-row');
  const totalAntes = await linhasLista.count();
  test.skip(totalAntes < 2, 'lista demo com menos de 2 itens — não dá pra testar "alguns marcados, outros não" com segurança');

  const toggleBtn = secao.locator('.cg-shopping-toggle--start, .cg-shopping-toggle--finish').first();
  const jaEmCompra = (await toggleBtn.innerText()).includes('Encerrar');
  if (!jaEmCompra) {
    await toggleBtn.click();
    await expect(toggleBtn).toContainText('Encerrar Compra');
  }

  // Marca só o primeiro item como comprado — o resto fica sem marcar de propósito.
  await linhasLista.first().getByRole('button', { name: 'Comprar' }).click();
  const precoModal = page.locator('.cg-modal-backdrop', { has: page.getByRole('heading', { name: /^Comprar:/ }) });
  await expect(precoModal).toBeVisible();
  await precoModal.getByRole('button', { name: 'Confirmar' }).click();
  await expect(precoModal).toBeHidden();

  await toggleBtn.click(); // "Encerrar Compra" — dispara os 2 confirm() acima
  await page.waitForTimeout(500);

  await secao.locator('button', { hasText: 'Histórico' }).click();
  const historicoModal = page.locator('.cg-modal-backdrop', { has: page.getByRole('heading', { name: 'Histórico de compras' }) });
  await expect(historicoModal).toBeVisible();
  await historicoModal.locator('.cg-list-row').first().click(); // a recém-finalizada é a mais recente

  // Detalhe empilha POR CIMA do histórico (mesmo padrão "lista -> formulário
  // por cima" do resto do app — os dois ficam com x-show=true ao mesmo
  // tempo), por isso escopa pelo próprio atributo x-show do detalhe, não só
  // ".cg-modal:visible" (que pegaria as linhas dos dois modais juntos).
  const detalheBackdrop = page.locator('.cg-modal-backdrop[x-show="detalheAberto"]');
  await expect(detalheBackdrop).toBeVisible();

  // O que importa: a QUANTIDADE de linhas no detalhe bate com o total de
  // ANTES de encerrar (nenhum item some por não ter sido comprado), e pelo
  // menos uma continua mostrando o círculo vazio (não marcada como comprada).
  const linhasDetalhe = detalheBackdrop.locator('.cg-list-row');
  await expect(linhasDetalhe).toHaveCount(totalAntes, { timeout: 5000 });
  await expect(detalheBackdrop.locator('.bi-circle.cg-muted').first()).toBeVisible();
});
