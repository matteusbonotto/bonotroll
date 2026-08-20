// Regressão Fase 4 (BONOTTO-2027-BLUEPRINT.md §8, fluxo de casal): "Entre
// vocês" em Grupo mostra quem deve quanto pra quem, sem precisar somar de
// cabeça. Estado injetado direto no componente pra controlar o cenário com
// precisão (não depende do que o seed de demo tem hoje).
import { test, expect } from '@playwright/test';

test('"Entre vocês" mostra a dívida líquida entre os dois membros do grupo demo', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Grupo' }).first().click();
  await page.waitForTimeout(400);

  const membros = await page.evaluate(() => {
    const el = document.querySelector('section[x-data^="groupView"]');
    const comp = window.Alpine.$data(el);
    return comp.$store.app.group?.members?.map((m) => m.id) || [];
  });
  test.skip(membros.length < 2, 'conta demo sem grupo de 2+ membros — nada a testar aqui');

  await page.evaluate((ids) => {
    const el = document.querySelector('section[x-data^="groupView"]');
    const comp = window.Alpine.$data(el);
    comp.saldosEntreMembros = [{ devedorId: ids[1], credorId: ids[0], valor: 123.45 }];
  }, membros);
  await page.waitForTimeout(200);

  await expect(page.getByText('Entre vocês')).toBeVisible();
  await expect(page.getByText('R$ 123,45')).toBeVisible({ timeout: 5000 });
});
