-- Bõnotto — dados básicos (categorias + lançamentos + lista de compras)
--
-- PRÉ-REQUISITOS (nessa ordem):
--   1. Rodar supabase/schema.sql neste projeto.
--   2. Matheus e Beatriz cada um ter feito cadastro (sign up) pelo menos uma vez no
--      app real — isso cria a linha em auth.users e o profile correspondente via
--      trigger. Sem isso o script abaixo não encontra os dois e cancela sozinho.
--   3. Editar os dois e-mails logo abaixo pelos e-mails reais usados no cadastro.
--
-- Este script recria os mesmos dados que hoje aparecem no modo demonstração
-- (mockDb.js): as 13 categorias, os lançamentos da planilha e a lista de
-- compras de exemplo — já ligados às contas reais e a um grupo "Família".
-- Rode uma única vez (rodar de novo duplica tudo).

do $$
declare
  v_matheus_id uuid;
  v_beatriz_id uuid;
  v_group_id uuid;
  v_lista_id uuid;
begin
  select id into v_matheus_id from auth.users where email = 'MATHEUS_EMAIL_AQUI';
  select id into v_beatriz_id from auth.users where email = 'BEATRIZ_EMAIL_AQUI';

  if v_matheus_id is null or v_beatriz_id is null then
    raise exception 'Não encontrei as duas contas em auth.users. Cadastre Matheus e Beatriz pelo app primeiro e ajuste os e-mails no topo deste arquivo.';
  end if;

  insert into groups (nome, codigo, criado_por)
  values ('Família', 'FAMILIA-' || substr(md5(random()::text), 1, 6), v_matheus_id)
  returning id into v_group_id;

  insert into group_members (group_id, profile_id, papel) values
    (v_group_id, v_matheus_id, 'admin'),
    (v_group_id, v_beatriz_id, 'membro');

  insert into categories (owner_id, group_id, nome, cor, icone) values
    (v_matheus_id, v_group_id, 'Assinaturas', '#0EA5E9', 'bi-collection-play'),
    (v_matheus_id, v_group_id, 'Curso', '#22C55E', 'bi-mortarboard'),
    (v_matheus_id, v_group_id, 'Casa', '#A855F7', 'bi-house-door'),
    (v_matheus_id, v_group_id, 'Carro', '#6366F1', 'bi-car-front'),
    (v_matheus_id, v_group_id, 'Pet', '#EF4444', 'bi-heart'),
    (v_matheus_id, v_group_id, 'Delivery', '#F97316', 'bi-bicycle'),
    (v_matheus_id, v_group_id, 'Outro', '#64748B', 'bi-three-dots'),
    (v_matheus_id, v_group_id, 'Salário', '#EAB308', 'bi-cash-coin'),
    (v_matheus_id, v_group_id, 'Alimentos', '#16A34A', 'bi-basket'),
    (v_matheus_id, v_group_id, 'Limpeza', '#06B6D4', 'bi-droplet'),
    (v_matheus_id, v_group_id, 'Higiene', '#EC4899', 'bi-droplet-half'),
    (v_matheus_id, v_group_id, 'Bebidas', '#D97706', 'bi-cup-straw'),
    (v_matheus_id, v_group_id, 'Hortifruti', '#65A30D', 'bi-apple');

  insert into transactions (owner_id, group_id, responsavel_id, tipo, titulo, categoria_id, tipo_despesa, valor, data_cadastro, data_vencimento, data_pagamento, recorrente) values
    (v_matheus_id, v_group_id, v_matheus_id, 'saida', 'Amazon Prime', (select id from categories where group_id = v_group_id and nome = 'Assinaturas'), 'fixa', 19.90, current_date - 15, current_date + 3, null, false),
    (v_matheus_id, v_group_id, v_matheus_id, 'saida', 'Claro Móvel', (select id from categories where group_id = v_group_id and nome = 'Assinaturas'), 'fixa', 51.91, current_date - 15, current_date - 2, null, false),
    (v_matheus_id, v_group_id, v_matheus_id, 'saida', 'Nubank+', (select id from categories where group_id = v_group_id and nome = 'Assinaturas'), 'fixa', 29.00, current_date - 15, current_date - 10, current_date - 10, false),
    (v_matheus_id, v_group_id, v_matheus_id, 'saida', 'Vivo Internet', (select id from categories where group_id = v_group_id and nome = 'Assinaturas'), 'fixa', 92.34, current_date - 15, current_date + 5, null, false),
    (v_matheus_id, v_group_id, v_matheus_id, 'saida', 'Open English', (select id from categories where group_id = v_group_id and nome = 'Curso'), 'fixa', 172.79, current_date - 15, current_date - 15, current_date - 15, false),
    (v_matheus_id, v_group_id, v_matheus_id, 'saida', 'Tokio Marine — Seguro casa', (select id from categories where group_id = v_group_id and nome = 'Casa'), 'fixa', 34.40, current_date - 15, current_date - 20, current_date - 20, false),
    (v_matheus_id, v_group_id, v_matheus_id, 'saida', 'CPFL Paulista (energia)', (select id from categories where group_id = v_group_id and nome = 'Casa'), 'variavel', 196.50, current_date - 15, current_date - 1, null, false),
    (v_matheus_id, v_group_id, v_matheus_id, 'saida', 'Águas Cristalinas Saneamento (água)', (select id from categories where group_id = v_group_id and nome = 'Casa'), 'variavel', 119.64, current_date - 15, current_date + 4, null, false),
    (v_matheus_id, v_group_id, v_matheus_id, 'saida', 'Condomínio', (select id from categories where group_id = v_group_id and nome = 'Casa'), 'fixa', 415.90, current_date - 15, null, null, false),
    (v_matheus_id, v_group_id, v_matheus_id, 'saida', 'Seguro Carro', (select id from categories where group_id = v_group_id and nome = 'Carro'), 'fixa', 212.58, current_date - 15, current_date - 30, current_date - 30, false),
    (v_matheus_id, v_group_id, v_matheus_id, 'saida', 'Financiamento Carro', (select id from categories where group_id = v_group_id and nome = 'Carro'), 'fixa', 765.87, current_date - 15, current_date + 6, null, false),
    (v_matheus_id, v_group_id, v_matheus_id, 'saida', 'Gasolina', (select id from categories where group_id = v_group_id and nome = 'Carro'), 'variavel', 200.00, current_date - 15, current_date - 5, current_date - 5, false),
    (v_matheus_id, v_group_id, v_matheus_id, 'saida', 'Petlove', (select id from categories where group_id = v_group_id and nome = 'Pet'), 'variavel', 44.90, current_date - 15, current_date - 8, current_date - 8, false),
    (v_matheus_id, v_group_id, v_matheus_id, 'saida', 'iFood / 99', (select id from categories where group_id = v_group_id and nome = 'Delivery'), 'variavel', 500.00, current_date - 15, null, null, false),
    (v_matheus_id, v_group_id, v_matheus_id, 'saida', 'Financiamento Casa', (select id from categories where group_id = v_group_id and nome = 'Casa'), 'fixa', 1000.00, current_date - 15, current_date - 3, null, false),
    (v_matheus_id, v_group_id, v_matheus_id, 'saida', 'Dízimo', (select id from categories where group_id = v_group_id and nome = 'Outro'), 'variavel', 200.00, current_date - 15, current_date - 7, current_date - 7, false),
    (v_matheus_id, v_group_id, v_matheus_id, 'entrada', 'Salário Vetor Nimbus Tecnologia', (select id from categories where group_id = v_group_id and nome = 'Salário'), 'fixa', 6000.00, current_date - 15, current_date - 11, current_date - 11, true),
    (v_beatriz_id, v_group_id, v_beatriz_id, 'entrada', 'Salário Estúdio Alameda Criativa', (select id from categories where group_id = v_group_id and nome = 'Salário'), 'fixa', 5200.00, current_date - 15, current_date - 11, current_date - 11, true);

  insert into shopping_lists (owner_id, group_id, nome, status)
  values (v_matheus_id, v_group_id, 'Compras da Semana', 'planejando')
  returning id into v_lista_id;

  insert into shopping_list_items (list_id, nome, categoria_id, unidade, quantidade) values
    (v_lista_id, 'Arroz 5kg', (select id from categories where group_id = v_group_id and nome = 'Alimentos'), 'kg', 5),
    (v_lista_id, 'Feijão 1kg', (select id from categories where group_id = v_group_id and nome = 'Alimentos'), 'kg', 1),
    (v_lista_id, 'Detergente', (select id from categories where group_id = v_group_id and nome = 'Limpeza'), 'un', 2),
    (v_lista_id, 'Sabonete', (select id from categories where group_id = v_group_id and nome = 'Higiene'), 'un', 3),
    (v_lista_id, 'Banana Prata', (select id from categories where group_id = v_group_id and nome = 'Hortifruti'), 'kg', 1),
    (v_lista_id, 'Refrigerante 2L', (select id from categories where group_id = v_group_id and nome = 'Bebidas'), 'un', 2);

  raise notice 'Seed concluído. Grupo % criado com Matheus (%) e Beatriz (%).', v_group_id, v_matheus_id, v_beatriz_id;
end $$;
