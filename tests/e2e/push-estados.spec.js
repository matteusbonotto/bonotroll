import { test, expect } from '@playwright/test';

// Fase 9: a tela mostra o estado REAL das notificações e o que fazer.
async function abrirPerfil(page, permissao) {
  await page.addInitScript((p) => {
    Object.defineProperty(Notification, 'permission', { get: () => p, configurable: true });
    Notification.requestPermission = async () => p;
  }, permissao);
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item', { hasText: 'Perfil' }).first().click();
  return page.locator('.cg-push-estado');
}

test('permissão bloqueada: explica como liberar e não finge que ativou', async ({ page }) => {
  const estado = await abrirPerfil(page, 'denied');
  await expect(estado).toContainText('bloqueadas pelo navegador');
  await expect(estado).toContainText('cadeado');
  await expect(estado.getByRole('button', { name: 'Já liberei — verificar de novo' })).toBeVisible();
});

test('não pedida: oferece ativar; se o navegador bloquear no pedido, mostra a explicação', async ({ page }) => {
  const estado = await abrirPerfil(page, 'default');
  await expect(estado).toContainText('Desativadas neste aparelho');
  await page.evaluate(() => { Notification.requestPermission = async () => 'denied'; });
  await estado.getByRole('button', { name: 'Ativar notificações' }).click();
  await expect(estado).toContainText('bloqueadas pelo navegador');
});
