import { test, expect } from '@playwright/test';

// BNTT Business (demonstração): unidades, filtro por unidade e papéis.
async function entrarBusiness(page) {
  await page.goto('/app?demo=1&tipo=business');
  await page.evaluate(() => localStorage.setItem('bonotto_onboarding_v2_seen', '1'));
  await page.getByText('Entrar como', { exact: false }).first().click();
  await expect(page.locator('html')).toHaveAttribute('data-linha', 'business');
}

test('cria unidades, lança numa delas e o seletor do topo filtra', async ({ page }) => {
  await entrarBusiness(page);
  await page.evaluate(() => Alpine.store('app').setView('grupo'));
  const nova = page.getByLabel('Nome da nova unidade');
  await nova.fill('Loja Centro');
  await page.getByRole('button', { name: 'Criar unidade' }).click();
  await expect(page.locator('.cg-unidades__lista li')).toHaveCount(1);
  await nova.fill('Filial Norte');
  await page.getByRole('button', { name: 'Criar unidade' }).click();
  await expect(page.locator('.cg-unidades__lista li')).toHaveCount(2);

  // Lançamento novo já nasce na unidade escolhida no topo.
  const topo = page.getByRole('combobox', { name: 'Unidade', exact: true });
  await topo.selectOption({ label: 'Filial Norte' });
  await page.evaluate(() => Alpine.store('txModal').openNew('saida'));
  await page.getByLabel('Título', { exact: true }).fill('Aluguel da filial');
  await page.getByLabel('Valor (R$)').fill('1500');
  await expect(page.locator('#cg-campo-txmodal-unidade')).toHaveValue(await page.evaluate(() => Alpine.store('app').unidadeAtual));
  await page.locator('.cg-modal:visible').getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Despesa salva.')).toBeVisible();

  await page.evaluate(() => Alpine.store('app').setView('transacoes'));
  const secao = page.locator('section[x-data^="transactionsView"]');
  await expect(secao.getByText('Aluguel da filial').first()).toBeVisible();
  // Na outra unidade, o lançamento não aparece.
  await topo.selectOption({ label: 'Loja Centro' });
  await expect(secao.getByText('Aluguel da filial')).toHaveCount(0);
  await topo.selectOption({ label: 'Todas as unidades' });
  await expect(secao.getByText('Aluguel da filial').first()).toBeVisible();
});

test('dono troca o papel de alguém; contador não consegue lançar', async ({ page }) => {
  await entrarBusiness(page);
  await page.evaluate(() => Alpine.store('app').setView('grupo'));
  await page.getByRole('combobox', { name: 'Papel de Carla' }).selectOption('contador');
  await expect(page.getByText('Carla agora é contador.')).toBeVisible();

  // Entra como Carla (contadora): a regra vale para ela.
  await page.evaluate(async () => {
    const app = Alpine.store('app');
    await app.loginDemo(app.demoProfiles.find((p) => p.nome === 'Carla').id);
  });
  await expect.poll(() => page.evaluate(() => Alpine.store('app').meuPapel)).toBe('contador');
  await page.evaluate(() => Alpine.store('txModal').openNew('saida'));
  await page.getByLabel('Título', { exact: true }).fill('Teste contador');
  await page.getByLabel('Valor (R$)').fill('10');
  await page.locator('.cg-modal:visible').getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Com o papel de contador você consulta e exporta, mas não lança.')).toBeVisible();
});
