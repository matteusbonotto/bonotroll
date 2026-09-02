// Pedido 1/2 (2026-09-02): Recursos e Caixinhas ganharam view "Lista" (além
// da grade já existente) — mesmo padrão de toggle+persistência de
// shoppingList.js::viewMode (bonotto_view_recursos / bonotto_view_caixinhas).
// Em Recursos a troca de view é só no nível de ITEM (grid dentro de
// cômodo/subcategoria); em Caixinhas é a única grade da tela (bancos).
// Cobre também a digitação direta de quantidade em Recursos
// (.cg-qty-stepper agora tem um <input type="number"> de verdade, não só
// os botões +/-), que precisa SALVAR de verdade (sobreviver a um reload),
// não só mudar na tela.
import { test, expect } from '@playwright/test';

test('alternar pra Lista em Recursos e em Caixinhas mantém os mesmos dados visíveis', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();

  // ---------- Recursos: grid de itens (cômodo -> "Todas"/subcategoria) ----------
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Recursos' }).first().click();
  await page.waitForTimeout(400);

  const secaoRecursos = page.locator('section[x-data^="resourcesView"]');
  await secaoRecursos.locator('.cg-room-tile').first().click();
  await page.waitForTimeout(300);
  // "Todas" ou a primeira subcategoria — qualquer uma leva pra grade de itens
  // (mesmo padrão de navegação de desfazer-recurso.spec.js).
  const subcat = secaoRecursos.locator('.cg-room-tile').first();
  if (await subcat.count()) { await subcat.click(); await page.waitForTimeout(300); }

  const itemGrade = secaoRecursos.locator('.cg-resource-grid .cg-resource-item').first();
  test.skip(!(await itemGrade.count()), 'conta demo sem item de Recursos visível nesta subcategoria — nada a testar');
  const nomeItem = (await itemGrade.locator('.fw-semibold').first().innerText()).trim();

  await secaoRecursos.locator('.cg-view-toggle button[title="Lista"]').click();
  // Grade (x-if) sai do DOM, lista (x-if) entra — mesmo item, mesmo nome.
  await expect(secaoRecursos.locator('.cg-resource-grid')).toHaveCount(0);
  await expect(secaoRecursos.locator('.cg-list-row', { hasText: nomeItem })).toBeVisible();

  // Volta pra grade — não deve perder o dado nem travar em nenhum lado.
  await secaoRecursos.locator('.cg-view-toggle button[title="Grade"]').click();
  await expect(secaoRecursos.locator('.cg-resource-grid .cg-resource-item', { hasText: nomeItem })).toBeVisible();

  // ---------- Caixinhas: única grade da tela (bancos) ----------
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Caixinhas' }).first().click();
  await page.waitForTimeout(400);

  const secaoCaixinhas = page.locator('section[x-data^="caixinhasView"]');
  const bancoTile = secaoCaixinhas.locator('.cg-room-grid .cg-room-tile:not(.cg-room-tile--add)').first();
  test.skip(!(await bancoTile.count()), 'conta demo sem nenhuma caixinha — nada a testar aqui');
  const nomeBanco = (await bancoTile.locator('.cg-room-tile__nome').innerText()).trim();

  await secaoCaixinhas.locator('.cg-view-toggle button[title="Lista"]').click();
  await expect(secaoCaixinhas.locator('.cg-room-grid')).toHaveCount(0);
  await expect(secaoCaixinhas.locator('.cg-list-row', { hasText: nomeBanco })).toBeVisible();

  // Linha da lista continua clicável — entra no detalhe da caixinha (mesmo
  // handler selecionar() da grade, só reorganizado visualmente).
  await secaoCaixinhas.locator('.cg-list-row', { hasText: nomeBanco }).first().click();
  await expect(secaoCaixinhas.locator('.cg-back', { hasText: 'Caixinhas' })).toBeVisible();
});

test('digitar quantidade em Recursos persiste depois de recarregar a página', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Recursos' }).first().click();
  await page.waitForTimeout(400);

  const secao = page.locator('section[x-data^="resourcesView"]');
  await secao.locator('.cg-room-tile').first().click();
  await page.waitForTimeout(300);
  const subcat = secao.locator('.cg-room-tile').first();
  if (await subcat.count()) { await subcat.click(); await page.waitForTimeout(300); }

  const itemGrade = secao.locator('.cg-resource-grid .cg-resource-item').first();
  test.skip(!(await itemGrade.count()), 'conta demo sem item de Recursos visível nesta subcategoria — nada a testar');

  const nomeItem = (await itemGrade.locator('.fw-semibold').first().innerText()).trim();
  const input = itemGrade.locator('input.cg-qty-stepper__value');
  const valorAtual = Number(await input.inputValue()) || 0;
  const novoValor = valorAtual + 3;

  // Digitação direta (não é o botão +/-) — dispara @input, que passa por
  // definirQuantidade() (mesmo debounce de 500ms de ajustar()).
  await input.fill(String(novoValor));
  await input.dispatchEvent('input');
  await page.waitForTimeout(900);

  await page.reload();
  await page.waitForTimeout(600);
  const secao2 = page.locator('section[x-data^="resourcesView"]');
  await secao2.locator('.cg-room-tile').first().click();
  await page.waitForTimeout(300);
  const subcat2 = secao2.locator('.cg-room-tile').first();
  if (await subcat2.count()) { await subcat2.click(); await page.waitForTimeout(300); }

  const itemDepois = secao2.locator('.cg-resource-grid .cg-resource-item', { hasText: nomeItem }).first();
  await expect(itemDepois.locator('input.cg-qty-stepper__value')).toHaveValue(String(novoValor), { timeout: 5000 });
});
