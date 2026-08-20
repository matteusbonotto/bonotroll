# Arquitetura — Bõnotto

Versão viva e curta. Diagnóstico completo em `docs/RAIO-X-DO-PROJETO.md` e `docs/RAIO-X-2.0.md`.

## Módulos e fluxo de dado

```text
index.html (7 telas + ~12 modais, todos montados, x-show troca visibilidade)
   │
   ├─ js/app.js                    bootstrap Alpine, service worker, auto-refresh, overlay behavior (Esc/foco)
   │
   ├─ js/components/*.js           1 x-data por tela/modal — SÓ orquestra UI e chama services/
   │     dashboard.js, transactionTable.js, transactionForm.js (store txModal),
   │     shoppingList.js, resourcesView.js, caixinhasView.js,
   │     bankManager.js / categoryManager.js / companyManager.js / caixinhaManager.js (stores de modal empilhado),
   │     budgetManager.js, csvImportModal.js, groupView.js, profileView.js, charts.js, store.js (store global $store.app)
   │
   ├─ js/services/*.js             ÚNICA fronteira UI↔dado — cada função checa isDemoMode()
   │     transactions.js (inclui divisão multi-pagador, groupBy*, computeSummary)
   │     shoppingList.js, resources.js, caixinhas.js, banks.js, companies.js, categories.js,
   │     budgets.js, groups.js, auth.js, notifications.js, push.js, recurring.js,
   │     csvImport.js, dataExport.js, fx.js (câmbio), ocr.js, barcode.js, pdf.js
   │
   ├─ js/data/
   │     config.js         isDemoMode() — a única checagem que existe
   │     mockDb.js          "banco" localStorage, espelha supabase/schema.sql, seedDatabase() com dado fake completo
   │     supabaseClient.js  cliente real (import dinâmico do @supabase/supabase-js via esm.sh)
   │     vapid.js           chave pública VAPID (push)
   │
   ├─ js/utils/*.js                funções puras — format.js, money.js, status.js, image.js, dbFallback.js
   │
   └─ css/tokens.css → components.css → app.css   (nessa ordem de carregamento)
```

## Dependência externa (todas grátis, sem chave própria)

Frankfurter (câmbio fiat), CoinGecko (cripto), Open Food Facts (código de barras), esm.sh (CDN de módulo ES pra Chart.js/Tesseract.js/pdf.js/html5-qrcode/PapaParse/@supabase/supabase-js), Google Fonts (só "Caveat", tela de Compras).

## Decisões deliberadas — não redesenhar sem motivo novo

- Sem build step/bundler — `<script type="module">` nativo, tudo via CDN.
- Prefixo `cg-` em todo CSS próprio (herdado do nome antigo "CasaGrana").
- `services/` como única fronteira — nenhuma tela sabe se está em demo ou real.
- Nada calculado é persistido (status, saldo, totais — sempre derivado ao vivo).
- Import dinâmico para toda lib pesada.

## Dívida arquitetural conhecida (ver `.claude/docs/roadmap.md` § Technical Debt)

- `index.html` é um god-file (cresce a cada tela nova, sem separação física — tensão real do "sem build step", não erro óbvio a corrigir).
- Aritmética monetária no cliente usa `Number` (ponto flutuante), não centavos inteiros — o banco (`numeric(12,2)`) está correto, o cliente não.
- Padrão de bug `x-show` + utilitário Bootstrap (`!important`) já reapareceu em ≥5 componentes diferentes — mitigado pontualmente (`x-show.important`), não existe lint/convenção automatizada que previna a próxima ocorrência.
