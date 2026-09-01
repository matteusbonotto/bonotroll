# Decisões — Bõnotto

Log de decisões arquiteturais/técnicas relevantes. Uma linha de contexto não vira entrada aqui — só decisões que, se esquecidas, levariam alguém a redescobrir ou reverter sem motivo. Formato por item: `DECISÃO / POR QUÊ / ALTERNATIVAS / IMPACTO / STATUS`. Mais detalhe (histórico completo do debate) fica nos documentos vivos referenciados, não duplicado aqui.

---

## 2026-09-01 — Orçamento estourado avisa o GRUPO, mas o orçamento continua pessoal

- **Decisão**: `category_budgets` continua `owner_id`-scoped (sem mudança de schema/regra) — a novidade é só o destinatário da notificação, que passa a incluir todos os membros do grupo, não só quem definiu/estourou o próprio orçamento.
- **Por quê**: pedido do usuário ("assim como cartão de crédito... avise os membros") — mesmo espírito já usado pro cartão de crédito (instrumento pessoal, visibilidade de grupo). Generalizar pra "avisar o grupo" em vez de criar um conceito novo de "orçamento compartilhado" evita reabrir a decisão já registrada de 2026-08-20 sobre orçamento ser sempre pessoal.
- **Impacto**: novo trigger `notificar_orcamento_estourado` (modo real) + `generateBudgetAlerts` (modo demo) — mesma divisão real×demo já usada por `notifyPayment`/`notificar_pagamento_para_grupo`. Funciona pra QUALQUER categoria com orçamento definido, não só "Mercado" (a pergunta do usuário era sobre Mercado especificamente, mas nada no mecanismo é Mercado-específico — generalizar não custou esforço extra).
- **Status**: ATIVO.

## 2026-09-01 — Todo deploy futuro DEVE bumpar `CACHE_NAME` do service worker

- **Decisão**: nunca fazer `git push origin main` que mude qualquer arquivo do `APP_SHELL` (`sw.js`) sem também bumpar `CACHE_NAME` no mesmo commit/rodada.
- **Por quê**: os 2 deploys anteriores a este (correção de exclusão/OCR/QR, 2026-08-23/24) mudaram `js/`/`css/`/`index.html` sem bumpar `CACHE_NAME` — usuário reportou "pedi correções e até hoje não foram aplicadas". A causa raiz não era o deploy em si (confirmado: `main` = `origin/main` = GitHub Pages, conteúdo novo confirmado ao vivo via fetch), mas o service worker nunca detectou versão nova pra oferecer/forçar a atualização no PWA instalado — é exatamente o mesmo tipo de bug já catalogado antes neste projeto ("ícone do app instalado ficava desatualizado", `docs/CHECKLIST-REBRAND.md` Rodada 3).
- **Impacto**: `sw.js` bumpado v6→v7 (commit `5708e81`). Regra vale daqui pra frente pra qualquer agente/sessão.
- **Status**: ATIVO, regra permanente.

## 2026-08-22 — Cartão de crédito vira entidade própria (tabela `cartoes`)

- **Decisão**: nova tabela `cartoes` (dono, banco vinculado via FK a `banks`, nome), nova coluna `transactions.cartao_id` (nullable). `groupCartaoCredito` agrupa por `cartao_id` quando presente, cai no fallback `responsavel_id+mês` para dado legado.
- **Por quê**: bug de produção real (compras se agrupavam na fatura errada quando 2 pessoas tinham fatura no mesmo mês) tinha a mesma causa raiz do gap pedido pelo usuário (sem cartão como entidade, não dá pra ter múltiplos cartões por pessoa nem selecionar por banco). `architect`, `database` e `product-manager` chegaram à mesma recomendação de forma independente.
- **Alternativas**: fix mínimo sem tabela nova (só resolvia o bug, não o gap); campo de texto livre pro nome do cartão (reintroduziria bug de duplicata já resolvido pra bancos/empresas/categorias).
- **Impacto**: ver `.claude/discussions/001-cartao-credito-multi-cartao.md` (documento completo com as 3 análises).
- **Status**: DECIDIDO, implementação em andamento (`TASK-023` em `.claude/checklist/tasks.json`).

## 2026-08-23 — `.claude/memory/` precisa estar versionado (git), nunca `.gitignore`

- **Decisão**: `.claude/memory/*.md` é conhecimento persistente do PROJETO — vai pro commit igual `.claude/docs/`/`.claude/discussions/`, nunca é "arquivo local do agente".
- **Por quê**: um processo anterior adicionou `.claude/memory/` ao `.gitignore` com o comentário "local do agente (não versionar)", presumindo (errado) que memória é efêmera/local. Efeito real: todo o conteúdo gravado até aqui nunca tinha sido commitado nem pushado — sumiria numa clonagem nova, o oposto do propósito desta pasta.
- **Correção**: linha removida do `.gitignore`.
- **Status**: ATIVO, regra permanente — nenhum agente/sessão futura deve voltar a ignorar esta pasta.

## 2026-08-21 — `is_group_member` como função `security definer` para RLS

- **Decisão**: toda policy que precisa saber "esse usuário é membro do grupo X" chama a função `is_group_member(group_id)`, nunca faz subquery direta em `group_members`.
- **Por quê**: policy ingênua consultando `group_members` direto causa recursão de policy (RLS de `group_members` reavalia RLS de `group_members` reavalia...). Já ocorreu 3 vezes antes da correção (documentado em `docs/RAIO-X-2.0.md` §4).
- **Impacto**: qualquer tabela nova com RLS de grupo (ex.: `cartoes`, decisão acima) precisa reaproveitar essa função, nunca reintroduzir a versão ingênua.
- **Status**: ATIVO, regra permanente.

## 2026-08-19/20 — Money Engine em centavos inteiros

- **Decisão**: toda aritmética monetária no cliente passa por `js/utils/money.js` (centavos inteiros — `Math.round(valor*100)`), nunca `Number` de ponto flutuante direto.
- **Por quê**: `numeric(12,2)` no banco já está correto; o cliente não estava, criando risco de erro de centavo em somas/divisões.
- **Alternativas**: nenhuma considerada — é a correção padrão da indústria pra dinheiro, sem trade-off real.
- **Impacto**: em uso em `transactions.js`, `caixinhas.js`, `shoppingList.js`, `budgets.js`. Ponto de dívida técnica ainda existente: alguns formulários/exibições isolados podem não ter migrado — ver `.claude/docs/architecture.md` §Dívida arquitetural.
- **Status**: ATIVO.

## 2026-08-20 — Bancos/Categorias/Empresas como entidades compartilhadas (find-or-create)

- **Decisão**: nome único por `(owner_id, coalesce(group_id,...), nome)`, sempre find-or-create (nunca duplicar por texto livre repetido).
- **Por quê**: bug relatado — "Nubank" da Matheus e "Nubank" da Beatriz criavam duas linhas sem relação, perdendo logo/identidade compartilhada.
- **Impacto**: qualquer entidade nova do mesmo tipo (ex.: `cartoes`) deve seguir o mesmo padrão — mas com nuance: `cartoes` é **owner-scoped**, não group-scoped (um cartão físico pertence a uma pessoa, diferente de banco/categoria/empresa que são conceitos verdadeiramente compartilhados). Ver decisão de 2026-08-22 acima.
- **Status**: ATIVO, padrão de referência pra toda entidade "cadastrável, sem duplicata" do projeto.

## 2026-08 (Blueprint 2027) — Manter HTML+Alpine+Bootstrap, sem build step

- **Decisão**: não migrar para React/Vue/build step algum.
- **Por quê**: nenhum problema real do projeto (zero testes à época, aritmética em float, acessibilidade incidental) era causado pela ausência de framework — todos eram trabalho não feito, que um framework novo não resolveria sozinho e que uma migração ativamente atrasaria. Comparativo completo em `docs/BONOTTO-2027-BLUEPRINT.md` §1.3.
- **Status**: ATIVO — não redesenhar sem motivo técnico novo (não "porque é mais moderno").
