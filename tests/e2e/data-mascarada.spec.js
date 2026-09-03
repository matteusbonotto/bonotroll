// Pedido real (2026-09-02): digitar uma data livremente (dd/mm/aaaa) em vez
// de depender só do calendário nativo — selecionar 2027/2028 clicando mês a
// mês era lento demais. Ver js/utils/dateInput.js (máscara/parse puros,
// já 100% cobertos em tests/unit/dateInput.test.js) e a diretiva Alpine
// x-datamask (js/app.js) que liga essas funções nos <input> do app.
//
// Estes 2 testes cobrem a integração ponta a ponta que o unitário não pega:
// (a) digitar uma data completa persiste e volta formatada certa depois de
//     recarregar a página; (b) o botão de calendário ao lado ainda entrega
//     a data escolhida pro MESMO campo mascarado.
import { test, expect } from '@playwright/test';

test('digitar uma data completa no campo mascarado salva e persiste (recarregando a página)', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Compras' }).first().click();
  await page.waitForTimeout(400);

  const secao = page.locator('section[x-data^="shoppingView"]');
  await secao.locator('.cg-fab').click();

  const modal = page.locator('.cg-modal-backdrop', { has: page.getByRole('heading', { name: 'Adicionar item' }) });
  await expect(modal).toBeVisible();

  const nomeItem = 'Item validade teste ' + Date.now();
  await modal.getByPlaceholder('Ex: Arroz 5kg').fill(nomeItem);

  // Digita tecla-a-tecla (não .fill()) pra exercitar de verdade a máscara
  // incremental — as barras precisam aparecer sozinhas conforme os dígitos
  // vão entrando, não só quando o texto inteiro chega de uma vez.
  const campoValidade = modal.getByPlaceholder('dd/mm/aaaa');
  await campoValidade.pressSequentially('15032027', { delay: 20 });
  await expect(campoValidade).toHaveValue('15/03/2027');

  await modal.getByRole('button', { name: 'Adicionar' }).click();
  // Modal fica aberto entre adições (fluxo de adicionar vários itens
  // seguidos) — nome limpo confirma que o item foi de fato salvo.
  await expect(modal.getByPlaceholder('Ex: Arroz 5kg')).toHaveValue('');
  await modal.getByRole('button', { name: 'Fechar', exact: true }).last().click();
  await expect(modal).toBeHidden();

  await page.reload();
  await page.waitForTimeout(500);
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Compras' }).first().click();
  await page.waitForTimeout(400);

  const linha = secao.locator('.cg-item-row', { hasText: nomeItem });
  await expect(linha).toBeVisible();
  await linha.locator('button[title="Editar"]').click();

  const modalEdicao = page.locator('.cg-modal-backdrop', { has: page.getByRole('heading', { name: 'Editar item' }) });
  await expect(modalEdicao).toBeVisible();
  // Prova o round-trip completo: texto digitado -> ISO gravado no banco
  // (mockDb/localStorage) -> reaberto depois de um reload de página real ->
  // formatado de volta pro mesmo texto BR, não um valor corrompido/deslocado.
  await expect(modalEdicao.getByPlaceholder('dd/mm/aaaa')).toHaveValue('15/03/2027');
});

test('escolher uma data no seletor nativo (botão de calendário) atualiza o campo mascarado', async ({ page }) => {
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));

  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Compras' }).first().click();
  await page.waitForTimeout(400);

  const secao = page.locator('section[x-data^="shoppingView"]');
  await secao.locator('.cg-fab').click();

  const modal = page.locator('.cg-modal-backdrop', { has: page.getByRole('heading', { name: 'Adicionar item' }) });
  await expect(modal).toBeVisible();

  const grupo = modal.locator('.cg-date-field');
  const campoMascarado = grupo.getByPlaceholder('dd/mm/aaaa');

  // O Playwright não consegue dirigir o popup NATIVO do sistema operacional
  // que showPicker() abre (não é parte da árvore DOM/acessibilidade) — então
  // o teste cobre as duas metades separadamente: 1) clicar no botão nunca
  // lança um erro pro console (cgAbrirSeletorNativo, js/app.js, é
  // best-effort com try/catch); 2) escolher uma data no <input type="date">
  // nativo (aqui simulado com o mesmo value+'change' que o navegador
  // dispara de verdade ao fechar o calendário) sincroniza de volta pro
  // campo mascarado — são o MESMO expression Alpine (x-model no nativo,
  // x-datamask no mascarado), então a diretiva já cuida disso sozinha.
  await grupo.locator('.cg-date-field__btn').click();
  await page.waitForTimeout(100);
  expect(erros, `erro de console ao clicar no botão de calendário: ${JSON.stringify(erros)}`).toEqual([]);

  // x-model do Alpine escuta o evento "input" (não "change") num
  // <input> comum — inclusive type="date". Um navegador de verdade
  // dispara os dois ao fechar o seletor nativo (confirmado manualmente:
  // só "change" nunca atualiza a expressão Alpine, deixando o campo
  // mascarado vazio) — sem disparar "input" aqui, esta simulação não
  // reproduz o comportamento real e o teste falha por um motivo que
  // nunca aconteceria no navegador de verdade.
  await grupo.locator('.cg-date-field__nativo').evaluate((el) => {
    el.value = '2027-03-20';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await expect(campoMascarado).toHaveValue('20/03/2027');
});
