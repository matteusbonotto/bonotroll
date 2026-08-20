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
