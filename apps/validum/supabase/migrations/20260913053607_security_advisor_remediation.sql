-- =============================================================================
-- VALIDUM - REMEDIACION DE ADVISORS DE SEGURIDAD Y RENDIMIENTO
-- =============================================================================

-- Esta funcion administrativa no forma parte de la API de la aplicacion. El
-- permiso EXECUTE heredado de PUBLIC la exponia innecesariamente por RPC.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Unifica la lectura de perfiles en una sola politica para que Postgres no
-- evalúe dos politicas permisivas en cada SELECT. Las escrituras siguen
-- limitadas estrictamente al perfil propio.
drop policy if exists profiles_own_row on public.profiles;
drop policy if exists profiles_team_read on public.profiles;

create policy profiles_team_or_self_read
on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (select private.shares_organization_with(id))
);

create policy profiles_self_insert
on public.profiles
for insert to authenticated
with check (id = (select auth.uid()));

create policy profiles_self_update
on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy profiles_self_delete
on public.profiles
for delete to authenticated
using (id = (select auth.uid()));

-- Indices de soporte para las claves foraneas señaladas por el advisor.
create index if not exists organizations_created_by_idx
  on public.organizations (created_by);

create index if not exists soporte_documentos_owner_id_idx
  on public.soporte_documentos (owner_id);
