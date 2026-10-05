// `npm run build` — gera dist/ (o que o Firebase Hosting publica) a partir do
// código-fonte, sem nunca alterar o fonte:
//
//   fonte → cópia só do que é público → config pública injetada → minificação
//   (esbuild) → obfuscação (javascript-obfuscator) → carimbo de versão no
//   service worker → varredura de segredos → dist/
//
// Cada .js continua sendo um arquivo separado, com o mesmo caminho do fonte (não
// há bundle): os imports relativos, os import() dinâmicos de esm.sh e a lista
// APP_SHELL do sw.js seguem valendo sem reescrever nada.
//
// Sem sourcemaps de propósito: publicar um .map no Hosting entregaria o
// código-fonte legível inteiro e anularia a obfuscação. Pra depurar, use
// `npm run dev` (fonte legível) — o comportamento é o mesmo.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { transform } from 'esbuild';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { RAIZ, lerEnv, configPublica, injetarConfig, valoresSecretos } from './env.mjs';

const DIST = path.join(RAIZ, 'dist');

// Lista explícita do que é publicado — docs/, supabase/, tests/, importacao/,
// .claude/, prompts etc. nunca vão pro Hosting.
const PUBLICAR = [
  'index.html',
  'app.html',
  'termos.html',
  'privacidade.html',
  'manifest.webmanifest',
  'sw.js',
  'css',
  'js',
  'assets',
  'landing-assets',
];

// Obfuscação conservadora: tudo que o index.html referencia por NOME (métodos
// e propriedades dos x-data do Alpine, window.cgFormat/cgStatus/cgDateInput,
// exports entre módulos) precisa continuar existindo com o mesmo nome. Por isso
// renameGlobals/renameProperties/transformObjectKeys ficam desligados — só
// variáveis locais são renomeadas. controlFlowFlattening/deadCodeInjection/
// selfDefending/debugProtection também desligados: custam muito desempenho
// (ou quebram o app em DevTools aberto) para um ganho pequeno aqui.
const OPCOES_OBFUSCADOR = {
  target: 'browser',
  // Semente fixa = saída determinística: o mesmo fonte gera o mesmo dist/, o
  // carimbo de versão do sw.js (passo 4) não muda e o PWA não se atualiza à
  // toa num deploy sem mudança real. Com semente aleatória, todo build mudaria.
  seed: 20260925,
  sourceMap: false,
  compact: true,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  renameProperties: false,
  transformObjectKeys: false,
  stringArray: true,
  stringArrayThreshold: 0.75,
  stringArrayEncoding: ['base64'],
  stringArrayRotate: true,
  stringArrayShuffle: true,
  splitStrings: false,
  numbersToExpressions: false,
  simplify: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
  unicodeEscapeSequence: false,
};

function copiar(origem, destino) {
  const stat = fs.statSync(origem);
  if (stat.isDirectory()) {
    fs.mkdirSync(destino, { recursive: true });
    for (const nome of fs.readdirSync(origem)) copiar(path.join(origem, nome), path.join(destino, nome));
  } else {
    fs.copyFileSync(origem, destino);
  }
}

function listar(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listar(p) : [p];
  });
}

const rel = (p) => path.relative(DIST, p).replace(/\\/g, '/');

async function main() {
  const inicio = Date.now();
  const env = lerEnv();
  // --demo: build sem nenhuma config de Supabase (placeholders ficam) — usado
  // por `npm run test:dist`, pra suíte e2e rodar contra o artefato de produção
  // sem nenhuma chance de tocar o banco real.
  const soDemo = process.argv.includes('--demo');
  const publica = soDemo ? null : configPublica(env);
  if (!publica && !soDemo) {
    throw new Error(
      'O .env não tem SB_PROJ_ID + SB_PB — o build sairia em modo demonstração. ' +
        'Preencha o .env (ou use --demo se for isso mesmo).'
    );
  }

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST);
  for (const item of PUBLICAR) copiar(path.join(RAIZ, item), path.join(DIST, item));

  // 1) Configuração pública do Supabase.
  const configPath = path.join(DIST, 'js/data/config.js');
  fs.writeFileSync(configPath, injetarConfig(fs.readFileSync(configPath, 'utf8'), publica));

  // 2) Minificação + obfuscação do JS do app e da landing. O sw.js é tratado à
  //    parte (passo 4) porque precisa do carimbo de versão.
  const arquivos = listar(DIST);
  let bytesAntes = 0;
  let bytesDepois = 0;
  for (const arquivo of arquivos) {
    const r = rel(arquivo);
    if (r === 'sw.js') continue;
    const ext = path.extname(arquivo);
    if (ext !== '.js' && ext !== '.css') continue;
    const fonte = fs.readFileSync(arquivo, 'utf8');
    bytesAntes += Buffer.byteLength(fonte);
    let saida;
    if (ext === '.css') {
      saida = (await transform(fonte, { loader: 'css', minify: true, legalComments: 'none' })).code;
    } else {
      const minificado = (
        await transform(fonte, { loader: 'js', minify: true, target: 'es2020', legalComments: 'none', sourcemap: false })
      ).code;
      saida = JavaScriptObfuscator.obfuscate(minificado, OPCOES_OBFUSCADOR).getObfuscatedCode();
    }
    fs.writeFileSync(arquivo, saida);
    bytesDepois += Buffer.byteLength(saida);
  }

  // 3) Hash de conteúdo de tudo que foi publicado (menos o próprio sw.js).
  const hash = crypto.createHash('sha256');
  for (const arquivo of listar(DIST).sort()) {
    if (rel(arquivo) === 'sw.js') continue;
    hash.update(rel(arquivo));
    hash.update(fs.readFileSync(arquivo));
  }
  const versao = hash.digest('hex').slice(0, 10);

  // 4) Carimbo no CACHE_NAME do service worker: todo build com conteúdo
  //    diferente gera um sw.js com bytes diferentes → o navegador instala o SW
  //    novo, que faz skipWaiting() + a página recarrega sozinha (js/app.js).
  //    Build idêntico = mesmo carimbo = nenhuma atualização à toa. Isso tira a
  //    dependência de lembrar de bumpar 'bntt-vNN' à mão a cada deploy.
  const swPath = path.join(DIST, 'sw.js');
  const swFonte = fs.readFileSync(swPath, 'utf8');
  const swCarimbado = swFonte.replace(/const CACHE_NAME = '([^']+)';/, `const CACHE_NAME = '$1-${versao}';`);
  if (swCarimbado === swFonte) throw new Error('Não achei a constante CACHE_NAME em sw.js para carimbar a versão.');
  fs.writeFileSync(
    swPath,
    (await transform(swCarimbado, { loader: 'js', minify: true, target: 'es2020', legalComments: 'none' })).code
  );

  // 5) Varredura de segredos e resíduos no que vai ser publicado.
  const proibidos = [
    ...valoresSecretos(env).map(([nome, valor]) => [`valor de ${nome} (.env)`, valor]),
    ['secret key do Supabase', /sb_secret_[A-Za-z0-9_-]+/],
    ['chave privada', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
    ['JWT service_role', /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/],
    ['projeto Supabase antigo', 'zkoxuafdcsfrdmlfckxz'],
    ['sourcemap', /sourceMappingURL=/],
  ];
  const achados = [];
  for (const arquivo of listar(DIST)) {
    if (!/\.(js|css|html|json|webmanifest|svg)$/.test(arquivo)) continue;
    const conteudo = fs.readFileSync(arquivo, 'utf8');
    for (const [nome, padrao] of proibidos) {
      if (padrao instanceof RegExp) {
        for (const m of conteudo.matchAll(new RegExp(padrao.source, 'g'))) {
          // JWT legado de anon é público por natureza; só barra se for service_role.
          if (nome === 'JWT service_role') {
            const role = (() => {
              try {
                return JSON.parse(Buffer.from(m[0].split('.')[1], 'base64url').toString()).role;
              } catch {
                return null;
              }
            })();
            if (role !== 'service_role') continue;
          }
          achados.push(`${rel(arquivo)}: ${nome}`);
        }
      } else if (conteudo.includes(padrao)) {
        achados.push(`${rel(arquivo)}: ${nome}`);
      }
    }
  }
  if (achados.length) {
    fs.rmSync(DIST, { recursive: true, force: true });
    throw new Error(`Build ABORTADO — conteúdo proibido nos artefatos (dist/ apagado):\n  ${[...new Set(achados)].join('\n  ')}`);
  }

  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
  console.log(`dist/ gerado em ${((Date.now() - inicio) / 1000).toFixed(1)}s — versão ${versao}`);
  console.log(`JS+CSS: ${kb(bytesAntes)} → ${kb(bytesDepois)} (minificado + obfuscado)`);
  console.log(publica ? `Supabase: ${publica.url}` : 'ATENÇÃO: build em MODO DEMONSTRAÇÃO (sem Supabase).');
  console.log('Varredura de segredos: nada encontrado.');
}

main().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
