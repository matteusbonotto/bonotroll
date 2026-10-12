-- =====================================================================
-- Perfil novo pelo Google (complemento 2026-10, Fase 8)
-- O Google manda o nome em full_name/name, não em 'nome'. Idempotente.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nome)
  -- 'nome' vem do cadastro por e-mail; 'full_name'/'name' vêm do Google.
  values (new.id, left(coalesce(
    nullif(trim(new.raw_user_meta_data->>'nome'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1)
  ), 80));
  return new;
end;
$$ language plpgsql security definer;

alter function public.handle_new_user() set search_path = public;
