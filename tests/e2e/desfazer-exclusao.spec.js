// Regressão Fase 4 (BONOTTO-2027-BLUEPRINT.md, Conflito 3): exclusões
// frequentes/de baixo dano trocaram confirm() por um toast "Desfazer" —
// remove da UI na hora, só exclui de verdade no banco depois de alguns
// segundos, e "Desfazer" restaura sem nunca ter chamado a exclusão real.
import { test, expect } from '@playwright/test';

test('remover movimentação de Caixinha: some na hora, "Desfazer" restaura', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Caixinhas' }).first().click();
  await page.waitForTimeout(400);

  // .cg-room-tile é reaproveitado por Recursos E Caixinhas — as duas telas
  // ficam permanentemente montadas no DOM (RAIO-X §3.1), então um locator
  // sem escopo pega o tile ERRADO (o de Recursos, escondido). Precisa
  // escopar pela section da própria tela.
  const secaoCaixinhas = page.locator('section[x-data^="caixinhasView"]');
  const primeiraCaixinha = secaoCaixinhas.locator('.cg-room-tile').first();
  test.skip(!(await primeiraCaixinha.count()), 'conta demo sem nenhuma caixinha — nada a testar aqui');
  await primeiraCaixinha.click();
  await page.waitForTimeout(300);

  const linhasHistorico = secaoCaixinhas.locator('button[title="Remover"]');
  const totalAntes = await linhasHistorico.count();
  test.skip(totalAntes === 0, 'caixinha sem histórico — nada a testar aqui');

  await linhasHistorico.first().click();
  await expect(linhasHistorico).toHaveCount(totalAntes - 1, { timeout: 3000 });

  const toast = page.locator('.cg-toast', { hasText: 'Movimentação removida' });
  await expect(toast).toBeVisible({ timeout: 3000 });
  await toast.getByText('Desfazer').click();

  await expect(linhasHistorico).toHaveCount(totalAntes, { timeout: 3000 });
});
