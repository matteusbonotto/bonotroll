-- =========================================================================
-- Pente-fino de segurança (2026-10-15). Idempotente — pode rodar de novo.
--
-- Base: snapshot de produção backups/bntt/2026-10-15-antes-pente-fino
-- (policies, funções, grants) + consultas só de leitura ao catálogo.
-- O que já estava bom: RLS ligado em todas as tabelas; anon sem grant em
-- public; funções definer com search_path; ia_consumir, bntt_cron_headers,
-- bntt_plano_* só para service_role; group_members sem INSERT/UPDATE.
--
-- Testes: supabase/testes/invasao-logado.sql (casos 17 a 23).
-- Depois de aplicar, mude também js/services/groups.js (já alterado nesta
-- branch): join_group_by_code agora devolve NULL quando o código não existe.
-- =========================================================================


-- -------------------------------------------------------------------------
-- 1) [ALTO] Roubo de plano pago trocando groups.criado_por
--
-- Exploit: a policy "Admin atualiza o grupo" deixa o admin dar UPDATE em
-- QUALQUER coluna de groups. bntt_plano_efetivo dá a cada membro o melhor
-- plano entre o dele e o de groups.criado_por. Então:
--   rpc('create_group', {p_nome:'x'})  ->  vira admin
--   from('groups').update({criado_por: '<uuid de quem paga>'}).eq('id', g)
-- e a pessoa (e quem ela convidar) passa a ter o plano da vítima — sem
-- pagar, e com o limite de pessoas da vítima. O grupo ainda aparece pra
-- vítima ("Ver grupos" aceita criado_por = auth.uid()).
-- Também dava pra trocar o código direto (sem rotate_group_code) e criar
-- grupos por INSERT direto, com código escolhido a dedo.
--
-- Correção: authenticated só altera "nome"; criar grupo só via RPC
-- create_group (SECURITY DEFINER). Gatilho de reforço: criado_por e codigo
-- não mudam por quem vem da API, mesmo se alguém devolver o grant no futuro.
-- -------------------------------------------------------------------------
revoke insert, update on public.groups from anon, authenticated;
grant update (nome) on public.groups to authenticated;

create or replace function public.bntt_groups_imutaveis()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Dentro de rotate_group_code (definer) current_user é o dono da função,
  -- não authenticated — então a troca de código oficial continua passando.
  if current_user in ('authenticated', 'anon')
     and (new.criado_por is distinct from old.criado_por or new.codigo is distinct from old.codigo) then
    raise exception 'criado_por e codigo do grupo não podem ser alterados pela API' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function public.bntt_groups_imutaveis() from public, anon, authenticated;

drop trigger if exists bntt_groups_imutaveis on public.groups;
create trigger bntt_groups_imutaveis before update on public.groups
  for each row execute function public.bntt_groups_imutaveis();

-- Conferência (só leitura) — grupo cujo criador não é membro é suspeito:
--   select g.id from groups g
--    where g.criado_por is not null
--      and not exists (select 1 from group_members m where m.group_id = g.id and m.profile_id = g.criado_por);


-- -------------------------------------------------------------------------
-- 2) [MÉDIO] Limite de tentativas do código de convite nunca contava
--
-- Exploit: join_group_by_code grava a falha em group_join_attempts e logo
-- depois faz RAISE EXCEPTION — o erro desfaz a transação inteira, inclusive
-- a linha da tentativa. A tabela fica sempre vazia e o limite de 5/hora
-- nunca dispara: chute ilimitado de código. Agravante: o único grupo em
-- produção ainda tem código antigo de 6 caracteres.
--   for (c of candidatos) await supabase.rpc('join_group_by_code', {p_codigo: c})
--
-- Correção: código errado devolve NULL (sem exceção), então a tentativa
-- fica gravada. O app trata NULL como "Código de grupo não encontrado.".
-- -------------------------------------------------------------------------
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

  select * into v_group from groups where codigo = upper(trim(coalesce(p_codigo, '')));
  if not found then
    -- Sem RAISE aqui: a exceção desfaria este INSERT e o limite nunca contaria.
    insert into group_join_attempts (profile_id) values (auth.uid());
    return null;
  end if;

  insert into group_members (group_id, profile_id, papel)
  values (v_group.id, auth.uid(), 'membro')
  on conflict do nothing;
  return v_group;
end;
$$;
revoke all on function public.join_group_by_code(text) from public, anon;
grant execute on function public.join_group_by_code(text) to authenticated;

-- Códigos antigos (6 caracteres, da época do hex) viram códigos de 10.
-- ATENÇÃO: quem for convidar precisa copiar o código novo na tela do grupo.
update public.groups set codigo = public.gerar_codigo_grupo() where char_length(codigo) < 10;


-- -------------------------------------------------------------------------
-- 3) [MÉDIO] Lançar dados na conta de quem não é do seu grupo
--
-- Exploit: nas tabelas com policy "owner_id = auth.uid() OR
-- is_group_member(group_id)" o WITH CHECK aceita qualquer owner_id desde
-- que o group_id seja do atacante. Então:
--   from('transactions').insert({owner_id:'<uuid da vítima>', group_id:'<meu grupo>', ...})
-- e a linha aparece na conta da vítima (que nem é do grupo) — lançamento
-- falso, item falso, lista falsa. Com responsavel_id = vítima, o gatilho de
-- orçamento ainda manda notificação pra ela. No UPDATE, um membro também
-- podia "dar" a linha de outro membro pra um estranho, ou tirar a ficha de
-- saúde/cofre de outra pessoa da casa (group_id = null) e escondê-la.
--
-- Correção (gatilho, não policy, para não quebrar casos legítimos):
--   INSERT: dono/responsável precisa ser você ou membro do grupo da linha;
--           senão o dono vira você e o responsável vira NULL (não quebra a
--           recorrência de quem saiu do grupo, só neutraliza a injeção).
--   UPDATE: trocar o dono pra quem não é do grupo, ou tirar do grupo a
--           linha de outra pessoa, é recusado.
-- -------------------------------------------------------------------------
create or replace function public.bntt_guarda_dono()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_eu uuid := auth.uid();
begin
  if v_eu is null then return new; end if;  -- service role / cron
  -- Excluir um grupo faz o FK (ON DELETE SET NULL) zerar group_id das linhas
  -- de todos os membros; isso chega aqui com profundidade > 1 e é legítimo.
  if pg_trigger_depth() > 1 then return new; end if;

  if tg_op = 'INSERT' then
    if new.owner_id is distinct from v_eu
       and not (new.group_id is not null and exists (
         select 1 from group_members m where m.group_id = new.group_id and m.profile_id = new.owner_id)) then
      new.owner_id := v_eu;
    end if;
  else
    if new.owner_id is distinct from old.owner_id and new.owner_id is distinct from v_eu
       and not (new.group_id is not null and exists (
         select 1 from group_members m where m.group_id = new.group_id and m.profile_id = new.owner_id)) then
      raise exception 'BNTT_DONO: o dono precisa ser você ou alguém do grupo' using errcode = '42501';
    end if;
    if old.group_id is not null and new.group_id is null and new.owner_id is distinct from v_eu then
      raise exception 'BNTT_DONO: só o dono tira o registro do grupo' using errcode = '42501';
    end if;
  end if;

  -- IF aninhado: new.responsavel_id só existe em transactions, e o PL/pgSQL
  -- só prepara a expressão interna quando chega nela.
  if tg_table_name = 'transactions' then
    if new.responsavel_id is not null and new.responsavel_id is distinct from v_eu
       and (tg_op = 'INSERT' or new.responsavel_id is distinct from old.responsavel_id)
       and not (new.group_id is not null and exists (
         select 1 from group_members m where m.group_id = new.group_id and m.profile_id = new.responsavel_id)) then
      if tg_op = 'INSERT' then
        new.responsavel_id := null;
      else
        raise exception 'BNTT_DONO: o responsável precisa ser você ou alguém do grupo' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.bntt_guarda_dono() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['transactions', 'caixinhas', 'resource_items', 'resource_rooms', 'shopping_lists',
                           'categories', 'banks', 'cartoes', 'companies', 'cofres', 'fichas_saude'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists bntt_guarda_dono on public.%I', t);
      execute format('create trigger bntt_guarda_dono before insert or update on public.%I
                        for each row execute function public.bntt_guarda_dono()', t);
    end if;
  end loop;
end $$;


-- -------------------------------------------------------------------------
-- 4) [MÉDIO] Passar dos 30 lançamentos/mês do plano grátis
--
-- Exploit: bntt_trava_lancamentos conta "criado_em >= início do mês", mas
-- criado_em vem do cliente:
--   from('transactions').insert({..., criado_em: '2000-01-01'})
-- nunca entra na conta → lançamentos ilimitados no grátis.
-- Correção: em INSERT vindo da API, criado_em é sempre now().
-- -------------------------------------------------------------------------
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
  new.criado_em := now();  -- o cliente não escolhe a data que conta pro limite
  v_limite := public.bntt_limite(public.bntt_plano_efetivo(auth.uid()), 'lancamentosMes');
  if v_limite is null then return new; end if;
  select count(*) into v_usados from transactions where owner_id = auth.uid() and criado_em >= date_trunc('month', now());
  if v_usados >= v_limite then
    raise exception 'BNTT_LIMITE: lancamentosMes (% por mês no seu plano)', v_limite using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.bntt_trava_lancamentos() from public, anon, authenticated;


-- -------------------------------------------------------------------------
-- 5) [MÉDIO] Passar do limite de listas abertas / unidades
--
-- Exploit (listas): o limite só roda no INSERT e ignora listas
-- 'finalizada'. Cria N listas já finalizadas e depois:
--   from('shopping_lists').update({status:'planejando'}).eq('id', x)
-- Exploit (unidades): dono de dois grupos cria a unidade no grupo com folga
-- e depois muda o group_id pro grupo que já está no limite.
-- Correção: os mesmos gatilhos de limite também rodam nessas mudanças
-- (a linha atual não entra na conta: ainda está finalizada / no grupo antigo).
-- -------------------------------------------------------------------------
drop trigger if exists bntt_limite_listas_reabrir on public.shopping_lists;
create trigger bntt_limite_listas_reabrir before update of status on public.shopping_lists
  for each row when (old.status = 'finalizada' and new.status <> 'finalizada')
  execute function public.bntt_trava_listas();

drop trigger if exists bntt_limite_unidades_mover on public.unidades;
create trigger bntt_limite_unidades_mover before update of group_id on public.unidades
  for each row when (old.group_id is distinct from new.group_id)
  execute function public.bntt_trava_unidades();


-- -------------------------------------------------------------------------
-- 6) [MÉDIO] Bucket avatars listável por qualquer um (enumera usuários)
--
-- Exploit: a policy "Avatar é público pra leitura" (SELECT em
-- storage.objects, sem dono, papel public = inclusive anon) deixa listar:
--   supabase.storage.from('avatars').list('')   // sem login
-- Cada pasta é o UUID de um usuário — é exatamente o que os exploits 1 e 3
-- precisam ("uuid de quem paga" / "uuid da vítima").
-- Correção: bucket público não precisa de policy SELECT para servir a URL
-- pública (/object/public/avatars/...). Fica só a leitura da PRÓPRIA pasta
-- (necessária para o upload com upsert).
-- -------------------------------------------------------------------------
drop policy if exists "Avatar é público pra leitura" on storage.objects;
drop policy if exists "Usuário lê a própria pasta de avatar" on storage.objects;
create policy "Usuário lê a própria pasta de avatar" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- O UPDATE do avatar não tinha WITH CHECK explícito (herdava o USING, ok),
-- mas deixamos explícito pra ninguém "simplificar" e abrir mover-pra-pasta-alheia.
drop policy if exists "Usuário atualiza o próprio avatar" on storage.objects;
create policy "Usuário atualiza o próprio avatar" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);


-- -------------------------------------------------------------------------
-- 7) [BAIXO] Defesa em profundidade nos grants
--
-- ia_uso e group_join_attempts têm RLS sem policy (ninguém da API lê/grava),
-- mas authenticated ainda tinha arwd — se um dia alguém criar uma policy
-- "pra testar", o usuário zera o próprio contador de IA / de tentativas.
-- MAINTAIN (PG17) em todas as tabelas deixa authenticated dar LOCK/VACUUM/
-- REINDEX; não é usado pelo app.
-- -------------------------------------------------------------------------
revoke all on public.ia_uso from anon, authenticated;
revoke all on public.group_join_attempts from anon, authenticated;

do $$
begin
  if current_setting('server_version_num')::int >= 170000 then
    execute 'revoke maintain on all tables in schema public from anon, authenticated';
    execute 'alter default privileges for role postgres in schema public revoke maintain on tables from anon, authenticated';
  end if;
end $$;
