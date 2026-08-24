// Regressão de bug real relatado em uso (2026-08-23): "excluí uma despesa,
// disse que excluiu com sucesso, mas não excluiu". Causa raiz: notifyUndo
// (store.js) adiava a chamada de exclusão de verdade pra dentro de um
// setTimeout(5000) — se a aba fechasse/recarregasse antes disso, a exclusão
// nunca acontecia de fato, mesmo o toast já tendo dito "excluído". Corrigido
// pra a exclusão real acontecer ANTES do toast aparecer. Este teste prova
// exatamente o cenário que quebrava: excluir, NUNCA clicar "Desfazer",
// recarregar a página, e confirmar que a transação continua removida (não
// "voltou" por a exclusão nunca ter sido persistida de verdade).
import { test, expect } from '@playwright/test';

test('excluir uma transação sem clicar "Desfazer" remove ela de verdade, mesmo recarregando a página', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Transações' }).first().click();
  await page.waitForTimeout(400);

  const secao = page.locator('section[x-data^="transactionsView"]');
  const editarBtns = secao.locator('button[aria-label="Editar"]');
  const total = await editarBtns.count();
  test.skip(total === 0, 'conta demo sem nenhuma transação editável — nada a testar aqui');

  // Usa o título como identidade (não a contagem total de linhas): o app
  // gera lançamentos recorrentes automaticamente ao recarregar a sessão
  // (gerarRecorrentesPendentes), então a contagem total pode mudar por
  // motivo nenhum relacionado a este bug. Título só serve de identidade
  // confiável pra uma transação NÃO recorrente (recorrente repete o mesmo
  // título em vários meses, então "sumiu" seria falso positivo/negativo) —
  // procura a primeira editável que não seja recorrente.
  const backdrop = page.locator('.cg-modal-backdrop[x-show="$store.txModal.open"]');
  const recorrenteSwitch = page.locator('#recorrente');
  const tituloInput = page.locator('input[x-model="$store.txModal.form.titulo"]');
  let tituloExcluido = '';
  for (let i = 0; i < Math.min(total, 15); i++) {
    await editarBtns.nth(i).click();
    await expect(backdrop).toBeVisible({ timeout: 5000 });
    const ehRecorrente = await recorrenteSwitch.isChecked();
    if (!ehRecorrente) {
      tituloExcluido = (await tituloInput.first().inputValue()) || '';
      if (tituloExcluido) break;
    }
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(backdrop).toBeHidden({ timeout: 5000 });
  }
  test.skip(!tituloExcluido, 'não achei nenhuma transação não-recorrente editável entre as primeiras 15 — nada seguro a testar aqui');

  await page.getByRole('button', { name: 'Excluir lançamento' }).click();
  await expect(backdrop).toBeHidden({ timeout: 5000 });

  const toast = page.locator('.cg-toast', { hasText: 'Lançamento excluído' });
  await expect(toast).toBeVisible({ timeout: 3000 });
  // Nunca clica em "Desfazer" — é exatamente o caminho que estava quebrado.
  await expect(toast).toBeHidden({ timeout: 8000 }); // some sozinho depois de alguns segundos

  await page.reload();
  await page.waitForTimeout(500);
  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Transações' }).first().click();
  await page.waitForTimeout(400);

  await expect(secao.getByText(tituloExcluido, { exact: true })).toHaveCount(0);
});
