# Banco de dados — Bõnotto

Fonte de verdade: `supabase/schema.sql` (idempotente — sempre `create table if not exists`, `drop policy if exists` antes de recriar). Este documento é o mapa rápido, não substitui ler o schema real antes de mudar algo.

## Tabelas (18)

| Tabela | Papel |
|---|---|
| `profiles` | 1 por usuário (nome, cor, avatar) |
| `groups` / `group_members` | grupo (casal), código de convite, papel (admin/membro) |
| `categories` / `category_budgets` | categoria de transação/item, com limite mensal opcional |
| `companies` | empresa/serviço (nome + logo), entidade compartilhada, única por owner/grupo |
| `banks` | banco de uma Caixinha (nome + logo), mesma ideia de `companies` |
| `transactions` | entrada/saída — fixa/variável, recorrência, parcela, vencimento/pagamento |
| `transaction_payers` | divisão de uma transação entre membros (% e valor) — ausência de linha = 100% do `responsavel_id` |
| `resource_rooms` / `resource_categories` / `resource_items` | inventário doméstico em 3 níveis |
| `caixinhas` / `caixinha_movimentacoes` | reserva por banco, multi-moeda; saldo é sempre SOMA das movimentações, nunca uma coluna própria |
| `shopping_lists` / `shopping_list_items` | lista de compras, máquina de estados |
| `notifications` | central de notificação (dedupe por `dedupe_key`) |
| `push_subscriptions` | inscrição de push real (VAPID) |

## Padrão de RLS (todas as tabelas, sem exceção)

```sql
owner_id = auth.uid() OR is_group_member(group_id)
```

`is_group_member` é uma função `security definer` — existe porque uma policy RLS ingênua consultando `group_members` direto causa recursão de policy (a saga de 3 tentativas está documentada em `docs/RAIO-X-2.0.md` §4). Não reintroduzir a versão ingênua.

## Regras de dado que o código depende delas serem verdade

- **Dinheiro é sempre `numeric(12,2)`**, nunca `float`/`real`.
- **Nada calculado é persistido** — saldo de caixinha, status de pagamento, total de lista de compras: sempre derivado das linhas brutas no momento da leitura, nunca uma coluna própria que possa divergir.
- **Entidade "por nome, sem duplicata"** (`banks`, `companies`, `categories`, `resource_rooms`) tem índice único por `(owner_id, coalesce(group_id, ...), nome)`.
- **`transaction_payers` vazio = não dividida** — 100% do `responsavel_id`, comportamento retrocompatível com transação antiga.

## Modo demo (`js/data/mockDb.js`)

Espelha exatamente esta estrutura em `localStorage`, incluindo `seedDatabase()` com dado fake completo (transações, caixinhas multi-moeda, bancos/empresas com logo, despesa dividida, item parcelado). **Qualquer mudança de schema precisa de mudança equivalente no seed do mockDb** — se não, o modo demo (usado pra toda verificação/teste deste projeto) fica com uma tabela vazia que o schema real não teria.

## Edge Functions (`supabase/functions/`, deploy manual)

`notify-scan` (cron diário), `notify-payment` (trigger de banco), `keepalive` (evita hibernar no free tier). Passo a passo de deploy em `supabase/NOTIFICACOES.md`.
