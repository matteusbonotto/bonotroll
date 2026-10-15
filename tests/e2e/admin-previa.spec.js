import { test, expect } from '@playwright/test';

// Administração do BNTT (vouchers e planos): por enquanto só PRÉVIA VISUAL.
// Garante que aparece, que é rotulada como prévia e que nada grava.
test('admin vê a prévia de vouchers e planos, com tudo desligado', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await expect.poll(() => page.evaluate(() => !!Alpine.store('app').profile)).toBe(true);
  // Fora do demo a marca vem do servidor (app_metadata.admin_app); aqui simulamos.
  await page.evaluate(() => { Alpine.store('app').conta = { ...Alpine.store('app').conta, adminApp: true }; Alpine.store('app').setView('perfil'); });
  const admin = page.getByTestId('admin-bntt');
  await expect(admin).toBeVisible();
  await expect(admin).toContainText('Prévia visual');
  await expect(admin.getByRole('button', { name: 'Criar voucher' })).toBeDisabled();
  await expect(admin).toContainText('FAMILIA-VIP');
  await admin.getByRole('tab', { name: 'Planos' }).click();
  await expect(admin).toContainText('BNTT Business');
  await expect(admin.getByRole('button', { name: 'Editar' }).first()).toBeDisabled();
});

test('modo demo não mostra a área de admin (só existe um admin, vindo do servidor)', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.evaluate(() => Alpine.store('app').setView('perfil'));
  await expect(page.getByTestId('admin-bntt')).toHaveCount(0);
});
