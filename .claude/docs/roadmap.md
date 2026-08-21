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

## In Progress / Bloqueado por falta de sinal concreto

- "Aparência geral mais distinta/moderna" (pedido original, prioridade 2) — subjetivo demais pra ter critério de aceite sem exemplo/referência do usuário. Não é preguiça, é ausência de critério verificável (ver `.claude/agents/product-manager.md`).
- Migração da tipografia solta (~66 `font-size` fora da escala de tokens) para `--font-size-*` — ver Technical Debt abaixo, motivo de não ter sido feita ainda.

## Planned (próximos passos sugeridos, não confirmados com o usuário)

- Migração tela-por-tela da tipografia solta pra escala de tokens, **com revisão visual do usuário antes de espalhar** (não é seguro automatizar cegamente — muda tamanho visível em vários lugares de uma vez).
- Money Engine dedicado: consolidar soma monetária do cliente pra centavos inteiros num módulo único testado (`caixinhas.js`, `transactions.js`, `shoppingList.js`, `budgets.js` hoje usam `Number` de ponto flutuante).
- Alternativa textual em todo gráfico configurável (regra do prompt original §45 — hoje só o Dashboard completo/novo tem tabela oculta pra leitor de tela, os outros gráficos não).
- Níveis de severidade em notificação (INFO/ATTENTION/WARNING/CRITICAL).

## Technical Debt

- **Zero teste automatizado antes desta sessão** — mitigado (47 unit + 23 e2e), mas cobertura ainda não é exaustiva; toda lógica nova sensível a dinheiro/data deveria ganhar teste no mesmo PR/rodada, não depois.
- **Aritmética monetária em `Number` (ponto flutuante) no cliente** — o banco (`numeric(12,2)`) está correto; risco crescente conforme mais transações/parcelas se acumulam. Não é hipótese: o histórico do projeto já teve 3 bugs de soma de moeda em Caixinhas em 2 dias antes de ser corrigido.
- **`index.html` como god-file** — cresce a cada tela nova, sem separação física (tensão real do "sem build step", não erro óbvio).
- **Padrão `x-show` + utility Bootstrap `!important`** — mitigado pontualmente (`x-show.important`) cada vez que reaparece, mas não existe lint/convenção automatizada que previna a próxima ocorrência antes dela acontecer.
- **~66 `font-size` soltos fora da escala de tokens** — tokens já existem (`css/tokens.css`), migração não feita porque é uma mudança visível em várias telas simultaneamente, precisa de revisão do usuário antes de espalhar.
- **README genuinamente desatualizado** em alguns pontos (ver `docs/RAIO-X-2.0.md` §7 pra lista exata das divergências encontradas).

## Potential Improvements (sugestões, não compromissos)

- "Quanto ainda posso gastar" com manchete própria na Home (hoje o orçamento existe em Perfil, mas sem destaque no Dashboard).
- Projeção de fim de mês / detecção de anomalia de gasto — dado histórico já existe, falta só o cálculo.
- `history.pushState` real pra navegação entre telas (hoje é só troca de `$store.app.view` — botão físico "voltar" do Android/gesto do navegador não funciona como "voltar" dentro do app).
- WCAG 2.2 AA sistemático (hoje é cobertura pontual — `prefers-reduced-motion` está ausente por completo dos 3 arquivos CSS).
