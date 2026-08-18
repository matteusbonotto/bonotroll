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

create table if not exists shopping_list_items (
  id uuid primary key default uuid_generate_v4(),
  list_id uuid not null references shopping_lists(id) on delete cascade,
  nome text not null,
  categoria_id uuid references categories(id) on delete set null,
  unidade text not null default 'un' check (unidade in ('un', 'kg', 'g')),
  quantidade numeric(10, 3) default 1,
  preco_unitario numeric(12, 2),
  preco_por_kg numeric(12, 2),
  subtotal numeric(12, 2) default 0,
  comprado boolean not null default false,
  codigo_barras text,
  foto_url text,
  criado_em timestamptz not null default now()
);

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
drop policy if exists "Editar/excluir categoria própria" on categories;
create policy "Editar/excluir categoria própria" on categories for update
  using (owner_id = auth.uid());
drop policy if exists "Excluir categoria própria" on categories;
create policy "Excluir categoria própria" on categories for delete
  using (owner_id = auth.uid());

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

alter table transactions enable row level security;
drop policy if exists "Ver e editar transações próprias ou do grupo" on transactions;
create policy "Ver e editar transações próprias ou do grupo" on transactions for all
  using (owner_id = auth.uid() or public.is_group_member(group_id))
  with check (owner_id = auth.uid());

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
  with check (owner_id = auth.uid());

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
  with check (owner_id = auth.uid());

alter table notifications enable row level security;
drop policy if exists "Ver as próprias notificações" on notifications;
create policy "Ver as próprias notificações" on notifications for select
  using (profile_id = auth.uid());
drop policy if exists "Marcar a própria notificação como lida" on notifications;
create policy "Marcar a própria notificação como lida" on notifications for update
  using (profile_id = auth.uid());
drop policy if exists "Criar notificação para si ou colega de grupo" on notifications;
-- "colega de grupo" existe porque quem MARCA uma despesa como paga (ver
-- notifyPayment em js/services/notifications.js) insere a notificação já
-- direto pro profile_id do OUTRO membro, não pro próprio — mesma
-- necessidade que já existia na policy de SELECT de "profiles" acima.
create policy "Criar notificação para si ou colega de grupo" on notifications for insert
  with check (
    profile_id = auth.uid()
    or profile_id in (
      select gm2.profile_id from group_members gm1
      join group_members gm2 on gm2.group_id = gm1.group_id
      where gm1.profile_id = auth.uid()
    )
  );
drop policy if exists "Excluir a própria notificação" on notifications;
create policy "Excluir a própria notificação" on notifications for delete
  using (profile_id = auth.uid());

alter table push_subscriptions enable row level security;
drop policy if exists "Gerenciar a própria inscrição de push" on push_subscriptions;
create policy "Gerenciar a própria inscrição de push" on push_subscriptions for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

alter table shopping_lists enable row level security;
drop policy if exists "Ver e editar listas próprias ou do grupo" on shopping_lists;
create policy "Ver e editar listas próprias ou do grupo" on shopping_lists for all
  using (owner_id = auth.uid() or public.is_group_member(group_id))
  with check (owner_id = auth.uid());

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
-- O bucket privado "anexos" já foi criado (via API, com a service_role key
-- do seu .env) — não precisa criar nada em Storage, só rodar as policies.
-- Privado (ao contrário de "avatars"): comprovante é documento financeiro,
-- só o dono deve conseguir ler — por isso o app pede uma signed URL pra
-- exibir/baixar em vez de guardar uma URL pública fixa.
-- =========================================================

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
-- STORAGE (foto de perfil)
-- O bucket público "avatars" já foi criado (via API, com a service_role key
-- do seu .env) — não precisa criar nada em Storage, só rodar as policies.
-- =========================================================

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
