-- Registra de forma reproducible la correccion aplicada al bootstrap de
-- organizaciones: COALESCE es una expresion SQL y no pertenece a pg_catalog.
create or replace function public.create_organization_with_owner(organization_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  organization_id_result uuid;
begin
  if current_user_id is null then
    raise exception 'Se requiere una sesion autenticada';
  end if;

  if pg_catalog.length(pg_catalog.btrim(coalesce(organization_name, ''))) = 0 then
    raise exception 'El nombre de la organizacion es obligatorio';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(current_user_id::text, 0)
  );

  select membership.organization_id
    into organization_id_result
    from public.organization_members as membership
   where membership.user_id = current_user_id
     and membership.active = true
   order by
     case when membership.role = 'owner' then 0 else 1 end,
     membership.created_at
   limit 1;

  if organization_id_result is not null then
    insert into public.user_preferences (user_id, organization_id)
    values (current_user_id, organization_id_result)
    on conflict (user_id) do update
      set organization_id = excluded.organization_id,
          updated_at = pg_catalog.now();
    return organization_id_result;
  end if;

  insert into public.organizations (name, created_by)
  values (pg_catalog.btrim(organization_name), current_user_id)
  returning id into organization_id_result;

  insert into public.organization_members (organization_id, user_id, role)
  values (organization_id_result, current_user_id, 'owner');

  insert into public.user_preferences (user_id, organization_id)
  values (current_user_id, organization_id_result)
  on conflict (user_id) do update
    set organization_id = excluded.organization_id,
        updated_at = pg_catalog.now();

  if pg_catalog.to_regclass('public.soporte_documentos') is not null then
    execute
      'update public.soporte_documentos set organization_id = $1 where organization_id is null and owner_id = $2'
      using organization_id_result, current_user_id;
  end if;

  return organization_id_result;
end;
$$;

revoke all on function public.create_organization_with_owner(text) from public, anon;
grant execute on function public.create_organization_with_owner(text) to authenticated;
