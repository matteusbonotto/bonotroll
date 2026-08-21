// Antes, trocar de tela usava history.replaceState — só mantinha a URL/hash
// bookmarkável (sobrevive a F5), sem empilhar histórico nenhum. O botão
// físico "voltar" do Android/gesto do navegador fechava o app direto em vez
// de andar por dentro dele. Agora setView usa pushState (ver store.js) e um
// listener de "popstate" (js/app.js) sincroniza de volta sem reempilhar.
import { test, expect } from '@playwright/test';

test('botão voltar do navegador anda pelas telas do app (pushState), não fecha o app', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.waitForTimeout(600);

  const viewAtual = () => page.evaluate(() => Alpine.store('app').view);

  await page.locator('.cg-sidebar__item', { hasText: 'Transações' }).first().click();
  await page.waitForTimeout(200);
  await page.locator('.cg-sidebar__item', { hasText: 'Lista de compras' }).first().click();
  await page.waitForTimeout(200);
  expect(await viewAtual()).toBe('compras');

  await page.goBack();
  await page.waitForTimeout(200);
  expect(await viewAtual()).toBe('transacoes');

  await page.goBack();
  await page.waitForTimeout(200);
  expect(await viewAtual()).toBe('home');

  await page.goForward();
  await page.waitForTimeout(200);
  expect(await viewAtual()).toBe('transacoes');

  // F5 continua preservando a tela atual (comportamento de antes, não regrediu).
  await page.reload();
  await page.waitForTimeout(600);
  expect(await viewAtual()).toBe('transacoes');
});
