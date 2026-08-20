// Regressão do bug documentado em RAIO-X §8.5 / DESIGN-SYSTEM-2027 §1:
// o accordion de "Agrupar" em Transações usava x-show num elemento com
// classe .d-flex do Bootstrap (!important), que vence o display:none do
// Alpine — o grupo "fechava" visualmente mas o conteúdo nunca saía do DOM.
// Corrigido trocando por x-if. Este teste garante que um grupo fechado sai
// de verdade do DOM (contagem de <table> cai), não só fica invisível.
import { test, expect } from '@playwright/test';

test('grupo fechado no Agrupar remove o conteúdo do DOM (x-if), não só esconde', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Transações' }).first().click();
  await page.waitForTimeout(400);

  await page.getByRole('button', { name: 'Agrupar' }).click();
  await page.waitForTimeout(300);

  // Locator posicional (nth), não filtrado por ícone — o botão de cabeçalho
  // do grupo continua no DOM o tempo todo (só o corpo do grupo usa x-if);
  // um locator filtrado por ":has(i.bi-chevron-up)" pararia de bater com o
  // MESMO botão assim que o ícone virasse chevron-down, invalidando a
  // referência depois do clique.
  const headers = page.locator('button:has(i.bi-chevron-up), button:has(i.bi-chevron-down)');
  await expect(headers.first()).toBeVisible({ timeout: 5000 });

  const totalHeaders = await headers.count();
  let idxAberto = -1;
  for (let i = 0; i < totalHeaders; i++) {
    if (await headers.nth(i).locator('i.bi-chevron-up').count()) { idxAberto = i; break; }
  }
  expect(idxAberto, 'esperava pelo menos um grupo aberto por padrão').toBeGreaterThanOrEqual(0);
  const alvo = headers.nth(idxAberto);

  const tabelasAntes = await page.locator('table.cg-table').count();
  const cardsAntes = await page.locator('.cg-tx-row, [class*="cg-card"]').count();

  await alvo.click();
  await page.waitForTimeout(200);

  // o mesmo botão agora deve mostrar chevron-down (fechado)
  await expect(alvo.locator('i.bi-chevron-down')).toBeVisible();

  const tabelasDepois = await page.locator('table.cg-table').count();
  const cardsDepois = await page.locator('.cg-tx-row, [class*="cg-card"]').count();

  // o conteúdo do grupo precisa ter saído do DOM de verdade — nunca só
  // ficado invisível (que era exatamente o bug antigo).
  expect(tabelasDepois + cardsDepois).toBeLessThan(tabelasAntes + cardsAntes);

  // reabrir devolve o conteúdo (x-if recria, não é destruição permanente)
  await alvo.click();
  await page.waitForTimeout(200);
  await expect(alvo.locator('i.bi-chevron-up')).toBeVisible();
});
