-- BNTT — trigger + agendamentos das Edge Functions de notificação/keepalive
--
-- ESTE ARQUIVO NÃO É EXECUTADO AUTOMATICAMENTE POR NADA. Rode manualmente
-- (`npx supabase db query --linked -f supabase/notifications_push.sql`) DEPOIS de:
--   1. Rodar supabase/schema.sql.
--   2. Publicar as 3 Edge Functions (supabase/functions/, verify_jwt = false
--      via supabase/config.toml) e configurar os secrets delas — ver
--      supabase/NOTIFICACOES.md.
--   3. Criar no Vault o segredo 'bntt_cron_secret' com o MESMO valor do secret
--      BNTT_CRON_SECRET das functions (NOTIFICACOES.md, passo 2).
--
-- Nenhuma chave fica neste arquivo: o header x-bntt-cron é lido do Vault
-- (vault.decrypted_secrets) na hora de cada chamada. As chaves novas do
-- Supabase (sb_secret_…) não são JWT, por isso as functions não usam mais
-- a service_role no Authorization (ver functions/_shared/autorizacao.ts).

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Headers de toda chamada do banco para as Edge Functions. security definer +
-- search_path fixo: só o dono (postgres) lê o Vault; ninguém com role
-- anon/authenticated consegue chamar isto (revoke abaixo).
create or replace function public.bntt_cron_headers()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'Content-Type', 'application/json',
    'x-bntt-cron', (select decrypted_secret from vault.decrypted_secrets where name = 'bntt_cron_secret')
  );
$$;
revoke all on function public.bntt_cron_headers() from public, anon, authenticated;

-- =========================================================
-- TRIGGER: avisa a Edge Function notify-payment em tempo real sempre que
-- uma transação é marcada como paga (data_pagamento passa de nulo pra
-- preenchido).
--
-- Não usa supabase_functions.http_request (o mecanismo por trás da UI
-- "Database Webhooks") de propósito — esse schema só existe em projetos
-- que já criaram um webhook alguma vez pela UI, então depender dele quebra
-- em projeto novo com o erro "schema supabase_functions does not exist".
-- Uma função própria chamando net.http_post diretamente (pg_net, já criado
-- acima) evita essa dependência e funciona em qualquer projeto.
-- =========================================================

create or replace function public.notify_payment_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := 'https://qlcrsclgtpjeqkmykqrs.supabase.co/functions/v1/notify-payment',
    body := jsonb_build_object('record', to_jsonb(new), 'old_record', to_jsonb(old)),
    headers := public.bntt_cron_headers()
  );
  return new;
end;
$$;

drop trigger if exists notify_payment_trigger on transactions;
create trigger notify_payment_trigger
  after update on transactions
  for each row
  when (new.data_pagamento is not null and old.data_pagamento is null)
  execute function public.notify_payment_webhook();

-- =========================================================
-- AGENDAMENTOS (pg_cron): notify-scan roda a cada 5 MIN (era 1x/dia, depois
-- de hora em hora — pedido explícito de deixar vencimento/estoque em tempo
-- real de verdade, já que só dá pra saber que "hoje entrou no prazo de 7
-- dias" ou "a quantidade zerou" rodando essa varredura de novo; diferente
-- de pagamento, que é um evento discreto — dá pra reagir na hora via
-- trigger). keepalive continua a cada 3 dias (bem abaixo do limite de
-- pausa por inatividade do plano gratuito — não precisa ser mais frequente
-- que isso, só existe pra manter o projeto "vivo"). ~288 execuções/dia de
-- notify-scan ainda é bem modesto pro volume de dados de uma casa (poucas
-- dezenas de despesas/itens) e pro teto de invocations do plano free.
-- Rodar select cron.unschedule(...) antes se estiver reagendando (evita
-- duplicar o job) — já incluído abaixo, junto com o unschedule dos nomes
-- antigos ('-diario'/'-horario') pra quem já tinha agendado.
-- =========================================================

select cron.unschedule('bonotto-notify-scan-diario') where exists (select 1 from cron.job where jobname = 'bonotto-notify-scan-diario');
select cron.unschedule('bonotto-notify-scan-horario') where exists (select 1 from cron.job where jobname = 'bonotto-notify-scan-horario');
select cron.unschedule('bonotto-notify-scan-5min') where exists (select 1 from cron.job where jobname = 'bonotto-notify-scan-5min');
select cron.schedule(
  'bonotto-notify-scan-5min',
  '*/5 * * * *', -- a cada 5 minutos
  $$
  select net.http_post(
    url := 'https://qlcrsclgtpjeqkmykqrs.supabase.co/functions/v1/notify-scan',
    headers := public.bntt_cron_headers()
  );
  $$
);

select cron.unschedule('bonotto-keepalive') where exists (select 1 from cron.job where jobname = 'bonotto-keepalive');
select cron.schedule(
  'bonotto-keepalive',
  '0 6 */3 * *', -- a cada 3 dias, 06:00 UTC
  $$
  select net.http_post(
    url := 'https://qlcrsclgtpjeqkmykqrs.supabase.co/functions/v1/keepalive',
    headers := public.bntt_cron_headers()
  );
  $$
);

-- Conferir se os jobs foram criados:
-- select jobid, jobname, schedule, active from cron.job;
