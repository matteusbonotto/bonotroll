// TASK-037/038 — RECONSTRUÇÃO do onboarding (2026-09-11): a v1 (tour de 5
// slides só de leitura) foi testada e REJEITADA por um usuário real —
// "quero um passo a passo para a pessoa fazer ao menos uma coisa de cada do
// zero. e ver os resultados". O formato novo é um passo-a-passo interativo:
// só boas-vindas/conclusão continuam sendo um modal de leitura; os 3 passos
// do meio (financeiro/compras/recursos) navegam pra tela real, destacam o
// elemento real com um spotlight, e só avançam quando a pessoa faz a ação
// de verdade (ou escolhe pular). Ver js/components/onboarding.js pro
// comentário grande da arquitetura.
//
// Chave de "já visto" mudou pra v2 (bonotto_onboarding_v2_seen) — quem já
// tinha visto/dispensado a v1 nunca teve chance de ver este formato novo,
// então faz sentido mostrar de novo uma vez. playwright.config.js pré-semeia
// essa MESMA chave pro resto da suíte não ser interrompido por este modal.
import { test, expect } from '@playwright/test';

test.describe('primeira visita (storageState vazio)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('passo de boas-vindas aparece na 1ª visita, "Pular" fecha tudo e não reabre sozinho num reload', async ({ page }) => {
    await page.goto('/?demo=1');
    await page.getByText('Entrar como', { exact: false }).first().click();

    // Passo 0 (boas-vindas) ainda é o modal cheio de sempre — só filtra por
    // ".cg-tour" (não por índice/ordem) pro caso de outro modal ser
    // adicionado antes dele no HTML no futuro.
    const backdrop = page.locator('.cg-modal-backdrop', { has: page.locator('.cg-tour') });
    await expect(backdrop).toBeVisible({ timeout: 5000 });
    // Escopado no backdrop, não em page.getByText: o título do passo ATUAL
    // também é refletido (mesmo texto) no painel de spotlight escondido dos
    // passos de ação, sempre presente no DOM — um getByText solto encontraria
    // os dois "Bem-vindo(a)..." (um deles escondido) e violaria strict mode.
    await expect(backdrop.getByText('Bem-vindo(a) ao Bõnotto!')).toBeVisible();

    await page.getByRole('button', { name: 'Pular' }).click();
    await expect(backdrop).toBeHidden();

    // A flag precisa ter sido persistida de verdade (não só o estado do
    // Alpine em memória) — garante "não repete sozinho" mesmo reabrindo a aba.
    const vistoNoStorage = await page.evaluate(() => localStorage.getItem('bonotto_onboarding_v2_seen'));
    expect(vistoNoStorage).toBe('1');

    await page.reload();
    await page.waitForTimeout(500);
    await expect(backdrop).toBeHidden();
  });

  test('fluxo completo: registra uma transação, um item de compra e um item de recurso de verdade através do tour', async ({ page }) => {
    await page.goto('/?demo=1');
    await page.getByText('Entrar como', { exact: false }).first().click();

    const infoBackdrop = page.locator('.cg-modal-backdrop', { has: page.locator('.cg-tour') });
    await expect(infoBackdrop).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Próximo' }).click();

    // ---------- Passo "financeiro" ----------
    const spotBackdrop = page.locator('.cg-tour-spot-backdrop');
    await expect(spotBackdrop).toBeVisible();
    await expect(spotBackdrop.getByText('Registre um gasto de verdade')).toBeVisible();
    // A tela real por baixo precisa ter navegado sozinha pro Início, e o
    // botão real (não uma simulação) precisa estar destacável/clicável.
    const home = page.locator('section[x-data^="dashboardView"]');
    await expect(home).toBeVisible();
    const alvoTransacao = page.locator('[data-tour-alvo="nova-transacao"]');
    await expect(alvoTransacao).toBeVisible();

    // "Pular esta etapa" some assim que a ação é feita — antes disso, deve
    // estar visível (a pessoa não fez a ação ainda).
    await expect(page.getByRole('button', { name: 'Pular esta etapa' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continuar' })).toBeHidden();

    await alvoTransacao.click();
    const txModal = page.locator('.cg-modal-backdrop[x-show="$store.txModal.open"]');
    await expect(txModal).toBeVisible();
    await txModal.locator('input[placeholder="Ex: Aluguel, Mercado, Salário…"]').fill('Cafézinho do tour');
    await txModal.locator('input[type="number"]').first().fill('10');
    await txModal.getByRole('button', { name: 'Salvar' }).click();
    await expect(txModal).toBeHidden();

    // Ação real detectada: o passo mostra o resultado e libera "Continuar"
    // (sem precisar de "Pular esta etapa" mais).
    await expect(spotBackdrop.getByText('Prontinho! Repare que o saldo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pular esta etapa' })).toBeHidden();
    await page.getByRole('button', { name: 'Continuar' }).click();

    // ---------- Passo "compras" ----------
    await expect(spotBackdrop.getByText('Adicione um item na lista')).toBeVisible();
    const compras = page.locator('section[x-data^="shoppingView"]');
    await expect(compras).toBeVisible();
    const alvoCompra = page.locator('[data-tour-alvo="novo-item-compra"]');
    await expect(alvoCompra).toBeVisible();
    await alvoCompra.click();

    const itemFormBackdrop = compras.locator('.cg-modal-backdrop[x-show="itemFormAberto"]');
    await expect(itemFormBackdrop).toBeVisible();
    await itemFormBackdrop.locator('input[placeholder="Ex: Arroz 5kg"]').fill('Leite do tour');
    await itemFormBackdrop.getByRole('button', { name: 'Adicionar' }).click();

    await expect(spotBackdrop.getByText('Viu? O item já apareceu na lista')).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();

    // ---------- Passo "recursos" ----------
    await expect(spotBackdrop.getByText('Cadastre algo que tem em casa')).toBeVisible();
    const recursos = page.locator('section[x-data^="resourcesView"]');
    await expect(recursos).toBeVisible();
    // O tour já andou sozinho o drill-down cômodo -> subcategoria "Todas" —
    // o alvo real (botão "Item") precisa já estar visível sem clique extra.
    const alvoRecurso = page.locator('[data-tour-alvo="recursos-add-item"]');
    await expect(alvoRecurso).toBeVisible({ timeout: 5000 });
    await alvoRecurso.click();

    const itemRecursoModal = recursos.locator('.cg-modal-backdrop[x-show="itemModalAberto"]');
    await expect(itemRecursoModal).toBeVisible();
    await itemRecursoModal.locator('input[placeholder="Ex: Arroz, Papel higiênico…"]').fill('Sabonete do tour');
    await itemRecursoModal.getByRole('button', { name: 'Salvar' }).click();

    await expect(spotBackdrop.getByText('Esse item já está guardado nesse cômodo')).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();

    // ---------- Conclusão ----------
    await expect(infoBackdrop).toBeVisible();
    await expect(infoBackdrop.getByText('Pronto pra usar de verdade!')).toBeVisible();
    await page.getByRole('button', { name: 'Começar a usar' }).click();
    await expect(infoBackdrop).toBeHidden();
    await expect(spotBackdrop).toBeHidden();

    const vistoNoStorage = await page.evaluate(() => localStorage.getItem('bonotto_onboarding_v2_seen'));
    expect(vistoNoStorage).toBe('1');

    // As 3 ações realmente aconteceram — não é simulação: aparecem nas
    // telas de verdade depois do tour fechado.
    await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Transações' }).first().click();
    // Escopado em transactionsView (não page.getByText solto): a Home
    // (dashboardView) também renderiza os "últimos lançamentos" com o mesmo
    // título — ela continua montada por baixo (x-show, não x-if, CLAUDE.md),
    // então um getByText sem escopo de tela pega o elemento errado/escondido.
    const transacoes = page.locator('section[x-data^="transactionsView"]');
    await expect(transacoes.getByText('Cafézinho do tour').first()).toBeVisible();
  });

  test('"Pular esta etapa" avança sem fazer a ação, e "Pular tudo" (Esc) encerra o tour inteiro', async ({ page }) => {
    await page.goto('/?demo=1');
    await page.getByText('Entrar como', { exact: false }).first().click();

    await expect(page.locator('.cg-modal-backdrop', { has: page.locator('.cg-tour') })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Próximo' }).click();

    const spotBackdrop = page.locator('.cg-tour-spot-backdrop');
    await expect(spotBackdrop).toBeVisible();
    await page.getByRole('button', { name: 'Pular esta etapa' }).click();

    // Avançou pro passo de compras sem ter criado nenhuma transação.
    await expect(spotBackdrop.getByText('Adicione um item na lista')).toBeVisible();

    // Esc durante um passo de ação pula o tour INTEIRO (não só o passo) —
    // mesmo mecanismo central de sempre (setupOverlayBehavior, js/app.js).
    await page.keyboard.press('Escape');
    await expect(spotBackdrop).toBeHidden();
    const vistoNoStorage = await page.evaluate(() => localStorage.getItem('bonotto_onboarding_v2_seen'));
    expect(vistoNoStorage).toBe('1');
  });

  test('Esc dentro do formulário real (aberto por um passo de ação) fecha só o formulário, nunca o tour inteiro', async ({ page }) => {
    await page.goto('/?demo=1');
    await page.getByText('Entrar como', { exact: false }).first().click();

    await expect(page.locator('.cg-modal-backdrop', { has: page.locator('.cg-tour') })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Próximo' }).click();

    const spotBackdrop = page.locator('.cg-tour-spot-backdrop');
    await expect(spotBackdrop).toBeVisible();
    await page.locator('[data-tour-alvo="nova-transacao"]').click();

    const txModal = page.locator('.cg-modal-backdrop[x-show="$store.txModal.open"]');
    await expect(txModal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(txModal).toBeHidden();
    // O tour continua exatamente no mesmo passo, não fechou por baixo.
    await expect(spotBackdrop).toBeVisible();
    await expect(spotBackdrop.getByText('Registre um gasto de verdade')).toBeVisible();
  });
});

test('tour reabre a qualquer momento por "Rever tutorial" em Perfil, mesmo já tendo sido visto', async ({ page }) => {
  // Usa o storageState padrão (já "visto", ver playwright.config.js) — o
  // ponto aqui é justamente provar que dá pra reabrir de novo DEPOIS de já
  // ter sido visto, sem depender da abertura automática de 1ª visita.
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();

  const infoBackdrop = page.locator('.cg-modal-backdrop', { has: page.locator('.cg-tour') });
  await expect(infoBackdrop).toBeHidden();

  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Perfil' }).first().click();
  await page.locator('.cg-list-flat', { hasText: 'Rever tutorial' }).click();

  await expect(infoBackdrop).toBeVisible({ timeout: 5000 });
  await expect(infoBackdrop.getByText('Bem-vindo(a) ao Bõnotto!')).toBeVisible();

  // Esc fecha (setupOverlayBehavior, js/app.js) e devolve o foco — mesmo
  // mecanismo central já usado pelos outros modais do app.
  await page.keyboard.press('Escape');
  await expect(infoBackdrop).toBeHidden();

  // Devolveu a pessoa pra tela de onde ela abriu o tour (Perfil), não deixou
  // "esquecida" em nenhuma tela intermediária.
  await expect(page.locator('section[x-data^="profileView"]')).toBeVisible();
});
