-- =====================================================================
-- Fichas de saúde cifradas ponta a ponta (Palm Business, fase 8, 2026-10-04)
-- O servidor guarda só texto cifrado (AES-256-GCM no aparelho) e as duas
-- "embalagens" da chave de dados (pela senha da família e pelo código de
-- recuperação). Idempotente.
-- =====================================================================

create table if not exists cofres (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  pela_senha text not null check (char_length(pela_senha) between 40 and 400),
  pelo_codigo text not null check (char_length(pelo_codigo) between 40 and 400),
  criado_em timestamptz not null default now()
);
-- Um cofre por casa (grupo); sem grupo, um por pessoa.
create unique index if not exists cofres_um_por_grupo on cofres (group_id) where group_id is not null;
create unique index if not exists cofres_um_por_pessoa on cofres (owner_id) where group_id is null;
alter table cofres enable row level security;

drop policy if exists "Ver cofre próprio ou do grupo" on cofres;
create policy "Ver cofre próprio ou do grupo" on cofres for select
  using (owner_id = auth.uid() or public.is_group_member(group_id));
drop policy if exists "Criar cofre" on cofres;
create policy "Criar cofre" on cofres for insert
  with check (owner_id = auth.uid() and (group_id is null or public.is_group_member(group_id)));
drop policy if exists "Trocar senha do cofre" on cofres;
create policy "Trocar senha do cofre" on cofres for update
  using (owner_id = auth.uid() or public.is_group_member(group_id))
  with check (group_id is null or public.is_group_member(group_id));

create table if not exists fichas_saude (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  cifrado text not null check (cifrado like 'v1.%' and char_length(cifrado) <= 20000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists fichas_saude_grupo_idx on fichas_saude (group_id);
alter table fichas_saude enable row level security;

drop policy if exists "Fichas da casa" on fichas_saude;
create policy "Fichas da casa" on fichas_saude for select
  using (owner_id = auth.uid() or public.is_group_member(group_id));
drop policy if exists "Criar ficha" on fichas_saude;
create policy "Criar ficha" on fichas_saude for insert
  with check (owner_id = auth.uid() and (group_id is null or public.is_group_member(group_id)));
drop policy if exists "Editar ficha" on fichas_saude;
create policy "Editar ficha" on fichas_saude for update
  using (owner_id = auth.uid() or public.is_group_member(group_id))
  with check (group_id is null or public.is_group_member(group_id));
drop policy if exists "Apagar ficha" on fichas_saude;
create policy "Apagar ficha" on fichas_saude for delete
  using (owner_id = auth.uid() or public.is_group_member(group_id));
