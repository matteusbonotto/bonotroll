// Regressão: link "Ver demonstração" na tela de entrada real (pedido
// original desta rodada — não testado navegando pro modo real de verdade
// pra não depender de rede contra o Supabase de produção; só confirma que
// o link aparece com o href certo quando isDemoMode é falso).
import { test, expect } from '@playwright/test';

test('link "Ver demonstração" aparece só fora do modo demo, apontando pra ?demo=1', async ({ page }) => {
  await page.goto('/?demo=1');

  const link = page.getByText('Ver demonstração com dados de exemplo');
  await expect(link).toBeHidden(); // em modo demo, o link não faz sentido — já está nele

  await page.evaluate(() => { window.Alpine.store('app').isDemoMode = false; });
  await page.waitForTimeout(200);

  await expect(link).toBeVisible({ timeout: 3000 });
  await expect(link).toHaveAttribute('href', '?demo=1');
});
