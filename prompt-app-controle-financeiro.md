> **Nota de uso:** este documento é um *prompt* completo e autossuficiente. Copie e cole o conteúdo abaixo (a partir de "# PROMPT DE CONSTRUÇÃO") em uma nova conversa com a IA que vai executar o projeto (Claude Code, Claude.ai, etc.). Ele já contém tudo que a IA precisa saber para construir o produto sem perguntas adicionais de escopo.

---

# PROMPT DE CONSTRUÇÃO — "CasaGrana": App PWA de Controle Financeiro + Lista de Compras

## 0. Seu papel

Você é uma **equipe multidisciplinar de especialistas** trabalhando em conjunto neste projeto. Ao tomar cada decisão, raciocine com o chapéu de cada um dos papéis abaixo — eles têm poder de veto sobre decisões que violem sua área:

| Papel | Responsabilidade | Veta |
|---|---|---|
| **Product Designer** | Dono do escopo e da experiência ponta a ponta. Garante que o produto resolve o problema real (controlar dinheiro + lista de compras do mercado) sem inchar. | Features que não servem ao objetivo central. |
| **UX/UI Designer** | Sistema de design, hierarquia visual, fluxos, acessibilidade. | Telas confusas, inconsistentes ou difíceis para leigos. |
| **Dev Fullstack** | Implementação em HTML/CSS/JS puro + bibliotecas via CDN, integração com Supabase, PWA. | Soluções que exigem build step/bundler. |
| **Especialista em Finanças** | Regras de negócio: status de pagamento, fixa x variável, cálculo de saldo/entradas/saídas. | Cálculos financeiros incorretos ou ambíguos. |
| **Especialista em Supabase/Banco de Dados** | Modelagem do schema, RLS (Row Level Security), Storage, Auth. | Dados de um usuário/grupo vazando para outro. |
| **Segurança** | XSS, sanitização de inputs, RLS, armazenamento seguro de sessão/chaves. | Qualquer `innerHTML` com dado não sanitizado, chaves sensíveis expostas incorretamente. |
| **QA** | Escreve e roda o checklist de aceite (seção 10) antes de considerar qualquer entrega "pronta". | Entregas sem teste em mobile real e sem teste dos fluxos críticos. |

## 1. Resumo executivo

**CasaGrana** (nome sugerido, livre para renomear) é um PWA simples, bonito e extremamente fácil de usar — deve ser operável por uma criança ou um idoso sem instruções — que une duas coisas no dia a dia de uma casa/família:

1. **Controle financeiro pessoal e do grupo** (entradas, saídas, despesas fixas/variáveis, vencimentos e status de pagamento).
2. **Lista de compras de mercado**, com um fluxo de "planejar → comprar → pausar → encerrar" e cálculo automático do valor gasto por item e no total.

Princípio guia: **minimalismo inteligente**. Prefira esconder complexidade avançada atrás de "mais opções" a espalhar campos na tela principal.

## 2. Restrições técnicas inegociáveis

- **Sem bundler/build step.** HTML + CSS + JS puro, módulos ES nativos do navegador (`<script type="module">`), tudo via CDN.
- **Mobile first**, mas com um **layout desktop mais denso/abrangente** (mais colunas visíveis, painéis lado a lado) usando breakpoints do Bootstrap — não é só o mobile esticado.
- **PWA instalável e com uso offline básico** (é um app usado dentro de mercados, onde o sinal é ruim).
- **Backend: Supabase** (Auth + Postgres + Storage). Sem servidor próprio.

### Stack de bibliotecas (todas via CDN)

| Biblioteca | Uso |
|---|---|
| Bootstrap 5.3.x (CSS + JS bundle) | Grid, componentes base, utilitários responsivos |
| Bootstrap Icons 1.11.x | Iconografia consistente |
| Alpine.js 3.x | Reatividade e estado dos componentes sem framework pesado |
| Chart.js 4.x | Gráficos (categorias de gastos, evolução) |
| PapaParse 5.x | Importação/exportação de CSV |
| `html5-qrcode` (ou `@zxing/library`) | Leitura de código de barras/QR pela câmera |
| `@supabase/supabase-js` v2 (via esm.sh) | Auth, banco de dados, storage, realtime |
| (opcional, fase 2) Open Food Facts API | Autocompletar nome/categoria de produto a partir do código de barras |

Não adicione bibliotecas além dessas sem necessidade concreta — cada dependência nova precisa se justificar (minimalismo também no código).

## 3. Estrutura de arquivos sugerida

```
/
├── index.html
├── manifest.webmanifest
├── sw.js
├── /assets
│   ├── /icons          (192, 512, maskable, favicon)
│   └── /img
├── /css
│   ├── tokens.css       (cores, tipografia, espaçamento — design tokens)
│   ├── components.css   (cards, badges de status, botões custom)
│   └── app.css          (layout geral, overrides)
├── /js
│   ├── app.js                    (bootstrap do Alpine, roteamento simples por hash)
│   ├── supabaseClient.js
│   ├── /services
│   │   ├── auth.js
│   │   ├── transactions.js
│   │   ├── categories.js
│   │   ├── groups.js
│   │   ├── shoppingList.js
│   │   ├── csvImport.js          (wrapper do PapaParse)
│   │   └── barcode.js            (wrapper do html5-qrcode)
│   ├── /components                (Alpine.data() por componente de tela)
│   │   ├── dashboard.js
│   │   ├── transactionForm.js
│   │   ├── transactionTable.js
│   │   ├── shoppingList.js
│   │   └── charts.js
│   └── /utils
│       ├── format.js             (moeda BRL, datas)
│       └── status.js             (regra pago/pendente/a vencer/vencido)
└── README.md                     (setup do Supabase, deploy, variáveis)
```

## 4. Modelo de dados (Supabase / Postgres)

```sql
create extension if not exists "uuid-ossp";

-- Perfis (espelha auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  avatar_url text,
  criado_em timestamptz not null default now()
);

-- Grupos (ex: família)
create table groups (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  criado_por uuid references profiles(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table group_members (
  group_id uuid references groups(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  papel text not null default 'membro' check (papel in ('admin','membro')),
  entrou_em timestamptz not null default now(),
  primary key (group_id, profile_id)
);

create table categories (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references profiles(id) on delete cascade,
  group_id uuid references groups(id) on delete cascade,
  nome text not null,
  cor text not null default '#6c757d',
  icone text default 'bi-tag',
  criado_em timestamptz not null default now()
);

create table transactions (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  group_id uuid references groups(id) on delete set null,
  responsavel_id uuid references profiles(id) on delete set null,
  tipo text not null check (tipo in ('entrada','saida')),
  titulo text not null,
  empresa_servico text,
  categoria_id uuid references categories(id) on delete set null,
  tipo_despesa text not null default 'variavel' check (tipo_despesa in ('fixa','variavel')),
  valor numeric(12,2) not null check (valor >= 0),
  status text not null default 'pendente' check (status in ('pago','pendente','a_vencer','vencido')),
  data_cadastro date not null default current_date,
  data_vencimento date,
  data_pagamento date,
  recorrente boolean not null default false,
  observacoes text,
  comprovante_url text,
  criado_em timestamptz not null default now()
);

create table shopping_lists (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references profiles(id) on delete cascade,
  group_id uuid references groups(id) on delete set null,
  nome text not null default 'Lista de Compras',
  status text not null default 'planejando' check (status in ('planejando','comprando','pausada','finalizada')),
  criado_em timestamptz not null default now(),
  iniciado_em timestamptz,
  finalizado_em timestamptz,
  transacao_id uuid references transactions(id) on delete set null
);

create table shopping_list_items (
  id uuid primary key default uuid_generate_v4(),
  list_id uuid not null references shopping_lists(id) on delete cascade,
  nome text not null,
  categoria_id uuid references categories(id) on delete set null,
  unidade text not null default 'un' check (unidade in ('un','kg','g')),
  quantidade numeric(10,3) default 1,
  preco_unitario numeric(12,2),
  preco_por_kg numeric(12,2),
  subtotal numeric(12,2) default 0,
  comprado boolean not null default false,
  codigo_barras text,
  foto_url text,
  criado_em timestamptz not null default now()
);
```

### RLS (Row Level Security) — aplicar em todas as tabelas de dados

Exemplo de política a replicar para `transactions`, `shopping_lists`, `shopping_list_items` e `categories` (ajustando a tabela referenciada):

```sql
alter table transactions enable row level security;

create policy "Ver e editar transações próprias ou do grupo"
  on transactions for all
  using (
    owner_id = auth.uid()
    or group_id in (select group_id from group_members where profile_id = auth.uid())
  )
  with check (owner_id = auth.uid());
```

`group_members` e `groups` também precisam de RLS: um usuário só vê grupos dos quais é membro.

### Regra de status de pagamento (Especialista em Finanças)

| Status | Regra | Cor (Bootstrap) |
|---|---|---|
| **Pago** | `data_pagamento` preenchida (marcado manualmente pelo usuário) | `success` (verde) |
| **Vencido** | `data_vencimento < hoje` E não pago | `danger` (vermelho) |
| **A vencer** | `data_vencimento` entre hoje e hoje+7 dias E não pago | `warning` (amarelo) |
| **Pendente** | Sem `data_vencimento`, ou vencimento além de 7 dias, E não pago | `secondary` (cinza) |

O limite de "7 dias" deve ser uma constante configurável em `utils/status.js`.

## 5. Telas e módulos

### 5.1 Home (Dashboard)

- **Cabeçalho pessoal em destaque**: avatar/foto, nome, e três números grandes — **Saldo**, **Entradas**, **Saídas** — no estilo do card de referência abaixo (fornecido pelo usuário), mais o **maior gasto** do período em destaque com seu título/categoria.
- **Resumo do grupo** (se o usuário pertencer a um grupo): mesmo formato acima, porém somando os valores de todos os membros. Se não houver grupo, essa seção fica oculta (grupo é 100% opcional).
- Atalhos rápidos: **+ Nova despesa**, **+ Despesa fixa**, **Lista de compras**, **Ver tabela completa**.
- Mobile: cards empilhados. Desktop: cards + tabela recente + gráfico lado a lado (grid de 2-3 colunas).

> Referência visual enviada pelo usuário: card com foto do responsável, "Entrada", "Saída", "Saldo" em verde/vermelho/azul. Replicar essa linguagem visual, mas com um card por pessoa e um card agregado do grupo.

### 5.2 Cadastro de transação (Nova despesa/entrada)

Formulário único, usado tanto para entradas quanto saídas:

| Campo | Tipo | Observação |
|---|---|---|
| Movimentação | Toggle Entrada/Saída | Padrão: Saída |
| Título | Texto, obrigatório | |
| Empresa/Serviço | Texto, opcional | Ex: "Nubank", "iFood" |
| Categoria | Select com cor + ícone | Pré-carregada com categorias padrão (seção 8), criável pelo usuário |
| Tipo de despesa | Toggle Fixa/Variável | Só relevante para Saída |
| Responsável | Select | Usuário logado por padrão; se houver grupo, lista os membros |
| Valor | Numérico, máscara R$ | |
| Data de cadastro | Data, auto (hoje) | Editável |
| Data de vencimento | Data, opcional | Vazio = sem vencimento definido |
| Status | Calculado automaticamente (seção 4) | Botão "Marcar como pago" sobrepõe o cálculo |
| Recorrente | Checkbox | Sinaliza despesa fixa mensal (ex: assinatura, financiamento) — em MVP é só um marcador/filtro, sem geração automática de lançamentos futuros (isso fica para fase 2) |
| Observações | Texto, opcional | |
| Comprovante/Foto | Upload/câmera, opcional | Vai para Supabase Storage |

Deve existir uma via **rápida** (poucos toques) para o caso comum: título + valor + categoria + entrada/saída, com o resto em "mais opções" recolhido.

### 5.3 Tabela de transações

- Mesma estrutura de colunas da planilha de referência do usuário: **Movimentação · Responsável · Empresa/Serviço · Categoria · Valor**, acrescida de **Vencimento · Status · Tipo (Fixa/Variável)**.
- Edição inline com dropdowns (igual à planilha de referência: Responsável e Categoria editáveis direto na linha).
- Filtros: por responsável, categoria, status, tipo (fixa/variável), período.
- Ordenação por qualquer coluna.
- Badges coloridos de status e categoria (cores consistentes em toda a tela: tabela, home e gráficos usam a mesma cor por categoria).
- Botão de exportar a visão atual para CSV.

### 5.4 Lista de compras

Fluxo de estados da lista (`shopping_lists.status`):

```
planejando  --[Iniciar Compra]-->  comprando  --[Encerrar Compra]-->  finalizada
                                       |  ^
                                [Pausar]  |[Retomar]
                                       v  |
                                    pausada
```

- **Planejando**: usuário adiciona itens livremente (nome, categoria, quantidade estimada) — sem preço ainda.
- **Toggle principal** (um único botão que muda de rótulo conforme o estado): "Iniciar Compra" ⇄ "Encerrar Compra".
- **Botão Pausar** é independente do toggle: só aparece durante "Comprando", leva para "Pausada"; nesse estado o botão vira "Retomar".
- **Durante "Comprando"**: tocar em um item abre um input rápido (idealmente inline, sem modal pesado) para:
  - **Unidade**: quantidade (un) OU peso (kg/g).
  - Se **quantidade**: preço unitário → subtotal = quantidade × preço unitário.
  - Se **peso**: preço por kg (ou por g) → subtotal = peso × preço/unidade.
  - Marcar item como comprado (checkbox).
- **Barra de resumo fixa** (sticky, sempre visível durante a compra): quantidade de itens (comprados/total) e **valor total a pagar**.
- Botão "Ver gráfico" abre um modal com Chart.js mostrando gasto por categoria daquela lista.
- Ao **finalizar**, oferecer opção (não obrigatória) de gerar automaticamente uma `transaction` (Saída) com o valor total, categorizando por "Mercado"/categoria predominante — liga o módulo de compras ao financeiro sem forçar o usuário.

### 5.5 Importação CSV

- Importador genérico reaproveitável para: transações, categorias e itens de lista de compras.
- Fluxo: upload do arquivo (PapaParse) → tela de mapeamento de colunas (o usuário associa colunas do CSV aos campos do sistema) → prévia das primeiras linhas → confirmação → relatório de linhas importadas/com erro.
- Exportação no mesmo formato deve estar disponível a partir da tabela (seção 5.3).

### 5.6 Captura por foto / código de barras

- **Código de barras**: usar `html5-qrcode` para ler o código pela câmera ao cadastrar um item da lista de compras. Opcionalmente, consultar a Open Food Facts API (gratuita) para pré-preencher nome/categoria a partir do código — tratar como *melhoria opcional*, com fallback manual caso a busca falhe ou o produto não exista na base.
- **Foto**: input de câmera (`capture="environment"`) para anexar foto do item/comprovante como referência visual — não fazer OCR/leitura automática do valor na v1 (ficaria complexo e frágil); isso fica marcado como possível fase 2 (`Tesseract.js`).

## 6. Sistema de design (UX/UI)

- **Tipografia**: fonte do sistema (`-apple-system`, `Segoe UI`, etc. — sem carregar fonte externa, por performance) em tamanho generoso; nada abaixo de 16px em corpo de texto.
- **Toques grandes**: alvo mínimo de toque de 44×44px em todos os botões — pensado para uso por idosos/crianças.
- **Ícone + texto sempre juntos** em ações importantes (nunca só um ícone ambíguo).
- **Confirmação simples** para ações destrutivas (excluir transação/item) — modal claro com linguagem cotidiana, nunca jargão técnico.
- **Cores com significado consistente**: verde = entrada/pago/positivo; vermelho = saída/vencido/negativo; amarelo = atenção/a vencer; a cor de cada categoria é fixa e reaproveitada em badges, tabela e gráficos.
- **Poucas telas, navegação óbvia**: barra inferior fixa no mobile (Home · Transações · Lista de Compras · Grupo · Perfil) com ícones do Bootstrap Icons; no desktop vira uma barra lateral.
- **Contraste mínimo AA** (WCAG) em todo texto sobre fundo colorido.

## 7. PWA e uso offline

- `manifest.webmanifest`: nome, ícones 192/512 (incluindo versão *maskable*), `theme_color`, `background_color`, `display: standalone`, `start_url`.
- `sw.js`: cache-first para o app shell (HTML/CSS/JS/ícones); dados do Supabase seguem direto pela rede.
- **Fila offline**: como o uso principal acontece dentro do mercado (sinal ruim), gravações feitas sem conexão (marcar item comprado, preço, etc.) devem ser guardadas localmente (localStorage/IndexedDB) e sincronizadas com o Supabase assim que a conexão voltar. Mostrar um indicador discreto de "offline — sincronizando depois".

## 8. Dados de exemplo (seed) — baseados na planilha de referência do usuário

Use estes dados para popular o ambiente de demonstração/testes, refletindo o caso de uso real informado:

- **Grupo**: "Família" com dois membros — Matheus e Beatriz.
- **Categorias** (com cor própria): Assinaturas, Curso, Casa, Carro, Pet, Delivery, Outro, Salário.
- **Exemplos de transações** (Saída): Amazon Prime R$19,90, Claro Móvel R$51,91, Nubank+ R$29,00, Vivo Internet R$92,34, Seguro Carro R$212,58, Financiamento Carro R$765,87, Condomínio R$415,90, Financiamento Casa R$1.000,00, Gasolina R$200,00.
- **Exemplos de transações** (Entrada): Salário MB Labs (Matheus) R$6.000,00, Salário Dinamo (Beatriz) R$5.200,00.
- **Card pessoal esperado (Matheus)**: Entrada R$6.000,00 · Saída R$3.265,21 · Saldo R$2.734,79.
- **Card do grupo**: soma de Matheus + Beatriz (Entrada agregada R$11.200,00 e assim por diante).

## 9. Segurança e privacidade

- Nunca usar `innerHTML` com dado vindo do usuário/banco sem sanitização — preferir `textContent`/bindings do Alpine.
- Toda a leitura/escrita de dados passa pela RLS do Supabase — nunca confiar apenas em filtro no front-end.
- Sessão via Supabase Auth (cookies/localStorage geridos pela própria lib) — não implementar autenticação própria.
- Upload de fotos/comprovantes: bucket privado no Supabase Storage, URLs assinadas com expiração, nunca público por padrão.
- Validar tamanho/tipo de arquivo antes do upload (evitar upload de arquivos arbitrários).

## 10. Checklist de aceite (QA)

- [ ] Responsivo testado em pelo menos 4 larguras: 360px, 768px, 1024px, 1440px.
- [ ] Instalável como PWA (manifest válido, ícones corretos, `Lighthouse PWA ≥ 90`).
- [ ] Uso básico offline funcional (marcar item comprado sem internet e ver sincronizar depois).
- [ ] RLS testada com 2 contas: usuário A não enxerga nem edita dados do usuário B fora do grupo compartilhado.
- [ ] Cálculo de status (pago/pendente/a vencer/vencido) correto para casos de borda: sem vencimento, vencimento hoje, vencimento no passado.
- [ ] Cálculo de subtotal por peso (kg/g) e por unidade corretos, incluindo arredondamento de moeda.
- [ ] Fluxo completo da lista de compras: planejar → iniciar → pausar → retomar → encerrar, com resumo (qtd. itens e valor total) sempre correto.
- [ ] Importação de CSV com linhas inválidas não trava o processo — reporta erro por linha.
- [ ] Leitura de código de barras testada em um dispositivo real (câmera de celular).
- [ ] Contraste de texto AA em todos os badges de status/categoria.
- [ ] Alvos de toque ≥44px em botões principais; testado por alguém sem contexto prévio do app (simulando usuário leigo/idoso).
- [ ] Nenhuma chave secreta do Supabase (`service_role`) exposta no front-end — apenas a `anon key` pública.

## 11. Entregáveis finais

- Código-fonte completo e funcional na estrutura da seção 3.
- `README.md` com: passo a passo para criar o projeto no Supabase, rodar o schema SQL da seção 4, configurar as políticas de RLS, preencher `supabaseClient.js` com URL/anon key, e instruções de deploy (qualquer hosting estático, ex. Vercel/Netlify/GitHub Pages).
- Ícones do PWA nos tamanhos exigidos.
- Dados de seed (seção 8) como script SQL opcional de demonstração.

## 12. Fora de escopo por ora (não implementar nesta v1)

- OCR completo de nota fiscal (leitura automática do valor da foto).
- Geração automática de lançamentos futuros para despesas recorrentes (fica só o marcador "recorrente").
- Múltiplas moedas / internacionalização.
- Notificações push.

---

### Instrução final para a IA executora

Construa de forma incremental: primeiro a base (Auth + schema Supabase + shell do PWA + navegação), depois o módulo financeiro (home, cadastro, tabela), depois a lista de compras, depois importação/CSV e leitura de código de barras. A cada etapa, valide contra o checklist da seção 10 antes de seguir para a próxima. Priorize sempre clareza e simplicidade de uso sobre quantidade de funcionalidades visíveis na tela.
