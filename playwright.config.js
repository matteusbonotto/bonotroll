// @ts-check
import { defineConfig, devices } from '@playwright/test';

// Suíte E2E do Bõnotto. Roda sempre contra ?demo=1 (ver js/data/config.js) —
// nunca depende de trocar js/data/config.js pra placeholder, então as
// credenciais reais que ficam commitadas nesse arquivo nunca são um risco
// pra rodar os testes, e o teste nunca faz uma chamada de rede real ao
// Supabase de produção.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5500',
    trace: 'retain-on-failure',
    // TASK-037 (tour de onboarding, js/components/onboarding.js): sem isto,
    // TODO teste que loga (quase a suíte inteira) cairia num primeiro login
    // "primeira visita de verdade" e o tour abriria sozinho por cima,
    // bloqueando qualquer clique seguinte (.cg-modal-backdrop intercepta
    // pointer events, por design — é um modal de verdade). Pré-semeia a
    // flag "já visto" (mesma chave que js/components/onboarding.js usa,
    // localStorage bonotto_onboarding_v1_seen) pra cada contexto já nascer
    // sem o tour, do jeito que testes escritos ANTES do tour existir
    // esperam. tests/e2e/onboarding-tour.spec.js precisa testar o
    // comportamento de "primeira visita" de propósito — ele sobrescreve
    // isto com um storageState vazio só nos próprios testes (test.use).
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:5500',
          localStorage: [{ name: 'bonotto_onboarding_v1_seen', value: '1' }],
        },
      ],
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'python -m http.server 5500',
    url: 'http://localhost:5500',
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
});
