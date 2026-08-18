# Notificações — central no app, push de verdade e keepalive

A central de notificações (o sino no topo) **já funciona sozinha**, em modo demo e no Supabase real, sem nenhum passo manual — ela roda a varredura direto no navegador a cada login (`js/services/notifications.js::generateForProfile`).

O que exige passos manuais (porque isso é infraestrutura de servidor, e eu não tenho acesso à sua sessão do Supabase CLI) é:

1. **Push de verdade** (a notificação chegar mesmo com o app fechado).
2. **Keepalive** (o projeto Supabase não pausar por inatividade no plano gratuito).

Nenhum dos dois é obrigatório pro resto do app funcionar — sem eles, a central de notificações dentro do app continua funcionando normalmente.

## 0. Pré-requisitos

- Ter rodado `supabase/schema.sql` no SQL Editor do seu projeto (já inclui as tabelas `notifications` e `push_subscriptions` usadas aqui).
- Node.js instalado (você já tem — vamos usar `npx supabase`, sem precisar instalar o CLI globalmente).

## 1. Login e link do projeto

```bash
npx supabase login
# abre o navegador pra autorizar — faça login na conta dona do projeto zkoxuafdcsfrdmlfckxz

npx supabase link --project-ref zkoxuafdcsfrdmlfckxz
```

## 2. Configurar os secrets das Edge Functions

Já existe um par de chaves VAPID pronto — a **pública** já está commitada em `js/data/vapid.js`, e te mandei a **privada** correspondente numa mensagem de chat separada (de propósito: chave privada nunca deve ir pra nenhum arquivo deste repositório, só direto pro secret do Supabase):

```bash
npx supabase secrets set VAPID_PUBLIC_KEY="<copie de js/data/vapid.js>"
npx supabase secrets set VAPID_PRIVATE_KEY="<cole a chave privada que te enviei no chat>"
```

Perdeu a chave privada ou prefere gerar um par novo do zero? `npx web-push generate-vapid-keys` gera outro par — só lembre de atualizar a chave pública em `js/data/vapid.js` também (as duas têm que ser do mesmo par).

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` **não precisam ser configuradas** — toda Edge Function do projeto já recebe as duas automaticamente.

## 3. Deploy das 3 Edge Functions

```bash
npx supabase functions deploy keepalive
npx supabase functions deploy notify-scan
npx supabase functions deploy notify-payment
```

Teste rápido de cada uma (deve responder `{"ok":true,...}`):

```bash
curl -i --request POST "https://zkoxuafdcsfrdmlfckxz.supabase.co/functions/v1/keepalive" \
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY"

curl -i --request POST "https://zkoxuafdcsfrdmlfckxz.supabase.co/functions/v1/notify-scan" \
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY"
```

(`notify-payment` não precisa de teste manual — só é chamada pelo trigger de banco do passo 4.)

## 4. Trigger + agendamentos (pg_cron)

Abra `supabase/notifications_push.sql`, troque as duas ocorrências de `<SERVICE_ROLE_KEY>` pela sua chave `service_role` (**Project Settings → API → service_role secret** — nunca a `anon key`), e rode o arquivo inteiro no SQL Editor do projeto.

Isso cria:
- Um trigger em `transactions` que chama `notify-payment` automaticamente sempre que uma despesa é marcada como paga.
- Um agendamento (`pg_cron`) que roda `notify-scan` todo dia às 08h (horário de Brasília).
- Um agendamento que roda `keepalive` a cada 3 dias.

Se o SQL Editor reclamar que `pg_cron`/`pg_net` não existem, ative as duas extensões em **Database → Extensions** no painel do Supabase antes de rodar de novo (a primeira linha do arquivo já tenta criar as duas, mas alguns projetos exigem habilitar pela UI na primeira vez).

## 5. Ativar no app

Com tudo acima feito, qualquer pessoa logada (modo real, não demo) pode ativar em **Perfil → Notificações push** (o switch). A partir daí, despesa vencendo/vencida, item de Recursos acabando/vencendo e pagamento de outro membro do grupo chegam como notificação push mesmo com o app fechado.

## Verificação

- `select * from cron.job;` no SQL Editor — deve listar `bonotto-notify-scan-diario` e `bonotto-keepalive`.
- `select * from notifications order by criado_em desc limit 10;` — depois de rodar `notify-scan` manualmente (passo 3), deve ter linhas novas se houver despesa a vencer/vencida ou item de Recursos em falta/vencendo.
- Marcar uma despesa como paga (com um grupo de 2+ pessoas) e conferir que o outro perfil recebeu uma notificação (`select * from notifications where tipo = 'pagamento';`).
