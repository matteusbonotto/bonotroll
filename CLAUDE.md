# CLAUDE.md — Bõnotto

Contexto principal do repositório para o Claude Code. Leia isto primeiro; os documentos vivos em `.claude/docs/` e `docs/` aprofundam cada assunto.

## Idioma

Responder **sempre em português do Brasil** (PT-BR), em qualquer conversa sobre este repositório — não só quando o usuário escrever em português primeiro. Comentário de código, mensagem de commit e resposta ao usuário seguem essa regra; nome de variável/função/classe continua em português também, já é o padrão estabelecido no código (ver o resto deste documento). (Formalizado a partir de `.claude/language.md`.)

## Project Overview

**Bõnotto** é um PWA doméstico para duas pessoas (Matheus e Beatriz) que unifica três domínios que normalmente vivem em apps separados:

1. **Controle financeiro pessoal e do grupo** — entradas/saídas, despesa fixa/variável, recorrência com cadência, parcelamento, divisão de despesa entre múltiplos pagadores, saldo "entre vocês".
2. **Lista de compras** — máquina de estados (planejar → comprar → pausar → encerrar), preço por unidade/peso, sugestão de categoria, leitura de código de barras/foto/PDF.
3. **Recursos** — inventário doméstico em 3 níveis (cômodo → subcategoria → item), com sugestão automática de compra quando algo acaba ou vence.

Mais dois módulos que amarram os três: **Caixinhas** (reserva financeira por banco, multi-moeda com conversão ao vivo) e **Notificações** (central no app + push real via Edge Functions).

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
Build:               NENHUM — index.html único, <script type="module"> direto no navegador
Deployment:          git push origin main → GitHub Pages serve a branch main diretamente. Sem CI de deploy (só CI de teste, .github/workflows/tests.yml). Nunca trabalhar direto em main — sempre numa branch de feature, mergear (fast-forward) só quando o usuário pedir deploy explicitamente.
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

- **Prefixo `cg-`** em toda classe CSS própria (herdado do nome antigo do projeto, "CasaGrana" — decisão deliberada, não renomear).
- **`services/` é a única fronteira** entre UI e dado. Toda função nova de acesso a dado entra ali, nunca direto num componente.
- **Nada calculado é persistido** — status de pagamento, saldo de caixinha, total de lista de compras: tudo derivado ao vivo do dado bruto a cada render.
- **Padrão "best-effort"** para ação secundária (ex.: gerar notificação nunca pode travar salvar uma transação) — sempre `try/catch` isolado ao redor da parte não-crítica.
- **Find-or-create sem duplicata** — bancos/categorias/empresas são entidades compartilhadas (nome único por owner/grupo), nunca texto livre duplicado. Ver `findOrCreateBank`/`findCompanyByName` como referência de padrão.
- **Import dinâmico para tudo pesado** (`await import('https://esm.sh/...')`) — nenhuma lib grande paga custo de carregamento se a sessão não usar aquela feature.
- **`?demo=1`** ativa o modo demo (localStorage) sem precisar de conta Supabase — é como todo teste e toda verificação visual deste projeto deve rodar.

## Armadilhas já conhecidas (não redescobrir)

- **`x-show` + classe de utilidade Bootstrap no mesmo elemento nunca esconde nada.** Utilities do Bootstrap 5 (`.d-flex`, `.d-none`, `.mt-1`, etc.) são `!important` na folha de estilo; o `x-show` padrão do Alpine escreve um `style="display:none"` SEM `!important` — a folha de estilo sempre vence. Ocorreu ≥5 vezes neste projeto em componentes diferentes. Fix: `x-show.important="..."` (modificador nativo do Alpine), ou remover a classe utilitária conflitante do elemento.
- **Declaração de CSS duplicada, mesma especificidade, a de baixo no arquivo ganha silenciosamente.** Já aconteceu com `.cg-btn`, `.cg-main`, `.cg-card`/`.cg-card--compact`, `.cg-modal`. Ao adicionar uma variante nova (`.cg-card--dense` etc.), usar seletor composto (`.cg-card.cg-card--dense`) em vez de confiar em ordem de arquivo.
- **Aritmética monetária no cliente usa `Number` de ponto flutuante, não centavos inteiros** (o banco usa `numeric(12,2)`, correto). Dívida técnica conhecida, não corrigida — ver `docs/RAIO-X-2.0.md` §5/§8.
- **Todas as 7 telas ficam sempre montadas no DOM** — um seletor CSS/JS sem escopo de tela (`document.querySelector('.cg-algo')`) pode pegar o elemento errado de uma tela escondida. Sempre escopar por `section[x-data^="nomeDaView"]` em teste/debug.

## Comandos

```bash
python -m http.server 5500      # servidor local (o app não precisa de nada além de arquivos estáticos)
# abrir http://localhost:5500/?demo=1

npm run test:unit                # testes de função pura (node --test)
npm test                         # Playwright e2e (usa playwright.config.js, sobe o server sozinho)
npx playwright test --workers=2  # mesma coisa, mais rápido em paralelo
```

## Onde cavar mais fundo

- [`docs/RAIO-X-DO-PROJETO.md`](docs/RAIO-X-DO-PROJETO.md) — diagnóstico técnico file-por-file, verificado contra produção.
- [`docs/RAIO-X-2.0.md`](docs/RAIO-X-2.0.md) — diagnóstico multidisciplinar (pontos fortes, problemas, riscos, dívida técnica, gaps).
- [`docs/DESIGN-SYSTEM-2027.md`](docs/DESIGN-SYSTEM-2027.md) — diretriz de UX/UI, escala tipográfica, regra do botão "voltar", quando usar card.
- [`docs/BONOTTO-2027-BLUEPRINT.md`](docs/BONOTTO-2027-BLUEPRINT.md) — roadmap detalhado por fase.
- [`docs/CHECKLIST-REBRAND.md`](docs/CHECKLIST-REBRAND.md) — status real, item a item, do rebrand e das rodadas de pedido subsequentes. **Binário: `[x]` feito e verificado, `[ ]` não feito. Sem meio-termo.**
- [`prompt-app-controle-financeiro.md`](prompt-app-controle-financeiro.md) — o prompt de construção original, autossuficiente.
- [`.claude/docs/`](.claude/docs/) — versões vivas e mais curtas dos documentos acima, mantidas por este sistema de agentes.
