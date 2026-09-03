// Novo (2026-09-03): "Agrupar por Período" ganhou um 2º nível — Ano por
// cima do Mês (agruparPorAnoMes, js/utils/periodo.js). Este teste confirma
// que o cabeçalho de ano aparece com o rótulo certo, que clicar nele
// colapsa/expande TODOS os meses daquele ano de uma vez (não só um) e que
// isso não quebra o toggle de mês individual depois de reabrir o ano.
//
// O seed demo (mockDb.js) só gera transações num único ano (o ano corrente,
// datas relativas a "hoje") — sem um 2º ano de verdade não dá pra ver o
// cabeçalho de ano em ação. O teste injeta 2 transações a mais, em MESES
// diferentes do ano seguinte, direto no localStorage do modo demo (mesmo
// padrão já usado em cartao-credito-fatura.spec.js) — só pra este cenário,
// nunca vira seed permanente.
import { test, expect } from '@playwright/test';

test('Agrupar por Período: cabeçalho de Ano aparece, colapsa/expande todos os meses do ano junto, e não quebra o toggle de mês individual', async ({ page }) => {
  await page.goto('/?demo=1');

  const { anoAtual, anoQueVem } = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('bonotto_demo_db_v2'));
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const anoQueVem = anoAtual + 1;
    const base = db.transactions.find((t) => t.tipo === 'saida') || db.transactions[0];
    db.transactions.push(
      {
        ...base,
        id: 'tx-teste-ano-que-vem-agosto',
        titulo: 'Teste Ano Que Vem Agosto',
        tipo: 'saida',
        valor: 111.11,
        data_vencimento: `${anoQueVem}-08-15`,
        data_cadastro: `${anoQueVem}-08-01`,
        data_pagamento: null,
        recorrente: false,
        cartao_credito: false,
        cartao_id: null,
        parcela_total: null,
        parcela_atual: null,
      },
      {
        ...base,
        id: 'tx-teste-ano-que-vem-marco',
        titulo: 'Teste Ano Que Vem Março',
        tipo: 'saida',
        valor: 222.22,
        data_vencimento: `${anoQueVem}-03-10`,
        data_cadastro: `${anoQueVem}-03-01`,
        data_pagamento: null,
        recorrente: false,
        cartao_credito: false,
        cartao_id: null,
        parcela_total: null,
        parcela_atual: null,
      }
    );
    localStorage.setItem('bonotto_demo_db_v2', JSON.stringify(db));
    return { anoAtual, anoQueVem };
  });

  await page.reload();
  await page.getByText('Entrar como', { exact: false }).first().click();
  const secao = page.locator('section[x-data^="transactionsView"]');
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Transações' }).first().click();
  await page.waitForTimeout(400);

  await page.getByRole('button', { name: 'Agrupar' }).click();
  await page.waitForTimeout(300);
  // "Período" já é o agrupamento padrão, mas clica explícito pra não
  // depender disso silenciosamente.
  await page.getByRole('button', { name: 'Período', exact: true }).click();
  await page.waitForTimeout(300);

  const headerAnoAtual = secao.getByRole('button', { name: String(anoAtual), exact: false });
  const headerAnoQueVem = secao.getByRole('button', { name: String(anoQueVem), exact: false });
  await expect(headerAnoAtual).toBeVisible();
  await expect(headerAnoQueVem).toBeVisible();

  // O rótulo "Agora" continua no cabeçalho do MÊS atual (já funcionava);
  // aqui confirma que o cabeçalho de ANO atual também ganha o badge, e que
  // o ano seguinte (nunca é o ano corrente) não ganha. O badge usa x-show
  // (não x-if) — o elemento .cg-badge sempre existe no DOM, só escondido
  // via display:none quando isAnoAtual é false, então a asserção certa é
  // toBeHidden(), não toHaveCount(0) (que contaria o nó escondido também).
  await expect(headerAnoAtual.locator('.cg-badge', { hasText: 'Agora' })).toBeVisible();
  await expect(headerAnoQueVem.locator('.cg-badge', { hasText: 'Agora' })).toBeHidden();

  const mesAgo = 'ago/' + String(anoQueVem).slice(2);
  const mesMar = 'mar/' + String(anoQueVem).slice(2);

  // Os 2 cabeçalhos de MÊS do ano seguinte (agosto e março) aparecem os dois
  // — prova que o ano agrupa mais de 1 mês, não só o cenário trivial de 1.
  await expect(secao.getByText(mesAgo, { exact: true })).toHaveCount(1);
  await expect(secao.getByText(mesMar, { exact: true })).toHaveCount(1);

  await headerAnoQueVem.click();
  await page.waitForTimeout(200);

  // Colapsar o ano esconde OS DOIS meses de uma vez — nenhum cabeçalho de
  // mês daquele ano sobra solto (seria o bug: só a tabela some, o cabeçalho
  // do mês continua aparecendo por fora do ano fechado).
  await expect(secao.getByText(mesAgo, { exact: true })).toHaveCount(0);
  await expect(secao.getByText(mesMar, { exact: true })).toHaveCount(0);

  // Reabrir o ano devolve os dois cabeçalhos de mês.
  await headerAnoQueVem.click();
  await page.waitForTimeout(200);
  await expect(secao.getByText(mesAgo, { exact: true })).toHaveCount(1);
  await expect(secao.getByText(mesMar, { exact: true })).toHaveCount(1);

  // Toggle de mês individual continua funcionando depois de reabrir o ano:
  // nenhum dos 2 meses é o mês atual, então os dois começam FECHADOS por
  // padrão (abertoPorPadrao só é true no mês de hoje) — abrir "agosto" não
  // deve abrir "março" junto (são independentes um do outro, só o ANO os
  // amarra).
  await expect(secao.getByText('Teste Ano Que Vem Agosto')).toHaveCount(0);
  await expect(secao.getByText('Teste Ano Que Vem Março')).toHaveCount(0);

  const headerMesAgo = secao.locator('button', { hasText: mesAgo }).first();
  await headerMesAgo.click();
  await page.waitForTimeout(200);
  await expect(secao.getByText('Teste Ano Que Vem Agosto').first()).toBeVisible();
  // Março continua fechado — abrir agosto não mexeu nele.
  await expect(secao.getByText('Teste Ano Que Vem Março')).toHaveCount(0);

  await headerMesAgo.click();
  await page.waitForTimeout(200);
  await expect(secao.getByText('Teste Ano Que Vem Agosto')).toHaveCount(0);
});
