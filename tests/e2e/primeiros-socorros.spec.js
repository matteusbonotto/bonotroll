import { test, expect } from '@playwright/test';

test('Primeiros socorros: abre pelo menu, liga para o SAMU e busca um tópico', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Primeiros socorros' }).first().click();
  const secao = page.locator('section[x-data^="primeirosSocorrosView"]');
  await expect(secao).toBeVisible();
  await expect(secao.locator('a[href="tel:192"]').first()).toBeVisible();
  await secao.getByLabel('O que aconteceu?').fill('engasgo');
  await secao.getByRole('button', { name: /Engasgo/ }).click();
  await expect(secao.getByText('manobra de Heimlich', { exact: false })).toBeVisible();
});
