import { test, expect } from '@playwright/test';

// Menu do avatar → Acessibilidade: A−/A+ em passos, com limites; narração e tema como chaves.
const abrirMenu = (page) => page.locator('.cg-topbar [x-data*="menuOpen"] > button').first().click();
test('A+ e A− mudam o texto um passo por toque, dentro dos limites, e lembram a escolha', async ({ page }) => {
  test.slow(); // muitos toques + recarga da página
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await abrirMenu(page);

  const valor = page.locator('.cg-texto-controle__valor');
  const mais = page.getByRole('button', { name: 'Aumentar o texto' });
  const menos = page.getByRole('button', { name: 'Diminuir o texto' });
  await expect(valor).toHaveText('100%');

  await mais.click();
  await expect(valor).toHaveText('113%');
  for (let i = 0; i < 6; i++) if (await mais.isEnabled()) await mais.click();
  await expect(valor).toHaveText('150%');
  await expect(mais).toBeDisabled();
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).fontSize)).toBe('24px');

  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.fontSize)).toBe('150%');

  await abrirMenu(page);
  for (let i = 0; i < 8; i++) if (await menos.isEnabled()) await menos.click();
  await expect(valor).toHaveText('88%');
  await expect(menos).toBeDisabled();
  await mais.click();
  await expect(valor).toHaveText('100%');
});

test('narração liga, fala o que é tocado e desliga', async ({ page }) => {
  await page.addInitScript(() => {
    window.__falas = [];
    window.speechSynthesis.speak = (u) => window.__falas.push(u.text);
  });
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await abrirMenu(page);

  const botao = page.getByRole('switch', { name: 'Narração' });
  await botao.click();
  await expect(botao).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Aumentar o texto' }).click();
  await expect.poll(() => page.evaluate(() => window.__falas.join(' | '))).toContain('Aumentar o texto');

  await botao.click();
  await expect(botao).toHaveAttribute('aria-checked', 'false');
  const antes = await page.evaluate(() => window.__falas.length);
  await page.getByRole('button', { name: 'Diminuir o texto' }).click();
  expect(await page.evaluate(() => window.__falas.length)).toBe(antes);
});

test('tema escuro é uma chave no menu do avatar', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await abrirMenu(page);
  const tema = page.getByRole('switch', { name: 'Tema escuro' });
  const antes = await tema.getAttribute('aria-checked');
  await tema.click();
  await expect(tema).not.toHaveAttribute('aria-checked', antes);
  const escuro = await page.evaluate(() => document.documentElement.getAttribute('data-bs-theme'));
  expect(escuro).toBe(antes === 'true' ? 'light' : 'dark');
});
