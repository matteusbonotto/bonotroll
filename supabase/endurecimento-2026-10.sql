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
