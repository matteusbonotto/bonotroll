import { test, expect } from '@playwright/test';

// Fase 9: a tela mostra o estado REAL das notificações e o que fazer.
async function abrirPerfil(page, permissao) {
  await page.addInitScript((p) => {
    Object.defineProperty(Notification, 'permission', { get: () => p, configurable: true });
    Notification.requestPermission = async () => p;
  }, permissao);
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item', { hasText: 'Configurações' }).first().click();
  return page.locator('.cg-push-estado');
}

test('permissão bloqueada: explica como liberar e não finge que ativou', async ({ page }) => {
  const estado = await abrirPerfil(page, 'denied');
  await expect(estado).toContainText('Bloqueadas no navegador');
  await expect(estado).toContainText('cadeado');
  await expect(estado.getByRole('button', { name: 'Já liberei — conferir' })).toBeVisible();
});

test('não pedida: oferece ativar; se o navegador bloquear no pedido, mostra a explicação', async ({ page }) => {
  const estado = await abrirPerfil(page, 'default');
  await expect(estado.getByRole('button', { name: 'Ativar notificações' })).toBeVisible();
  await page.evaluate(() => { Notification.requestPermission = async () => 'denied'; });
  await estado.getByRole('button', { name: 'Ativar notificações' }).click();
  await expect(estado).toContainText('Bloqueadas no navegador');
});

test('erro do navegador vira frase em português; o texto técnico fica escondido em "Detalhes"', async ({ page }) => {
  await page.addInitScript(() => {
    PushManager.prototype.getSubscription = async () => null;
    PushManager.prototype.subscribe = async () => { throw new DOMException('Registration failed - push service error', 'AbortError'); };
  });
  const estado = await abrirPerfil(page, 'granted');
  await estado.getByRole('button', { name: 'Ativar notificações' }).click();
  const alerta = estado.getByRole('alert');
  await expect(alerta).toContainText('serviço de avisos do celular');
  await expect(alerta).not.toContainText('Registration failed');
  await expect(estado.locator('details')).toBeVisible();
  await expect(estado.locator('details code')).toBeHidden(); // fechado até a pessoa abrir
  await expect(estado.getByRole('button', { name: 'Ativar notificações' })).toBeEnabled(); // não fica preso em "Ativando…"
});
