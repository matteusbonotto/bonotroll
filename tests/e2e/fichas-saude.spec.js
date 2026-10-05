import { test, expect } from '@playwright/test';

// Fase 8 (Palm Business): ficha de emergência cifrada ponta a ponta.
test('cria a senha da família, cadastra pessoa com alergia e tipo sanguíneo, dado salvo cifrado, tranca e abre de novo', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item', { hasText: 'Saúde' }).first().click();
  // Fichas ficam em Primeiros socorros → "Informações dos membros".
  await page.locator('section[x-data^="primeirosSocorrosView"]').getByRole('button', { name: /Informações dos membros/ }).click();
  const fichas = page.locator('section.cg-fichas');
  await fichas.getByLabel('Crie a senha da família (mínimo 8 caracteres)').fill('familia segura 2026');
  await fichas.getByLabel('Repita a senha').fill('familia segura 2026');
  await fichas.getByRole('button', { name: 'Criar e continuar' }).click();
  await expect(fichas.locator('.cg-cofre-codigo')).toHaveText(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){5}$/, { timeout: 15000 });
  await fichas.getByLabel('Guardei o código num lugar seguro').check();
  await fichas.getByRole('button', { name: 'Continuar' }).click();

  await fichas.getByRole('button', { name: 'Adicionar pessoa' }).click();
  await fichas.getByLabel('Nome *').fill('Vó Rosa');
  await fichas.getByLabel('Tipo sanguíneo').selectOption('O-');
  await fichas.getByLabel('Alergias (uma por linha)').fill('Dipirona\nPenicilina');
  await fichas.getByLabel('Contato de emergência').fill('Carla');
  await fichas.getByLabel('Telefone do contato').fill('(11) 98888-7777');
  await fichas.getByRole('button', { name: 'Salvar' }).click();

  const card = fichas.locator('.cg-ficha', { hasText: 'Vó Rosa' });
  await expect(card.locator('.cg-ficha__sangue')).toContainText('Tipo O-');
  await expect(card.locator('.cg-ficha__alergias')).toContainText('Dipirona, Penicilina');
  await expect(card.getByRole('link', { name: 'Ligar para Carla' })).toHaveAttribute('href', 'tel:11988887777');

  const salvo = await page.evaluate(() => localStorage.getItem('bonotto_demo_db_v3'));
  expect(salvo).not.toContain('Dipirona');
  expect(salvo).not.toContain('Vó Rosa');

  await fichas.getByRole('button', { name: 'Trancar as fichas neste aparelho' }).click();
  await expect(fichas.getByText('Fichas protegidas')).toBeVisible();
  await fichas.getByLabel('Senha da família', { exact: true }).fill('senha errada');
  await fichas.getByRole('button', { name: 'Abrir fichas' }).click();
  await expect(fichas.getByRole('alert')).toContainText('Senha da família incorreta');
  await fichas.getByLabel('Senha da família', { exact: true }).fill('familia segura 2026');
  await fichas.getByRole('button', { name: 'Abrir fichas' }).click();
  await expect(fichas.locator('.cg-ficha', { hasText: 'Vó Rosa' })).toBeVisible({ timeout: 15000 });
});
