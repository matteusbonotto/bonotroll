// `npm run dev` — serve o código-fonte LEGÍVEL (sem minificar/obfuscar),
// conectado ao Supabase configurado no .env. A única diferença para servir a
// pasta crua é js/data/config.js, que sai com a configuração PÚBLICA injetada
// em memória (o arquivo em disco nunca é tocado).
//
// Porta 5510 de propósito, diferente da 5500 do Playwright (playwright.config.js
// usa reuseExistingServer): se fosse a mesma, a suíte e2e podia reaproveitar
// este servidor e rodar contra o banco real em vez do fonte cru em modo demo.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, configPublica, injetarConfig } from './env.mjs';

const PORTA = Number(process.env.PORT) || 5510;
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.csv': 'text/csv; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

const publica = configPublica();

http
  .createServer((req, res) => {
    const caminhoUrl = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    let arquivo = path.normalize(path.join(RAIZ, caminhoUrl));
    // Nada fora da raiz, e nunca .env/.git/node_modules.
    const relativo = path.relative(RAIZ, arquivo);
    if (relativo.startsWith('..') || /(^|[\\/])(\.env|\.git|node_modules)([\\/.]|$)/.test(relativo)) {
      res.writeHead(404).end();
      return;
    }
    if (fs.existsSync(arquivo) && fs.statSync(arquivo).isDirectory()) arquivo = path.join(arquivo, 'index.html');
    if (!fs.existsSync(arquivo)) {
      res.writeHead(404).end('404');
      return;
    }
    let corpo = fs.readFileSync(arquivo);
    if (path.relative(RAIZ, arquivo).replace(/\\/g, '/') === 'js/data/config.js') {
      corpo = injetarConfig(corpo.toString('utf8'), publica);
    }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(corpo);
  })
  .listen(PORTA, () => {
    console.log(`BNTT (dev, código legível) em http://localhost:${PORTA}/`);
    console.log(
      publica
        ? `Supabase: ${publica.url}`
        : 'Sem SB_PROJ_ID/SB_PB no .env — o app vai abrir em MODO DEMONSTRAÇÃO.'
    );
  });
