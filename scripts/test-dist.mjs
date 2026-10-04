// `npm run test:dist` — roda a suíte Playwright contra dist/ (build de
// produção obfuscado) em vez do fonte. Só existe pra setar PW_DIST=1 de um
// jeito que funcione igual no Windows e no Linux do CI, sem depender de cross-env.
import { spawnSync } from 'node:child_process';

const r = spawnSync('npx', ['playwright', 'test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PW_DIST: '1' },
});
process.exit(r.status ?? 1);
