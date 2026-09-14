// TASK-037/038 — RECONSTRUÇÃO do onboarding (2026-09-11): a v1 (tour de 5
// slides só de leitura) foi testada e REJEITADA por um usuário real —
// "quero um passo a passo para a pessoa fazer ao menos uma coisa de cada do
// zero. e ver os resultados". O formato novo é um passo-a-passo interativo:
// só boas-vindas/conclusão continuam sendo um modal de leitura; um passo do
// meio (tipo:'acao') navega pra tela real, destaca o elemento real com um
// spotlight, e só avança quando a pessoa faz a ação de verdade (ou escolhe
// pular). Ver js/components/onboarding.js pro comentário grande da
// arquitetura.
//
// TASK-042 (2026-09-14) — GENERALIZAÇÃO: outro feedback real de usuário
// ("Só tem tutorial de criação de despesa... Tem q ter tutorial tour para
// cada coisa... e dar a opção para o usuário escolher oq ele quer
// aprender") trocou o tour ÚNICO de 3 ações forçadas (financeiro/compras/
// recursos) por um CATÁLOGO de mini-guias escolhíveis (a "Central de
// tutoriais") + um tour de 1ª visita SIMPLIFICADO (boas-vindas + só a ação
// "financeiro", que é a mais fundamental, + um atalho de conclusão pra abrir
// a Central). Os 3 guias originais continuam existindo — agora acessíveis
// tanto avulsos pela Central quanto (só o "financeiro") dentro do tour.
//
// Chave de "já visto" continua v2 (bonotto_onboarding_v2_seen) — a mudança
// desta rodada é só no CONTEÚDO por trás do mecanismo interativo (que já
// existia), não no formato em si, então não fazia sentido mostrar de novo
// pra quem já tinha visto a v2. playwright.config.js pré-semeia essa MESMA
// chave pro resto da suíte não ser interrompido por este modal.
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
    // também é refletido (mesmo texto) no painel de spotlight escondido do
    // passo de ação, sempre presente no DOM — um getByText solto encontraria
    // os dois "Bem-vindo(a)..." (um deles escondido) e violaria strict mode.
    await expect(backdrop.getByText('Bem-vindo(a) ao BNTT!')).toBeVisible();

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

  test('fluxo simplificado: registra uma transação de verdade e depois abre a Central de tutoriais pela conclusão', async ({ page }) => {
    await page.goto('/?demo=1');
    await page.getByText('Entrar como', { exact: false }).first().click();

    const infoBackdrop = page.locator('.cg-modal-backdrop', { has: page.locator('.cg-tour') });
    await expect(infoBackdrop).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Próximo' }).click();

    // ---------- Único passo de ação do tour simplificado: "financeiro" ----------
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

    // ---------- Conclusão: agora convida pra Central, em vez de forçar
    // compras/recursos também ----------
    await expect(infoBackdrop).toBeVisible();
    await expect(infoBackdrop.getByText('Boa! Você já viu como funciona.')).toBeVisible();
    await infoBackdrop.getByRole('button', { name: 'Abrir Central de tutoriais' }).click();
    await expect(infoBackdrop).toBeHidden();
    await expect(spotBackdrop).toBeHidden();

    const vistoNoStorage = await page.evaluate(() => localStorage.getItem('bonotto_onboarding_v2_seen'));
    expect(vistoNoStorage).toBe('1');

    // A Central abriu de verdade, listando os guias (inclusive os 2 que não
    // são mais forçados no tour, "compras"/"recursos" — continuam
    // disponíveis ali).
    const central = page.locator('.cg-modal-backdrop[x-show="$store.onboarding.centralAberta"]');
    await expect(central).toBeVisible();
    await expect(central.locator('.cg-list-flat', { hasText: 'Adicione um item na lista' })).toBeVisible();
    await expect(central.locator('.cg-list-flat', { hasText: 'Cadastre algo que tem em casa' })).toBeVisible();

    // A transação em si realmente aconteceu — não é simulação.
    await central.locator('.btn-close').click();
    await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Transações' }).first().click();
    const transacoes = page.locator('section[x-data^="transactionsView"]');
    await expect(transacoes.getByText('Cafézinho do tour').first()).toBeVisible();
  });

  test('"Pular esta etapa" avança pra conclusão sem fazer a ação, e "Pular tudo" (Esc) encerra o tour inteiro', async ({ page }) => {
    await page.goto('/?demo=1');
    await page.getByText('Entrar como', { exact: false }).first().click();

    const infoBackdrop = page.locator('.cg-modal-backdrop', { has: page.locator('.cg-tour') });
    await expect(infoBackdrop).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Próximo' }).click();

    const spotBackdrop = page.locator('.cg-tour-spot-backdrop');
    await expect(spotBackdrop).toBeVisible();
    await page.getByRole('button', { name: 'Pular esta etapa' }).click();

    // Único passo de ação do tour pulado -> vai direto pra conclusão (não
    // existe mais um 2º/3º passo de ação forçado).
    await expect(spotBackdrop).toBeHidden();
    await expect(infoBackdrop).toBeVisible();
    await expect(infoBackdrop.getByText('Boa! Você já viu como funciona.')).toBeVisible();

    // Esc no passo de conclusão (info) fecha o tour inteiro — mesmo
    // mecanismo central de sempre (setupOverlayBehavior, js/app.js).
    await page.keyboard.press('Escape');
    await expect(infoBackdrop).toBeHidden();
    const vistoNoStorage = await page.evaluate(() => localStorage.getItem('bonotto_onboarding_v2_seen'));
    expect(vistoNoStorage).toBe('1');
  });

  test('Esc durante o passo de ação (spotlight) encerra o tour inteiro', async ({ page }) => {
    await page.goto('/?demo=1');
    await page.getByText('Entrar como', { exact: false }).first().click();

    await expect(page.locator('.cg-modal-backdrop', { has: page.locator('.cg-tour') })).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: 'Próximo' }).click();

    const spotBackdrop = page.locator('.cg-tour-spot-backdrop');
    await expect(spotBackdrop).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(spotBackdrop).toBeHidden();
    const vistoNoStorage = await page.evaluate(() => localStorage.getItem('bonotto_onboarding_v2_seen'));
    expect(vistoNoStorage).toBe('1');
  });

  test('Esc dentro do formulário real (aberto pelo passo de ação) fecha só o formulário, nunca o tour inteiro', async ({ page }) => {
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

// ---------- Central de tutoriais (TASK-042) ----------
// storageState padrão (já "visto", ver playwright.config.js) — não depende
// da abertura automática de 1ª visita; testa os pontos de entrada manuais e
// pelo menos um guia NOVO do catálogo (além dos 3 originais, já cobertos
// acima/no tour).
test.describe('Central de tutoriais', () => {
  test('abre pelo ícone dedicado da topbar e também por Perfil → Preferências, listando os guias', async ({ page }) => {
    await page.goto('/?demo=1');
    await page.getByText('Entrar como', { exact: false }).first().click();

    const central = page.locator('.cg-modal-backdrop[x-show="$store.onboarding.centralAberta"]');
    await expect(central).toBeHidden();

    await page.locator('.cg-topbar').getByRole('button', { name: 'Central de tutoriais' }).click();
    await expect(central).toBeVisible({ timeout: 5000 });
    await expect(central.locator('.cg-list-flat', { hasText: 'Tour de boas-vindas completo' })).toBeVisible();
    await expect(central.locator('.cg-list-flat', { hasText: 'Registre um gasto de verdade' })).toBeVisible();
    await expect(central.locator('.cg-list-flat', { hasText: 'Divida uma despesa com seu par' })).toBeVisible();
    await expect(central.locator('.cg-list-flat', { hasText: 'Crie uma caixinha' })).toBeVisible();
    await expect(central.locator('.cg-list-flat', { hasText: 'Convide seu par pro grupo' })).toBeVisible();

    // Fecha no X, reabre por Perfil → Preferências (2º ponto de entrada).
    await central.locator('.btn-close').click();
    await expect(central).toBeHidden();

    await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Perfil' }).first().click();
    await page.locator('.cg-list-flat', { hasText: 'Central de tutoriais' }).click();
    await expect(central).toBeVisible();

    // Esc fecha (setupOverlayBehavior) — mesmo mecanismo de qualquer modal.
    await page.keyboard.press('Escape');
    await expect(central).toBeHidden();
  });

  test('guia avulso "Crie uma caixinha" (novo no catálogo): navega sozinho, cria de verdade e mostra o resultado', async ({ page }) => {
    await page.goto('/?demo=1');
    await page.getByText('Entrar como', { exact: false }).first().click();

    await page.locator('.cg-topbar').getByRole('button', { name: 'Central de tutoriais' }).click();
    const central = page.locator('.cg-modal-backdrop[x-show="$store.onboarding.centralAberta"]');
    await expect(central).toBeVisible();
    await central.locator('.cg-list-flat', { hasText: 'Crie uma caixinha' }).click();
    await expect(central).toBeHidden();

    const spotBackdrop = page.locator('.cg-tour-spot-backdrop');
    await expect(spotBackdrop).toBeVisible();
    // Guia avulso: "Guia rápido" no lugar de "Passo X de Y", sem dots.
    await expect(spotBackdrop.getByText('Guia rápido')).toBeVisible();
    await expect(spotBackdrop.getByText('Crie uma caixinha')).toBeVisible();

    const caixinhas = page.locator('section[x-data^="caixinhasView"]');
    await expect(caixinhas).toBeVisible();
    const alvo = page.locator('[data-tour-alvo="nova-caixinha"]');
    await expect(alvo).toBeVisible({ timeout: 5000 });
    await alvo.click();

    const caixinhaModal = page.locator('.cg-modal-backdrop[x-show="$store.caixinhaModal.open"]');
    await expect(caixinhaModal).toBeVisible();
    // Banco já vem de um <select> com bancos do seed — só precisa escolher
    // um valor de verdade (o 1º banco cadastrado) e salvar.
    await caixinhaModal.locator('select').first().selectOption({ index: 1 });
    await caixinhaModal.getByRole('button', { name: /Criar caixinha|Salvar/ }).click();
    await expect(caixinhaModal).toBeHidden();

    await expect(spotBackdrop.getByText('Show! Sua caixinha já está criada.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pular' })).toBeHidden();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(spotBackdrop).toBeHidden();
  });

  test('guia avulso "Divida uma despesa com seu par": ação acontece DENTRO do formulário real, sem perder o guia', async ({ page }) => {
    await page.goto('/?demo=1');
    await page.getByText('Entrar como', { exact: false }).first().click();

    await page.locator('.cg-topbar').getByRole('button', { name: 'Central de tutoriais' }).click();
    const central = page.locator('.cg-modal-backdrop[x-show="$store.onboarding.centralAberta"]');
    await central.locator('.cg-list-flat', { hasText: 'Divida uma despesa com seu par' }).click();

    const spotBackdrop = page.locator('.cg-tour-spot-backdrop');
    await expect(spotBackdrop).toBeVisible();
    await expect(spotBackdrop.getByText('Divida uma despesa com seu par')).toBeVisible();

    await page.locator('[data-tour-alvo="nova-transacao"]').click();
    const txModal = page.locator('.cg-modal-backdrop[x-show="$store.txModal.open"]');
    await expect(txModal).toBeVisible();

    // O guia continua junto por baixo (só encoberto pelo modal real, que tem
    // z-index maior — ver comentário grande em onboarding.js) enquanto a
    // pessoa mexe no formulário de verdade.
    await txModal.getByRole('button', { name: 'Mais opções' }).click();
    await txModal.getByTitle('Dividir com mais alguém').click();
    await txModal.locator('.cg-pill-option').first().click();
    await expect(txModal.getByText(/Dividindo entre 2 pessoas/)).toBeVisible();

    // Fecha o formulário real (a pessoa decide quando, o guia nunca fecha
    // ele sozinho) — o painel reaparece já com o resultado.
    await txModal.locator('.btn-close').click();
    await expect(txModal).toBeHidden();
    await expect(spotBackdrop.getByText('Boa! O valor já foi dividido')).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(spotBackdrop).toBeHidden();
  });
});
