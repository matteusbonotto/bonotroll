// Serve dist/ aplicando os MESMOS cabeçalhos do firebase.json (CSP inclusa).
// O emulador do Firebase não aplica `headers`, e o `python -m http.server`
// também não — então até 2026-10-04 nenhum teste via a CSP de produção.
// Uso: node scripts/servir-dist.mjs [porta]   (usado por `npm run test:dist`)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const PORTA = Number(process.argv[2] || 5520);
const RAIZ = resolve('dist');
const config = JSON.parse(await readFile('firebase.json', 'utf8'));
const cabecalhosGlobais = Object.fromEntries(
  (config.hosting.headers.find((h) => h.source === '**')?.headers || []).map((h) => [h.key, h.value]),
);

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.csv': 'text/csv; charset=utf-8',
};

createServer(async (req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let arquivo = normalize(join(RAIZ, caminho));
  if (!arquivo.startsWith(RAIZ)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if ((await stat(arquivo)).isDirectory()) arquivo = join(arquivo, 'index.html');
    const corpo = await readFile(arquivo);
    res.writeHead(200, { ...cabecalhosGlobais, 'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream' });
    res.end(corpo);
  } catch {
    res.writeHead(404, cabecalhosGlobais).end('não encontrado');
  }
}).listen(PORTA, '127.0.0.1', () => console.log(`dist/ com cabeçalhos do firebase.json em http://localhost:${PORTA}`));
