-- =============================================================================
-- VALIDUM - EQUIPO INTERNO, ROLES Y AISLAMIENTO MULTIEMPRESA
--
-- public.organizations es el tenant real de Validum. No se crea una segunda
-- tabla `tenants`, porque duplicar la frontera de aislamiento permitiria que
-- formularios, afiliados y usuarios terminaran apuntando a tenants distintos.
-- =============================================================================

alter table public.organization_members
  add column if not exists status text not null default 'active',
  add column if not exists invited_email text,
  add column if not exists invited_by uuid references auth.users(id) on delete set null,
  add column if not exists invited_at timestamptz,
  add column if not exists accepted_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update public.organization_members
set status = case when active then 'active' else 'revoked' end
where invited_at is null;

alter table public.organization_members
  alter column role set default 'operator';

-- Completa perfiles de usuarios antiguos antes de añadir la FK usada por la
-- vista del equipo. No copia secretos ni metadatos de autorizacion.
insert into public.profiles (id, email, display_name)
select
  auth_user.id,
  auth_user.email,
  coalesce(
    auth_user.raw_user_meta_data ->> 'full_name',
    split_part(coalesce(auth_user.email, ''), '@', 1)
  )
from auth.users auth_user
on conflict (id) do nothing;

alter table public.organization_members
  drop constraint if exists organization_members_role_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.organization_members'::regclass
      and conname = 'organization_members_role_check'
  ) then
    alter table public.organization_members
      add constraint organization_members_role_check
      check (role in ('owner', 'admin', 'operator', 'auditor', 'analyst', 'viewer'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.organization_members'::regclass
      and conname = 'organization_members_status_check'
  ) then
    alter table public.organization_members
      add constraint organization_members_status_check
      check (status in ('active', 'invited', 'revoked'));
  end if;

  -- Esta segunda FK permite a PostgREST resolver de forma segura el perfil
  -- publico asociado sin exponer el schema auth por la Data API.
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.organization_members'::regclass
      and conname = 'organization_members_profile_fkey'
  ) then
    alter table public.organization_members
      add constraint organization_members_profile_fkey
      foreign key (user_id) references public.profiles(id) on delete cascade
      not valid;
  end if;
end $$;

alter table public.organization_members
  validate constraint organization_members_profile_fkey;

create index if not exists organization_members_org_status_idx
  on public.organization_members (organization_id, status, role);

create index if not exists organization_members_invited_by_idx
  on public.organization_members (invited_by)
  where invited_by is not null;

drop trigger if exists set_updated_at on public.organization_members;
create trigger set_updated_at
  before update on public.organization_members
  for each row execute function private.set_updated_at();

-- Permite que un miembro vea los perfiles del equipo con el que comparte una
-- organizacion. La identidad del llamador siempre se valida dentro de la
-- funcion y el helper no se expone por la Data API.
create or replace function private.shares_organization_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members caller
    join public.organization_members target
      on target.organization_id = caller.organization_id
    where caller.user_id = (select auth.uid())
      and caller.active = true
      and caller.status <> 'revoked'
      and target.user_id = target_user_id
  );
$$;

revoke all on function private.shares_organization_with(uuid)
  from public, anon, authenticated, service_role;
grant execute on function private.shares_organization_with(uuid) to authenticated;

drop policy if exists profiles_team_read on public.profiles;
create policy profiles_team_read
on public.profiles
for select to authenticated
using ((select private.shares_organization_with(id)));

-- Las invitaciones se crean en una Edge Function con secret key. Estas RPC
-- solo realizan cambios de rol o revocacion despues de comprobar al llamador.
create or replace function public.set_organization_member_role(
  target_organization_id uuid,
  target_user_id uuid,
  new_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_role text;
begin
  if (select auth.uid()) is null then
    raise exception 'Se requiere una sesion autenticada';
  end if;

  if not private.has_organization_role(target_organization_id, array['owner', 'admin']) then
    raise exception 'No tienes permiso para cambiar roles';
  end if;

  if new_role not in ('admin', 'operator', 'auditor') then
    raise exception 'Rol no permitido';
  end if;

  select role into current_role
  from public.organization_members
  where organization_id = target_organization_id
    and user_id = target_user_id;

  if current_role is null then
    raise exception 'El usuario no pertenece a la organizacion';
  end if;

  if current_role = 'owner' then
    raise exception 'El rol del propietario no se modifica desde este modulo';
  end if;

  update public.organization_members
  set role = new_role,
      updated_at = now()
  where organization_id = target_organization_id
    and user_id = target_user_id;
end;
$$;

create or replace function public.revoke_organization_member(
  target_organization_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_role text;
begin
  if (select auth.uid()) is null then
    raise exception 'Se requiere una sesion autenticada';
  end if;

  if not private.has_organization_role(target_organization_id, array['owner', 'admin']) then
    raise exception 'No tienes permiso para revocar accesos';
  end if;

  select role into target_role
  from public.organization_members
  where organization_id = target_organization_id
    and user_id = target_user_id
    and active = true;

  if target_role is null then
    raise exception 'El usuario no tiene un acceso activo';
  end if;

  if target_role = 'owner' then
    raise exception 'El acceso del propietario no se revoca desde este modulo';
  end if;

  if target_user_id = (select auth.uid()) then
    raise exception 'No puedes revocar tu propio acceso';
  end if;

  update public.organization_members
  set active = false,
      status = 'revoked',
      revoked_at = now(),
      updated_at = now()
  where organization_id = target_organization_id
    and user_id = target_user_id;
end;
$$;

revoke all on function public.set_organization_member_role(uuid, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.revoke_organization_member(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.set_organization_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.revoke_organization_member(uuid, uuid) to authenticated;

-- Una invitacion se vuelve activa unicamente cuando Supabase registra el
-- primer inicio de sesion. Un usuario revocado nunca se reactiva por este trigger.
create or replace function private.activate_invited_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.last_sign_in_at is not null
     and new.last_sign_in_at is distinct from old.last_sign_in_at then
    update public.organization_members
    set status = 'active',
        active = true,
        accepted_at = coalesce(accepted_at, now()),
        updated_at = now()
    where user_id = new.id
      and status = 'invited';
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_first_sign_in on auth.users;
create trigger on_auth_user_first_sign_in
  after update of last_sign_in_at on auth.users
  for each row execute function private.activate_invited_membership();

revoke all on function private.activate_invited_membership()
  from public, anon, authenticated, service_role;

-- Operador reemplaza a analyst como nombre visible. Se conserva analyst para
-- datos ya creados; auditor y viewer permanecen de solo lectura.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'companies', 'employees', 'beneficiaries', 'affiliate_documents',
    'novelties', 'pila_forms', 'form_templates', 'stamp_presets',
    'generated_forms'
  ] loop
    execute format('drop policy if exists tenant_write on public.%I', table_name);
    execute format('drop policy if exists tenant_insert on public.%I', table_name);
    execute format('drop policy if exists tenant_update on public.%I', table_name);
    execute format('drop policy if exists tenant_delete on public.%I', table_name);

    execute format(
      'create policy tenant_insert on public.%I for insert to authenticated with check ((select private.has_organization_role(organization_id, array[''owner'',''admin'',''operator'',''analyst''])))',
      table_name
    );
    execute format(
      'create policy tenant_update on public.%I for update to authenticated using ((select private.has_organization_role(organization_id, array[''owner'',''admin'',''operator'',''analyst'']))) with check ((select private.has_organization_role(organization_id, array[''owner'',''admin'',''operator'',''analyst''])))',
      table_name
    );
    execute format(
      'create policy tenant_delete on public.%I for delete to authenticated using ((select private.has_organization_role(organization_id, array[''owner'',''admin'',''operator'',''analyst''])))',
      table_name
    );
  end loop;
end $$;

drop policy if exists support_documents_tenant_write on public.soporte_documentos;
drop policy if exists support_documents_tenant_insert on public.soporte_documentos;
drop policy if exists support_documents_tenant_update on public.soporte_documentos;
drop policy if exists support_documents_tenant_delete on public.soporte_documentos;

create policy support_documents_tenant_insert
on public.soporte_documentos
for insert to authenticated
with check ((select private.has_organization_role(organization_id, array['owner','admin','operator','analyst'])));

create policy support_documents_tenant_update
on public.soporte_documentos
for update to authenticated
using ((select private.has_organization_role(organization_id, array['owner','admin','operator','analyst'])))
with check ((select private.has_organization_role(organization_id, array['owner','admin','operator','analyst'])));

create policy support_documents_tenant_delete
on public.soporte_documentos
for delete to authenticated
using ((select private.has_organization_role(organization_id, array['owner','admin','operator','analyst'])));

create or replace function private.can_access_storage_path(
  object_name text,
  require_write boolean default false
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  organization_id uuid;
begin
  organization_id := split_part(object_name, '/', 1)::uuid;
  if require_write then
    return private.has_organization_role(
      organization_id,
      array['owner', 'admin', 'operator', 'analyst']
    );
  end if;
  return private.is_organization_member(organization_id);
exception when others then
  return false;
end;
$$;

revoke all on function private.can_access_storage_path(text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function private.can_access_storage_path(text, boolean) to authenticated;

grant usage on schema public to authenticated;
grant select on table public.organization_members, public.profiles to authenticated;
grant execute on function public.set_organization_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.revoke_organization_member(uuid, uuid) to authenticated;

comment on table public.organization_members is
  'Usuarios internos de cada tenant. No confundir con public.employees, que contiene afiliados/cotizantes para formularios EPS.';
