-- Bõnotto — schema do banco de dados (Supabase / Postgres)
--
-- ESTE ARQUIVO NÃO É EXECUTADO AUTOMATICAMENTE POR NADA NESTE REPOSITÓRIO.
-- Ele só deve ser rodado manualmente, por você, dentro do SQL Editor do SEU
-- próprio projeto Supabase, quando decidir sair do modo demonstração.
-- Veja o README.md para o passo a passo.

create extension if not exists "uuid-ossp";

-- =========================================================
-- TABELAS
-- =========================================================

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  avatar_url text,
  cor text not null default '#1F7A5C',
  criado_em timestamptz not null default now()
);

create table if not exists groups (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  codigo text not null unique,
  criado_por uuid references profiles(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table if not exists group_members (
  group_id uuid not null references groups(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  papel text not null default 'membro' check (papel in ('admin', 'membro')),
  entrou_em timestamptz not null default now(),
  primary key (group_id, profile_id)
);

create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  nome text not null,
  cor text not null default '#6c757d',
  icone text default 'bi-tag',
  icone_url text,
  criado_em timestamptz not null default now()
);
-- (o índice único de categorias fica lá no fim do arquivo, depois de
-- "transactions"/"shopping_list_items" existirem — ver por quê na seção
-- "LIMPEZA DE CATEGORIAS DUPLICADAS")

-- "create table if not exists" NÃO adiciona coluna em tabela que já existe
-- (só cria do zero) — por isso toda coluna nova droppada aqui embaixo desde
-- que o projeto foi instalado pela primeira vez também precisa de um
-- "alter table ... add column if not exists" explícito. Rodar de novo é
-- sempre seguro (idempotente).
alter table profiles add column if not exists cor text not null default '#1F7A5C';
alter table categories add column if not exists icone_url text;

-- Orçamento mensal por categoria — pessoal (owner_id), não do grupo: cada
-- pessoa define o próprio limite. "Mensal" não tem coluna de mês/ano porque
-- o limite vale todo mês igual; o gasto do mês é sempre recalculado no
-- cliente a partir de transactions.data_cadastro (ver js/services/budgets.js).
create table if not exists category_budgets (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  categoria_id uuid not null references categories(id) on delete cascade,
  valor_limite numeric(12, 2) not null check (valor_limite > 0),
  criado_em timestamptz not null default now(),
  unique (owner_id, categoria_id)
);

-- "Empresa/Serviço" de uma transação passou a poder ter logo: cada nome
-- distinto vira uma linha aqui (criada sob demanda ao salvar uma transação),
-- reaproveitada da próxima vez que o mesmo nome for digitado.
create table if not exists companies (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  nome text not null,
  logo_url text,
  criado_em timestamptz not null default now()
);
-- "unique (col, coalesce(...), col)" como CONSTRAINT de tabela não é SQL
-- válido no Postgres (constraint só aceita colunas simples, não expressão)
-- — precisa ser um índice único, mesmo padrão do índice de "categories" lá
-- embaixo no arquivo (coalesce pro group_id nulo não colidir consigo mesmo).
create unique index if not exists companies_owner_group_nome_uniq
  on companies (owner_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid), nome);

-- Banco de uma Caixinha, mesma ideia de companies acima: nome distinto vira
-- uma linha aqui (find-or-create ao salvar a caixinha), com logo
-- reaproveitado por qualquer caixinha que use o mesmo banco — antes cada
-- caixinha guardava o próprio icone/icone_url, então duas caixinhas do
-- mesmo banco (ex.: uma do Matheus, uma da Beatriz, ambas "Nubank") não
-- tinham relação nenhuma entre si (bug relatado).
create table if not exists banks (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  nome text not null,
  logo_url text,
  criado_em timestamptz not null default now()
);
create unique index if not exists banks_owner_group_nome_uniq
  on banks (owner_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid), nome);

create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  group_id uuid references groups(id) on delete set null,
  responsavel_id uuid references profiles(id) on delete set null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  titulo text not null,
  empresa_servico text,
  categoria_id uuid references categories(id) on delete set null,
  tipo_despesa text not null default 'variavel' check (tipo_despesa in ('fixa', 'variavel')),
  valor numeric(12, 2) not null check (valor >= 0),
  data_cadastro date not null default current_date,
  data_vencimento date,
  data_pagamento date,
  recorrente boolean not null default false,
  observacoes text,
  comprovante_url text,
  criado_em timestamptz not null default now()
);
-- Observação: não existe coluna "status" — pago/pendente/a vencer/vencido é
-- calculado no cliente a partir de data_vencimento e data_pagamento
-- (ver js/utils/status.js), para não ter duas fontes de verdade divergentes.

-- Código de barras (boleto, 44 dígitos) ou conteúdo de QR code (Pix "copia e
-- cola" ou o link de uma nota fiscal/NFC-e) lidos ao cadastrar a despesa —
-- ver js/services/barcode.js::parseBoletoBarcode/parsePixQrPayload. Guardado
-- mesmo quando só dá pra extrair uma parte dos dados (ou nenhuma), pra
-- pessoa conseguir conferir a fatura original depois.
alter table transactions add column if not exists codigo_barras text;
alter table transactions add column if not exists qrcode_dados text;

-- Recorrência com cadência configurável + parcelas (2026-08-19). Antes
-- "recorrente" era só um booleano (sempre mensal, sem contagem de parcela).
-- recorrencia_tipo controla de quanto em quanto tempo gerarRecorrentesPendentes
-- (js/services/recurring.js) avança pra próxima ocorrência; 'personalizado'
-- usa recorrencia_intervalo_dias em vez de uma cadência fixa. parcela_atual/
-- parcela_total são independentes da cadência — cobrem tanto uma recorrência
-- com número de vezes limitado (ex.: financiamento 5/48) quanto uma despesa
-- lançada manualmente já no meio de uma série (ex.: importação de CSV
-- começando na parcela 5 de 10, sem que as 4 anteriores existam no app).
-- recorrencia_serie_id agrupa as ocorrências de uma mesma série de forma
-- confiável — antes gerarRecorrentesPendentes reconhecia a série só por
-- "título + categoria + tipo", o que colidia se a pessoa tivesse duas
-- despesas recorrentes homônimas.
alter table transactions add column if not exists recorrencia_tipo text
  check (recorrencia_tipo in ('semanal', 'mensal', 'anual', 'personalizado'));
alter table transactions add column if not exists recorrencia_intervalo_dias int;
-- Dia do mês (mensal) ou dia+mês do ano (anual) declarados explicitamente
-- pela pessoa (2026-08-20) — "todo dia 10" / "todo dia 10 de março".
-- gerarRecorrentesPendentes (js/services/recurring.js) prioriza esses
-- campos sobre simplesmente "empurrar a data anterior em 1 mês/ano" quando
-- presentes, então editar o dia aqui na ocorrência mais recente já
-- redireciona as próximas geradas, sem precisar mexer em nada mais.
alter table transactions add column if not exists recorrencia_dia_mes int check (recorrencia_dia_mes is null or (recorrencia_dia_mes between 1 and 31));
alter table transactions add column if not exists recorrencia_mes int check (recorrencia_mes is null or (recorrencia_mes between 1 and 12));
alter table transactions add column if not exists parcela_atual int check (parcela_atual is null or parcela_atual > 0);
alter table transactions add column if not exists parcela_total int check (parcela_total is null or parcela_total >= parcela_atual);
alter table transactions add column if not exists recorrencia_serie_id uuid;

-- Divisão de despesa entre múltiplos pagadores. Uma transação SEM nenhuma
-- linha aqui continua sendo 100% do responsavel_id dela (retrocompatível —
-- despesas antigas não precisam de migração). Linhas aqui só existem quando
-- há 2+ pagadores, e nesse caso substituem completamente responsavel_id pra
-- fins de "quem deve quanto" (ver js/services/transactions.js::shareForMember).
create table if not exists transaction_payers (
  id uuid primary key default uuid_generate_v4(),
  transaction_id uuid not null references transactions(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  percentual numeric(5, 2),
  valor numeric(12, 2) not null check (valor >= 0),
  criado_em timestamptz not null default now(),
  unique (transaction_id, profile_id)
);

-- Recursos (inventário doméstico): cômodo -> subcategoria (fixos, sem CRUD de
-- usuário — só os itens dentro deles são livres) -> item com quantidade e
-- validade opcional. Ver js/services/resources.js (DEFAULT_ROOMS/
-- DEFAULT_ROOM_CATEGORIES) pra lista completa seedada no primeiro acesso.
create table if not exists resource_rooms (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  nome text not null,
  icone text default 'bi-door-open',
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

create table if not exists resource_categories (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references resource_rooms(id) on delete cascade,
  nome text not null,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);

create table if not exists resource_items (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  room_id uuid not null references resource_rooms(id) on delete cascade,
  category_id uuid references resource_categories(id) on delete set null,
  nome text not null,
  quantidade int not null default 0 check (quantidade >= 0),
  data_validade date,
  foto_url text,
  criado_em timestamptz not null default now()
);

-- Ícone (Bootstrap Icons) pra ilustrar o item quando não há foto real —
-- usado pela importação de CSV de Recursos (não hotlinka foto nenhuma de
-- fora, ver importacao/recursos-essenciais.csv), mas também disponível pra
-- edição manual. Item sem icone E sem foto_url continua caindo no ícone
-- genérico de "adicionar foto" (comportamento de antes, sem mudança).
alter table resource_items add column if not exists icone text;

-- =========================================================
-- LIMPEZA DE CÔMODOS/SUBCATEGORIAS DUPLICADOS + ÍNDICES ÚNICOS
-- Mesmo problema que categories já teve (ver "LIMPEZA DE CATEGORIAS
-- DUPLICADAS" no fim deste arquivo): ensureDefaultRooms rodando duas vezes
-- em paralelo (dois acessos à tela de Recursos antes do primeiro terminar)
-- criava os cômodos padrão duplicados. Reaponta resource_categories e
-- resource_items dos duplicados pro "sobrevivente" antes de apagar, depois
-- cria os índices que impedem duplicar de novo. No-op depois da primeira
-- vez — seguro rodar sempre.
-- =========================================================

with ranked as (
  select id, owner_id, nome,
         coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid) as gkey,
         row_number() over (
           partition by owner_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid), nome
           order by criado_em
         ) as rn
  from resource_rooms
),
keeper_map as (
  select d.id as dup_id, k.id as keeper_id
  from ranked d
  join ranked k on k.owner_id = d.owner_id and k.gkey = d.gkey and k.nome = d.nome and k.rn = 1
  where d.rn > 1
)
update resource_categories c set room_id = km.keeper_id
from keeper_map km where c.room_id = km.dup_id;

with ranked as (
  select id, owner_id, nome,
         coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid) as gkey,
         row_number() over (
           partition by owner_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid), nome
           order by criado_em
         ) as rn
  from resource_rooms
),
keeper_map as (
  select d.id as dup_id, k.id as keeper_id
  from ranked d
  join ranked k on k.owner_id = d.owner_id and k.gkey = d.gkey and k.nome = d.nome and k.rn = 1
  where d.rn > 1
)
update resource_items i set room_id = km.keeper_id
from keeper_map km where i.room_id = km.dup_id;

with ranked as (
  select id,
         row_number() over (
           partition by owner_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid), nome
           order by criado_em
         ) as rn
  from resource_rooms
)
delete from resource_rooms r using ranked rk
where r.id = rk.id and rk.rn > 1;

create unique index if not exists resource_rooms_owner_group_nome_uniq
  on resource_rooms (owner_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid), nome);

-- Mesma lógica pras subcategorias dentro de cada cômodo (já únicos a essa altura)
with ranked as (
  select id, room_id, nome,
         row_number() over (partition by room_id, nome order by criado_em) as rn
  from resource_categories
),
keeper_map as (
  select d.id as dup_id, k.id as keeper_id
  from ranked d
  join ranked k on k.room_id = d.room_id and k.nome = d.nome and k.rn = 1
  where d.rn > 1
)
update resource_items i set category_id = km.keeper_id
from keeper_map km where i.category_id = km.dup_id;

with ranked as (
  select id,
         row_number() over (partition by room_id, nome order by criado_em) as rn
  from resource_categories
)
delete from resource_categories c using ranked rk
where c.id = rk.id and rk.rn > 1;

create unique index if not exists resource_categories_room_nome_uniq
  on resource_categories (room_id, nome);

-- =========================================================
-- CAIXINHAS: dinheiro guardado em bancos/corretoras (2026-08-19)
-- Mesma apresentação de Recursos (grade de "cômodos", aqui cada tile é um
-- banco), mas os valores guardado/retirado NUNCA são colunas próprias —
-- são sempre derivados da soma de caixinha_movimentacoes (mesmo princípio
-- de "status não é coluna" já usado em transactions/resource_items, ver
-- js/utils/status.js): a caixinha guarda só a config (banco, moeda, meta),
-- o histórico de aportes/retiradas é a fonte de verdade de quanto tem nela.
-- =========================================================

create table if not exists caixinhas (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  group_id uuid references groups(id) on delete set null,
  banco_nome text not null,
  moeda text not null default 'BRL',
  meta numeric(12, 2) check (meta is null or meta > 0),
  icone text not null default 'bi-piggy-bank',
  criado_em timestamptz not null default now()
);

-- Ícone por upload de imagem OU URL colada pela própria pessoa (nunca
-- adivinhada) — mesmo padrão de categories.icone_url. Com valor, vence o
-- ícone de preset (icone) na hora de renderizar.
alter table caixinhas add column if not exists icone_url text;

create table if not exists caixinha_movimentacoes (
  id uuid primary key default uuid_generate_v4(),
  caixinha_id uuid not null references caixinhas(id) on delete cascade,
  tipo text not null check (tipo in ('guardado', 'retirado')),
  valor numeric(12, 2) not null check (valor > 0),
  data date not null default current_date,
  observacoes text,
  criado_em timestamptz not null default now()
);

create table if not exists shopping_lists (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  group_id uuid references groups(id) on delete set null,
  nome text not null default 'Lista de Compras',
  status text not null default 'planejando' check (status in ('planejando', 'comprando', 'pausada', 'finalizada')),
  criado_em timestamptz not null default now(),
  iniciado_em timestamptz,
  finalizado_em timestamptz,
  transacao_id uuid references transactions(id) on delete set null
);
-- Mercado (pra aparecer no histórico) e limite de gasto — os dois opcionais,
-- editáveis a qualquer momento pela tela (ver js/components/shoppingList.js).
-- Sem tabela de preferência separada pra "limite padrão": a lista nova
-- simplesmente herda o limite da lista anterior mais recente (ver
-- getOrCreateActiveList em js/services/shoppingList.js), que já dá o efeito
-- de "lembrar o de sempre" sem precisar de mais uma tabela.
alter table shopping_lists add column if not exists nome_mercado text;
alter table shopping_lists add column if not exists limite_gasto numeric(12, 2);

create table if not exists shopping_list_items (
  id uuid primary key default uuid_generate_v4(),
  list_id uuid not null references shopping_lists(id) on delete cascade,
  nome text not null,
  categoria_id uuid references categories(id) on delete set null,
  unidade text not null default 'un' check (unidade in ('un', 'kg', 'g', 'l', 'ml')),
  quantidade numeric(10, 3) default 1,
  prioridade int not null default 3 check (prioridade between 1 and 5),
  preco_unitario numeric(12, 2),
  preco_por_kg numeric(12, 2),
  subtotal numeric(12, 2) default 0,
  comprado boolean not null default false,
  codigo_barras text,
  data_validade date,
  foto_url text,
  criado_em timestamptz not null default now()
);
-- "create table if not exists" não roda em quem já tem a tabela — coluna
-- nova em conta existente precisa deste alter (idempotente, seguro repetir).
alter table shopping_list_items add column if not exists prioridade int not null default 3;
alter table shopping_list_items add column if not exists data_validade date;
-- Mesma razão: quem já tem a tabela ficou com o check antigo (só
-- 'un'/'kg'/'g') — recriar o constraint idempotente adiciona 'l'/'ml' sem
-- precisar apagar a tabela. Nome do constraint é o padrão que o Postgres já
-- dava sozinho pra um "check" inline sem nome explícito.
alter table shopping_list_items drop constraint if exists shopping_list_items_unidade_check;
alter table shopping_list_items add constraint shopping_list_items_unidade_check check (unidade in ('un', 'kg', 'g', 'l', 'ml'));

-- Notificações dentro do app (sino no topo). dedupe_key evita duplicar a
-- mesma notificação a cada varredura (cliente, ver js/services/
-- notifications.js, ou a Edge Function notify-scan) — ex.:
-- "vencimento_despesa:{transacao_id}:2026-08-18" só entra uma vez por dia
-- por transação/perfil.
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  tipo text not null check (tipo in ('validade', 'estoque', 'vencimento_despesa', 'pagamento')),
  titulo text not null,
  corpo text,
  referencia_tabela text,
  referencia_id uuid,
  dedupe_key text not null,
  lida boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (profile_id, dedupe_key)
);

-- Inscrições de push (Web Push API) — uma linha por navegador/dispositivo
-- inscrito. Preenchida pelo client em js/services/push.js, consumida pelas
-- Edge Functions notify-scan e notify-payment.
create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  criado_em timestamptz not null default now()
);

-- =========================================================
-- CRIA O PERFIL AUTOMATICAMENTE QUANDO ALGUÉM SE CADASTRA
-- (js/services/auth.js envia o nome em options.data.nome no signUp)
-- =========================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================
-- FUNÇÃO AUXILIAR PARA AS POLÍTICAS DE RLS
-- (security definer evita o erro clássico de "recursão infinita" que
-- acontece quando uma policy de group_members consulta a própria tabela)
-- =========================================================

create or replace function public.is_group_member(gid uuid)
returns boolean as $$
  select exists (
    select 1 from group_members
    where group_id = gid and profile_id = auth.uid()
  );
$$ language sql security definer stable;

-- eh_colega_de_grupo() existiu aqui numa tentativa anterior de resolver a
-- notificação de pagamento via policy de INSERT cross-usuário — removida:
-- ver "NOTIFICAR O GRUPO QUANDO UMA DESPESA É PAGA" mais abaixo pelo
-- caminho que substituiu ela (trigger security definer, sem depender de
-- RLS de notifications aceitar insert pra outro profile_id).
drop function if exists public.eh_colega_de_grupo(uuid, uuid);

-- =========================================================
-- CRIAR/ENTRAR EM GRUPO
-- (js/services/groups.js chama estas duas via supabase.rpc(...) em vez de
-- fazer insert direto. Motivo: "criar grupo" precisa inserir em groups E em
-- group_members numa única operação — se fossem dois inserts separados pelo
-- cliente, o Postgres bloquearia o RETURNING do primeiro insert porque quem
-- está criando ainda não é membro do grupo no instante em que a linha é
-- lida de volta. E "entrar por código" precisa localizar o grupo pelo
-- código ANTES de ser membro dele, o que nenhuma policy de SELECT razoável
-- permite passar em aberto. security definer resolve as duas coisas de uma
-- vez: a função roda com privilégio para ver/inserir livremente, e só usa
-- auth.uid() para saber quem está chamando.)
-- =========================================================

create or replace function public.create_group(p_nome text)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group groups;
  v_codigo text;
begin
  -- md5(random()) em vez de uuid_generate_v4(): a extensão uuid-ossp mora no
  -- schema "extensions" na Supabase, não em "public" — com "set search_path
  -- = public" acima, uuid_generate_v4() sem qualificar o schema não resolve
  -- ("function uuid_generate_v4() does not exist"). md5()/random() são
  -- funções nativas do Postgres, sempre resolvem.
  v_codigo := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  insert into groups (nome, codigo, criado_por)
  values (p_nome, v_codigo, auth.uid())
  returning * into v_group;

  insert into group_members (group_id, profile_id, papel)
  values (v_group.id, auth.uid(), 'admin');

  return v_group;
end;
$$;

create or replace function public.join_group_by_code(p_codigo text)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group groups;
begin
  select * into v_group from groups where codigo = upper(p_codigo);
  if not found then
    raise exception 'Código de grupo não encontrado.';
  end if;

  insert into group_members (group_id, profile_id, papel)
  values (v_group.id, auth.uid(), 'membro')
  on conflict do nothing;

  return v_group;
end;
$$;

grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group_by_code(text) to authenticated;

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================

-- Todas as policies abaixo são precedidas de "drop policy if exists" de
-- propósito: isso torna o arquivo inteiro seguro pra rodar de novo sempre
-- que ele mudar (nunca dá erro de "policy already exists" — só substitui
-- pela versão nova). Tabelas ("create table if not exists"), extensão,
-- função ("create or replace") e trigger ("drop ... if exists" antes)
-- já eram seguros de re-rodar; só faltava isso nas policies.

alter table profiles enable row level security;
drop policy if exists "Ver o próprio perfil e perfis do meu grupo" on profiles;
create policy "Ver o próprio perfil e perfis do meu grupo" on profiles for select
  using (id = auth.uid() or id in (
    select gm2.profile_id from group_members gm1
    join group_members gm2 on gm2.group_id = gm1.group_id
    where gm1.profile_id = auth.uid()
  ));
drop policy if exists "Atualizar o próprio perfil" on profiles;
create policy "Atualizar o próprio perfil" on profiles for update
  using (id = auth.uid());

alter table groups enable row level security;
-- create_group()/join_group_by_code() acima já bypassam RLS (são security
-- definer), então estas policies só importam pra alguém consultar a tabela
-- diretamente depois — mas "or criado_por = auth.uid()" continua correto:
-- o criador de um grupo deve sempre conseguir vê-lo.
drop policy if exists "Ver grupos dos quais participo" on groups;
create policy "Ver grupos dos quais participo" on groups for select
  using (public.is_group_member(id) or criado_por = auth.uid());
drop policy if exists "Admin exclui o grupo" on groups;
create policy "Admin exclui o grupo" on groups for delete
  using (id in (select group_id from group_members where profile_id = auth.uid() and papel = 'admin'));
drop policy if exists "Criar grupo" on groups;
create policy "Criar grupo" on groups for insert
  with check (criado_por = auth.uid());
drop policy if exists "Admin atualiza o grupo" on groups;
create policy "Admin atualiza o grupo" on groups for update
  using (id in (select group_id from group_members where profile_id = auth.uid() and papel = 'admin'));

alter table group_members enable row level security;
drop policy if exists "Ver membros do meu grupo" on group_members;
create policy "Ver membros do meu grupo" on group_members for select
  using (public.is_group_member(group_id));
drop policy if exists "Entrar em um grupo" on group_members;
create policy "Entrar em um grupo" on group_members for insert
  with check (profile_id = auth.uid());
drop policy if exists "Sair do grupo" on group_members;
create policy "Sair do grupo" on group_members for delete
  using (profile_id = auth.uid());

alter table categories enable row level security;
drop policy if exists "Ver categorias próprias ou do grupo" on categories;
create policy "Ver categorias próprias ou do grupo" on categories for select
  using (owner_id = auth.uid() or public.is_group_member(group_id));
drop policy if exists "Criar categoria" on categories;
create policy "Criar categoria" on categories for insert
  with check (owner_id = auth.uid());
-- Editar/excluir: dono sempre pode. Uma categoria DE GRUPO (group_id não
-- nulo) também pode ser editada/excluída por QUALQUER membro do grupo, não
-- só por quem criou — ela é um recurso do grupo, não pessoal de quem
-- clicou primeiro em "criar categoria padrão" (ver 2026-08-20: o índice
-- único de categoria de grupo passou a ser por grupo, não por dono+grupo;
-- RLS precisa acompanhar essa mudança de modelo, senão o "dono" vencedor
-- do merge de duplicatas vira o único que consegue mexer nela).
drop policy if exists "Editar/excluir categoria própria" on categories;
drop policy if exists "Editar categoria própria ou do grupo" on categories;
create policy "Editar categoria própria ou do grupo" on categories for update
  using (owner_id = auth.uid() or (group_id is not null and public.is_group_member(group_id)));
drop policy if exists "Excluir categoria própria" on categories;
drop policy if exists "Excluir categoria própria ou do grupo" on categories;
create policy "Excluir categoria própria ou do grupo" on categories for delete
  using (owner_id = auth.uid() or (group_id is not null and public.is_group_member(group_id)));

alter table category_budgets enable row level security;
drop policy if exists "Gerenciar os próprios orçamentos" on category_budgets;
create policy "Gerenciar os próprios orçamentos" on category_budgets for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

alter table companies enable row level security;
drop policy if exists "Ver empresas próprias ou do grupo" on companies;
create policy "Ver empresas próprias ou do grupo" on companies for select
  using (owner_id = auth.uid() or public.is_group_member(group_id));
drop policy if exists "Criar empresa" on companies;
create policy "Criar empresa" on companies for insert
  with check (owner_id = auth.uid());
drop policy if exists "Editar/excluir empresa própria" on companies;
create policy "Editar/excluir empresa própria" on companies for update
  using (owner_id = auth.uid());
drop policy if exists "Excluir empresa própria" on companies;
create policy "Excluir empresa própria" on companies for delete
  using (owner_id = auth.uid());

alter table banks enable row level security;
drop policy if exists "Ver bancos próprios ou do grupo" on banks;
create policy "Ver bancos próprios ou do grupo" on banks for select
  using (owner_id = auth.uid() or public.is_group_member(group_id));
drop policy if exists "Criar banco" on banks;
create policy "Criar banco" on banks for insert
  with check (owner_id = auth.uid());
drop policy if exists "Editar banco próprio" on banks;
create policy "Editar banco próprio" on banks for update
  using (owner_id = auth.uid());
drop policy if exists "Excluir banco próprio" on banks;
create policy "Excluir banco próprio" on banks for delete
  using (owner_id = auth.uid());

-- with check só em "owner_id = auth.uid()" (sem o "or is_group_member")
-- parecia certo mas quebrava todo UPDATE entre membros do grupo: with check
-- valida a linha DEPOIS da alteração, e um UPDATE que não mexe em owner_id
-- mantém o owner_id de quem criou — então quando um membro editava/marcava
-- como paga uma despesa do OUTRO (o uso normal de "grupo"), o Postgres
-- rejeitava com "new row violates row-level security policy" mesmo a
-- pessoa podendo ENXERGAR a linha (using já permitia). DELETE não usa with
-- check, só INSERT/UPDATE — por isso excluir sempre funcionou mas editar
-- não. Repetido no mesmo padrão em resource_rooms/resource_items/
-- shopping_lists logo abaixo.
alter table transactions enable row level security;
drop policy if exists "Ver e editar transações próprias ou do grupo" on transactions;
create policy "Ver e editar transações próprias ou do grupo" on transactions for all
  using (owner_id = auth.uid() or public.is_group_member(group_id))
  with check (owner_id = auth.uid() or public.is_group_member(group_id));

alter table transaction_payers enable row level security;
drop policy if exists "Ver e editar pagadores de transações visíveis" on transaction_payers;
create policy "Ver e editar pagadores de transações visíveis" on transaction_payers for all
  using (transaction_id in (
    select id from transactions where owner_id = auth.uid() or public.is_group_member(group_id)
  ))
  with check (transaction_id in (
    select id from transactions where owner_id = auth.uid() or public.is_group_member(group_id)
  ));

alter table resource_rooms enable row level security;
drop policy if exists "Ver e editar cômodos próprios ou do grupo" on resource_rooms;
create policy "Ver e editar cômodos próprios ou do grupo" on resource_rooms for all
  using (owner_id = auth.uid() or public.is_group_member(group_id))
  with check (owner_id = auth.uid() or public.is_group_member(group_id));

alter table resource_categories enable row level security;
drop policy if exists "Ver e editar subcategorias de cômodos visíveis" on resource_categories;
create policy "Ver e editar subcategorias de cômodos visíveis" on resource_categories for all
  using (room_id in (
    select id from resource_rooms where owner_id = auth.uid() or public.is_group_member(group_id)
  ))
  with check (room_id in (
    select id from resource_rooms where owner_id = auth.uid() or public.is_group_member(group_id)
  ));

alter table resource_items enable row level security;
drop policy if exists "Ver e editar itens próprios ou do grupo" on resource_items;
create policy "Ver e editar itens próprios ou do grupo" on resource_items for all
  using (owner_id = auth.uid() or public.is_group_member(group_id))
  with check (owner_id = auth.uid() or public.is_group_member(group_id));

alter table caixinhas enable row level security;
drop policy if exists "Ver e editar caixinhas próprias ou do grupo" on caixinhas;
create policy "Ver e editar caixinhas próprias ou do grupo" on caixinhas for all
  using (owner_id = auth.uid() or public.is_group_member(group_id))
  with check (owner_id = auth.uid() or public.is_group_member(group_id));

alter table caixinha_movimentacoes enable row level security;
drop policy if exists "Ver e editar movimentações de caixinhas visíveis" on caixinha_movimentacoes;
create policy "Ver e editar movimentações de caixinhas visíveis" on caixinha_movimentacoes for all
  using (caixinha_id in (
    select id from caixinhas where owner_id = auth.uid() or public.is_group_member(group_id)
  ))
  with check (caixinha_id in (
    select id from caixinhas where owner_id = auth.uid() or public.is_group_member(group_id)
  ));

alter table notifications enable row level security;
drop policy if exists "Ver as próprias notificações" on notifications;
create policy "Ver as próprias notificações" on notifications for select
  using (profile_id = auth.uid());
drop policy if exists "Marcar a própria notificação como lida" on notifications;
create policy "Marcar a própria notificação como lida" on notifications for update
  using (profile_id = auth.uid());
drop policy if exists "Criar notificação para si ou colega de grupo" on notifications;
drop policy if exists "Criar a própria notificação" on notifications;
-- Só a própria — de propósito, bem mais estrito do que antes. Notificar o
-- COLEGA de pagamento não passa mais por aqui: é o trigger
-- notificar_pagamento_para_grupo() (logo abaixo) que grava isso, rodando
-- como security definer (ignora RLS por completo). Depender de o CLIENTE
-- inserir direto pro profile_id de outra pessoa, sob RLS normal, se provou
-- fragil na prática (ver comentário do trigger) — então o client
-- (js/services/notifications.js::notifyPayment) só usa esse caminho em modo
-- demo (mockDb, sem RLS nenhuma); em modo real não escreve mais nada aqui.
create policy "Criar a própria notificação" on notifications for insert
  with check (profile_id = auth.uid());
drop policy if exists "Excluir a própria notificação" on notifications;
create policy "Excluir a própria notificação" on notifications for delete
  using (profile_id = auth.uid());

-- =========================================================
-- NOTIFICAR O GRUPO QUANDO UMA DESPESA É PAGA (direto no banco)
--
-- Substitui o antigo caminho de "o cliente insere a notificação direto pro
-- profile_id do colega, sob RLS normal": em teste real (sessão real,
-- role authenticated, RLS valendo de verdade) isso continuava caindo em
-- "new row violates row-level security policy" mesmo com a policy e os
-- dados de grupo corretos — a suspeita é a subquery de group_members
-- dentro da policy ficar sujeita à RLS da PRÓPRIA group_members outra vez,
-- de um jeito que não reproduz rodando como postgres/superuser no SQL
-- Editor (que ignora RLS). Em vez de continuar caçando a causa exata
-- desse comportamento, a notificação pro colega passa a ser gravada por
-- um TRIGGER security definer — ignora RLS de propósito, roda sempre,
-- sem depender de nenhuma policy cross-usuário. Só dispara pra despesa
-- com grupo (group_id not null); sem grupo não tem quem notificar.
-- =========================================================

create or replace function public.notificar_pagamento_para_grupo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (profile_id, tipo, titulo, corpo, referencia_tabela, referencia_id, dedupe_key, lida)
  select
    gm.profile_id,
    'pagamento',
    '"' || new.titulo || '" foi paga',
    'R$ ' || to_char(new.valor, 'FM999999990.00'),
    'transactions',
    new.id,
    'pagamento:' || new.id || ':' || new.data_pagamento::text,
    false
  from group_members gm
  where gm.group_id = new.group_id
    and gm.profile_id <> auth.uid()
  on conflict (profile_id, dedupe_key) do nothing;
  return new;
end;
$$;

drop trigger if exists notificar_pagamento_trigger on transactions;
create trigger notificar_pagamento_trigger
  after update on transactions
  for each row
  when (new.data_pagamento is not null and old.data_pagamento is null and new.group_id is not null)
  execute function public.notificar_pagamento_para_grupo();

alter table push_subscriptions enable row level security;
drop policy if exists "Gerenciar a própria inscrição de push" on push_subscriptions;
create policy "Gerenciar a própria inscrição de push" on push_subscriptions for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

alter table shopping_lists enable row level security;
drop policy if exists "Ver e editar listas próprias ou do grupo" on shopping_lists;
create policy "Ver e editar listas próprias ou do grupo" on shopping_lists for all
  using (owner_id = auth.uid() or public.is_group_member(group_id))
  with check (owner_id = auth.uid() or public.is_group_member(group_id));

alter table shopping_list_items enable row level security;
drop policy if exists "Ver e editar itens de listas próprias ou do grupo" on shopping_list_items;
create policy "Ver e editar itens de listas próprias ou do grupo" on shopping_list_items for all
  using (list_id in (
    select id from shopping_lists where owner_id = auth.uid() or public.is_group_member(group_id)
  ))
  with check (list_id in (
    select id from shopping_lists where owner_id = auth.uid() or public.is_group_member(group_id)
  ));

-- =========================================================
-- STORAGE (fotos de comprovantes de transações)
-- Cria o bucket direto por SQL (storage.buckets é uma tabela normal) — a
-- versão anterior deste arquivo assumia que o bucket já existia "criado via
-- API com a service_role key do seu .env", o que nunca foi verdade neste
-- projeto: só as policies existiam, sem o bucket por trás, e é por isso que
-- TODO upload de foto (avatar, ícone de categoria, logo de empresa, foto de
-- item de Recursos, comprovante) falhava silenciosamente. Rodar este bloco
-- resolve os cinco de uma vez, já que todos menos "anexos" reaproveitam o
-- bucket "avatars" (ver comentário mais abaixo).
-- Privado (ao contrário de "avatars"): comprovante é documento financeiro,
-- só o dono deve conseguir ler — por isso o app pede uma signed URL pra
-- exibir/baixar em vez de guardar uma URL pública fixa.
-- =========================================================

insert into storage.buckets (id, name, public)
values ('anexos', 'anexos', false)
on conflict (id) do nothing;

drop policy if exists "Upload de anexos do próprio usuário" on storage.objects;
create policy "Upload de anexos do próprio usuário"
  on storage.objects for insert
  with check (bucket_id = 'anexos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Leitura de anexos do próprio usuário" on storage.objects;
create policy "Leitura de anexos do próprio usuário"
  on storage.objects for select
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Exclusão de anexos do próprio usuário" on storage.objects;
create policy "Exclusão de anexos do próprio usuário"
  on storage.objects for delete
  using (bucket_id = 'anexos' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================
-- STORAGE (foto de perfil — e, por reaproveitamento do mesmo bucket público,
-- também ícone de categoria, logo de empresa/serviço e foto de item de
-- Recursos: todos usam uploadCategoryIcon/uploadCompanyLogo/uploadItemPhoto,
-- que sobem pra "avatars" na pasta do usuário em vez de criar um bucket por
-- funcionalidade — ver comentário em js/services/categories.js).
-- =========================================================

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar é público pra leitura" on storage.objects;
create policy "Avatar é público pra leitura" on storage.objects for select
  using (bucket_id = 'avatars');

drop policy if exists "Usuário sobe o próprio avatar" on storage.objects;
create policy "Usuário sobe o próprio avatar" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Usuário atualiza o próprio avatar" on storage.objects;
create policy "Usuário atualiza o próprio avatar" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Usuário remove o próprio avatar" on storage.objects;
create policy "Usuário remove o próprio avatar" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- =========================================================
-- LIMPEZA DE CATEGORIAS DUPLICADAS + ÍNDICE ÚNICO
-- Categorias duplicadas apareciam por uma corrida de dois logins simultâneos
-- criando as categorias padrão ao mesmo tempo (já corrigido no app). Isto
-- aqui limpa o que já duplicou (reapontando lançamentos/itens de lista pra
-- categoria "sobrevivente") e cria o índice que impede duplicar de novo.
-- Fica no fim do arquivo (não logo após "create table categories") porque
-- precisa que "transactions" e "shopping_list_items" já existam. Depois da
-- primeira limpeza isto vira um no-op — seguro de rodar toda vez.
-- =========================================================

with ranked as (
  select id, owner_id, nome,
         coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid) as gkey,
         row_number() over (
           partition by owner_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid), nome
           order by criado_em
         ) as rn
  from categories
),
keeper_map as (
  select d.id as dup_id, k.id as keeper_id
  from ranked d
  join ranked k on k.owner_id = d.owner_id and k.gkey = d.gkey and k.nome = d.nome and k.rn = 1
  where d.rn > 1
)
update transactions t set categoria_id = km.keeper_id
from keeper_map km where t.categoria_id = km.dup_id;

with ranked as (
  select id, owner_id, nome,
         coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid) as gkey,
         row_number() over (
           partition by owner_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid), nome
           order by criado_em
         ) as rn
  from categories
),
keeper_map as (
  select d.id as dup_id, k.id as keeper_id
  from ranked d
  join ranked k on k.owner_id = d.owner_id and k.gkey = d.gkey and k.nome = d.nome and k.rn = 1
  where d.rn > 1
)
update shopping_list_items i set categoria_id = km.keeper_id
from keeper_map km where i.categoria_id = km.dup_id;

with ranked as (
  select id,
         row_number() over (
           partition by owner_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid), nome
           order by criado_em
         ) as rn
  from categories
)
delete from categories c using ranked r
where c.id = r.id and r.rn > 1;

-- Índice de expressão (não uma unique constraint comum) porque NULL nunca é
-- igual a NULL: sem o coalesce, duas categorias pessoais (group_id nulo) com
-- o mesmo nome não seriam pegas como duplicata pelo Postgres.
create unique index if not exists categories_owner_group_nome_uniq
  on categories (owner_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid), nome);

-- =========================================================
-- CATEGORIAS DUPLICADAS POR MAIÚSCULA/ESPAÇO (2026-08-19)
-- O índice acima compara o texto LITERAL de "nome" — "Casa", "casa" e
-- "Casa " (espaço sobrando) não colidem entre si pra ele, mesmo o app
-- (ensureDefaultCategories, guessCategoryByTitle) já tratando os três como
-- a MESMA categoria ao comparar (case-insensitive + trim). Essa divergência
-- entre "o que o índice barra" e "o que o app considera duplicata" é a causa
-- real de categorias duplicadas continuarem aparecendo mesmo com o índice
-- de cima no ar. Troca pra um índice de expressão sobre lower(btrim(nome)),
-- que passa a ser a mesma régua usada no app — e limpa antes o que já
-- duplicou por essa via (mesmo padrão de reapontar/apagar usado acima,
-- agora particionando pelo nome NORMALIZADO em vez do literal).
-- =========================================================

with ranked as (
  select id, owner_id,
         coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid) as gkey,
         lower(btrim(nome)) as nome_norm,
         row_number() over (
           partition by owner_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(nome))
           order by criado_em
         ) as rn
  from categories
),
keeper_map as (
  select d.id as dup_id, k.id as keeper_id
  from ranked d
  join ranked k on k.owner_id = d.owner_id and k.gkey = d.gkey and k.nome_norm = d.nome_norm and k.rn = 1
  where d.rn > 1
)
update transactions t set categoria_id = km.keeper_id
from keeper_map km where t.categoria_id = km.dup_id;

with ranked as (
  select id, owner_id,
         coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid) as gkey,
         lower(btrim(nome)) as nome_norm,
         row_number() over (
           partition by owner_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(nome))
           order by criado_em
         ) as rn
  from categories
),
keeper_map as (
  select d.id as dup_id, k.id as keeper_id
  from ranked d
  join ranked k on k.owner_id = d.owner_id and k.gkey = d.gkey and k.nome_norm = d.nome_norm and k.rn = 1
  where d.rn > 1
)
update shopping_list_items i set categoria_id = km.keeper_id
from keeper_map km where i.categoria_id = km.dup_id;

with ranked as (
  select id,
         row_number() over (
           partition by owner_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(nome))
           order by criado_em
         ) as rn
  from categories
)
delete from categories c using ranked r
where c.id = r.id and r.rn > 1;

drop index if exists categories_owner_group_nome_uniq;
create unique index if not exists categories_owner_group_nome_norm_uniq
  on categories (owner_id, coalesce(group_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(btrim(nome)));

-- =========================================================
-- CATEGORIA DE GRUPO: única por GRUPO, não por dono+grupo (2026-08-20)
-- O índice acima (e o modelo até aqui) só impedia UM dono de duplicar a
-- própria categoria — nunca impediu dois MEMBROS DIFERENTES do mesmo grupo
-- de criarem, cada um, a própria versão de "Delivery"/"Saúde"/etc., porque
-- owner_id sempre entrava na chave de unicidade. Na prática: cada pessoa
-- loga, ensureDefaultCategories roda pra ela, e sem ver a categoria da
-- OUTRA pessoa como "sua" (mesmo nome, mesmo grupo, dono diferente), cria a
-- própria — daí a mesma categoria aparecendo duas vezes pra qualquer membro
-- do grupo. Correção real: categoria de grupo passa a ser única pelo par
-- (group_id, nome normalizado), point final, dono nenhum entra na conta.
-- Categoria pessoal (group_id nulo) continua única só por dono, como
-- sempre foi — não faz sentido impedir duas pessoas de terem cada uma sua
-- categoria pessoal "Mercado".
-- =========================================================

-- Limpeza: junta duplicatas de categoria de GRUPO que já existem (mesmo
-- group_id, mesmo nome normalizado, donos diferentes) — reaponta
-- transações e itens de lista de compras pro "sobrevivente" (o mais
-- antigo) antes de apagar os outros. category_budgets não precisa de
-- reaponte manual: a FK dela pra categories já é "on delete cascade".
with ranked as (
  select id, group_id,
         lower(btrim(nome)) as nome_norm,
         row_number() over (partition by group_id, lower(btrim(nome)) order by criado_em) as rn
  from categories
  where group_id is not null
),
keeper_map as (
  select d.id as dup_id, k.id as keeper_id
  from ranked d
  join ranked k on k.group_id = d.group_id and k.nome_norm = d.nome_norm and k.rn = 1
  where d.rn > 1
)
update transactions t set categoria_id = km.keeper_id
from keeper_map km where t.categoria_id = km.dup_id;

with ranked as (
  select id, group_id,
         lower(btrim(nome)) as nome_norm,
         row_number() over (partition by group_id, lower(btrim(nome)) order by criado_em) as rn
  from categories
  where group_id is not null
),
keeper_map as (
  select d.id as dup_id, k.id as keeper_id
  from ranked d
  join ranked k on k.group_id = d.group_id and k.nome_norm = d.nome_norm and k.rn = 1
  where d.rn > 1
)
update shopping_list_items i set categoria_id = km.keeper_id
from keeper_map km where i.categoria_id = km.dup_id;

with ranked as (
  select id, group_id,
         row_number() over (partition by group_id, lower(btrim(nome)) order by criado_em) as rn
  from categories
  where group_id is not null
)
delete from categories c using ranked r
where c.id = r.id and r.rn > 1;

-- Categorias com nome CORROMPIDO (encoding errado numa importação de CSV
-- antiga — ver correção em js/services/csvImport.js) que sobraram sem
-- nenhuma duplicata "normal" pra esse merge pegar: têm um caractere de
-- substituição unicode (U+FFFD) no nome, o que nunca é um nome de
-- categoria legítimo. Reaponta o que usa elas pra uma categoria "Outro" do
-- mesmo escopo (cria se não existir) antes de apagar, em vez de simplesmente
-- destruir a categorização de quem usava.
do $$
declare
  corrompida record;
  destino uuid;
begin
  for corrompida in select id, owner_id, group_id from categories where nome like '%' || chr(65533) || '%' loop
    select id into destino from categories
      where lower(btrim(nome)) = 'outro'
        and (owner_id = corrompida.owner_id or coalesce(group_id, corrompida.group_id) = corrompida.group_id)
      limit 1;
    if destino is null then
      insert into categories (nome, cor, icone, owner_id, group_id)
        values ('Outro', '#64748B', 'bi-three-dots', corrompida.owner_id, corrompida.group_id)
        returning id into destino;
    end if;
    update transactions set categoria_id = destino where categoria_id = corrompida.id;
    update shopping_list_items set categoria_id = destino where categoria_id = corrompida.id;
    delete from categories where id = corrompida.id;
  end loop;
end $$;

drop index if exists categories_owner_group_nome_norm_uniq;

-- Pessoal (group_id nulo): única por dono.
create unique index if not exists categories_pessoal_nome_uniq
  on categories (owner_id, lower(btrim(nome)))
  where group_id is null;

-- De grupo: única pro grupo inteiro, independente de quem criou.
create unique index if not exists categories_grupo_nome_uniq
  on categories (group_id, lower(btrim(nome)))
  where group_id is not null;
