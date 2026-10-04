# Deploy no Firebase + banco dedicado — BNTT

Migração de infraestrutura iniciada em 2026-09-25 (branch `feat/firebase-banco-dedicado`).
Documento vivo: marque `[x]` só o que foi feito **e** verificado.

## Arquitetura

```text
Navegador (PWA)
   │  HTML/CSS/JS estático (dist/, minificado + obfuscado)
   ▼
Firebase Hosting — projeto bnttapp → https://bnttapp.web.app
   │  (só arquivos estáticos; nenhum SDK do Firebase no app)
   ▼
Supabase appbntt (ref qlcrsclgtpjeqkmykqrs, sa-east-1)
   ├── Postgres + RLS  (supabase/schema.sql)
   ├── Auth (email/senha)
   ├── Storage (buckets avatars, anexos)
   └── Edge Functions (keepalive, notify-scan, notify-payment)
```

| Componente | Antes | Agora |
|---|---|---|
| Hosting | GitHub Pages (branch `main`, fonte cru) | Firebase Hosting `bnttapp`, `public: dist` |
| Banco | Supabase `zkoxuafdcsfrdmlfckxz` (conta pessoal) | Supabase `appbntt` / `qlcrsclgtpjeqkmykqrs` (conta do BNTT) |
| Config do frontend | URL + anon key hardcoded em `js/data/config.js` | `.env` (`SB_PROJ_ID`, `SB_PB`) injetado por `npm run dev`/`build`; fonte só com placeholder |
| Build | nenhum | `npm run build` → esbuild (minificação) + javascript-obfuscator |
| Versão do SW | `CACHE_NAME` bumpado à mão | carimbo automático por hash de conteúdo |

## Variáveis do `.env` (só nomes)

| Nome | Tipo | Uso |
|---|---|---|
| `SB_PROJ_ID` | público | monta `https://<ref>.supabase.co` no build |
| `SB_PB` | público | publishable key → `SUPABASE_ANON_KEY` no build (RLS protege os dados) |
| `URL_BASE_FIREBASE` | público | referência; o app usa caminhos relativos |
| `FIREBASE_API_KEY` | público | não usada (o app não usa SDK do Firebase) |
| `SB_SK` | **secreto** | nunca no frontend; só scripts de administração/migração |
| `STRIP_TOKEN` | **secreto** | nunca no frontend; reservado pro billing futuro |

`scripts/env.mjs` recusa montar o build se `SB_PB` for uma `sb_secret_…` ou um JWT `service_role`, e o build aborta (apagando `dist/`) se o valor de qualquer variável secreta, uma `sb_secret_…`, uma chave privada PEM, um JWT `service_role`, o ref do banco antigo ou um `sourceMappingURL` aparecer nos artefatos.

## Comandos

```bash
npm install
npm run dev          # fonte legível + banco do .env → http://localhost:5510/
npm run build        # dist/ de produção
npm run test:unit    # testes de função pura
npm test             # e2e contra o fonte (modo demo)
npm run test:dist    # e2e contra o dist/ obfuscado (build --demo)
npm run preview      # build + emulador do Hosting (o emulador NÃO aplica os headers do firebase.json)
npm run deploy       # build + firebase deploy --only hosting  ← produção
```

Validar headers/cache de verdade sem tocar o site principal (canal temporário):

```bash
npm run build && firebase hosting:channel:deploy validacao --expires 1d
```

## Decisões

- **Sem bundle.** Cada `.js` é minificado e obfuscado no mesmo caminho: imports relativos, `import()` de esm.sh e o `APP_SHELL` do `sw.js` continuam valendo.
- **Obfuscação conservadora.** `renameGlobals`, `renameProperties` e `transformObjectKeys` ficam desligados, porque o `index.html` (Alpine) referencia métodos, propriedades e `window.cg*` por nome. `controlFlowFlattening`, `deadCodeInjection`, `selfDefending` e `debugProtection` também ficam desligados (custo de desempenho ou quebra com DevTools aberto). String array em base64 fica ligada. A semente é fixa, então o build é determinístico.
- **Sem sourcemaps publicados.** Um `.map` no Hosting entregaria o fonte legível. Para depurar, use `npm run dev`.
- **Obfuscação não é segurança.** Nenhum segredo chega ao frontend. A proteção dos dados é a RLS do Postgres.
- **Sem rewrite de SPA.** A navegação é por hash (`#/transacoes`), então toda rota é `/index.html`. Um rewrite `** → /index.html` só faria arquivo inexistente responder HTML com status 200.
- **Cache.** `/`, `*.html`, `*.js`, `*.css` e o manifest vão com `no-cache` (revalidação por ETag a cada carga). `sw.js` vai com `no-store`. Ícones ficam com 7 dias (a URL leva `?v=N`). Com o carimbo no `CACHE_NAME`, um deploy novo sempre instala um SW novo, que faz `skipWaiting()`, e a página recarrega sozinha (`js/app.js`).
- **Headers de segurança:** nosniff, `X-Frame-Options: DENY`, CSP mínima (`frame-ancestors`/`base-uri`/`object-src`), Permissions-Policy (câmera só same-origin, por causa do leitor de código de barras). HSTS o Firebase já manda.
- **Sem CSP completa (ainda).** O Alpine padrão exige `unsafe-eval`, e Tesseract/pdf.js/esm.sh carregam workers de CDNs. Uma CSP de `script-src`/`connect-src` precisa ser testada feature por feature antes de ligar.

## Migração de dados (banco antigo → appbntt)

Estado em 2026-09-25: o `appbntt` está **vazio** (0 tabelas em `public`, 0 usuários, 0 buckets, sem `pg_cron`/`pg_net`). O banco antigo tem os dados reais e **não é acessível pela conta Supabase logada hoje**.

Enquanto a migração não termina, **não publique** o `bnttapp.web.app` com o banco novo aberto a cadastros. Uma conta criada no banco novo com o mesmo e-mail colidiria com o `auth.users` migrado (UUID diferente, e o histórico ficaria órfão).

Plano (cada passo em produção só com confirmação explícita):

1. **Acesso ao banco antigo.** A connection string (Project Settings → Database, com a senha do banco) ou `npx supabase login` na conta dona do `zkoxuafdcsfrdmlfckxz`. Para copiar arquivos do Storage também é preciso a service_role/secret key do projeto antigo.
2. **Backup do antigo** (somente leitura): `supabase db dump` do schema e dos dados de `public` e `auth`, guardado fora do repositório.
3. **Schema no novo:** `npx supabase db query --linked -f supabase/schema.sql` (idempotente, sem DROP de tabela, já cria os buckets).
4. **Dados:**
   - Primeiro `auth.users` e `auth.identities` (preserva UUIDs e hashes de senha, ninguém precisa recadastrar).
   - Depois `public` em ordem de FK, com `session_replication_role = replica`. Isso é necessário para o trigger `on_auth_user_created` não criar profiles duplicados.
5. **Arquivos do Storage** (`avatars`, `anexos`): copiar objeto a objeto via API, mantendo os mesmos paths. Colunas que guardam a URL pública completa do bucket (avatares) precisam ter o host `zkoxuafdcsfrdmlfckxz` reescrito para `qlcrsclgtpjeqkmykqrs`.
6. **Validação:** contagem por tabela antes × depois; amostras de transações/parcelas/divisões; login real das duas contas; abrir um anexo; saldo "entre vocês" igual nos dois bancos.
7. **Auth do novo projeto:** Site URL e Redirect URLs = `https://bnttapp.web.app` (Authentication → URL Configuration). Conferir também SMTP e templates de e-mail.
8. **Push/keepalive:** extensões `pg_cron`/`pg_net`, deploy das 3 Edge Functions, secrets VAPID e `supabase/notifications_push.sql`. Ver a pendência de chaves em `supabase/NOTIFICACOES.md`.
9. **Deploy:** `npm run deploy`, depois reinstalar o PWA em `bnttapp.web.app` nos dois celulares.
10. **Desligar o antigo:** página de aviso/redirect no GitHub Pages por um tempo, depois desligar o Pages e privatizar o repositório. Só pausar o projeto Supabase antigo depois de algumas semanas de uso estável no novo.

## Checklist

- [x] Projeto estudado e diagnóstico feito
- [x] Banco novo identificado (`appbntt`), linkado na CLI e inspecionado (vazio)
- [x] Config do frontend vem do `.env`; nenhuma credencial hardcoded no fonte
- [x] `.gitignore` cobre `.env`, `.env.*`, `dist/`, `.firebase/`
- [x] Build: minificação + obfuscação + varredura de segredos funcionando
- [x] Suíte e2e completa (56 testes) passando contra o `dist/` obfuscado
- [x] `firebase.json`/`.firebaserc` (`bnttapp`); headers validados num canal de preview real
- [x] Build determinístico (mesmo fonte → mesma versão do SW)
- [ ] Schema aplicado no `appbntt`
- [ ] Dados, usuários e arquivos migrados e validados
- [ ] Auth URL Configuration apontando para `bnttapp.web.app`
- [ ] Edge Functions + push + keepalive no projeto novo
- [ ] Deploy de produção no `bnttapp.web.app`
- [ ] GitHub Pages desligado e repositório privado
