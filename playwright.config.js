// @ts-check
import { defineConfig, devices } from '@playwright/test';

// Suíte E2E do BNTT. Roda sempre contra ?demo=1 (ver js/data/config.js) —
// o python http.server abaixo serve o fonte cru, onde js/data/config.js só
// tem placeholders (a config real só é injetada por npm run dev/build — ver
// scripts/env.mjs), então o teste nunca faz uma chamada de rede real ao
// Supabase de produção.
// PW_DIST=1 (npm run test:dist) roda a MESMA suíte contra o build de produção
// (dist/, minificado + obfuscado) numa porta própria — é o que garante que a
// obfuscação não quebrou nada que o index.html/Alpine referencia por nome.
const DIST = !!process.env.PW_DIST;
const PORTA = DIST ? 5520 : 5500;
const ORIGEM = `http://localhost:${PORTA}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: ORIGEM,
    trace: 'retain-on-failure',
    // TASK-037/038 (onboarding, js/components/onboarding.js): sem isto,
    // TODO teste que loga (quase a suíte inteira) cairia num primeiro login
    // "primeira visita de verdade" e o tour abriria sozinho por cima,
    // bloqueando qualquer clique seguinte (o passo de boas-vindas é um
    // .cg-modal-backdrop de verdade; os passos de ação escurecem o resto da
    // tela). Pré-semeia a flag "já visto" (mesma chave que
    // js/components/onboarding.js usa — bonotto_onboarding_v2_seen, "v2"
    // porque a reconstrução de 2026-09 trocou o formato inteiro, de um tour
    // de slides pra um passo-a-passo interativo; ver comentário grande no
    // topo de onboarding.js) pra cada contexto já nascer sem o tour, do
    // jeito que testes escritos ANTES do tour existir esperam.
    // tests/e2e/onboarding-tour.spec.js precisa testar o comportamento de
    // "primeira visita" de propósito — ele sobrescreve isto com um
    // storageState vazio só nos próprios testes (test.use).
    storageState: {
      cookies: [],
      origins: [
        {
          origin: ORIGEM,
          localStorage: [{ name: 'bonotto_onboarding_v2_seen', value: '1' }],
        },
      ],
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: DIST ? `node scripts/servir-dist.mjs ${PORTA}` : `python -m http.server ${PORTA}`,
    url: ORIGEM,
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
});
