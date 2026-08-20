// Regressão Fase 4 (BONOTTO-2027-BLUEPRINT.md, Conflito 1): "Mercado
// 184,90" na entrada rápida precisa pré-preencher título e valor nos campos
// de sempre, sem salvar sozinho.
import { test, expect } from '@playwright/test';

test('entrada rápida "Mercado 184,90" pré-preenche título e valor', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.getByRole('button', { name: 'Nova despesa' }).first().click();

  const rapida = page.locator('input[x-model="$store.txModal.entradaRapida"]');
  await expect(rapida).toBeVisible({ timeout: 5000 });
  await rapida.fill('Mercado 184,90');

  await expect(page.locator('input[x-model="$store.txModal.form.titulo"]')).toHaveValue('Mercado');
  await expect(page.locator('input[x-model="$store.txModal.form.valor"]')).toHaveValue('184.9');
});

test('entrada rápida some ao editar um lançamento existente (nunca reaparece pra sobrescrever dado real)', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();

  await page.evaluate(() => {
    const el = document.querySelector('[x-data^="txModal"], body'); // txModal é store global, não precisa de elemento específico
    window.Alpine.store('txModal').openEdit({ id: 'tx-teste', tipo: 'saida', titulo: 'Aluguel', valor: 1200, categoria_id: '', responsavel_id: '' });
  });

  await expect(page.locator('input[x-model="$store.txModal.entradaRapida"]')).toBeHidden({ timeout: 5000 });
});
