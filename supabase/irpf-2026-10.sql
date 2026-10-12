-- =====================================================================
-- Imposto de Renda (BNTT Home, complemento 2026-10, Fase 8)
-- Organização da declaração: documentos importados (SEM o arquivo
-- original — só o que foi lido), itens com origem e estado de conferência,
-- respostas do questionário e dependentes. Dado fiscal é PESSOAL: só o
-- dono vê e mexe (nada de grupo). Idempotente.
-- =====================================================================

create table if not exists irpf_declaracoes (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  exercicio int not null check (exercicio between 2020 and 2100),
  respostas jsonb not null default '{}'::jsonb,
  consentimento_ia_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
-- Find-or-create sem duplicata: uma declaração por pessoa e exercício.
create unique index if not exists irpf_declaracoes_uma_por_ano on irpf_declaracoes (owner_id, exercicio);

create table if not exists irpf_documentos (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  declaracao_id uuid not null references irpf_declaracoes(id) on delete cascade,
  nome text not null check (char_length(nome) <= 160),
  hash text check (hash is null or hash ~ '^[0-9a-f]{64}$'),
  chave_conteudo text check (chave_conteudo is null or char_length(chave_conteudo) <= 300),
  tipo text not null check (char_length(tipo) <= 40),
  status text not null check (status in ('processado', 'parcial', 'rejeitado', 'duplicado', 'nao_identificado', 'ignorado')),
  status_extracao text check (status_extracao is null or char_length(status_extracao) <= 40),
  duplicado_de uuid references irpf_documentos(id) on delete set null,
  motivo text check (motivo is null or char_length(motivo) <= 1000),
  ano_calendario int,
  instituicao_nome text check (instituicao_nome is null or char_length(instituicao_nome) <= 200),
  instituicao_documento text check (instituicao_documento is null or char_length(instituicao_documento) <= 20),
  duvidas jsonb not null default '[]'::jsonb,
  extraido_por text check (extraido_por is null or extraido_por in ('local', 'ia', 'planilha')),
  paginas int check (paginas is null or paginas between 0 and 100),
  criado_em timestamptz not null default now()
);
create index if not exists irpf_documentos_declaracao_idx on irpf_documentos (declaracao_id);
-- O MESMO arquivo (mesmo SHA-256) não entra duas vezes na mesma declaração.
create unique index if not exists irpf_documentos_hash_unico on irpf_documentos (declaracao_id, hash) where hash is not null;

create table if not exists irpf_itens (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  declaracao_id uuid not null references irpf_declaracoes(id) on delete cascade,
  documento_id uuid references irpf_documentos(id) on delete cascade,
  campo text not null check (char_length(campo) <= 60),
  valor_original text check (valor_original is null or char_length(valor_original) <= 60),
  centavos bigint check (centavos is null or centavos between -100000000000 and 100000000000),
  pagina int,
  trecho text check (trecho is null or char_length(trecho) <= 500),
  referencia text check (referencia is null or char_length(referencia) <= 200),
  confianca numeric(4,3) check (confianca is null or confianca between 0 and 1),
  origem text not null check (origem in ('documento', 'ia', 'planilha', 'manual')),
  revisao text not null check (revisao in ('importado', 'sugerido', 'pendente', 'confirmado', 'corrigido', 'inconsistente')),
  beneficiario text not null default 'titular' check (char_length(beneficiario) <= 80),
  fonte_documento text check (fonte_documento is null or char_length(fonte_documento) <= 20),
  fonte_nome text check (fonte_nome is null or char_length(fonte_nome) <= 200),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists irpf_itens_declaracao_idx on irpf_itens (declaracao_id);
create index if not exists irpf_itens_documento_idx on irpf_itens (documento_id);

create table if not exists irpf_dependentes (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  declaracao_id uuid not null references irpf_declaracoes(id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  relacao text check (relacao is null or char_length(relacao) <= 40),
  criado_em timestamptz not null default now()
);
create index if not exists irpf_dependentes_declaracao_idx on irpf_dependentes (declaracao_id);

-- RLS: só o dono. As tabelas-filhas também exigem que a declaração seja dele
-- (não dá para pendurar item na declaração de outra pessoa).
alter table irpf_declaracoes enable row level security;
alter table irpf_documentos enable row level security;
alter table irpf_itens enable row level security;
alter table irpf_dependentes enable row level security;

drop policy if exists "IRPF: só o dono" on irpf_declaracoes;
create policy "IRPF: só o dono" on irpf_declaracoes for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "IRPF: só o dono" on irpf_documentos;
create policy "IRPF: só o dono" on irpf_documentos for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from irpf_declaracoes d where d.id = declaracao_id and d.owner_id = auth.uid()));

drop policy if exists "IRPF: só o dono" on irpf_itens;
create policy "IRPF: só o dono" on irpf_itens for all
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and exists (select 1 from irpf_declaracoes d where d.id = declaracao_id and d.owner_id = auth.uid())
    and (documento_id is null or exists (select 1 from irpf_documentos x where x.id = documento_id and x.owner_id = auth.uid()))
  );

drop policy if exists "IRPF: só o dono" on irpf_dependentes;
create policy "IRPF: só o dono" on irpf_dependentes for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and exists (select 1 from irpf_declaracoes d where d.id = declaracao_id and d.owner_id = auth.uid()));
