import { test, expect } from '@playwright/test';

// Open Finance (Pluggy) no modo demo: conexões fictícias, busca, revisão,
// importação e — o mais importante — reimportar não duplica.
test('open finance: busca, importa e não duplica na segunda vez', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await expect.poll(() => page.evaluate(() => !!Alpine.store('app').profile)).toBe(true);
  await page.evaluate(() => Alpine.store('app').setView('transacoes'));
  await page.getByTestId('abrir-open-finance').click();
  const modal = page.getByTestId('modal-importar');
  await expect(modal.getByRole('heading', { name: /Open Finance — suas contas/ })).toBeVisible();
  await expect(modal.locator('li', { hasText: 'Banco de Exemplo' }).first()).toBeVisible();
  await modal.getByRole('button', { name: /Buscar transações/ }).click();
  await expect(page.getByText('3 linha(s) prontas')).toBeVisible();
  await page.getByRole('button', { name: 'Importar agora' }).click();
  await expect.poll(() => page.evaluate(() => Alpine.store('csvModal').step), { timeout: 10000 }).toBe('resultado');
  const importadas = () => page.evaluate(() => JSON.parse(localStorage.getItem('bonotto_demo_db_v5')).transactions.filter((t) => (t.externo_id || '').startsWith('pluggy:demo-')));
  const primeira = await importadas();
  expect(primeira).toHaveLength(3);
  expect(Number(primeira.find((t) => t.titulo === 'Supermercado Exemplo').valor)).toBe(152.3);
  expect(primeira.find((t) => t.titulo === 'PIX recebido').tipo).toBe('entrada');

  await page.evaluate(() => Alpine.store('csvModal').openFor('transacoes'));
  await modal.getByRole('button', { name: /Buscar do banco/ }).click();
  await modal.getByRole('button', { name: /Buscar transações/ }).click();
  await expect(modal.getByText('Tudo deste período já foi importado.')).toBeVisible();
  expect(await importadas()).toHaveLength(3);
});

test('open finance: card Seus bancos na Home — fechado mostra o resumo, abre e lembra', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await expect.poll(() => page.evaluate(() => !!Alpine.store('app').profile)).toBe(true);
  await page.evaluate(() => { localStorage.removeItem('bonotto_saldos_abertos'); Alpine.store('app').setView('home'); });
  const card = page.getByTestId('saldos-bancos');
  await expect(card).toBeVisible();
  const topo = card.getByRole('button', { name: /Seus bancos/ });
  await expect(topo).toHaveAttribute('aria-expanded', 'false');
  // Fechado: resumo por banco (nome + saldo), sem o detalhe das contas.
  await expect(card.locator('.cg-bancos__chip')).toHaveCount(1);
  await expect(card.locator('.cg-bancos__chip')).toContainText('Banco de Exemplo');
  await expect(card.locator('.cg-bancos__chip')).toContainText('2.450,90');
  await expect(card.getByText('Conta Corrente ••1234')).toBeHidden();
  await expect(card).not.toContainText('MeuPluggy');
  // Aberto: contas e fatura do cartão (fora do saldo em conta).
  await topo.click();
  await expect(topo).toHaveAttribute('aria-expanded', 'true');
  await expect(card.getByText('Conta Corrente ••1234')).toBeVisible();
  await expect(card.getByText('Fatura do cartão ••9876')).toBeVisible();
  await expect(card.getByText(/Faturas de cartão: R\$\s?812,40/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bonotto_saldos_abertos'))).toBe('1');
});
