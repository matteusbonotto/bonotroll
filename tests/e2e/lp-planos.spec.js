import { test, expect } from '@playwright/test';

// LP na raiz (2026-10-05): Casa/Negócio, Mensal/Anual (−20%), e o plano
// escolhido chega ao app — que oferece seguir para o pagamento no Stripe.
test('LP troca Casa/Negócio e Mensal/Anual, com os preços certos', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Seu dinheiro.*Sua casa.*Sob controle/);
  const familia = page.getByRole('article', { name: 'Plano Família' });
  await expect(familia).toContainText('R$ 19,90');

  await page.getByRole('radio', { name: /Anual/ }).click();
  await expect(familia).toContainText('R$ 15,92'); // 191,04 / 12
  await expect(familia).toContainText('R$ 191,04 por ano');

  await page.getByRole('radio', { name: 'Negócio' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Seu caixa.*Sua empresa.*Sob controle/);
  await expect(page.locator('html')).toHaveAttribute('data-linha', 'business');
  await expect(page.getByRole('article', { name: 'Plano Expansão' })).toBeVisible();
  await expect(page.locator('[data-plano="business_expansao"]')).toHaveAttribute('href', /tipo=business&plano=business_expansao&ciclo=anual/);
});

test('quem chega com link do app (demo) vai direto para /app', async ({ page }) => {
  await page.goto('/?demo=1');
  await expect(page).toHaveURL(/\/app\?demo=1/);
});

test('plano escolhido na LP vira o aviso "Continuar para o pagamento" com o link do Stripe', async ({ page }) => {
  await page.goto('/app?demo=1&cadastro=1&tipo=home&plano=home_familia&ciclo=anual');
  await page.getByText('Entrar como', { exact: false }).first().click();
  const aviso = page.getByRole('dialog', { name: 'Plano Família' });
  await expect(aviso).toBeVisible();
  await expect(aviso).toContainText('20% de desconto');
  const url = await page.evaluate(() => Alpine.store('app').pagamentoPendente.url);
  expect(url).toMatch(/^https:\/\/buy\.stripe\.com\//);
  expect(url).toContain('client_reference_id=');
  await aviso.getByRole('button', { name: /Agora não/ }).click();
  await expect(aviso).toBeHidden();
});

test('demonstração Business: cores e nomes de empresa', async ({ page }) => {
  await page.goto('/app?demo=1&tipo=business');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await expect(page.locator('html')).toHaveAttribute('data-linha', 'business');
  const areas = await page.evaluate(() => Alpine.store('app').AREAS.map((a) => a.rotulo));
  expect(areas).toEqual(['Início', 'Financeiro', 'Estoque', 'Equipe']);
});
