-- Patch: corrige o erro "new row violates row-level security policy for table groups"
-- ao criar um grupo. Rode isto uma vez no SQL Editor do Supabase (já reproduzi e
-- confirmei a causa e a correção antes de mandar este patch).
drop policy if exists "Ver grupos dos quais participo" on groups;
create policy "Ver grupos dos quais participo" on groups for select
  using (public.is_group_member(id) or criado_por = auth.uid());
