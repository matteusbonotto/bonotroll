-- ARQUIVO ÚNICO PARA O SUPABASE: cole tudo no SQL Editor do projeto appbntt e clique em Run.
-- Junta: endurecimento-2026-10.sql (segurança) + saude-2026-10.sql (fichas de saúde) + business-2026-10.sql (unidades e papéis). Idempotente.

-- =====================================================================
-- Endurecimento de segurança — 2026-10-04 (docs/AUDITORIA-SEGURANCA-2026-10.md)
-- Idempotente. NÃO APLICADO AINDA: a CLI deste ambiente não acessa o
-- projeto appbntt (403). Aplicar com:
--   npx supabase db query --linked -f supabase/endurecimento-2026-10.sql
-- depois de `npx supabase login` com a conta do BNTT. Testar antes com
-- duas contas em grupos diferentes. Também foi anexado ao fim de schema.sql.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- C1 — ninguém se insere direto em group_members (nem como admin). Só as
-- funções create_group/join_group_by_code (security definer) inserem.
drop policy if exists "Entrar em um grupo" on group_members;
revoke insert, update on group_members from anon, authenticated;

-- C2 — tentativas de código de convite (5 erros por hora por pessoa).
create table if not exists group_join_attempts (
  id bigserial primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  tentado_em timestamptz not null default now()
);
alter table group_join_attempts enable row level security; -- sem policy: só funções definer acessam
create index if not exists group_join_attempts_profile_idx on group_join_attempts (profile_id, tentado_em);

create or replace function public.join_group_by_code(p_codigo text)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group groups;
  v_falhas int;
begin
  if auth.uid() is null then
    raise exception 'Faça login para entrar num grupo.';
  end if;
  select count(*) into v_falhas from group_join_attempts
   where profile_id = auth.uid() and tentado_em > now() - interval '1 hour';
  if v_falhas >= 5 then
    raise exception 'Muitas tentativas com código errado. Tente de novo em 1 hora.';
  end if;

  select * into v_group from groups where codigo = upper(trim(p_codigo));
  if not found then
    insert into group_join_attempts (profile_id) values (auth.uid());
    raise exception 'Código de grupo não encontrado.';
  end if;

  insert into group_members (group_id, profile_id, papel)
  values (v_group.id, auth.uid(), 'membro')
  on conflict do nothing;
  return v_group;
end;
$$;

-- Código novo: 10 caracteres aleatórios (antes 6 hex). Códigos antigos continuam valendo.
create or replace function public.gerar_codigo_grupo()
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select upper(substr(translate(encode(extensions.gen_random_bytes(12), 'base64'), '+/=0O1Il', ''), 1, 10));
$$;

create or replace function public.create_group(p_nome text)
returns groups
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_group groups;
begin
  if auth.uid() is null then
    raise exception 'Faça login para criar um grupo.';
  end if;
  insert into groups (nome, codigo, criado_por)
  values (left(trim(p_nome), 80), public.gerar_codigo_grupo(), auth.uid())
  returning * into v_group;
  insert into group_members (group_id, profile_id, papel)
  values (v_group.id, auth.uid(), 'admin');
  return v_group;
end;
$$;

-- Admin troca o código (vazou) e remove um membro.
create or replace function public.rotate_group_code(p_group uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_codigo text;
begin
  if not exists (select 1 from group_members where group_id = p_group and profile_id = auth.uid() and papel = 'admin') then
    raise exception 'Só o administrador do grupo pode trocar o código.';
  end if;
  v_codigo := public.gerar_codigo_grupo();
  update groups set codigo = v_codigo where id = p_group;
  return v_codigo;
end;
$$;

create or replace function public.remove_group_member(p_group uuid, p_profile uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from group_members where group_id = p_group and profile_id = auth.uid() and papel = 'admin') then
    raise exception 'Só o administrador do grupo pode remover membros.';
  end if;
  if p_profile = auth.uid() then
    raise exception 'Para sair do grupo, use "Sair do grupo".';
  end if;
  delete from group_members where group_id = p_group and profile_id = p_profile;
end;
$$;

revoke all on function public.rotate_group_code(uuid) from public, anon;
revoke all on function public.remove_group_member(uuid, uuid) from public, anon;
grant execute on function public.rotate_group_code(uuid) to authenticated;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group_by_code(text) to authenticated;
revoke all on function public.gerar_codigo_grupo() from public, anon, authenticated;

-- A2 — ninguém grava linha num grupo do qual não é membro. Policy RESTRITIVA
-- (soma-se com AND às existentes), uma para insert e outra para update.
do $$
declare
  t text;
begin
  foreach t in array array['transactions', 'categories', 'companies', 'banks', 'cartoes',
                           'resource_rooms', 'resource_items', 'caixinhas', 'shopping_lists'] loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'group_id') then
      execute format('drop policy if exists "grupo_valido_insert" on %I', t);
      execute format('create policy "grupo_valido_insert" on %I as restrictive for insert to authenticated with check (group_id is null or public.is_group_member(group_id))', t);
      execute format('drop policy if exists "grupo_valido_update" on %I', t);
      execute format('create policy "grupo_valido_update" on %I as restrictive for update to authenticated using (true) with check (group_id is null or public.is_group_member(group_id))', t);
    end if;
  end loop;
end $$;

-- A1 — o trigger de orçamento insere 'orcamento_estourado'; o CHECK não aceitava.
alter table notifications drop constraint if exists notifications_tipo_check;
alter table notifications add constraint notifications_tipo_check
  check (tipo in ('validade', 'estoque', 'vencimento_despesa', 'pagamento', 'orcamento_estourado'));

-- A3 — push só para serviços de push oficiais (evita SSRF pelas Edge Functions).
-- NOT VALID: vale para inscrições novas sem quebrar as que já existem.
alter table push_subscriptions drop constraint if exists endpoint_push_oficial;
alter table push_subscriptions add constraint endpoint_push_oficial check (
  endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.notify\.windows\.com|web\.push\.apple\.com)/'
) not valid;

-- M1 — search_path fixo em funções security definer.
alter function public.is_group_member(uuid) set search_path = public;
alter function public.handle_new_user() set search_path = public;

-- M2 — uploads: só imagem, até 2 MB.
update storage.buckets
   set file_size_limit = 2097152,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp']
 where id = 'avatars';
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
