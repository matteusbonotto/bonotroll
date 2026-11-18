-- 18/11/2026 (auditoria): o tipo da conta (home/business) passa a ser gravado pelo SERVIDOR no
-- cadastro, em app_metadata.tipo, e só ele é lido. Antes o plano caía para user_metadata.tipo_conta,
-- que a própria pessoa altera com auth.updateUser e assim trocava de linha (liberando recursos e o
-- teste de 30 dias da outra). Idempotente.
-- Reverter: drop trigger if exists bntt_fixa_tipo on auth.users; drop function public.bntt_fixa_tipo();
--   e reaplicar bntt_plano_da_conta de supabase/schema.sql.

create or replace function public.bntt_fixa_tipo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.raw_app_meta_data->>'tipo' is null then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('tipo', case when new.raw_user_meta_data->>'tipo_conta' = 'business' then 'business' else 'home' end);
  end if;
  return new;
end $$;
revoke all on function public.bntt_fixa_tipo() from public, anon, authenticated;
drop trigger if exists bntt_fixa_tipo on auth.users;
create trigger bntt_fixa_tipo before insert on auth.users for each row execute function public.bntt_fixa_tipo();

-- contas que já existem: fixa o tipo que tinham até hoje
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
     || jsonb_build_object('tipo', case when raw_user_meta_data->>'tipo_conta' = 'business' then 'business' else 'home' end)
 where raw_app_meta_data->>'tipo' is null;

create or replace function public.bntt_plano_da_conta(uid uuid)
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when u.raw_app_meta_data->>'assinatura_ativa' = 'true' and u.raw_app_meta_data->>'plano' is not null
      then u.raw_app_meta_data->>'plano'
    when u.created_at > now() - interval '30 days'
      then case when u.raw_app_meta_data->>'tipo' = 'business' then 'business_expansao' else 'home_familia' end
    else case when u.raw_app_meta_data->>'tipo' = 'business' then 'business_largada' else 'home_gratis' end
  end
  from auth.users u
  where u.id = uid;
$$;
