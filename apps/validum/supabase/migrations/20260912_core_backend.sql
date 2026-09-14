-- =============================================================================
-- VALIDUM - BACKEND PRINCIPAL MULTIEMPRESA PARA SUPABASE
-- Ejecutar en Supabase SQL Editor con un usuario administrador del proyecto.
-- La aplicacion cliente utiliza exclusivamente la anon key; nunca service_role.
-- =============================================================================

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Identidad, organizaciones y membresias
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'analyst'
    check (role in ('owner', 'admin', 'analyst', 'viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  active_company_id text,
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- Las funciones SECURITY DEFINER evitan recursion de RLS al validar membresias.
create or replace function private.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.active = true
  );
$$;

create or replace function private.has_organization_role(
  target_organization_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members membership
    where membership.organization_id = target_organization_id
      and membership.user_id = (select auth.uid())
      and membership.active = true
      and membership.role = any(allowed_roles)
  );
$$;

revoke all on function private.is_organization_member(uuid) from public, anon, authenticated, service_role;
revoke all on function private.has_organization_role(uuid, text[]) from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.is_organization_member(uuid) to authenticated;
grant execute on function private.has_organization_role(uuid, text[]) to authenticated;

-- Crea el primer tenant del usuario de manera atomica. No permite crear
-- organizaciones para otro usuario ni agregarse a organizaciones ajenas.
create or replace function public.create_organization_with_owner(organization_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_organization_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesion autenticada';
  end if;

  if length(trim(coalesce(organization_name, ''))) = 0 then
    raise exception 'El nombre de la organizacion es obligatorio';
  end if;

  insert into public.organizations (name, created_by)
  values (trim(organization_name), auth.uid())
  returning id into new_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (new_organization_id, auth.uid(), 'owner');

  insert into public.user_preferences (user_id, organization_id)
  values (auth.uid(), new_organization_id)
  on conflict (user_id) do update
    set organization_id = excluded.organization_id,
        updated_at = now();

  -- Reclama metadatos creados por la version anterior, que solo utilizaba
  -- owner_id. Los objetos antiguos de Storage conservan su ruta y siguen
  -- protegidos por la politica legacy_owner definida al final del script.
  if to_regclass('public.soporte_documentos') is not null then
    execute
      'update public.soporte_documentos set organization_id = $1 where organization_id is null and owner_id = $2'
      using new_organization_id, auth.uid();
  end if;

  return new_organization_id;
end;
$$;

revoke all on function public.create_organization_with_owner(text) from public;
grant execute on function public.create_organization_with_owner(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Directorio empresarial y afiliados
-- Se conservan columnas buscables y un JSONB con el modelo completo de React.
-- Esto evita perder campos cuando evolucionen los formularios de cada EPS.
-- -----------------------------------------------------------------------------

create table if not exists public.companies (
  row_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id text not null,
  document_type text not null default 'NIT',
  document_number text not null,
  verification_digit text,
  legal_name text not null,
  trade_name text,
  department text,
  city text,
  address text,
  phone text,
  email text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, company_id),
  unique (organization_id, document_type, document_number)
);

create table if not exists public.employees (
  row_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id text not null,
  company_id text,
  document_type text not null,
  document_number text not null,
  first_name text not null,
  middle_name text,
  first_surname text not null,
  second_surname text,
  status text not null default 'ACTIVO',
  email text,
  phone text,
  eps_name text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_id),
  unique (organization_id, document_type, document_number),
  foreign key (organization_id, company_id)
    references public.companies(organization_id, company_id)
    on update cascade on delete set null (company_id)
);

create table if not exists public.beneficiaries (
  row_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  beneficiary_id text not null,
  employee_id text not null,
  relationship text not null,
  document_type text not null,
  document_number text not null,
  first_name text not null,
  middle_name text,
  first_surname text not null,
  second_surname text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, beneficiary_id),
  unique (organization_id, employee_id, document_type, document_number),
  foreign key (organization_id, employee_id)
    references public.employees(organization_id, employee_id)
    on update cascade on delete cascade
);

create table if not exists public.affiliate_documents (
  row_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id text not null,
  employee_id text not null,
  beneficiary_id text,
  category text not null,
  original_name text not null,
  content_type text not null,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, document_id),
  unique (organization_id, storage_path),
  foreign key (organization_id, employee_id)
    references public.employees(organization_id, employee_id)
    on update cascade on delete cascade
);

create table if not exists public.novelties (
  row_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  novelty_id text not null,
  employee_id text not null,
  novelty_type text not null,
  start_date date not null,
  end_date date,
  status text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, novelty_id),
  foreign key (organization_id, employee_id)
    references public.employees(organization_id, employee_id)
    on update cascade on delete cascade
);

create table if not exists public.pila_forms (
  row_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  form_id text not null,
  period text not null,
  form_number text not null,
  payment_status text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, form_id),
  unique (organization_id, form_number)
);

-- -----------------------------------------------------------------------------
-- Plantillas, mapeos, sellos e historial de PDFs
-- -----------------------------------------------------------------------------

create table if not exists public.form_templates (
  row_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id text not null,
  name text not null,
  entity_name text not null,
  entity_type text not null check (entity_type in ('EPS','ARL','AFP','CCF','IPS','OTRO')),
  form_type text not null,
  description text,
  pdf_storage_path text,
  thumbnail_storage_path text,
  page_count integer not null check (page_count > 0),
  page_sizes jsonb,
  layout_fingerprint text,
  fields jsonb not null default '[]'::jsonb check (jsonb_typeof(fields) = 'array'),
  mapping_status text not null default 'draft' check (mapping_status in ('draft','ready')),
  version integer not null default 1 check (version > 0),
  definition jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, template_id)
);

create table if not exists public.stamp_presets (
  row_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stamp_id text not null,
  name text not null,
  definition jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, stamp_id)
);

create table if not exists public.generated_forms (
  row_id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  generated_form_id text not null,
  template_id text,
  employee_id text,
  template_name text not null,
  employee_name text not null,
  pdf_storage_path text not null,
  manual_fields jsonb not null default '{}'::jsonb,
  procedure_fields jsonb not null default '{}'::jsonb,
  source_pdf_file_name text,
  generated_at timestamptz not null default now(),
  unique (organization_id, generated_form_id),
  foreign key (organization_id, template_id)
    references public.form_templates(organization_id, template_id)
    on update cascade on delete set null (template_id),
  foreign key (organization_id, employee_id)
    references public.employees(organization_id, employee_id)
    on update cascade on delete set null (employee_id)
);

-- Compatibilidad con la biblioteca de soportes ya implementada.
create table if not exists public.soporte_documentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  owner_id uuid default auth.uid() references auth.users(id) on delete set null,
  employee_id text,
  nombre varchar(255) not null,
  categoria varchar(64) not null default 'Otro',
  tipo_archivo varchar(32) not null,
  tamano_bytes bigint not null default 0 check (tamano_bytes >= 0),
  storage_path text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, storage_path)
);

alter table if exists public.soporte_documentos
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade;
alter table if exists public.soporte_documentos
  add column if not exists employee_id text;

create index if not exists companies_org_name_idx
  on public.companies (organization_id, legal_name);
create index if not exists organization_members_user_idx
  on public.organization_members (user_id, active, organization_id);
create index if not exists employees_org_name_idx
  on public.employees (organization_id, first_surname, first_name);
create index if not exists employees_org_company_idx
  on public.employees (organization_id, company_id);
create index if not exists beneficiaries_org_employee_idx
  on public.beneficiaries (organization_id, employee_id);
create index if not exists affiliate_documents_org_employee_idx
  on public.affiliate_documents (organization_id, employee_id);
create index if not exists novelties_org_employee_idx
  on public.novelties (organization_id, employee_id);
create index if not exists templates_org_entity_idx
  on public.form_templates (organization_id, entity_name, form_type);
create index if not exists generated_forms_org_date_idx
  on public.generated_forms (organization_id, generated_at desc);
create index if not exists generated_forms_org_template_idx
  on public.generated_forms (organization_id, template_id);
create index if not exists generated_forms_org_employee_idx
  on public.generated_forms (organization_id, employee_id);
create index if not exists support_documents_org_date_idx
  on public.soporte_documentos (organization_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Timestamps y perfil automatico
-- -----------------------------------------------------------------------------

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'organizations', 'user_preferences', 'companies', 'employees',
    'beneficiaries', 'novelties', 'pila_forms', 'form_templates', 'stamp_presets',
    'soporte_documentos'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      table_name
    );
  end loop;
end $$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

revoke all on function private.set_updated_at() from public, anon, authenticated, service_role;
revoke all on function private.handle_new_auth_user() from public, anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- RLS: ningun dato de negocio es publico.
-- -----------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.user_preferences enable row level security;
alter table public.companies enable row level security;
alter table public.employees enable row level security;
alter table public.beneficiaries enable row level security;
alter table public.affiliate_documents enable row level security;
alter table public.novelties enable row level security;
alter table public.pila_forms enable row level security;
alter table public.form_templates enable row level security;
alter table public.stamp_presets enable row level security;
alter table public.generated_forms enable row level security;
alter table public.soporte_documentos enable row level security;

drop policy if exists profiles_own_row on public.profiles;
create policy profiles_own_row on public.profiles
  for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists organizations_member_read on public.organizations;
create policy organizations_member_read on public.organizations
  for select to authenticated
  using ((select private.is_organization_member(id)));

drop policy if exists organizations_admin_update on public.organizations;
create policy organizations_admin_update on public.organizations
  for update to authenticated
  using ((select private.has_organization_role(id, array['owner','admin'])))
  with check ((select private.has_organization_role(id, array['owner','admin'])));

drop policy if exists memberships_member_read on public.organization_members;
create policy memberships_member_read on public.organization_members
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_organization_member(organization_id)));

drop policy if exists preferences_own_row on public.user_preferences;
create policy preferences_own_row on public.user_preferences
  for all to authenticated
  using (user_id = (select auth.uid()) and (select private.is_organization_member(organization_id)))
  with check (user_id = (select auth.uid()) and (select private.is_organization_member(organization_id)));

-- Politica CRUD comun: miembros editan; viewer solo consulta.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'companies', 'employees', 'beneficiaries', 'affiliate_documents', 'novelties',
    'pila_forms', 'form_templates', 'stamp_presets', 'generated_forms'
  ]
  loop
    execute format('drop policy if exists tenant_read on public.%I', table_name);
    execute format('drop policy if exists tenant_write on public.%I', table_name);
    execute format(
      'create policy tenant_read on public.%I for select to authenticated using ((select private.is_organization_member(organization_id)))',
      table_name
    );
    execute format(
      'create policy tenant_write on public.%I for all to authenticated using ((select private.has_organization_role(organization_id, array[''owner'',''admin'',''analyst'']))) with check ((select private.has_organization_role(organization_id, array[''owner'',''admin'',''analyst''])))',
      table_name
    );
  end loop;
end $$;

drop policy if exists "Permitir lectura publica o autenticada de soportes" on public.soporte_documentos;
drop policy if exists "Permitir insercion de soportes" on public.soporte_documentos;
drop policy if exists "Permitir actualizacion de soportes" on public.soporte_documentos;
drop policy if exists "Permitir eliminacion de soportes" on public.soporte_documentos;
drop policy if exists support_documents_tenant_read on public.soporte_documentos;
drop policy if exists support_documents_tenant_write on public.soporte_documentos;
create policy support_documents_tenant_read on public.soporte_documentos
  for select to authenticated
  using ((select private.is_organization_member(organization_id)));
create policy support_documents_tenant_write on public.soporte_documentos
  for all to authenticated
  using ((select private.has_organization_role(organization_id, array['owner','admin','analyst'])))
  with check ((select private.has_organization_role(organization_id, array['owner','admin','analyst'])));

-- -----------------------------------------------------------------------------
-- Storage privado. La primera carpeta de cada objeto DEBE ser organization_id.
-- Ejemplo: <organization_id>/templates/<template_id>/base.pdf
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('documentos-soporte', 'documentos-soporte', false, 26214400,
   array['application/pdf','image/png','image/jpeg','image/webp']),
  ('validum-templates', 'validum-templates', false, 52428800,
   array['application/pdf','image/png','image/jpeg']),
  ('validum-generated', 'validum-generated', false, 52428800,
   array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.can_access_storage_path(object_name text, require_write boolean default false)
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
    return private.has_organization_role(organization_id, array['owner','admin','analyst']);
  end if;
  return private.is_organization_member(organization_id);
exception when others then
  return false;
end;
$$;

revoke all on function private.can_access_storage_path(text, boolean) from public, anon, authenticated, service_role;
grant execute on function private.can_access_storage_path(text, boolean) to authenticated;

drop policy if exists "Permitir lectura de bucket documentos-soporte" on storage.objects;
drop policy if exists "Permitir subida a bucket documentos-soporte" on storage.objects;
drop policy if exists "Permitir actualizacion en bucket documentos-soporte" on storage.objects;
drop policy if exists "Permitir borrado en bucket documentos-soporte" on storage.objects;
drop policy if exists validum_private_files_read on storage.objects;
drop policy if exists validum_private_files_insert on storage.objects;
drop policy if exists validum_private_files_update on storage.objects;
drop policy if exists validum_private_files_delete on storage.objects;
drop policy if exists validum_legacy_owner_read on storage.objects;
drop policy if exists validum_legacy_owner_update on storage.objects;
drop policy if exists validum_legacy_owner_delete on storage.objects;

create policy validum_private_files_read on storage.objects
  for select to authenticated
  using (
    bucket_id in ('documentos-soporte','validum-templates','validum-generated')
    and (select private.can_access_storage_path(name, false))
  );
create policy validum_private_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('documentos-soporte','validum-templates','validum-generated')
    and (select private.can_access_storage_path(name, true))
  );
create policy validum_private_files_update on storage.objects
  for update to authenticated
  using (
    bucket_id in ('documentos-soporte','validum-templates','validum-generated')
    and (select private.can_access_storage_path(name, true))
  )
  with check (
    bucket_id in ('documentos-soporte','validum-templates','validum-generated')
    and (select private.can_access_storage_path(name, true))
  );
create policy validum_private_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('documentos-soporte','validum-templates','validum-generated')
    and (select private.can_access_storage_path(name, true))
  );

-- Solo para archivos creados por la version previa, cuyas rutas no comenzaban
-- con organization_id. No permite nuevas inserciones con el esquema antiguo.
create policy validum_legacy_owner_read on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos-soporte' and owner_id = (select auth.uid())::text);
create policy validum_legacy_owner_update on storage.objects
  for update to authenticated
  using (bucket_id = 'documentos-soporte' and owner_id = (select auth.uid())::text)
  with check (bucket_id = 'documentos-soporte' and owner_id = (select auth.uid())::text);
create policy validum_legacy_owner_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos-soporte' and owner_id = (select auth.uid())::text);

grant usage on schema public to authenticated;
revoke all on table
  public.profiles,
  public.organizations,
  public.organization_members,
  public.user_preferences,
  public.companies,
  public.employees,
  public.beneficiaries,
  public.affiliate_documents,
  public.novelties,
  public.pila_forms,
  public.form_templates,
  public.stamp_presets,
  public.generated_forms,
  public.soporte_documentos
from anon;
grant select, insert, update, delete on table
  public.profiles,
  public.organizations,
  public.organization_members,
  public.user_preferences,
  public.companies,
  public.employees,
  public.beneficiaries,
  public.affiliate_documents,
  public.novelties,
  public.pila_forms,
  public.form_templates,
  public.stamp_presets,
  public.generated_forms,
  public.soporte_documentos
to authenticated;
