// TASK-037/038 — FAQ (Alpine.store('faq'), js/components/faq.js), pedido
// junto da reconstrução do onboarding: "um botão FAQ com todos os detalhes
// e soluções rápidas para dúvidas frequentes", sempre acessível, separado
// do passo a passo guiado. Cobre os dois pontos de entrada (ícone "?" da
// topbar + item em Perfil), abrir/expandir uma pergunta, e os 3 jeitos de
// fechar (X, Esc, clique fora) — mesmo padrão de qualquer modal do app.
//
// storageState padrão (playwright.config.js) já marca o onboarding como
// visto, então ele não abre sozinho por cima aqui.
import { test, expect } from '@playwright/test';

test('FAQ abre pelo ícone "?" da topbar, expande uma pergunta e fecha com Esc', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();

  // Seletor pelo x-show exato (mesmo padrão de $store.txModal.open etc.),
  // não por "has texto Perguntas frequentes": o passo de conclusão do
  // onboarding TAMBÉM menciona "Perguntas frequentes" no próprio texto, e
  // fica na mesma árvore DOM do backdrop do tour (só escondido por x-show,
  // que "has"/getByText não filtram) — um filtro por texto seria ambíguo.
  const faqModal = page.locator('.cg-modal-backdrop[x-show="$store.faq.aberto"]');
  await expect(faqModal).toBeHidden();

  await page.getByRole('button', { name: 'Perguntas frequentes' }).click();
  await expect(faqModal).toBeVisible({ timeout: 5000 });

  // Conteúdo real (não genérico) — pelo menos as perguntas-chave pedidas
  // aparecem renderizadas.
  await expect(faqModal.getByText('Meus dados são só meus?')).toBeVisible();
  await expect(faqModal.getByText('Como funciona a fatura do cartão de crédito')).toBeVisible();

  // Accordion: resposta começa fechada, expande ao clicar na pergunta.
  const perguntaDemo = faqModal.getByRole('button', { name: /modo demonstração/i });
  const respostaDemo = faqModal.locator('#cg-faq-resposta-modo-demo');
  await expect(respostaDemo).toBeHidden();
  await perguntaDemo.click();
  await expect(respostaDemo).toBeVisible();
  await expect(respostaDemo).toContainText('só neste navegador');

  await page.keyboard.press('Escape');
  await expect(faqModal).toBeHidden();
});

test('FAQ também abre por Perfil → Preferências, e fecha no X e no clique fora', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();

  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Perfil' }).first().click();
  await page.locator('.cg-list-flat', { hasText: 'Perguntas frequentes' }).click();

  // Seletor pelo x-show exato (mesmo padrão de $store.txModal.open etc.),
  // não por "has texto Perguntas frequentes": o passo de conclusão do
  // onboarding TAMBÉM menciona "Perguntas frequentes" no próprio texto, e
  // fica na mesma árvore DOM do backdrop do tour (só escondido por x-show,
  // que "has"/getByText não filtram) — um filtro por texto seria ambíguo.
  const faqModal = page.locator('.cg-modal-backdrop[x-show="$store.faq.aberto"]');
  await expect(faqModal).toBeVisible({ timeout: 5000 });

  await faqModal.locator('.btn-close').click();
  await expect(faqModal).toBeHidden();

  // Reabre (mesmo item de Perfil — na tela de Perfil o ícone "?" da topbar
  // TAMBÉM está visível ao mesmo tempo, então usar getByRole aqui seria
  // ambíguo entre os dois pontos de entrada) pra testar o clique fora.
  await page.locator('.cg-list-flat', { hasText: 'Perguntas frequentes' }).click();
  await expect(faqModal).toBeVisible();
  await faqModal.click({ position: { x: 4, y: 4 } });
  await expect(faqModal).toBeHidden();
});
