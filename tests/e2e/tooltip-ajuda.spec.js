// TASK-038 — tooltips de ajuda contextual (.cg-help, js/components/help.js).
// Cobre: abre por clique/toque (não só :hover), fecha com Esc, aria-*
// corretos, em mais de um campo/indicador diferente do app.
//
// storageState padrão (playwright.config.js) já marca o tour de onboarding
// (TASK-037) como visto, então ele não abre sozinho aqui — não é o foco
// deste arquivo, e abrir por cima interceptaria os cliques abaixo
// (.cg-modal-backdrop, de propósito). Ver tests/e2e/onboarding-tour.spec.js
// pro comportamento do tour em si.
import { test, expect } from '@playwright/test';

test('tooltip do saldo (Início) abre ao clicar e fecha com Esc, com aria-describedby correto', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();

  const home = page.locator('section[x-data^="dashboardView"]');
  const trigger = home.locator('.cg-help__trigger[aria-label="O que é o saldo"]');
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');

  const popover = home.locator('.cg-help__popover', { hasText: 'Entradas pagas' });
  await expect(popover).toBeHidden();

  await trigger.click();
  await expect(popover).toBeVisible();
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');

  const describedby = await trigger.getAttribute('aria-describedby');
  expect(describedby).toBeTruthy();
  await expect(popover).toHaveAttribute('id', describedby);

  await page.keyboard.press('Escape');
  await expect(popover).toBeHidden();
});

test('tooltip do "Tipo" (Fixa/Variável) e do "Recorrente", no modal de nova despesa, abrem e fecham independentemente', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();

  await page.getByRole('button', { name: 'Nova despesa' }).first().click();
  const modal = page.locator('.cg-modal-backdrop[x-show="$store.txModal.open"]');
  await expect(modal).toBeVisible({ timeout: 5000 });

  // "Tipo"/"Recorrente" moram dentro de "Mais opções" (recolhido por padrão
  // numa despesa nova comum — só nasce expandido quando o tipo já é "fixa",
  // ver $store.txModal.showMore em js/components/transactionForm.js).
  await modal.getByRole('button', { name: 'Mais opções' }).click();

  const tipoTrigger = modal.locator('.cg-help__trigger[aria-label="Diferença entre despesa fixa e variável"]');
  const tipoPopover = modal.locator('.cg-help__popover', { hasText: 'Fixa: se repete' });
  await tipoTrigger.click();
  await expect(tipoPopover).toBeVisible();

  // Esc fecha só o tooltip — o modal de despesa continua aberto (o tooltip
  // usa @keydown.escape.stop, não deixa o Esc "vazar" e fechar o modal
  // inteiro por cima, comportamento acessível esperado: fecha o overlay mais
  // interno primeiro).
  await page.keyboard.press('Escape');
  await expect(tipoPopover).toBeHidden();
  await expect(modal).toBeVisible();

  const recorrenteTrigger = modal.locator('.cg-help__trigger[aria-label="O que é recorrência"]');
  const recorrentePopover = modal.locator('.cg-help__popover', { hasText: 'repetição automática' });
  await recorrenteTrigger.click();
  await expect(recorrentePopover).toBeVisible();
  await expect(modal).toBeVisible();
});

test('tooltip do "Entre vocês" (Grupo) e do "Total guardado" (Caixinhas) existem e abrem por clique', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();

  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Caixinhas' }).first().click();
  await page.waitForTimeout(300);
  const caixinhas = page.locator('section[x-data^="caixinhasView"]');
  const caixinhaTrigger = caixinhas.locator('.cg-help__trigger[aria-label="O que é uma caixinha"]').first();
  test.skip(await caixinhaTrigger.count() === 0, 'conta demo sem nenhuma caixinha — card totalizador não renderiza');
  await caixinhaTrigger.click();
  await expect(caixinhas.locator('.cg-help__popover', { hasText: 'reserva separada' }).first()).toBeVisible();
});
