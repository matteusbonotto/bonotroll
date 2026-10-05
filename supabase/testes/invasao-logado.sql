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

  begin insert into group_members (group_id, profile_id) values (g, s); r := r || '5 *** ENTROU NO GRUPO DE OUTRO ***';
  exception when others then r := r || ('5 entrar no grupo de outro: BLOQUEADO (' || sqlerrm || ')'); end;

  begin update auth.users set raw_app_meta_data = '{"plano":"home_familia","assinatura_ativa":true}' where id = s; r := r || '6 *** MUDOU O PRÓPRIO PLANO ***';
  exception when others then r := r || ('6 mudar o próprio plano: BLOQUEADO (' || sqlerrm || ')'); end;

  begin execute 'truncate transactions'; r := r || '7 *** TRUNCATE ***';
  exception when others then r := r || ('7 esvaziar tabela: BLOQUEADO (' || sqlerrm || ')'); end;

  begin perform public.bntt_plano_da_conta(outro); r := r || '8 *** LEU PLANO DE OUTRO ***';
  exception when others then r := r || ('8 ler plano de outro: BLOQUEADO (' || sqlerrm || ')'); end;

  update profiles set nome = 'invadido' where id = outro;
  get diagnostics n = row_count;                       r := r || ('9 perfis de outros alterados (devia 0): ' || n);
  update transactions set valor = 0 where owner_id = outro;
  get diagnostics n = row_count;                       r := r || ('10 lançamentos de outros alterados (devia 0): ' || n);
  delete from transactions where owner_id = outro;
  get diagnostics n = row_count;                       r := r || ('11 lançamentos de outros apagados (devia 0): ' || n);

  begin insert into transactions (owner_id, tipo, titulo, valor, tipo_despesa) values (outro, 'saida', 'falso', 1, 'variavel'); r := r || '12 *** LANÇOU EM NOME DE OUTRO ***';
  exception when others then r := r || ('12 lançar em nome de outro: BLOQUEADO (' || sqlerrm || ')'); end;

  v := public.bntt_meu_plano();                        r := r || ('13 plano que o servidor vê: ' || coalesce(v->>'plano', 'null'));

  -- Limite do plano grátis: 30 lançamentos no mês.
  begin
    for i in 1..31 loop
      insert into transactions (owner_id, tipo, titulo, valor, tipo_despesa) values (s, 'saida', 'teste ' || i, 1, 'variavel');
    end loop;
    r := r || '14 *** PASSOU DE 30 LANÇAMENTOS ***';
  exception when others then
    select count(*) into n from transactions where owner_id = s;
    r := r || ('14 31º lançamento: BLOQUEADO (' || sqlerrm || ')');
  end;

  begin insert into fichas_saude (owner_id, cifrado) values (s, 'v1.aaaa.bbbb'); r := r || '15 *** CRIOU FICHA SEM PLANO FAMÍLIA ***';
  exception when others then r := r || ('15 ficha de saúde no grátis: BLOQUEADO (' || sqlerrm || ')'); end;

  begin
    insert into shopping_lists (owner_id, nome) values (s, 'lista 1');
    insert into shopping_lists (owner_id, nome) values (s, 'lista 2');
    r := r || '16 *** 2 LISTAS NO GRÁTIS ***';
  exception when others then r := r || ('16 segunda lista no grátis: BLOQUEADO (' || sqlerrm || ')'); end;

  raise exception E'RELATORIO\n%', array_to_string(r, E'\n');
end;
$$;
