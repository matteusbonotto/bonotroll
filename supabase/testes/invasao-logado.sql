-- Teste de invasão como usuário logado. TUDO É DESFEITO: o bloco termina
-- com RAISE EXCEPTION (que leva o relatório), o que aborta a transação.
do $$
declare
  s uuid := '63e73097-eea5-4162-9166-4a5debff9760';      -- conta sozinha (sem grupo)
  outro uuid := '0595ee81-f158-4757-8d3e-3544ba0cf254';  -- conta de outra pessoa
  g uuid;
  r text[] := '{}';
  n int;
  i int;
  v jsonb;
  v_dono uuid;

begin
  select group_id into g from group_members where profile_id = outro limit 1;
  -- Prepara (como dono do banco): a conta S vira "grátis, criada há 1 ano".
  update auth.users set raw_app_meta_data = raw_app_meta_data - 'plano' - 'assinatura_ativa' - 'cortesia',
                        created_at = now() - interval '1 year'
   where id = s;

  -- Daqui pra baixo: exatamente o que um usuário logado pode fazer.
  perform set_config('request.jwt.claims', json_build_object('sub', s, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', s::text, true);
  execute 'set local role authenticated';

  select count(*) into n from transactions;            r := r || ('1 lançamentos visíveis (devia 0): ' || n);
  select count(*) into n from group_members;           r := r || ('2 membros de grupos visíveis (devia 0): ' || n);
  select count(*) into n from profiles where id <> s;  r := r || ('3 perfis de outros visíveis (devia 0): ' || n);
  select count(*) into n from fichas_saude;            r := r || ('4 fichas visíveis (devia 0): ' || n);

  begin insert into group_members (group_id, profile_id) values (g, s); r := r || '5 *** ENTROU NO GRUPO DE OUTRO ***'::text;
  exception when others then r := r || ('5 entrar no grupo de outro: BLOQUEADO (' || sqlerrm || ')'); end;

  begin update auth.users set raw_app_meta_data = '{"plano":"home_familia","assinatura_ativa":true}' where id = s; r := r || '6 *** MUDOU O PRÓPRIO PLANO ***'::text;
  exception when others then r := r || ('6 mudar o próprio plano: BLOQUEADO (' || sqlerrm || ')'); end;

  begin execute 'truncate transactions'; r := r || '7 *** TRUNCATE ***'::text;
  exception when others then r := r || ('7 esvaziar tabela: BLOQUEADO (' || sqlerrm || ')'); end;

  begin perform public.bntt_plano_da_conta(outro); r := r || '8 *** LEU PLANO DE OUTRO ***'::text;
  exception when others then r := r || ('8 ler plano de outro: BLOQUEADO (' || sqlerrm || ')'); end;

  update profiles set nome = 'invadido' where id = outro;
  get diagnostics n = row_count;                       r := r || ('9 perfis de outros alterados (devia 0): ' || n);
  update transactions set valor = 0 where owner_id = outro;
  get diagnostics n = row_count;                       r := r || ('10 lançamentos de outros alterados (devia 0): ' || n);
  delete from transactions where owner_id = outro;
  get diagnostics n = row_count;                       r := r || ('11 lançamentos de outros apagados (devia 0): ' || n);

  begin
    insert into transactions (owner_id, tipo, titulo, valor, tipo_despesa) values (outro, 'saida', 'falso', 1, 'variavel') returning owner_id into v_dono;
    r := r || case when v_dono = outro then '12 *** LANÇOU EM NOME DE OUTRO ***' else '12 lançar em nome de outro: NEUTRALIZADO (dono virou S)' end;
  exception when others then r := r || ('12 lançar em nome de outro: BLOQUEADO (' || sqlerrm || ')'); end;

  v := public.bntt_meu_plano();                        r := r || ('13 plano que o servidor vê: ' || coalesce(v->>'plano', 'null'));

  -- Limite do plano grátis: 30 lançamentos no mês.
  begin
    for i in 1..31 loop
      insert into transactions (owner_id, tipo, titulo, valor, tipo_despesa) values (s, 'saida', 'teste ' || i, 1, 'variavel');
    end loop;
    r := r || '14 *** PASSOU DE 30 LANÇAMENTOS ***'::text;
  exception when others then
    select count(*) into n from transactions where owner_id = s;
    r := r || ('14 31º lançamento: BLOQUEADO (' || sqlerrm || ')');
  end;

  begin insert into fichas_saude (owner_id, cifrado) values (s, 'v1.aaaa.bbbb'); r := r || '15 *** CRIOU FICHA SEM PLANO FAMÍLIA ***'::text;
  exception when others then r := r || ('15 ficha de saúde no grátis: BLOQUEADO (' || sqlerrm || ')'); end;

  begin
    insert into shopping_lists (owner_id, nome) values (s, 'lista 1');
    insert into shopping_lists (owner_id, nome) values (s, 'lista 2');
    r := r || '16 *** 2 LISTAS NO GRÁTIS ***'::text;
  exception when others then r := r || ('16 segunda lista no grátis: BLOQUEADO (' || sqlerrm || ')'); end;

  -- ===== Pente-fino 2026-10-15 (supabase/seguranca-pente-fino-2026-10-15.sql) =====
  -- Grupo próprio de S, criado pela RPC oficial (vira admin). Desfeito no fim.
  declare sg uuid;
  begin
    select id into sg from public.create_group('grupo do atacante');

    begin update groups set criado_por = outro where id = sg;
      get diagnostics n = row_count;
      r := r || case when n > 0 then '17 *** ROUBOU O PLANO (criado_por = outra conta) ***' else '17 trocar criado_por: nada mudou' end;
    exception when others then r := r || ('17 trocar criado_por do grupo: BLOQUEADO (' || sqlerrm || ')'); end;

    begin update groups set codigo = 'AAAAAA' where id = sg;
      get diagnostics n = row_count;
      r := r || case when n > 0 then '18 *** TROCOU O CÓDIGO NA MÃO ***' else '18 trocar código: nada mudou' end;
    exception when others then r := r || ('18 trocar código sem RPC: BLOQUEADO (' || sqlerrm || ')'); end;

    begin
      insert into transactions (owner_id, group_id, responsavel_id, tipo, titulo, valor, tipo_despesa)
        values (outro, sg, outro, 'saida', 'injetado', 1, 'variavel');
      select count(*) into n from transactions where titulo = 'injetado' and (owner_id = outro or responsavel_id = outro);
      r := r || case when n > 0 then '19 *** LANÇOU NA CONTA DE QUEM NÃO É DO GRUPO ***' else '19 lançar em nome de estranho: NEUTRALIZADO (dono virou S)' end;
    exception when others then r := r || ('19 lançar em nome de estranho: BLOQUEADO (' || sqlerrm || ')'); end;
  end;

  -- Limite de 30/mês com criado_em forjado no passado.
  begin
    for i in 1..31 loop
      insert into transactions (owner_id, tipo, titulo, valor, tipo_despesa, criado_em)
        values (s, 'saida', 'antigo ' || i, 1, 'variavel', '2000-01-01');
    end loop;
    r := r || '20 *** PASSOU DE 30 COM criado_em FORJADO ***'::text;
  exception when others then r := r || ('20 31º lançamento com criado_em forjado: BLOQUEADO (' || sqlerrm || ')'); end;

  -- Limite de listas: cria finalizadas e reabre.
  begin
    insert into shopping_lists (owner_id, nome, status) values (s, 'f1', 'finalizada'), (s, 'f2', 'finalizada');
    update shopping_lists set status = 'planejando' where owner_id = s and nome in ('f1', 'f2');
    r := r || '21 *** 2 LISTAS ABERTAS NO GRÁTIS (reabrindo) ***'::text;
  exception when others then r := r || ('21 reabrir lista acima do limite: BLOQUEADO (' || sqlerrm || ')'); end;

  -- Limite de tentativas do código de convite (5/hora). Com a correção, a 6ª
  -- já recusa; antes, o RAISE desfazia o registro e nunca recusava.
  begin
    for i in 1..6 loop
      begin perform public.join_group_by_code('ZZZZZZZZZ' || i);
      exception when others then
        if sqlerrm like 'Muitas tentativas%' then raise; end if;
      end;
    end loop;
    r := r || '22 *** 6 CÓDIGOS ERRADOS SEM BLOQUEIO ***'::text;
  exception when others then r := r || ('22 chute de código: BLOQUEADO (' || sqlerrm || ')'); end;

  -- Listar avatares de todo mundo (cada pasta é o UUID de um usuário).
  select count(*) into n from storage.objects
   where bucket_id = 'avatars' and (storage.foldername(name))[1] <> s::text;
  r := r || ('23 avatares de outros listáveis (devia 0): ' || n);

  raise exception E'RELATORIO\n%', array_to_string(r, E'\n');
end;
$$;
