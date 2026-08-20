# Regras de negócio — Bõnotto

Extraídas do código real (`js/services/`), não do escopo original. Se o comportamento do código mudar, este documento precisa mudar junto.

## Transações (`js/services/transactions.js`)

- **Pago vs. previsto**: `entradas`/`saidas`/`saldo` contam só o que tem `data_pagamento` preenchida ("quanto eu realmente tenho"). `entradasPrevistas`/`saidasPrevistas`/`saldoPrevisto` contam tudo, pago ou não ("quanto deve entrar/sair no total"). As duas visões coexistem na Home, nunca uma substituindo a outra.
- **Status derivado** (`computeStatus`): pago vence tudo (mesmo com vencimento no passado); sem vencimento e sem pagamento é `pendente`, nunca `vencido`; vencimento no passado sem pagamento é `vencido`; vencimento em ≤7 dias é `a_vencer`.
- **Divisão de despesa** (`transaction_payers`): ausência de linha = 100% do `responsavel_id` (retrocompatível). Com 2+ linhas, cada uma tem `%` e `valor` — a soma sempre precisa reconciliar com o valor total antes de salvar. `shareForMember(tx, payers, profileId)` é a função única que resolve "quanto esse membro deve dessa transação", usada tanto pro resumo por pessoa quanto pro saldo entre casal.
- **Saldo entre casal** (`computeSaldosEntreMembros`): só despesa **paga** gera dívida entre membros (dinheiro que ainda não saiu do bolso de ninguém não é dívida de ninguém). Dívidas nos dois sentidos se compensam num saldo líquido.
- **Recorrência**: `recorrencia_tipo` (semanal/mensal/anual/personalizado) gera o próximo lançamento automaticamente a partir da cadência + dia/mês configurado.

## Lista de compras (`js/services/shoppingList.js`)

- Máquina de estados: `planejando → comprando → pausada ⇄ comprando → finalizada`.
- Subtotal do item = quantidade × preço unitário (unidade `un`) OU quantidade × preço por kg/peso (demais unidades) — nunca os dois campos de preço preenchidos ao mesmo tempo.
- Limite de gasto por lista (`limite_gasto`, opcional) tem 4 níveis: `ok` (<80%), `proximo` (80–99%), `atingiu` (100–109%), `passou` (≥110%, alerta visual pulsante).
- Categoria é sugerida automaticamente por palavra-chave no nome digitado (`guessCategoryByName`) — nunca cria categoria nova sozinha, só sugere entre as já existentes; sempre editável manualmente, nunca trava o campo.

## Recursos / inventário (`js/services/resources.js`)

- 3 níveis fixos por padrão (cômodo → subcategoria → item), com CRUD completo — a lista de cômodos default (Quarto, Escritório, Cozinha, Banheiro, Sala, Lavanderia) é só o ponto de partida, editável.
- Quantidade 0 = "em falta"; validade vencida = "vencido"; ambos alimentam a seção "Sugestões" (Home + tela de Recursos) com botão pra adicionar direto na lista de compras ativa.

## Caixinhas (`js/services/caixinhas.js`)

- Saldo é **sempre** derivado da soma de `caixinha_movimentacoes` (guardado − retirado), nunca uma coluna própria.
- Multi-moeda (7 suportadas: BRL, USD, EUR, GBP, USDT, BTC, ETH) com conversão ao vivo pra BRL (`fx.js`) só pra exibição — o valor guardado na moeda original nunca é convertido/alterado.
- Banco é entidade compartilhada (nome + logo únicos por owner/grupo) — duas caixinhas do mesmo banco reaproveitam o mesmo registro, nunca duplicam.

## Orçamento (`js/services/budgets.js`)

- Limite mensal por categoria, sempre pessoal (`owner_id`), nunca de grupo — comparação contra o mês atual real, independente de qualquer filtro de período selecionado em outra tela.

## Notificações (`js/services/notifications.js`)

- Dedupe por `dedupe_key` — o mesmo evento (ex.: mesma conta vencida, mesmo dia) nunca gera uma segunda notificação.
- Modo demo gera client-side no `init()` do app; modo real é gerado no servidor (Edge Function `notify-scan`/`notify-payment`) — o client só lê/marca como lida nos dois casos, mesma UI.
