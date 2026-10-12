import { test, expect } from '@playwright/test';
import { pdfDePaginas } from '../fixtures/irpf/pdfSimples.js';
import { informeEmpregador, informeBanco, extratoMensal } from '../fixtures/irpf/sinteticos.js';

// IRPF (BNTT Home), modo demonstração, com documentos SINTÉTICOS lidos pelo
// pdf.js de verdade no navegador. Fluxo: escolher exercício → importar lote
// → conferir/corrigir → perguntas → resumo → recarregar e retomar.
const pdf = (name, paginas) => ({ name, mimeType: 'application/pdf', buffer: pdfDePaginas(paginas) });

async function abrirIrpf(page) {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item', { hasText: 'Imposto de Renda' }).click();
  return page.locator('section[x-data^="irpfView"]');
}

test('importa lote, recusa arquivo inválido, detecta repetido, confere, resume e retoma depois de recarregar', async ({ page }) => {
  test.setTimeout(120000); // lê 4 PDFs de verdade e percorre as 4 etapas
  const tela = await abrirIrpf(page);
  await expect(tela.getByText('Estimativa preliminar', { exact: false }).or(tela.getByText('estimativa preliminar'))).toBeVisible();
  await tela.getByRole('button', { name: /Exercício 2026/ }).click();
  await expect(tela.getByRole('button', { name: 'Documentos', exact: true })).toHaveAttribute('aria-current', 'step');

  await tela.getByTestId('irpf-arquivos').setInputFiles([
    pdf('informe-empresa.pdf', informeEmpregador()),
    pdf('informe-banco.pdf', informeBanco()),
    pdf('extrato-janeiro.pdf', extratoMensal()),
    { name: 'falso.pdf', mimeType: 'application/pdf', buffer: Buffer.from('isto não é um PDF') },
  ]);
  const docs = tela.getByTestId('irpf-doc');
  await expect(docs).toHaveCount(4, { timeout: 30000 });
  await expect(docs.filter({ hasText: 'informe-empresa.pdf' })).toContainText('Lido');
  await expect(docs.filter({ hasText: 'informe-empresa.pdf' })).toContainText('Empresa Fictícia de Testes Ltda');
  await expect(docs.filter({ hasText: 'extrato-janeiro.pdf' })).toContainText('Não usado');
  await expect(docs.filter({ hasText: 'falso.pdf' })).toContainText('Recusado');

  // O mesmo arquivo de novo: não cria outro documento.
  await tela.getByTestId('irpf-arquivos').setInputFiles([pdf('informe-empresa (1).pdf', informeEmpregador())]);
  await expect(tela.locator('.cg-irpf__lote')).toContainText('mesmo arquivo');
  await expect(docs).toHaveCount(4);

  // Conferência: nada conta até confirmar.
  await tela.getByRole('button', { name: 'Conferir os valores' }).click();
  const salario = tela.getByTestId('irpf-item').filter({ hasText: 'Rendimentos recebidos de pessoa jurídica' });
  await expect(salario).toContainText('R$ 48.000,00');
  await expect(salario).toContainText('Lido do documento');
  await expect(salario).toContainText('informe-empresa.pdf, página 1');
  // Balão de ajuda com explicação simples, acessível por teclado.
  await salario.getByRole('button', { name: /O que é Rendimentos recebidos/ }).focus();
  await page.keyboard.press('Enter');
  await expect(salario.getByRole('tooltip')).toContainText('informe de rendimentos');
  await page.keyboard.press('Escape');

  for (const nome of ['Rendimentos recebidos de pessoa jurídica', 'Contribuição previdenciária oficial']) {
    await tela.getByTestId('irpf-item').filter({ hasText: nome }).getByRole('button', { name: 'Está certo' }).click();
  }
  // Corrige o imposto retido (simula o valor certo ser outro).
  const irrf = tela.getByTestId('irpf-item').filter({ hasText: 'Imposto retido na fonte' });
  await irrf.getByRole('button', { name: 'Corrigir' }).click();
  await irrf.getByLabel('Valor correto').fill('1.900,00');
  await irrf.getByRole('button', { name: 'Salvar' }).click();
  await expect(irrf).toContainText('Corrigido por você');
  await expect(irrf).toContainText('R$ 1.900,00');
  await expect(salario).toContainText('Confirmado');

  // Perguntas
  await tela.getByRole('button', { name: 'Continuar' }).click();
  await tela.getByRole('group', { name: /dependentes/ }).getByLabel('Não').check();
  await tela.getByRole('group', { name: /sem documento/ }).getByLabel('Não').check();
  await tela.getByRole('button', { name: 'Ver o resumo' }).click();

  // Resumo: 48.000 − 5.280 = 42.720 (completo) → 15% − 4.679,03 = 1.728,97;
  // simplificado: 48.000 − 9.600 = 38.400 → 1.080,97 (melhor). 1.080,97 − 1.900 = restituir 819,03.
  const resultado = tela.getByTestId('irpf-resultado');
  await expect(resultado).toContainText('Imposto a restituir (estimado)');
  await expect(resultado).toContainText('R$ 819,03');
  await expect(resultado).toContainText('desconto simplificado');
  await expect(resultado).toContainText('não é o cálculo oficial');
  // Banco e poupança ainda não conferidos → estimativa parcial, explicada.
  await expect(tela.getByRole('status').filter({ hasText: 'Faltam' })).toContainText('aguardando sua conferência');
  await expect(tela.locator('.cg-irpf__guia-ficha').first()).toContainText('Rendimentos Tributáveis Recebidos de Pessoa Jurídica pelo Titular');

  // Exporta o CSV do BNTT (rotulado como não oficial).
  const [download] = await Promise.all([page.waitForEvent('download'), tela.getByRole('button', { name: 'Baixar planilha (CSV)' }).click()]);
  expect(download.suggestedFilename()).toBe('bntt-irpf-2026-organizacao.csv');

  // Recarrega: retoma no mesmo exercício, com o que já foi conferido.
  await page.reload();
  // A sessão demo volta sozinha; se pedir para entrar de novo, entra.
  const entrar = page.getByText('Entrar como', { exact: false }).first();
  if (await entrar.isVisible().catch(() => false)) await entrar.click();
  await page.waitForFunction(() => window.Alpine?.store('app')?.profile?.id);
  await page.evaluate(() => Alpine.store('app').setView('irpf'));
  await expect(tela.locator('#cg-irpf-titulo')).toContainText('exercício 2026');
  await expect(tela.getByTestId('irpf-item').filter({ hasText: 'Imposto retido na fonte' })).toContainText('Corrigido por você');
});

test('a conta Business não tem a área de Imposto de Renda', async ({ page }) => {
  await page.goto('/app?demo=1&tipo=business');
  await page.evaluate(() => localStorage.setItem('bonotto_onboarding_v2_seen', '1'));
  await page.getByText('Entrar como', { exact: false }).first().click();
  await expect(page.locator('html')).toHaveAttribute('data-linha', 'business');
  await expect(page.locator('.cg-sidebar__item', { hasText: 'Imposto de Renda' })).toHaveCount(0);
  // Rota direta também não abre: volta para o Início.
  await page.evaluate(() => Alpine.store('app').setView('irpf'));
  await expect(page.locator('section[x-data^="irpfView"]')).toBeHidden();
});

test('celular (390 px): tela cabe sem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.evaluate(() => Alpine.store('app').setView('irpf'));
  const tela = page.locator('section[x-data^="irpfView"]');
  await tela.getByRole('button', { name: /Exercício 2026/ }).click();
  await expect(tela.getByRole('button', { name: 'Documentos', exact: true })).toHaveAttribute('aria-current', 'step');
  await tela.getByTestId('irpf-arquivos').setInputFiles([pdf('informe-empresa.pdf', informeEmpregador())]);
  await expect(tela.getByTestId('irpf-doc')).toHaveCount(1, { timeout: 30000 });
  await tela.getByRole('button', { name: 'Conferir os valores' }).click();
  const largura = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largura).toBeLessThanOrEqual(390);
});
