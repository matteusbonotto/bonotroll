// Badge de categoria (2026-10-11): no celular só o ícone, com balão do nome
// ao tocar ou focar pelo teclado; no computador, ícone + nome. Uma
// implementação só (js/components/categoriaBadge.js).
import { test, expect } from '@playwright/test';
import { contraste } from '../../js/utils/cor.js';

const badgesDaHome = (page) => page.locator('section[x-data^="dashboardView"] .cg-chip--cat:visible');

async function entrar(page) {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await expect(badgesDaHome(page).first()).toBeVisible({ timeout: 10000 });
  // O dashboard recarrega a lista em segundo plano logo após o login
  // (recorrências/notificações) — espera estabilizar para não tocar num
  // badge que vai ser trocado por outro.
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
}

test.describe('celular (390 px)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('só o ícone, nome acessível e contraste suficiente', async ({ page }) => {
    await entrar(page);
    const badge = badgesDaHome(page).first();
    const caixa = await badge.boundingBox();
    expect(caixa.width).toBeLessThanOrEqual(34);
    await expect(badge.locator('.cg-chip__nome')).toHaveCSS('clip', 'rect(0px, 0px, 0px, 0px)');
    await expect(badge).toHaveAttribute('aria-label', /^Categoria: .+/);
    await expect(badge.locator('i.bi')).toBeVisible();
    const { fundo, texto } = await badge.evaluate((e) => ({ fundo: e.style.background, texto: e.style.color }));
    const hex = (rgb) => '#' + rgb.match(/\d+/g).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
    expect(contraste(hex(fundo), hex(texto))).toBeGreaterThanOrEqual(3);
  });

  test('tocar abre o balão com o nome; tocar fora fecha', async ({ page }) => {
    await entrar(page);
    const badge = badgesDaHome(page).first();
    const nome = (await badge.getAttribute('aria-label')).replace('Categoria: ', '');
    await badge.tap();
    const balao = badge.locator('.cg-chip__balao');
    await expect(balao).toBeVisible();
    await expect(balao).toHaveText(nome);
    await expect(badge).toHaveAttribute('aria-expanded', 'true');
    await page.locator('body').tap({ position: { x: 5, y: 400 } });
    await expect(balao).toBeHidden();
  });

  test('teclado: Tab foca e abre, Esc fecha, Enter alterna', async ({ page }) => {
    await entrar(page);
    const badge = badgesDaHome(page).first();
    await badge.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const balao = badge.locator('.cg-chip__balao');
    await expect(balao).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(balao).toBeHidden();
    await page.keyboard.press('Enter');
    await expect(balao).toBeVisible();
  });
});

test('computador: ícone + nome visíveis, sem balão desnecessário', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await entrar(page);
  const badge = badgesDaHome(page).first();
  await expect(badge.locator('.cg-chip__nome')).toBeVisible();
  await expect(badge.locator('i.bi, img.cg-chip__icon-img').first()).toBeVisible();
  await badge.hover();
  await expect(badge.locator('.cg-chip__balao')).toBeHidden();
});
