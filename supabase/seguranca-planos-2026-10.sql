-- =========================================================================
-- Segurança e limites dos planos NO SERVIDOR (2026-10-05). Idempotente.
--
-- Antes: os limites dos planos (lançamentos/mês, listas, pessoas, unidades,
-- fichas de saúde) só eram conferidos na tela — quem chamasse a API direto
-- passava por cima. Agora o banco recusa, com a mensagem "BNTT_LIMITE: …"
-- (o app transforma em "Disponível em outro plano").
--
-- O PLANO continua morando só em auth.users.raw_app_meta_data (escrito pelo
-- webhook do Stripe / service role). Usuário não altera app_metadata.
--
-- Plano que vale para uma pessoa = o melhor entre o dela e o de quem criou a
-- casa/empresa em que ela está (quem paga costuma ser quem criou).
-- Limites: espelho de js/data/planos.js — tests/unit/planos-sql.test.js
-- falha se os dois se desencontrarem.
-- =========================================================================

-- 1) Plano de uma conta (sem olhar grupo)
create or replace function public.bntt_plano_da_conta(uid uuid)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when u.raw_app_meta_data->>'assinatura_ativa' = 'true' and u.raw_app_meta_data->>'plano' is not null
      then u.raw_app_meta_data->>'plano'
    when u.created_at > now() - interval '30 days'
      then case when coalesce(u.raw_app_meta_data->>'tipo', u.raw_user_meta_data->>'tipo_conta') = 'business' then 'business_expansao' else 'home_familia' end
    else case when coalesce(u.raw_app_meta_data->>'tipo', u.raw_user_meta_data->>'tipo_conta') = 'business' then 'business_largada' else 'home_gratis' end
  end
  from auth.users u
  where u.id = uid;
$$;

create or replace function public.bntt_nivel(plano text)
returns int
language sql
immutable
as $$
  select coalesce((('{"home_gratis":0,"business_largada":0,"home_solteiro":1,"business_balcao":1,"home_casal":2,"business_expansao":2,"home_familia":3,"business_rede":3}'::jsonb) ->> plano)::int, 0);
$$;

-- 2) Plano que vale (o melhor entre o próprio e o de quem criou o grupo)
create or replace function public.bntt_plano_efetivo(uid uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_proprio text := public.bntt_plano_da_conta(uid);
  v_criador uuid;
  v_do_grupo text;
begin
  select g.criado_por into v_criador
    from group_members m join groups g on g.id = m.group_id
   where m.profile_id = uid
   limit 1;
  if v_criador is null or v_criador = uid then return v_proprio; end if;
  v_do_grupo := public.bntt_plano_da_conta(v_criador);
  return case when public.bntt_nivel(v_do_grupo) > public.bntt_nivel(v_proprio) then v_do_grupo else v_proprio end;
end;
$$;

-- 3) Limites (null = sem limite; saude: 1 liberado, 0 não)
create or replace function public.bntt_limite(plano text, recurso text)
returns int
language sql
immutable
as $$
  select ((
    '{
      "home_gratis":       {"pessoas": 1, "lancamentosMes": 30, "listas": 1, "unidades": 1, "saude": 0},
      "home_solteiro":     {"pessoas": 1, "unidades": 1, "saude": 0},
      "home_casal":        {"pessoas": 2, "unidades": 1, "saude": 0},
      "home_familia":      {"pessoas": 6, "unidades": 2, "saude": 1},
      "business_largada":  {"pessoas": 1, "lancamentosMes": 30, "listas": 1, "unidades": 1},
      "business_balcao":   {"pessoas": 3, "unidades": 1},
      "business_expansao": {"pessoas": 10, "unidades": 3},
      "business_rede":     {}
    }'::jsonb) -> plano ->> recurso)::int;
$$;

-- 4) O app pergunta o próprio plano ao servidor (fonte da verdade da tela)
create or replace function public.bntt_meu_plano()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_plano text;
  v_criada timestamptz;
begin
  if auth.uid() is null then return null; end if;
  v_plano := public.bntt_plano_efetivo(auth.uid());
  select created_at into v_criada from auth.users where id = auth.uid();
  return jsonb_build_object(
    'plano', v_plano,
    'dias_de_teste', greatest(0, 30 - extract(day from now() - v_criada)::int)
  );
end;
$$;

-- 5) Travas (BEFORE INSERT). Sem auth.uid() = manutenção pelo servidor: passa.
create or replace function public.bntt_trava_lancamentos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limite int;
  v_usados int;
begin
  if auth.uid() is null then return new; end if;
  v_limite := public.bntt_limite(public.bntt_plano_efetivo(auth.uid()), 'lancamentosMes');
  if v_limite is null then return new; end if;
  select count(*) into v_usados from transactions where owner_id = auth.uid() and criado_em >= date_trunc('month', now());
  if v_usados >= v_limite then
    raise exception 'BNTT_LIMITE: lancamentosMes (% por mês no seu plano)', v_limite using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.bntt_trava_listas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limite int;
  v_abertas int;
begin
  if auth.uid() is null then return new; end if;
  v_limite := public.bntt_limite(public.bntt_plano_efetivo(auth.uid()), 'listas');
  if v_limite is null then return new; end if;
  select count(*) into v_abertas from shopping_lists
   where status <> 'finalizada'
     and (owner_id = auth.uid() or (new.group_id is not null and group_id = new.group_id));
  if v_abertas >= v_limite then
    raise exception 'BNTT_LIMITE: listas (% lista aberta no seu plano)', v_limite using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.bntt_trava_saude()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return new; end if;
  if coalesce(public.bntt_limite(public.bntt_plano_efetivo(auth.uid()), 'saude'), 1) = 0 then
    raise exception 'BNTT_LIMITE: saude (fichas de saúde são do plano Família)' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create or replace function public.bntt_trava_unidades()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_criador uuid;
  v_limite int;
  v_total int;
begin
  if auth.uid() is null then return new; end if;
  select criado_por into v_criador from groups where id = new.group_id;
  v_limite := public.bntt_limite(public.bntt_plano_efetivo(coalesce(v_criador, auth.uid())), 'unidades');
  if v_limite is null then return new; end if;
  select count(*) into v_total from unidades where group_id = new.group_id;
  if v_total >= v_limite then
    raise exception 'BNTT_LIMITE: unidades (% no seu plano)', v_limite using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- Pessoas: vale também quando alguém entra pelo código (join_group_by_code).
create or replace function public.bntt_trava_pessoas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_criador uuid;
  v_limite int;
  v_total int;
begin
  select criado_por into v_criador from groups where id = new.group_id;
  if v_criador is null or v_criador = new.profile_id then return new; end if;
  v_limite := public.bntt_limite(public.bntt_plano_efetivo(v_criador), 'pessoas');
  if v_limite is null then return new; end if;
  select count(*) into v_total from group_members where group_id = new.group_id;
  if v_total >= v_limite then
    raise exception 'BNTT_LIMITE: pessoas (% no plano de quem criou o grupo)', v_limite using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists bntt_limite_lancamentos on transactions;
create trigger bntt_limite_lancamentos before insert on transactions for each row execute function public.bntt_trava_lancamentos();
drop trigger if exists bntt_limite_listas on shopping_lists;
create trigger bntt_limite_listas before insert on shopping_lists for each row execute function public.bntt_trava_listas();
drop trigger if exists bntt_limite_fichas on fichas_saude;
create trigger bntt_limite_fichas before insert on fichas_saude for each row execute function public.bntt_trava_saude();
drop trigger if exists bntt_limite_cofres on cofres;
create trigger bntt_limite_cofres before insert on cofres for each row execute function public.bntt_trava_saude();
drop trigger if exists bntt_limite_unidades on unidades;
create trigger bntt_limite_unidades before insert on unidades for each row execute function public.bntt_trava_unidades();
drop trigger if exists bntt_limite_pessoas on group_members;
create trigger bntt_limite_pessoas before insert on group_members for each row execute function public.bntt_trava_pessoas();

-- 6) Permissões no mínimo necessário (defesa em camadas: o RLS continua)
--    anon (sem login) não toca em nenhuma tabela do app.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
--    logado: nada de TRUNCATE (não passa pelo RLS), TRIGGER ou REFERENCES.
revoke truncate, trigger, references on all tables in schema public from authenticated;
--    tabelas futuras nascem sem acesso anônimo.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke truncate, trigger, references on tables from authenticated;

--    funções: ninguém sem login executa nada; logado só o que o app usa
--    (e o que as regras de acesso chamam por dentro).
revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;
revoke execute on all functions in schema public from authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group_by_code(text) to authenticated;
grant execute on function public.definir_papel(uuid, uuid, text, uuid) to authenticated;
grant execute on function public.is_group_member(uuid) to authenticated;
grant execute on function public.papel_no_grupo(uuid) to authenticated;
grant execute on function public.bntt_meu_plano() to authenticated;
do $$
begin
  -- RPCs do endurecimento (assinatura conferida antes de liberar)
  if to_regprocedure('public.rotate_group_code(uuid)') is not null then
    execute 'grant execute on function public.rotate_group_code(uuid) to authenticated';
  end if;
  if to_regprocedure('public.remove_group_member(uuid, uuid)') is not null then
    execute 'grant execute on function public.remove_group_member(uuid, uuid) to authenticated';
  end if;
end;
$$;

-- 7) Anexos (comprovantes): até 10 MB, só imagem e PDF
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'application/pdf']
 where id = 'anexos';
