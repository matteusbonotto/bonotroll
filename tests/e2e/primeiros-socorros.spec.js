import { test, expect } from '@playwright/test';

test('Primeiros socorros: abre pelo menu, liga para o SAMU e busca um tópico', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Saúde' }).first().click();
  const secao = page.locator('section[x-data^="primeirosSocorrosView"]');
  await expect(secao).toBeVisible();
  await expect(secao.locator('a[href="tel:192"]').first()).toBeVisible();
  // Menu de 3 caminhos (2026-10-05): Sintomas → busca → página da situação.
  await expect(secao.getByRole('button', { name: /Emergência/ })).toBeVisible();
  await secao.getByRole('button', { name: /Sintomas/ }).click();
  await secao.getByLabel('O que aconteceu?').fill('engasgo');
  await secao.getByRole('button', { name: /Engasgo/ }).click();
  await expect(secao.getByText('manobra de Heimlich', { exact: false })).toBeVisible();
});

test('Emergência mostra os números e as situações graves; Voltar sobe um nível', async ({ page }) => {
  await page.goto('/app?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.evaluate(() => Alpine.store('app').setView('socorros'));
  const secao = page.locator('section[x-data^="primeirosSocorrosView"]');
  await secao.getByRole('button', { name: /Emergência/ }).click();
  await expect(secao.getByRole('heading', { name: 'Emergência' })).toBeVisible();
  await expect(secao.locator('.cg-socorros-numero').first()).toBeVisible();
  await secao.locator('.cg-socorros-item').first().click();
  await expect(secao.getByRole('heading', { name: 'O que fazer' })).toBeVisible();
  await secao.getByRole('button', { name: 'Voltar' }).click();
  await expect(secao.getByRole('heading', { name: 'Emergência' })).toBeVisible();
  await secao.getByRole('button', { name: 'Voltar' }).click();
  await expect(secao.getByRole('button', { name: /Informações dos membros/ })).toBeVisible();
});
