-- Bõnotto — trigger + agendamentos das Edge Functions de notificação/keepalive
--
-- ESTE ARQUIVO NÃO É EXECUTADO AUTOMATICAMENTE POR NADA. Rode manualmente no
-- SQL Editor do seu projeto Supabase, DEPOIS de:
--   1. Rodar supabase/schema.sql (já contém as tabelas notifications e
--      push_subscriptions usadas aqui).
--   2. Fazer o deploy das 3 Edge Functions em supabase/functions/
--      (keepalive, notify-scan, notify-payment) — ver supabase/NOTIFICACOES.md
--      pro passo a passo completo, incluindo gerar as chaves VAPID.
--
-- ANTES DE RODAR: troque toda ocorrência de <SERVICE_ROLE_KEY> abaixo pela
-- sua chave service_role (Project Settings → API → service_role secret).
-- NUNCA cole essa chave em nenhum arquivo deste repositório — é só pra
-- colar direto no SQL Editor, uma vez, ao rodar este script.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- =========================================================
-- TRIGGER: avisa a Edge Function notify-payment em tempo real sempre que
-- uma transação é marcada como paga (data_pagamento passa de nulo pra
-- preenchido). supabase_functions.http_request já vem pronto em todo
-- projeto Supabase — é o mesmo mecanismo por trás da UI "Database Webhooks".
-- =========================================================

drop trigger if exists notify_payment_trigger on transactions;
create trigger notify_payment_trigger
  after update on transactions
  for each row
  when (new.data_pagamento is not null and old.data_pagamento is null)
  execute function supabase_functions.http_request(
    'https://zkoxuafdcsfrdmlfckxz.supabase.co/functions/v1/notify-payment',
    'POST',
    '{"Content-type":"application/json"}',
    '{}',
    '5000'
  );

-- =========================================================
-- AGENDAMENTOS (pg_cron): notify-scan roda 1x/dia, keepalive a cada 3 dias
-- (bem abaixo do limite de pausa por inatividade do plano gratuito).
-- Rodar select cron.unschedule('bonotto-notify-scan-diario') /
-- 'bonotto-keepalive' antes se estiver reagendando (evita duplicar o job).
-- =========================================================

select cron.unschedule('bonotto-notify-scan-diario') where exists (select 1 from cron.job where jobname = 'bonotto-notify-scan-diario');
select cron.schedule(
  'bonotto-notify-scan-diario',
  '0 11 * * *', -- 11:00 UTC ~ 08:00 horário de Brasília
  $$
  select net.http_post(
    url := 'https://zkoxuafdcsfrdmlfckxz.supabase.co/functions/v1/notify-scan',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || '<SERVICE_ROLE_KEY>')
  );
  $$
);

select cron.unschedule('bonotto-keepalive') where exists (select 1 from cron.job where jobname = 'bonotto-keepalive');
select cron.schedule(
  'bonotto-keepalive',
  '0 6 */3 * *', -- a cada 3 dias, 06:00 UTC
  $$
  select net.http_post(
    url := 'https://zkoxuafdcsfrdmlfckxz.supabase.co/functions/v1/keepalive',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || '<SERVICE_ROLE_KEY>')
  );
  $$
);

-- Conferir se os jobs foram criados:
-- select jobid, jobname, schedule, active from cron.job;
