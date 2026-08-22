# Roadmap — Bõnotto

Estado real, não aspiracional. Fonte primária de detalhe: `docs/CHECKLIST-REBRAND.md` (binário `[x]`/`[ ]`, sem meio-termo) e `docs/BONOTTO-2027-BLUEPRINT.md`. Atualizar esta seção sempre que um item mudar de coluna de verdade — nunca deixar desatualizado.

## Completed

- Rebrand completo (Bõnotto: logo, favicon, manifest, apple-touch-icon, todas as telas).
- Multi-pagador em transações (`transaction_payers`), saldo "entre vocês" (Splitwise-like).
- Bancos/Categorias/Empresas como entidades compartilhadas, sem duplicata (find-or-create), modal empilhado padronizado (lista → formulário por cima) nos 4 casos.
- Modos de visualização de Transações (lista/grade × normal/compacta, combináveis livremente) + agrupamento independente.
- Modal de despesa reorganizado e compactado (switches em vez de checkbox, campos numa linha só, comprovante ícone-só numa linha).
- Home: distinção pago vs. previsto (entradas/saídas), widget de lançamentos recentes com avatar+selo de empresa+badge de categoria.
- Dashboard completo ("Ver mais"): reaproveita os mesmos filtros dinâmicos (quem vê / período) e mostra todos os recortes (categoria/empresa/membro/fluxo/dia/mês/ano) de uma vez, Chart.js.
- Modo demo com dado 100% mockado e representativo: bancos/empresas com logo próprio, despesa dividida, item parcelado, caixinha em moeda estrangeira.
- Despesa "no cartão de crédito": accordion da fatura em Transações (tabela/tabela-mobile/grade) e exclusão do valor da compra dos totais/gráficos, já que ele está embutido no valor da própria fatura (ver `groupCartaoCredito`).
- Suite de teste real (47 unit + 23 e2e), CI leve rodando em push/PR (`.github/workflows/tests.yml`).
- `.cg-back`, Esc-pra-fechar + devolução de foco em todo modal, lista de Preferências (Perfil) sem card empilhado.
- Correções de causa raiz: `x-show`+utility Bootstrap (≥5 ocorrências), CSS duplicado (`.cg-card`, `.cg-main`, `.cg-modal`), barra de progresso não fixa no fundo do card (Caixinhas).
- Sistema `.claude/` (este) — agentes, comandos, docs vivos.
- **Money Engine** (`js/utils/money.js`, centavos inteiros — `somar`/`subtrair`/`dividirIgualmente`/`iguais`/`maiorQue`/`percentual`) — já em uso nos 4 arquivos que fazem conta com dinheiro (`transactions.js`, `caixinhas.js`, `shoppingList.js`, `budgets.js`, confirmado por grep de import). Isto estava listado como "Planned"/"Technical Debt" numa versão anterior deste documento — **estava errado**, já tinha sido feito antes deste doc existir; corrigido em 2026-08-21 depois de verificar o código de verdade em vez de confiar só no diagnóstico antigo (`docs/RAIO-X-2.0.md`, que é de antes desta correção existir).
- Alternativa textual em todo gráfico (regra do prompt original §45) — confirmado nos 3 lugares que têm gráfico (3 painéis da Início, Dashboard completo, "Ver gráfico" de Compras): todos têm uma `<table class="visually-hidden">` com os mesmos dados, pra leitor de tela. Mesma correção de doc acima.
- Níveis de severidade em notificação (INFO/ATTENTION/WARNING/CRITICAL) — `severidadeDe` (`js/utils/status.js`), testado (`tests/unit`) e coberto por `tests/e2e/severidade-notificacao.spec.js`. Mesma correção de doc acima.
- `prefers-reduced-motion` — já tratado globalmente em `css/app.css` (não "ausente por completo" como uma versão anterior deste doc dizia). Mesma correção.
- "Quanto ainda posso gastar" com manchete própria na Home — já existe (`orcamentoAlerta`, `dashboard.js`, linha do hero balance "Restam RX do orçamento de Y"). Mesma correção.
- README — já corrigido antes desta sessão (o próprio README documenta isso: "este README ficou desatualizado por um tempo dizendo o contrário").
- `history.pushState` real pra navegação entre telas — **este documento estava desatualizado nesta linha específica** (dizia "genuinamente não iniciado" na seção Potential Improvements, abaixo). Na verdade foi implementado em 2026-08-21 (`setView` trocado de `history.replaceState` pra `pushState` + sync via `popstate`, `tests/e2e/navegacao-historico.spec.js`, ver `docs/CHECKLIST-REBRAND.md` Rodada 5). Corrigido aqui em 2026-08-22 durante a reorganização do `.claude/` — mesmo tipo de correção de causa raiz já aplicada 5x antes neste mesmo documento (ver Rodada 5 do checklist).

## In Progress (2026-08-22)

- **Cartão de crédito multi-banco** — bug de agrupamento (compra cai na fatura errada quando 2 pessoas têm fatura no mesmo mês) + gap de modelagem (sem entidade "cartão", sem suporte a múltiplos cartões por pessoa/banco). Decisão de arquitetura já tomada por 3 agentes independentes, ver `.claude/discussions/001-cartao-credito-multi-cartao.md`. Implementação em `TASK-023` (`.claude/checklist/tasks.json`).
- **Privacidade do dado de demo** — `js/data/mockDb.js` usava nomes de empregador/concessionária reais aparentes, expostos publicamente via `?demo=1` no GitHub Pages. Regeneração com Faker em andamento (`FEAT-002`).
- **Auditoria visual completa das 7 telas** — finalmente com mandato concreto do usuário (não mais "acho que devia ficar mais bonito" sem critério). Resultado vai alimentar `TASK-022` e potencialmente destravar os itens de redesenho abaixo.

## Bloqueado por falta de sinal concreto (revisar depois da auditoria de 2026-08-22 acima)

- "Aparência geral mais distinta/moderna" (pedido original, prioridade 2) + redesenho visual agressivo de Compras/Recursos/Caixinhas/Perfil — subjetivo demais pra ter critério de aceite sem exemplo/referência do usuário. Não é preguiça, é ausência de critério verificável (ver `.claude/agents/product-manager.md`). **Pode estar prestes a ser destravado** pela auditoria visual em andamento acima, que produz critério objetivo em vez de gosto pessoal.
- "Ver mais" (Dashboard completo) considerado abaixo do esperado ("PowerBI profissional") — mesmo motivo, aguardando direção mais concreta.
- Migração da tipografia solta (~66 `font-size` fora da escala de tokens) para `--font-size-*` — ver Technical Debt abaixo, motivo de não ter sido feita ainda (é a única pendência real desta lista que não é 100% subjetiva, mas ainda precisa de revisão visual do usuário antes de espalhar).

## Technical Debt

- **~66 `font-size` soltos fora da escala de tokens** (`css/components.css`/`css/app.css`) — tokens já existem (`css/tokens.css`), migração não feita porque é uma mudança visível em várias telas simultaneamente de uma vez, precisa de revisão do usuário antes de espalhar (não é seguro automatizar cego).
- **`index.html` como god-file** — cresce a cada tela nova, sem separação física (tensão real do "sem build step", não erro óbvio a corrigir).
- **Padrão `x-show` + utility Bootstrap `!important`** — mitigado pontualmente (`x-show.important`) cada vez que reaparece, mas não existe lint/convenção automatizada que previna a próxima ocorrência antes dela acontecer.
- **Cobertura de teste não é exaustiva** — 47 unit + 23 e2e é uma base real, mas toda lógica nova sensível a dinheiro/data deveria ganhar teste no mesmo PR/rodada, não depois (política, não métrica de cobertura formal).
- ~~**Cartão de crédito com 2+ faturas no mesmo mês**~~ — virou caso real em 2026-08-22 (ver In Progress acima), não é mais dívida técnica arquivada, é trabalho ativo (`BUG-001`/`FEAT-001`).

## Potential Improvements (sugestões, não compromissos)

- Projeção de fim de mês / detecção de anomalia de gasto — dado histórico já existe (por categoria/pessoa), falta só o cálculo. Genuinamente não iniciado.
- `history.pushState` real pra navegação entre telas — hoje é só troca de `$store.app.view` (confirmado: nenhum `pushState`/`popstate` no código), então o botão físico "voltar" do Android/gesto do navegador fecha o app em vez de voltar uma tela dentro dele. Genuinamente não iniciado.
- WCAG 2.2 AA sistemático além do que já existe (`prefers-reduced-motion`, `.cg-back` com `aria-label`, switches com `<label>`) — não tem uma varredura completa recente pra saber o que falta especificamente; precisaria de uma auditoria própria antes de virar lista de tarefas.
- Multi-moeda fora de Caixinhas (Transações/Compras continuam só BRL) — documentado no README como escopo atual, não bug; só vira tarefa se o usuário pedir.
