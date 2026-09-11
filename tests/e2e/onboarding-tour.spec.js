// TASK-037 — tour guiado de onboarding. Cobre o critério pedido pelo
// usuário de teste: aparece sozinho na primeira visita, some ao ser
// dispensado e NÃO reaparece sozinho depois (localStorage
// bonotto_onboarding_v1_seen), e pode ser reaberto a qualquer momento por
// "Rever tutorial" em Perfil.
import { test, expect } from '@playwright/test';

// O restante da suíte assume, por padrão (ver playwright.config.js), que a
// flag "já visto" já está setada — senão o tour abriria sozinho por cima de
// QUALQUER teste que faça login, travando cliques (.cg-modal-backdrop
// intercepta pointer events de propósito). Só os testes DESTE describe
// precisam de fato simular uma "primeira visita" — storageState vazio
// sobrescreve o default só aqui.
test.describe('primeira visita (storageState vazio)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('tour aparece na 1ª visita, fecha com "Pular" e não reabre sozinho num reload', async ({ page }) => {
    await page.goto('/?demo=1');
    await page.getByText('Entrar como', { exact: false }).first().click();

    // Um só .cg-modal-backdrop tem .cg-tour dentro — filtra por isso em vez
    // de por índice/ordem, que mudaria se outro modal fosse adicionado antes
    // dele no HTML no futuro.
    const backdrop = page.locator('.cg-modal-backdrop', { has: page.locator('.cg-tour') });
    await expect(backdrop).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Bem-vindo(a) ao Bõnotto!')).toBeVisible();

    await page.getByRole('button', { name: 'Pular' }).click();
    await expect(backdrop).toBeHidden();

    // A flag precisa ter sido persistida de verdade (não só o estado do
    // Alpine em memória) — é o que garante "não repete sozinho" mesmo com a
    // aba fechada e reaberta, não só nesta mesma sessão de JS.
    const vistoNoStorage = await page.evaluate(() => localStorage.getItem('bonotto_onboarding_v1_seen'));
    expect(vistoNoStorage).toBe('1');

    await page.reload();
    await page.waitForTimeout(500);
    await expect(backdrop).toBeHidden();
  });

  test('dá pra navegar pelos passos e "Próximo" no último passo também marca como visto', async ({ page }) => {
    await page.goto('/?demo=1');
    await page.getByText('Entrar como', { exact: false }).first().click();

    const backdrop = page.locator('.cg-modal-backdrop', { has: page.locator('.cg-tour') });
    await expect(backdrop).toBeVisible({ timeout: 5000 });

    const proximo = page.getByRole('button', { name: 'Próximo' });
    for (let i = 0; i < 4; i++) {
      await proximo.click();
    }
    await expect(page.getByText('Pronto pra começar!')).toBeVisible();

    await page.getByRole('button', { name: 'Começar a usar' }).click();
    await expect(backdrop).toBeHidden();

    const vistoNoStorage = await page.evaluate(() => localStorage.getItem('bonotto_onboarding_v1_seen'));
    expect(vistoNoStorage).toBe('1');
  });
});

test('tour reabre a qualquer momento por "Rever tutorial" em Perfil, mesmo já tendo sido visto', async ({ page }) => {
  // Usa o storageState padrão (já "visto", ver playwright.config.js) — o
  // ponto aqui é justamente provar que dá pra reabrir de novo DEPOIS de já
  // ter sido visto, sem depender da abertura automática de 1ª visita.
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();

  const backdrop = page.locator('.cg-modal-backdrop', { has: page.locator('.cg-tour') });
  await expect(backdrop).toBeHidden();

  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Perfil' }).first().click();
  await page.locator('.cg-list-flat', { hasText: 'Rever tutorial' }).click();

  await expect(backdrop).toBeVisible({ timeout: 5000 });
  await expect(page.getByText('Bem-vindo(a) ao Bõnotto!')).toBeVisible();

  // Esc fecha (setupOverlayBehavior, js/app.js) e devolve o foco — mesmo
  // mecanismo central já usado pelos outros ~12 modais do app, reaproveitado
  // aqui sem reimplementação própria.
  await page.keyboard.press('Escape');
  await expect(backdrop).toBeHidden();
});
