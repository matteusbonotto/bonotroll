// Regressão (2026-09-01): categoria com orçamento (ex.: "Mercado") estourado
// deve gerar notificação pro grupo inteiro, não só pra quem estourou — seed
// demo tem uma compra de R$820 lançada em "Mercado" com limite de R$700.
import { test, expect } from '@playwright/test';

test('orçamento de "Mercado" estourado aparece no sino e notifica os dois membros do grupo', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();
  await page.waitForTimeout(600); // best-effort assíncrono (generateBudgetAlerts), roda logo após o login

  await page.getByRole('button', { name: 'Notificações' }).click();
  await page.waitForTimeout(300);
  await expect(page.getByText('Orçamento de "Mercado" estourou', { exact: false })).toBeVisible();

  // Confirma que o aviso foi pro GRUPO (Matheus e Beatriz), não só pra quem
  // tecnicamente estourou o próprio orçamento pessoal — inspeciona o "banco"
  // demo direto (mais confiável que alternar de perfil pela UI).
  const notificacoesPorPerfil = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem('bonotto_demo_db_v1'));
    const estouradas = db.notifications.filter((n) => n.tipo === 'orcamento_estourado');
    return [...new Set(estouradas.map((n) => n.profile_id))];
  });
  expect(notificacoesPorPerfil.length).toBeGreaterThanOrEqual(2);
});
