-- Open Finance (Pluggy / Meu Pluggy) — 2026-10-15. Idempotente.
-- Aplicar: npx supabase db query --linked -f supabase/openfinance-2026-10.sql
-- Ver docs/OPEN-FINANCE.md.

-- 1) Conexões (items da Pluggy) de cada pessoa. Só guarda o itemId — nenhuma
--    credencial de banco, saldo ou transação fica aqui.
create table if not exists public.openfinance_conexoes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  item_id uuid not null,
  apelido text check (apelido is null or char_length(apelido) <= 60),
  criado_em timestamptz not null default now(),
  -- Um item só pode pertencer a UMA conta do app (impede alguém de "adotar"
  -- a conexão bancária de outra pessoa mesmo sabendo o itemId).
  constraint openfinance_conexoes_item_unico unique (item_id)
);
create index if not exists openfinance_conexoes_owner_idx on public.openfinance_conexoes (owner_id);

alter table public.openfinance_conexoes enable row level security;
revoke all on public.openfinance_conexoes from anon;
revoke insert, update on public.openfinance_conexoes from authenticated;
grant select, delete on public.openfinance_conexoes to authenticated;

-- Ler/apagar só as próprias. Inserir só pela Edge Function (service_role),
-- que confere na Pluggy se o item existe antes de gravar.
drop policy if exists "openfinance_conexoes_select" on public.openfinance_conexoes;
create policy "openfinance_conexoes_select" on public.openfinance_conexoes
  for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "openfinance_conexoes_delete" on public.openfinance_conexoes;
create policy "openfinance_conexoes_delete" on public.openfinance_conexoes
  for delete to authenticated using (owner_id = (select auth.uid()));

-- 2) Transação importada guarda a origem para não importar duas vezes.
alter table public.transactions add column if not exists externo_id text
  check (externo_id is null or char_length(externo_id) <= 100);
create unique index if not exists transactions_owner_externo_unico
  on public.transactions (owner_id, externo_id) where externo_id is not null;

-- 3) Credenciais da Pluggy de cada pessoa (2026-10-15, "cada um com a sua
--    Pluggy"). O Client Secret fica CIFRADO (AES-GCM, chave só na Edge
--    Function) e nenhum papel da API lê esta tabela: só a função, com
--    service_role. A tela só sabe se existe ou não (ação 'status').
create table if not exists public.openfinance_credenciais (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  client_id uuid not null,
  segredo_cifrado text not null check (segredo_cifrado like 'v1.%' and char_length(segredo_cifrado) <= 600),
  atualizado_em timestamptz not null default now()
);
alter table public.openfinance_credenciais enable row level security;
revoke all on public.openfinance_credenciais from anon, authenticated;
