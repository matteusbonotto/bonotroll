-- =========================================================================
-- BNTT Business — unidades (filiais) e papéis da equipe (2026-10-05)
-- Idempotente. Rodar no SQL Editor do Supabase (projeto appbntt).
-- Papéis: dono (tudo), gerente (tudo, inclusive unidades), funcionário
-- (lança e mexe só no que ele mesmo lançou), contador (só consulta e exporta).
-- Contas Home continuam com 'admin'/'membro' (admin = dono, membro = gerente).
-- =========================================================================

-- 1) Papéis aceitos
alter table group_members drop constraint if exists group_members_papel_check;
alter table group_members add constraint group_members_papel_check
  check (papel in ('admin', 'membro', 'dono', 'gerente', 'funcionario', 'contador'));

-- Papel de quem está chamando, num grupo (security definer: não esbarra na
-- RLS da própria group_members).
create or replace function public.papel_no_grupo(gid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case papel when 'admin' then 'dono' when 'membro' then 'gerente' else papel end
    from group_members
   where group_id = gid and profile_id = auth.uid();
$$;

-- 2) Unidades (loja, filial, obra…)
create table if not exists unidades (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references groups(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  criado_por uuid references profiles(id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (group_id, nome)
);
alter table unidades enable row level security;

drop policy if exists "Ver unidades do meu grupo" on unidades;
create policy "Ver unidades do meu grupo" on unidades for select
  using (public.is_group_member(group_id));
drop policy if exists "Dono e gerente criam unidades" on unidades;
create policy "Dono e gerente criam unidades" on unidades for insert
  with check (public.papel_no_grupo(group_id) in ('dono', 'gerente'));
drop policy if exists "Dono e gerente editam unidades" on unidades;
create policy "Dono e gerente editam unidades" on unidades for update
  using (public.papel_no_grupo(group_id) in ('dono', 'gerente'))
  with check (public.papel_no_grupo(group_id) in ('dono', 'gerente'));
drop policy if exists "Dono e gerente apagam unidades" on unidades;
create policy "Dono e gerente apagam unidades" on unidades for delete
  using (public.papel_no_grupo(group_id) in ('dono', 'gerente'));

-- 3) Lançamento e pessoa ligados a uma unidade (opcional)
alter table transactions add column if not exists unidade_id uuid references unidades(id) on delete set null;
alter table group_members add column if not exists unidade_id uuid references unidades(id) on delete set null;
create index if not exists transactions_unidade_idx on transactions (unidade_id);

-- 4) Regras dos papéis nos lançamentos (RESTRICTIVE: somam às regras atuais)
drop policy if exists "Contador não cria lançamentos" on transactions;
create policy "Contador não cria lançamentos" on transactions as restrictive for insert
  with check (group_id is null or coalesce(public.papel_no_grupo(group_id), '') <> 'contador');
drop policy if exists "Contador e funcionário: só o que é seu" on transactions;
create policy "Contador e funcionário: só o que é seu" on transactions as restrictive for update
  using (group_id is null or coalesce(public.papel_no_grupo(group_id), '') not in ('contador', 'funcionario') or (public.papel_no_grupo(group_id) = 'funcionario' and owner_id = auth.uid()));
drop policy if exists "Contador e funcionário não apagam o dos outros" on transactions;
create policy "Contador e funcionário não apagam o dos outros" on transactions as restrictive for delete
  using (group_id is null or coalesce(public.papel_no_grupo(group_id), '') not in ('contador', 'funcionario') or (public.papel_no_grupo(group_id) = 'funcionario' and owner_id = auth.uid()));

-- 5) Trocar o papel / a unidade de alguém (só o dono; nunca deixa o grupo sem dono)
create or replace function public.definir_papel(gid uuid, pid uuid, novo_papel text, nova_unidade uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.papel_no_grupo(gid) is distinct from 'dono' then
    raise exception 'Só o dono pode mudar papéis.';
  end if;
  if novo_papel not in ('dono', 'gerente', 'funcionario', 'contador') then
    raise exception 'Papel inválido.';
  end if;
  if nova_unidade is not null and not exists (select 1 from unidades where id = nova_unidade and group_id = gid) then
    raise exception 'Unidade de outro grupo.';
  end if;
  if novo_papel <> 'dono' and pid = auth.uid()
     and (select count(*) from group_members where group_id = gid and papel in ('dono', 'admin')) <= 1 then
    raise exception 'O grupo precisa de pelo menos um dono.';
  end if;
  update group_members set papel = novo_papel, unidade_id = nova_unidade
   where group_id = gid and profile_id = pid;
end;
$$;
revoke all on function public.definir_papel(uuid, uuid, text, uuid) from public, anon;
grant execute on function public.definir_papel(uuid, uuid, text, uuid) to authenticated;
