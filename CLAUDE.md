# CLAUDE.md — BNTT

Contexto principal do repositório para o Claude Code. Leia isto primeiro; os documentos vivos em `.claude/docs/` e `docs/` aprofundam cada assunto.

**Histórico de nome**: o produto já passou por 2 rebrands — "CasaGrana" (nome original) → "Bõnotto" (2026-08-20, ver `docs/CHECKLIST-REBRAND.md`) → "**BNTT**" (2026-09-14, este). Documentos históricos (`docs/BONOTTO-2027-BLUEPRINT.md`, `docs/CHECKLIST-REBRAND.md`, `.claude/memory/`, `.claude/discussions/`, nomes de arquivo, commits antigos) continuam mencionando "Bõnotto"/"CasaGrana" de propósito — são registro do que aconteceu quando esses eram os nomes vigentes, não erro a corrigir. O nome do repositório GitHub (`bonotroll`) não muda. A URL pública MUDOU em 2026-09 (decisão explícita do usuário): de GitHub Pages para o Firebase Hosting `https://bnttapp.web.app` — o GitHub Pages será desligado e o repositório privatizado depois da migração (ver `docs/DEPLOY-FIREBASE.md`).

## Idioma

Responder **sempre em português do Brasil** (PT-BR), em qualquer conversa sobre este repositório — não só quando o usuário escrever em português primeiro. Comentário de código, mensagem de commit e resposta ao usuário seguem essa regra; nome de variável/função/classe continua em português também, já é o padrão estabelecido no código (ver o resto deste documento). (Formalizado a partir de `.claude/language.md`.)

## Project Overview

**BNTT — Controle Financeiro Doméstico** ("Seu dinheiro, sua casa, sob controle.") é um PWA doméstico para duas pessoas (Matheus e Beatriz) que unifica três domínios que normalmente vivem em apps separados:

1. **Controle financeiro pessoal e do grupo** — entradas/saídas, despesa fixa/variável, recorrência com cadência, parcelamento, divisão de despesa entre múltiplos pagadores, saldo "entre vocês".
2. **Lista de compras** — máquina de estados (planejar → comprar → pausar → encerrar), preço por unidade/peso, sugestão de categoria, leitura de código de barras/foto/PDF.
3. **Recursos** — inventário doméstico em 3 níveis (cômodo → subcategoria → item), com sugestão automática de compra quando algo acaba ou vence.

Mais dois módulos que amarram os três: **Caixinhas** (reserva financeira por banco, multi-moeda com conversão ao vivo) e **Notificações** (central no app + push real via Edge Functions).

A sigla BNTT nomeia os 4 pilares do posicionamento (usado sobretudo na landing page, `landing.html`): **B**alanço (item 1 acima) · **N**ecessidades (item 2) · **T**ransações (parte do item 1 — cartão, parcelamento, recorrência) · **T**ranquilidade (a proposta de valor de ter tudo num lugar só). Apoio visual secundário do slogan, quando fizer sentido: "Balanço. Necessidades. Transações. Tranquilidade."

É software sob medida para 2 usuários reais, não um produto comercial — mas construído com disciplina de produto real (RLS de verdade, services/ como fronteira, testes automatizados) porque *poderia* virar um no futuro.

O documento de escopo original e autossuficiente está em [`prompt-app-controle-financeiro.md`](prompt-app-controle-financeiro.md) (raiz do repo) — foi escrito para ser colado inteiro numa conversa nova e já contém as restrições técnicas inegociáveis, o schema completo e o checklist de aceite original.

## Technology Stack

Só o que realmente existe no repositório — nada inventado:

```text
Frontend:          Vanilla JS (ES modules nativos) + Alpine.js 3 (reatividade) + Bootstrap 5 (só CSS/grid/utilities) — tudo via CDN/esm.sh, sem bundler
Backend:            Supabase (Postgres + Auth + Storage + Edge Functions) — supabase/schema.sql é a fonte de verdade do schema
Database:           Postgres com RLS ativo em toda tabela (owner_id = auth.uid() OR membro do grupo)
Authentication:      Supabase Auth (email/senha) + modo demo local (localStorage, mesma forma de dado, ver js/data/mockDb.js)
Testing:             node --test (unit, tests/unit/*.test.js) + Playwright (e2e, tests/e2e/*.spec.js) — npm run test:unit && npm test
Build:               Só para produção — `npm run build` (scripts/build.mjs) copia o que é público para dist/, injeta a config pública do .env em js/data/config.js, minifica (esbuild) e obfusca (javascript-obfuscator, semente fixa) cada .js no mesmo caminho, sem bundle nem sourcemap, carimba a versão no CACHE_NAME do sw.js e aborta se achar segredo no artefato. Desenvolvimento continua sem build: `npm run dev` serve o fonte legível.
Deployment:          Firebase Hosting, projeto `bnttapp` (https://bnttapp.web.app) — `npm run deploy` (= build + `firebase deploy --only hosting`, public = dist/). Ver docs/DEPLOY-FIREBASE.md. O GitHub Pages (branch main) é a hospedagem ANTIGA, a ser desligada depois da migração. Nunca trabalhar direto em main — sempre numa branch de feature, mergear (fast-forward) e fazer deploy só quando o usuário pedir explicitamente.
Supabase CLI:         `npx supabase <comando>` funciona neste ambiente. Banco OFICIAL desde 2026-09-25: projeto `appbntt` (ref `qlcrsclgtpjeqkmykqrs`, conta do BNTT) — confirmar com `npx supabase projects list` que é ele que aparece com "linked": true. O banco antigo (`zkoxuafdcsfrdmlfckxz`, conta pessoal) só existe como origem da migração de dados. Pra aplicar `supabase/schema.sql` (idempotente): `npx supabase db query --linked -f supabase/schema.sql`; query solta: `npx supabase db query --linked "select ..."`. Isto é ação real em produção — sempre confirmar com o usuário antes. Se o login expirar, `npx supabase login` precisa ser feito pelo usuário (fluxo de navegador). Configuração do frontend (URL + publishable key) vem do .env (SB_PROJ_ID, SB_PB) — js/data/config.js só tem placeholders no fonte; SB_SK/STRIP_TOKEN são secretos e nunca vão pro frontend (scripts/env.mjs).
Infrastructure:      Nenhuma própria — Supabase free tier
External Services:   Frankfurter (câmbio), CoinGecko (cripto), Open Food Facts (código de barras), esm.sh (CDN de módulos pesados: Chart.js, Tesseract.js, pdf.js, html5-qrcode, PapaParse, @supabase/supabase-js), Google Fonts (só a fonte "Caveat" na tela de Compras)
```

## Estrutura real do código

```text
index.html                 — único arquivo de markup: 7 telas + ~12 modais, todos permanentemente montados (x-show troca visibilidade, nunca x-if pra telas principais)
css/tokens.css              — paleta semântica, escala de espaço, raio, dark mode (3 estados: sistema/claro forçado/escuro forçado)
css/components.css          — componentes .cg-* (cards, badges, avatares, tiles, etc.)
css/app.css                 — layout de página, topbar, sidebar, modais, responsividade
js/app.js                   — bootstrap do Alpine, registro de stores/componentes, service worker, auto-refresh
js/components/*.js          — um x-data por tela/modal (dashboard, transactionTable, shoppingList, resourcesView, caixinhasView, store global etc.)
js/services/*.js            — ÚNICA fronteira entre UI e dado; cada função checa isDemoMode() e decide mockDb vs Supabase — NENHUMA tela sabe qual dos dois está em uso
js/data/mockDb.js           — "banco" localStorage do modo demo, espelha exatamente o schema do Supabase, com seedDatabase() gerando dado fake completo
js/utils/*.js               — funções puras (formatação, dinheiro, status) — é aqui que ficam os testes unitários mais fáceis de escrever
supabase/schema.sql         — schema completo + RLS, idempotente (create table if not exists, drop policy if exists antes de recriar)
supabase/functions/*        — 3 Edge Functions (notify-scan, notify-payment, keepalive) — deploy manual, documentado em supabase/NOTIFICACOES.md
tests/unit/*.test.js        — funções puras de js/services e js/utils
tests/e2e/*.spec.js         — Playwright, sempre contra ?demo=1 (não precisa de conta real)
```

## Convenções que já existem — reutilizar, não reinventar

- **Prefixo `cg-`** em toda classe CSS própria (herdado do nome original do projeto, "CasaGrana" — decisão deliberada, sobreviveu ao rebrand pra "Bõnotto" e agora pra "BNTT", nunca renomear).
- **`services/` é a única fronteira** entre UI e dado. Toda função nova de acesso a dado entra ali, nunca direto num componente.
- **Nada calculado é persistido** — status de pagamento, saldo de caixinha, total de lista de compras: tudo derivado ao vivo do dado bruto a cada render.
- **Padrão "best-effort"** para ação secundária (ex.: gerar notificação nunca pode travar salvar uma transação) — sempre `try/catch` isolado ao redor da parte não-crítica.
- **Find-or-create sem duplicata** — bancos/categorias/empresas são entidades compartilhadas (nome único por owner/grupo), nunca texto livre duplicado. Ver `findOrCreateBank`/`findCompanyByName` como referência de padrão.
- **Import dinâmico para tudo pesado** (`await import('https://esm.sh/...')`) — nenhuma lib grande paga custo de carregamento se a sessão não usar aquela feature.
- **`?demo=1`** ativa o modo demo (localStorage) sem precisar de conta Supabase — é como todo teste e toda verificação visual deste projeto deve rodar.
- **Chaves de `localStorage` com prefixo `bonotto_`** (tema, modo de visualização por tela, flag de onboarding visto, banco demo — grep por `bonotto_` em `js/` pra ver a lista completa) **nunca são renomeadas**, mesmo pós-rebrand — são o estado já salvo no navegador de quem já usa o app; renomear a chave reseta essa preferência silenciosamente. Mesma lógica do prefixo `cg-` acima.

## Armadilhas já conhecidas (não redescobrir)

- **`x-show` + classe de utilidade Bootstrap no mesmo elemento nunca esconde nada.** Utilities do Bootstrap 5 (`.d-flex`, `.d-none`, `.mt-1`, etc.) são `!important` na folha de estilo; o `x-show` padrão do Alpine escreve um `style="display:none"` SEM `!important` — a folha de estilo sempre vence. Ocorreu ≥5 vezes neste projeto em componentes diferentes. Fix: `x-show.important="..."` (modificador nativo do Alpine), ou remover a classe utilitária conflitante do elemento.
- **Declaração de CSS duplicada, mesma especificidade, a de baixo no arquivo ganha silenciosamente.** Já aconteceu com `.cg-btn`, `.cg-main`, `.cg-card`/`.cg-card--compact`, `.cg-modal`. Ao adicionar uma variante nova (`.cg-card--dense` etc.), usar seletor composto (`.cg-card.cg-card--dense`) em vez de confiar em ordem de arquivo.
- **Aritmética monetária no cliente usa `Number` de ponto flutuante, não centavos inteiros** (o banco usa `numeric(12,2)`, correto). Dívida técnica conhecida, não corrigida — ver `docs/RAIO-X-2.0.md` §5/§8.
- **Todas as 7 telas ficam sempre montadas no DOM** — um seletor CSS/JS sem escopo de tela (`document.querySelector('.cg-algo')`) pode pegar o elemento errado de uma tela escondida. Sempre escopar por `section[x-data^="nomeDaView"]` em teste/debug.

## Comandos

```bash
npm run dev                     # fonte legível + Supabase do .env → http://localhost:5510/
python -m http.server 5500      # fonte cru, sempre em modo demo (config.js com placeholder) → http://localhost:5500/?demo=1
npm run build                   # dist/ de produção (minificado + obfuscado + varredura de segredos)
npm run preview                 # build + emulador do Firebase Hosting (atenção: o emulador não aplica os headers do firebase.json)
npm run deploy                  # build + firebase deploy --only hosting (produção — só quando o usuário pedir)

npm run test:unit                # testes de função pura (node --test)
npm test                         # Playwright e2e (usa playwright.config.js, sobe o server sozinho)
npx playwright test --workers=2  # mesma coisa, mais rápido em paralelo
npm run test:dist                # mesma suíte e2e contra o dist/ obfuscado (build --demo, porta 5520)
```

## Onde cavar mais fundo

- [`docs/RAIO-X-DO-PROJETO.md`](docs/RAIO-X-DO-PROJETO.md) — diagnóstico técnico file-por-file, verificado contra produção.
- [`docs/RAIO-X-2.0.md`](docs/RAIO-X-2.0.md) — diagnóstico multidisciplinar (pontos fortes, problemas, riscos, dívida técnica, gaps).
- [`docs/DESIGN-SYSTEM-2027.md`](docs/DESIGN-SYSTEM-2027.md) — diretriz de UX/UI, escala tipográfica, regra do botão "voltar", quando usar card.
- [`docs/BONOTTO-2027-BLUEPRINT.md`](docs/BONOTTO-2027-BLUEPRINT.md) — roadmap detalhado por fase.
- [`docs/CHECKLIST-REBRAND.md`](docs/CHECKLIST-REBRAND.md) — status real, item a item, do rebrand e das rodadas de pedido subsequentes. **Binário: `[x]` feito e verificado, `[ ]` não feito. Sem meio-termo.**
- [`prompt-app-controle-financeiro.md`](prompt-app-controle-financeiro.md) — o prompt de construção original, autossuficiente.
- [`.claude/docs/`](.claude/docs/) — versões vivas e mais curtas dos documentos acima, mantidas por este sistema de agentes.
