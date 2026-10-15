# Open Finance no BNTT (Pluggy / Meu Pluggy)

Importa transações das suas contas bancárias direto do banco, pelo botão
**Transações → Banco (Open Finance)**, e mostra os saldos das contas
conectadas no card **Saldos nos bancos** da tela inicial. Nada é gravado
sem você revisar: as transações entram na mesma prévia da importação de
planilha, e reimportar o mesmo período nunca duplica.

## É seguro?

- A **Pluggy** (Pluggy Brasil Instituição de Pagamento LTDA, CNPJ
  37.943.755/0001-30) é autorizada pelo Banco Central como ITP. O
  consentimento é dado no próprio banco, pelo Open Finance, e pode ser
  revogado a qualquer momento no app do banco ou em meu.pluggy.ai.
- O acesso é **só de leitura**: a função `openfinance` só faz `GET` na Pluggy
  e nenhum endpoint de pagamento é chamado.
- `PLUGGY_CLIENT_ID`/`PLUGGY_CLIENT_SECRET` e a apiKey da Pluggy (que vale
  2h e dá acesso total) **só existem na Edge Function**, como segredos do
  Supabase. O navegador não recebe nada disso, e o build aborta se algum
  desses valores aparecer no `dist/`.
- **O BNTT não guarda dado bancário.** O banco do app só tem o `itemId` de
  cada conexão (`openfinance_conexoes`) e o `externo_id` das transações que
  você importou.
- **Cada pessoa usa a própria Pluggy.** Ela cadastra Client ID e Client
  Secret uma vez, na própria tela. O servidor confere na Pluggy, cifra o
  secret com AES-GCM (chave `OPENFINANCE_CHAVE`, que só existe na função, com o
  id do dono como dado autenticado) e grava em `openfinance_credenciais`.
  Nenhum papel da API lê essa tabela, e o secret nunca volta para o navegador.
- Quem está em `PLUGGY_USUARIOS` pode usar as credenciais do servidor
  (`PLUGGY_CLIENT_ID`/`SECRET`). Sem credencial própria nem lista, a função
  recusa (falha fechada). Um `itemId` só pode estar vinculado a **uma** conta
  do app.

## Limites do plano grátis (Meu Pluggy)

- Só contas do **próprio titular**, em uso pessoal. Por isso cada pessoa da
  casa cria o próprio Meu Pluggy e cadastra as credenciais dela no app.
- Até 5 conexões. O banco atualiza a cada 24h.
- Produto para outras pessoas ou uso comercial exige plano pago (a partir de
  R$ 2.500/mês).

## Passo a passo para cada pessoa (está também dentro do app)

1. Criar conta grátis em meu.pluggy.ai e conectar os bancos.
2. Em dashboard.pluggy.ai, criar uma aplicação e copiar Client ID e Client
   Secret para o app ("Sua Pluggy").
3. No dashboard, conectar o conector MeuPluggy na aplicação e colar o
   itemId de cada banco em "Adicionar conexão".

## Configuração do servidor (uma vez, quem administra)

- Segredo `OPENFINANCE_CHAVE`: 32 bytes aleatórios em base64. Trocar essa
  chave invalida todas as credenciais guardadas, e cada pessoa precisa
  cadastrar de novo.
- Tabelas: `supabase/openfinance-2026-10.sql`.
- O titular pode usar as credenciais do servidor (passos abaixo).

## Credenciais do servidor para o titular (opcional)

1. Em **meu.pluggy.ai**, crie a conta e conecte seus bancos ("Conectar Minha
   Conta").
2. Em **dashboard.pluggy.ai**, crie uma aplicação. Na aba **Aplicação**, copie o
   CLIENT_ID e o CLIENT_SECRET.
3. No dashboard, ative o conector **MeuPluggy** e vincule cada banco à
   aplicação. Anote o **itemId** de cada conexão (formato UUID).
4. No `.env` (nunca versionado):

   ```
   PLUGGY_CLIENT_ID = "..."
   PLUGGY_CLIENT_SECRET = "..."
   PLUGGY_USUARIOS = "<seu id de usuário do BNTT>"
   ```

   O id de usuário está no Supabase: Authentication → Users.
5. Envie os segredos e publique a função:

   ```
   node scripts/openfinance-segredos.mjs
   npx supabase functions deploy openfinance --no-verify-jwt
   ```

6. No app: **Transações → Importar CSV → Buscar do banco**. Cole o itemId em
   "Adicionar conexão", escolha o período e clique em **Buscar transações**.

O banco precisa ter `supabase/openfinance-2026-10.sql` aplicado (tabela
`openfinance_conexoes` + coluna `transactions.externo_id`).

## Como as transações viram lançamentos

| Pluggy                                   | BNTT                                         |
|------------------------------------------|----------------------------------------------|
| `type` CREDIT / DEBIT                    | entrada / saída (o sinal do valor só vale se `type` faltar) |
| `description`                            | título                                       |
| `merchant.businessName`                  | empresa/serviço                              |
| `category`                               | categoria (find-or-create)                   |
| conta corrente, `status` POSTED          | pago na data                                 |
| cartão de crédito ou `PENDING`           | pendente, com vencimento na data             |
| `creditCardMetadata` (parcelas)          | parcela atual / total                        |
| `id`                                     | `externo_id = "pluggy:<id>"`, com índice único por dono |

A função usa `GET /v2/transactions` (paginação por cursor). O endpoint
`/transactions` com página numerada deixa de existir depois de 2026-12-31.

## Arquivos

- `supabase/functions/openfinance/index.ts`: HTTP, login, lista de liberados e ações.
- `supabase/functions/_shared/openfinanceNucleo.js`: validação, cliente Pluggy e normalização (testes em `tests/unit/openfinance-nucleo.test.js`).
- `js/services/openFinance.js`: cliente do navegador, com dados fictícios no modo demo (`tests/unit/openfinance-cliente.test.js`, `tests/e2e/open-finance-demo.spec.js`).
- `js/components/csvImportModal.js` e `app.html`: passo "openfinance" do modal de importação.
- `scripts/openfinance-segredos.mjs`: envia os segredos do `.env` sem expor o valor na linha de comando.
