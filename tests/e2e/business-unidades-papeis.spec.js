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
  // A demonstração já vem com as 4 padarias do Lucas.
  const lista = page.locator('.cg-unidades__lista li');
  await expect(lista).toHaveCount(4);
  const nova = page.getByLabel('Nome da nova unidade');
  await nova.fill('Loja Centro');
  await page.getByRole('button', { name: 'Criar unidade' }).click();
  await expect(lista).toHaveCount(5);
  await nova.fill('Filial Norte');
  await page.getByRole('button', { name: 'Criar unidade' }).click();
  await expect(lista).toHaveCount(6);

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
  await topo.selectOption({ label: 'Todas as filiais' });
  await expect(secao.getByText('Aluguel da filial').first()).toBeVisible();
});

test('dono troca o papel de alguém; contador não consegue lançar', async ({ page }) => {
  await entrarBusiness(page);
  await page.evaluate(() => Alpine.store('app').setView('grupo'));
  await page.getByRole('combobox', { name: 'Papel de Diego' }).selectOption('contador');
  await expect(page.getByText('Diego agora é contador.')).toBeVisible();

  // Entra como Diego (agora contador): a regra vale para ele.
  await page.evaluate(async () => {
    const app = Alpine.store('app');
    await app.loginDemo(app.demoProfiles.find((p) => p.nome === 'Diego').id);
  });
  await expect.poll(() => page.evaluate(() => Alpine.store('app').meuPapel)).toBe('contador');
  await page.evaluate(() => Alpine.store('txModal').openNew('saida'));
  await page.getByLabel('Título', { exact: true }).fill('Teste contador');
  await page.getByLabel('Valor (R$)').fill('10');
  await page.locator('.cg-modal:visible').getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(page.getByText('Com o papel de contador você consulta e exporta, mas não lança.')).toBeVisible();
});

test('demonstração: o dono tem 4 padarias (Business) e 2 casas (Home), cada linha com as suas pessoas', async ({ page }) => {
  await page.goto('/app?demo=1&tipo=business');
  await expect(page.getByText('Entrar como Marina')).toBeVisible();
  await expect(page.getByText('Entrar como Carla')).toBeHidden();
  await page.getByText('Entrar como Lucas').click();
  await expect.poll(() => page.evaluate(() => Alpine.store('app').unidades.map((u) => u.nome).sort().join(','))).toBe('Padaria Centro,Padaria Jardim,Padaria Shopping,Padaria Vila Nova');
  await page.evaluate(() => Alpine.store('app').trocarLinhaDemo('home'));
  await expect.poll(() => page.evaluate(() => Alpine.store('app').group?.group?.nome)).toBe('Família');
  await expect.poll(() => page.evaluate(() => Alpine.store('app').unidades.map((u) => u.nome).sort().join(','))).toBe('Casa,Casa da praia');
});

test('painel do dono: um bloco por filial com semáforo; tocar abre a filial e "Todas as filiais" volta', async ({ page }) => {
  await page.goto('/app?demo=1&tipo=business');
  await page.getByText('Entrar como Lucas').click();
  const blocos = page.locator('.cg-filial');
  await expect(blocos).toHaveCount(4, { timeout: 10000 });
  await expect(page.locator('.cg-filial--ok')).toContainText('Tudo em dia');
  await expect(page.locator('.cg-filial--alerta').first()).toBeVisible();
  await expect(page.locator('.cg-sugestao').first()).toContainText('Pague');
  await page.locator('.cg-filial', { hasText: 'Vila Nova' }).click();
  await expect(page.locator('.cg-filial-aberta')).toContainText('Padaria Vila Nova');
  await expect(blocos).toHaveCount(0);
  await page.getByRole('button', { name: /Todas as filiais/ }).click();
  await expect(blocos).toHaveCount(4);
});

test('funcionário não vê o painel do dono', async ({ page }) => {
  await page.goto('/app?demo=1&tipo=business');
  await page.getByText('Entrar como Diego').click();
  await expect(page.locator('.cg-hero-balance').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.cg-painel-dono')).toHaveCount(0);
});
