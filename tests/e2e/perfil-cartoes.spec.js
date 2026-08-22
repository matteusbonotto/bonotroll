// Multi-cartão (2026-08-22, .claude/discussions/001-cartao-credito-multi-cartao.md):
// Perfil → "Cartões de crédito" abre o gerenciador (Alpine.store('cartaoModal')),
// no mesmo padrão de dois modais empilhados de bankModal. O seed demo já tem
// dois cartões (Nubank do Matheus, Inter da Beatriz); o teste cria um terceiro
// e confirma que ele aparece na lista e no seletor de cartão do formulário de
// despesa.
import { test, expect } from '@playwright/test';

test('Perfil → Cartões de crédito cria cartão vinculado a banco e ele aparece no seletor de despesa', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Perfil' }).first().click();
  await page.waitForTimeout(300);

  await page.locator('.cg-list-flat', { has: page.getByRole('heading', { name: 'Cartões de crédito' }) }).click();

  const cartaoList = page.locator('.cg-modal-backdrop', { has: page.getByRole('heading', { name: 'Cartões de crédito', exact: true }) });
  await expect(cartaoList).toBeVisible();
  // Seed demo já tem os dois cartões (o nome do cartão é o span .fw-semibold;
  // "Nubank" também aparece como banco vinculado, então o locator é específico).
  const nomeCartao = (nome) => cartaoList.locator('.cg-manager-row .fw-semibold', { hasText: nome });
  await expect(nomeCartao('Nubank')).toHaveCount(1);
  await expect(nomeCartao('Inter')).toHaveCount(1);

  await cartaoList.getByRole('button', { name: 'Novo cartão' }).click();
  const cartaoForm = page.locator('.cg-modal-backdrop--stacked');
  await expect(cartaoForm).toBeVisible();
  await cartaoForm.locator('input[placeholder="Ex: Nubank, Inter, C6..."]').fill('Cartão Teste');
  await cartaoForm.locator('select').selectOption({ label: 'Nubank' });
  await cartaoForm.getByRole('button', { name: 'Criar cartão' }).click();
  await expect(cartaoForm).toBeHidden();
  await expect(cartaoList.getByText('Cartão Teste')).toBeVisible();

  await cartaoList.locator('.btn-close').click();
  await expect(cartaoList).toBeHidden();

  // O cartão novo aparece no seletor de cartão do formulário de despesa
  // (o seletor fica na seção "Quando", dentro de "Mais opções").
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Início' }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Nova despesa' }).click();
  const txModal = page.locator('.cg-modal-backdrop', { has: page.getByRole('heading', { name: 'Novo lançamento' }) });
  await expect(txModal).toBeVisible();
  await txModal.getByRole('button', { name: 'Mais opções' }).click();
  await page.waitForTimeout(200);
  const seletor = txModal.locator('#cartaoCredito');
  // Debug: imprime estado do select e do form.tipo no console.

  await expect(seletor).toBeVisible();
  await expect(seletor.locator('option', { hasText: 'Cartão Teste' })).toHaveCount(1);
  await expect(seletor.locator('option', { hasText: 'Nubank' })).toHaveCount(1);
  await expect(seletor.locator('option', { hasText: 'Inter' })).toHaveCount(1);
});
