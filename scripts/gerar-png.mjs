// Renderiza um HTML local em PNG (usado para gerar assets/icons/*.png a partir dos SVG).
//   node scripts/gerar-png.mjs <arquivo.html> <saida.png> [largura] [altura]
import { chromium } from '@playwright/test';
import { pathToFileURL } from 'node:url';

const [, , arquivo, saida, w, h] = process.argv;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: Number(w) || 520, height: Number(h) || 260 } });
await p.goto(pathToFileURL(arquivo).href);
await p.screenshot({ path: saida, omitBackground: true });
await b.close();
