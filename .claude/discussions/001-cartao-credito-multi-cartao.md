# 001 — Cartão de crédito como entidade própria (multi-cartão por banco)

**Data**: 2026-08-22
**Status**: `DECIDIDO` — aguardando implementação (`TASK-023`, ver `.claude/checklist/tasks.json`)

## Objetivo

Corrigir um bug de produção real (compras no cartão se agrupam na fatura errada quando há 2+ faturas no mesmo mês) e fechar um gap de modelagem que o usuário identificou ao relatar o bug: hoje não existe uma entidade "cartão de crédito" de verdade, só uma categoria + um boolean.

## Contexto

Pedido literal do usuário (preservado, ver análise completa do product-manager para a versão integral): Matheus e Beatriz devem poder ter cada um seu(s) próprio(s) cartão(ões), vinculados a um banco, com suporte a mais de um cartão por pessoa (bancos diferentes) — e as compras marcadas "no cartão" precisam cair na fatura certa, nunca na do outro.

Mecanismo atual (`js/services/transactions.js:193-241`): uma transação é "fatura" quando a categoria dela se chama, literalmente, "Cartão de crédito" (`isCartaoCreditoBill`, match por nome). Uma transação é "filha" quando tem `cartao_credito=true`. `groupCartaoCredito` monta um `Map<mês, id-da-primeira-fatura-encontrada>` e pendura toda filha do mês nessa única fatura — **sem olhar `responsavel_id`**. Já era dívida técnica documentada (`.claude/docs/roadmap.md`, antes de hoje): "só vale corrigir se for caso real do usuário". Virou caso real.

## Participantes

`architect`, `database`, `product-manager` — análises independentes, sem visão do trabalho um do outro (rodadas em paralelo, mesmo contexto-base fornecido pelo orquestrador).

## Análises

**architect** — achou a causa raiz mais profunda do que o esperado: desde 2026-08-20 `categories` é uma entidade **compartilhada por grupo** (`categories_grupo_nome_uniq`), então a categoria "Cartão de crédito" de Matheus e a de Beatriz já são **o mesmo `categoria_id`** — não há como diferenciar "de quem é a fatura" pelo nome da categoria em hipótese alguma. Avaliou 3 opções:
- **A — chave `mês+responsavel_id`, sem tabela nova**: resolve o bug relatado (cenário 1), esforço trivial, risco zero. **Não resolve** o gap de múltiplos cartões por pessoa (a ambiguidade só desce um nível).
- **B — tabela `cartoes` nova + FK `cartao_id`**: resolve os dois. Esforço moderado, mas é reaproveitamento quase mecânico do padrão `banks`/`findOrCreateBank`/modal `bankModal` já pago pelo projeto.
- **C — campo de texto livre (`cartao_nome`)**: vetada — reintroduziria exatamente a classe de bug que `banks`/`companies` foram criadas para resolver (nome digitado livre = duplicata/erro de agrupamento), já documentada 2x no próprio `schema.sql`.
- **Recomendação**: B, com A como *fallback* de compatibilidade para dado legado sem `cartao_id`.

**database** — DDL concreto, idempotente, no estilo do arquivo (`create table if not exists cartoes`, índice único, `cartao_id` nullable em `transactions`), RLS clonada literalmente do padrão `banks` (select owner-or-group via `is_group_member`, insert/update/delete só do dono — diferente do padrão `for all` de `caixinhas`/`transactions`, porque um cartão é uma identidade pessoal, não um recurso do lar). Recomendou **não** fazer backfill automático de "cartão padrão" nas linhas antigas com `cartao_credito=true` — inventar um cartão sintético sem `banco_id` real seria fabricar dado que finge ser específico. Linhas antigas ficam com `cartao_id = null` e continuam pelo heurístico de fallback. Chegou à mesma recomendação B, de forma independente.

**product-manager** — desambiguou o pedido: "itens divididos entre membros" (fala do usuário) descreve, na really, `responsavel_id` de cada despesa (cada compra pertence a um dono), **não** `transaction_payers` (divisão de valor/saldo entre casal) — as duas features são ortogonais e nenhuma muda a outra. Produziu 6 cenários de aceite (ver abaixo) e sinalizou 4 ambiguidades, 3 das quais este documento resolve agora com base no padrão já estabelecido no resto do projeto (ver Decisão), e 1 que seria pura preferência estética sem impacto técnico.

## Conflitos

Nenhum conflito real de recomendação — os 3 agentes convergiram em B de forma independente, cada um com um ângulo diferente (arquitetura, schema, produto). O único ponto de tensão explícito foi o **escopo do fix**: a opção A sozinha (mais barata) resolveria só o bug relatado, não o gap. `architect` argumentou explicitamente contra fatiar em duas rodadas ("não haveria motivo técnico real para adiar... só custo de contexto trocado duas vezes") — aceito.

## Alternativas descartadas

- Fix mínimo sem tabela nova (opção A) — insuficiente para o gap explícito do pedido.
- Campo de texto livre pra nome do cartão (opção C) — reintroduziria bug de duplicata já resolvido para bancos/empresas/categorias.
- Backfill automático de cartão sintético para dado legado — fabricaria dado que parece real sem ser.
- Esconder cartão de um membro do outro (dúvida levantada pelo PM) — quebraria o padrão universal de RLS do projeto (tudo visível entre membros do grupo); nada no pedido do usuário pede ocultação, só permissão de criar/associar o próprio.

## Decisão

**Implementar a Opção B**: nova tabela `cartoes` (`owner_id`, `group_id`, `banco_id` → FK `banks`, `nome`, `ativo`), nova coluna `transactions.cartao_id` (nullable, FK `cartoes`). `groupCartaoCredito` passa a agrupar por `cartao_id` quando presente; quando ausente (dado legado), cai no fallback `responsavel_id + mês` (opção A), nunca na chave antiga "só mês". RLS clonada do padrão `banks` (select compartilhado, escrita só do dono).

Resolvendo as ambiguidades do product-manager com base em precedente já existente no projeto (decisão minha, orquestrador, não pedida de volta ao usuário por já ter base suficiente em convenção estabelecida):
1. **Dado legado**: fica `cartao_id = null`, sem backfill forçado — migra sob demanda quando o usuário editar/recriar a despesa (confirmado por database).
2. **Despesa dividida + paga num cartão só (cenário 3)**: o cartão é sempre o escolhido explicitamente no formulário no momento do lançamento — independente de como `transaction_payers` divide o valor entre os dois. As duas coisas (dívida entre pessoas × qual cartão pagou) continuam ortogonais, como já era.
3. **Visibilidade**: SELECT compartilhado (Beatriz vê o cartão do Matheus ao navegar pelas transações do grupo, não pode editar/apagar o dele) — mesmo padrão universal de RLS já usado em toda a base (`owner_id = auth.uid() OR is_group_member(group_id)` para leitura).
4. **Campo obrigatório?** Opcional — mesma filosofia retrocompatível de `transaction_payers`/`cartao_credito` boolean: nada trava o salvamento por falta de cartão cadastrado.

## Impactos

- `supabase/schema.sql`: tabela `cartoes` + coluna `transactions.cartao_id` + 4 policies RLS (aditivo, idempotente, sem migração destrutiva).
- `js/services/cartoes.js` (novo): espelha `js/services/banks.js` (`listCartoes`/`createCartao`/`updateCartao`/`deleteCartao`/`findOrCreateCartao`... avaliar se find-or-create faz sentido aqui, já que "nome" de cartão é mais pessoal que banco — decisão de implementação, não de arquitetura).
- `js/services/transactions.js`: `groupCartaoCredito`/`isCartaoCreditoBill` — chave de agrupamento passa a considerar `cartao_id` com fallback `responsavel_id+mês`.
- `js/components/transactionForm.js`: switch booleano "cartão de crédito" vira seletor de cartão (com opção de criar inline, mesmo padrão de caixinha→banco).
- `index.html`: novo `$store.cartaoModal`, clonando a estrutura de `$store.bankModal` (linhas ~1918, 2914-2972).
- `js/data/mockDb.js`: nova coleção `cartoes` no seed + `cartao_id` nas transações de exemplo + **2ª fatura da Beatriz no mesmo mês** (necessário para o `?demo=1` conseguir reproduzir e provar visualmente o bug corrigido — sem isso o cenário 2 nunca é demonstrável). **Sequenciamento**: só depois que `FEAT-002` (regeneração do seed com Faker) terminar, para não haver dois agentes escrevendo em `mockDb.js` ao mesmo tempo.
- `tests/unit/transactions.test.js` + `tests/e2e/cartao-credito-fatura.spec.js`: novos casos (2 faturas/2 pessoas mesmo mês; 2 cartões/1 pessoa mesmo mês; fallback sem `cartao_id`).
- `.claude/docs/business-rules.md` e `database.md`: atualizar depois que o código real refletir a mudança (documento vivo, não antes).
- Nenhum impacto em `computeSaldosEntreMembros`/`shareForMember` (confirmado por `architect`: nenhuma das duas funções lê `cartao_credito`/`categoria_id`/`cartao_id`).

## Ações

1. `TASK-023` — implementar schema + services + form + UI (depois de `FEAT-002` terminar). Ver `.claude/checklist/tasks.json`.
2. `TASK-024` — revisão de segurança do RLS novo.
3. `TASK-025` — testes unit/e2e dos 6 cenários de aceite do product-manager.
4. `TASK-026` — code review final.
5. Cenários de aceite (do product-manager, usar como script de verificação manual em `?demo=1` antes de dar por concluído): pessoa sem fatura fica solta; 2 faturas/2 pessoas cada uma só agrupa a sua; despesa dividida no cartão de um só continua certa nos dois eixos (saldo × fatura); 2 cartões/1 pessoa não se misturam; pessoa sem cartão nenhum cadastrado não trava o formulário; mês sem nenhuma fatura mantém tudo solto (regressão do comportamento já existente).

## Status

`DECIDIDO`. Implementação pendente, sequenciada após `FEAT-002`.
