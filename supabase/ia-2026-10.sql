-- =====================================================================
-- IA (Gemini) — limite diário por pessoa (complemento 2026-10, Fase 8)
-- Usado SÓ pela Edge Function `ia` (chave de serviço). Guarda apenas a
-- contagem por dia e tarefa — nunca o conteúdo enviado. Idempotente.
-- =====================================================================

create table if not exists ia_uso (
  user_id uuid not null references auth.users(id) on delete cascade,
  dia date not null default (now() at time zone 'America/Sao_Paulo')::date,
  tarefa text not null check (char_length(tarefa) <= 40),
  chamadas int not null default 0 check (chamadas >= 0),
  primary key (user_id, dia, tarefa)
);
-- RLS ligado e SEM política: ninguém lê nem escreve pelo app; só a função
-- abaixo (security definer), chamada pela Edge Function com a chave de serviço.
alter table ia_uso enable row level security;

-- Soma 1 e diz se ainda está dentro do limite — numa instrução só (atômico,
-- duas chamadas ao mesmo tempo não passam do limite).
create or replace function public.ia_consumir(p_user uuid, p_tarefa text, p_limite int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chamadas int;
begin
  if p_user is null or p_tarefa is null or p_limite is null or p_limite < 1 then
    return false;
  end if;
  insert into ia_uso as u (user_id, dia, tarefa, chamadas)
  values (p_user, (now() at time zone 'America/Sao_Paulo')::date, p_tarefa, 1)
  on conflict (user_id, dia, tarefa) do update
    set chamadas = u.chamadas + 1
    where u.chamadas < p_limite
  returning chamadas into v_chamadas;
  return v_chamadas is not null;
end;
$$;

revoke all on function public.ia_consumir(uuid, text, int) from public, anon, authenticated;
grant execute on function public.ia_consumir(uuid, text, int) to service_role;
