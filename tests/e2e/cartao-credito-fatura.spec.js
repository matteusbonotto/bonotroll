// Regressão do bug de duplicação relatado pelo usuário: "Amazon Prime
// R$19,90" solta + uma "Fatura Cartão de Crédito" que JÁ contém esses 19,90
// dentro dela faziam as métricas somarem os dois valores. A compra marcada
// como cartao_credito=true passa a viver DENTRO da fatura do mês (accordion
// em Transações) e sai dos totais — o valor da fatura já é o gasto real.
//
// O teste prova o número, não só o desenho: lê "Saídas previstas" da Início,
// desmarca o switch "Cartão de crédito" da compra e confere que o total sobe
// EXATAMENTE os 19,90 que estavam sendo deduzidos.
import { test, expect } from '@playwright/test';

// "R$ 3.512,38" -> 3512.38 (formatCurrency usa pt-BR, com espaço não-quebrável)
function paraNumero(texto) {
  return Number(String(texto).replace(/[^\d,-]/g, '').replace(',', '.'));
}

test('fatura do cartão vira accordion e a compra dentro dela não soma duas vezes', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();

  const home = page.locator('section[x-data^="dashboardView"]');
  await expect(home.locator('.cg-hero-balance').first()).toBeVisible({ timeout: 10000 });

  // "Todo o período": o corte por período usa data_cadastro, e o seed demo é
  // relativo a hoje — sem isso o teste dependeria do dia do mês em que roda.
  await home.locator('select.form-select-sm').first().selectOption('tudo');
  await page.waitForTimeout(300);

  const saidasPrevistas = home.locator('.cg-hero-stat', { hasText: 'Saídas' }).locator('.cg-hero-stat__delta').first();
  const totalAgrupado = paraNumero(await saidasPrevistas.getAttribute('title'));
  expect(totalAgrupado).toBeGreaterThan(0);

  // ---------- Transações: accordion ----------
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Transações' }).first().click();
  await page.waitForTimeout(500);

  const secao = page.locator('section[x-data^="transactionsView"]');
  const fatura = secao.locator('tbody tr', { hasText: 'Fatura Cartão de Crédito' });
  await expect(fatura).toHaveCount(1);
  await expect(fatura).toContainText('450'); // valor próprio da fatura, sem recálculo

  // Fechado: a compra não aparece solta em lugar nenhum da lista.
  await expect(secao.locator('tbody tr', { hasText: 'Amazon Prime' })).toHaveCount(0);

  await fatura.locator('.cg-cartao-toggle').click();
  await page.waitForTimeout(200);

  // Aberto: aparece aninhada (.cg-tx-filho), com o valor dela visível.
  const filho = secao.locator('tbody tr.cg-tx-filho', { hasText: 'Amazon Prime' });
  await expect(filho).toHaveCount(1);
  await expect(filho).toContainText('19,90');

  // ---------- O número: desmarcar o switch devolve os 19,90 ao total ----------
  await filho.getByRole('button', { name: 'Editar' }).click();
  // hasText: 'Editar lançamento' (o h2 do próprio modal) — filtrar por
  // "Cartão de crédito" pegaria o modal de categorias, que fica montado no
  // DOM o tempo todo e agora lista uma categoria com esse nome.
  const modal = page.locator('.cg-modal', { hasText: 'Editar lançamento' }).first();
  // O antigo switch booleano virou um seletor de cartão (2026-08-22): a
  // compra do seed está no cartão Nubank do Matheus; desmarcar = escolher a
  // opção vazia "Não é compra no cartão".
  const seletorCartao = modal.locator('#cartaoCredito');
  await expect(seletorCartao).toHaveValue('cartao-nubank-matheus');
  await seletorCartao.selectOption('');
  await modal.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForTimeout(800);

  // Sem a marcação ela volta a ser um gasto avulso — e aí SIM soma por fora.
  // (as outras compras marcadas continuam dentro da fatura, intocadas.)
  await expect(secao.locator('tbody tr', { hasText: 'Amazon Prime' })).toHaveCount(1);
  await expect(secao.locator('tbody tr.cg-tx-filho', { hasText: 'Amazon Prime' })).toHaveCount(0);

  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Início' }).first().click();
  await page.waitForTimeout(500);
  const totalSolto = paraNumero(await saidasPrevistas.getAttribute('title'));

  // A diferença é exatamente o valor da compra: é essa soma a mais que a
  // marcação evita (era o R$2.019,90 em vez de R$2.000 do relato original).
  expect(Number((totalSolto - totalAgrupado).toFixed(2))).toBe(19.9);
});

// Sair do TOTAL não é sair da COBRANÇA: uma compra do cartão ainda não paga
// continua sendo dinheiro a pagar com data, então "Contas a vencer" (que
// lista itens, não soma nada) segue mostrando ela. Esconder uma dívida real
// dessa lista seria uma regressão, não a feature.
test('compra dentro da fatura continua aparecendo em "Contas a vencer" quando está vencida', async ({ page }) => {
  await page.goto('/?demo=1');

  // Puxa o vencimento da fatura E da compra pro dia 1 do mês corrente: as
  // duas continuam no mesmo mês (então a compra segue agrupada dentro da
  // fatura) e a compra passa a ser a mais antiga da fila de "a vencer",
  // garantindo que ela caiba no corte de 5 itens da lista.
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('bonotto_demo_db_v1'));
    const dia1 = `${new Date().toISOString().slice(0, 8)}01`;
    for (const t of db.transactions) {
      if (t.titulo === 'Amazon Prime' || t.titulo === 'Fatura Cartão de Crédito') t.data_vencimento = dia1;
    }
    localStorage.setItem('bonotto_demo_db_v1', JSON.stringify(db));
  });
  await page.reload();

  await page.getByText('Entrar como', { exact: false }).first().click();
  const home = page.locator('section[x-data^="dashboardView"]');
  await expect(home.locator('.cg-hero-balance').first()).toBeVisible({ timeout: 10000 });
  await expect(home.locator('.cg-due-row', { hasText: 'Amazon Prime' })).toHaveCount(1);

  // ...e, ao mesmo tempo, continua agrupada dentro da fatura em Transações
  // (some da lista de topo, não da cobrança).
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Transações' }).first().click();
  await page.waitForTimeout(500);
  const secao = page.locator('section[x-data^="transactionsView"]');
  await expect(secao.locator('tbody tr', { hasText: 'Amazon Prime' })).toHaveCount(0);
});

// Multi-cartão (2026-08-22): o seed demo tem DUAS faturas no MESMO mês — a
// do Matheus (Nubank, R$450) e a da Beatriz (Inter, R$300) — cada uma com
// uma compra própria (Amazon Prime e Farmácia). Antes do cartao_id, a
// compra da Beatriz caía na PRIMEIRA fatura do mês (a do Matheus). O teste
// prova que cada fatura agrupa só as compras do SEU cartão.
test('duas faturas no mesmo mês de cartões diferentes não misturam as compras', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();

  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Transações' }).first().click();
  await page.waitForTimeout(500);
  const secao = page.locator('section[x-data^="transactionsView"]');

  // As duas faturas existem, cada uma com seu valor próprio.
  const faturaMatheus = secao.locator('tbody tr', { hasText: 'Fatura Cartão de Crédito' });
  const faturaBeatriz = secao.locator('tbody tr', { hasText: 'Fatura Cartão Inter' });
  await expect(faturaMatheus).toHaveCount(1);
  await expect(faturaBeatriz).toHaveCount(1);
  await expect(faturaMatheus).toContainText('450');
  await expect(faturaBeatriz).toContainText('300');

  // Fechadas: nenhuma compra aparece solta.
  await expect(secao.locator('tbody tr', { hasText: 'Amazon Prime' })).toHaveCount(0);
  await expect(secao.locator('tbody tr', { hasText: 'Farmácia' })).toHaveCount(0);

  // Abre a fatura do Matheus: só a compra DELE (Amazon Prime) está dentro.
  await faturaMatheus.locator('.cg-cartao-toggle').click();
  await page.waitForTimeout(200);
  await expect(secao.locator('tbody tr.cg-tx-filho', { hasText: 'Amazon Prime' })).toHaveCount(1);
  await expect(secao.locator('tbody tr.cg-tx-filho', { hasText: 'Farmácia' })).toHaveCount(0);
  await faturaMatheus.locator('.cg-cartao-toggle').click();
  await page.waitForTimeout(200);

  // Abre a fatura da Beatriz: só a compra DELA (Farmácia) está dentro.
  await faturaBeatriz.locator('.cg-cartao-toggle').click();
  await page.waitForTimeout(200);
  await expect(secao.locator('tbody tr.cg-tx-filho', { hasText: 'Farmácia' })).toHaveCount(1);
  await expect(secao.locator('tbody tr.cg-tx-filho', { hasText: 'Amazon Prime' })).toHaveCount(0);
});
