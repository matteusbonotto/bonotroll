// Regressão: quem visitava com ?demo=1 (ou clicava "Ver demonstração")
// ficava PRESO no modo demo pra sempre — a flag persiste em localStorage
// (bonotto_force_demo, js/data/config.js) e nada na UI a limpava, mesmo com
// credenciais reais do Supabase já configuradas. "Sair do modo demonstração"
// usa o mecanismo ?demo=0 que já existia em config.js, só faltava o botão.
import { test, expect } from '@playwright/test';

// A suíte inteira roda contra ?demo=1 de propósito (ver playwright.config.js:
// "nunca faz uma chamada de rede real ao Supabase") — js/data/config.js tem
// credenciais reais commitadas, então ?demo=0 faria o app tentar checar
// sessão de verdade contra o Supabase de produção. Bloqueia esse domínio
// explicitamente (defesa em profundidade) e só verifica o que a correção do
// bug realmente precisa garantir: a flag persistida é limpa e a URL muda —
// não precisa esperar a tela de login real terminar de carregar.
test('"Sair do modo demonstração" limpa a flag persistida (bonotto_force_demo)', async ({ page }) => {
  await page.route('**supabase.co/**', (route) => route.abort());

  await page.goto('/?demo=1');
  await expect(page.getByText('Entrar como', { exact: false }).first()).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('bonotto_force_demo'))).toBe('1');

  await page.getByRole('button', { name: 'Sair do modo demonstração' }).click();
  await page.waitForURL(/demo=0/);
  expect(await page.evaluate(() => localStorage.getItem('bonotto_force_demo'))).toBeNull();
});
