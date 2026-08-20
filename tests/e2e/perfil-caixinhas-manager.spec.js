// Regressão: "Caixinhas" em Perfil virou "Bancos" — gerencia só nome+logo
// do banco (Alpine.store('bankModal')), separado de "criar/editar caixinha"
// (banco+moeda+meta+responsável, só dentro da tela de Caixinhas —
// Alpine.store('caixinhaModal')). Pedido explícito do usuário: "não quero
// abrir as caixinhas em Perfil, quero só gerenciar banco e logo — meta,
// valor, responsável é dentro do menu de caixinhas mesmo". Cobre também o
// modal empilhado: dentro da tela de Caixinhas, "+ Novo banco…" no seletor
// de banco abre o formulário de banco POR CIMA do formulário de caixinha.
import { test, expect } from '@playwright/test';

test('Perfil → Bancos gerencia só nome/logo; caixinha (meta/moeda/responsável) só na tela de Caixinhas', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Perfil' }).first().click();
  await page.waitForTimeout(300);

  await page.locator('.cg-list-flat', { has: page.getByRole('heading', { name: 'Bancos' }) }).click();

  const bankList = page.locator('.cg-modal-backdrop', { has: page.getByRole('heading', { name: 'Bancos', exact: true }) });
  await expect(bankList).toBeVisible();
  // Continua em Perfil — não navegou pra tela de Caixinhas.
  await expect(page.locator('.cg-sidebar__item.is-active').first()).toHaveText(/Perfil/);
  // Lista só tem nome+logo — nada de meta/moeda/responsável aqui.
  await expect(bankList.getByText('Meta')).toHaveCount(0);
  await expect(bankList.getByText('Responsável')).toHaveCount(0);

  await bankList.getByRole('button', { name: 'Novo banco' }).click();
  const bankForm = page.locator('.cg-modal-backdrop--stacked');
  await expect(bankForm).toBeVisible();
  await bankForm.locator('input[placeholder="Ex: Nubank, Inter, XP…"]').fill('Banco Teste');
  await bankForm.getByRole('button', { name: 'Criar banco' }).click();
  await expect(bankForm).toBeHidden();
  await expect(bankList.getByText('Banco Teste')).toBeVisible();

  await bankList.locator('.btn-close').click();
  await expect(bankList).toBeHidden();

  // Tela de Caixinhas: "Nova caixinha" mostra banco/moeda/meta/responsável
  // (não mistura com o cadastro de banco) e reconhece o banco recém-criado.
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Caixinhas' }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Nova caixinha' }).click();

  const cxModal = page.locator('.cg-modal-backdrop', { has: page.getByRole('heading', { name: 'Nova caixinha' }) });
  await expect(cxModal).toBeVisible();
  await expect(cxModal.getByText('Meta')).toBeVisible();
  await expect(cxModal.getByText('Responsável')).toBeVisible();
  await cxModal.locator('select').first().selectOption({ label: 'Banco Teste' });
  await cxModal.locator('input[type=number]').fill('500');
  await cxModal.getByRole('button', { name: 'Criar caixinha' }).click();
  await expect(page.getByText('Caixinha criada.')).toBeVisible();
  await expect(page.locator('.cg-room-tile', { hasText: 'Banco Teste' })).toBeVisible();
});
