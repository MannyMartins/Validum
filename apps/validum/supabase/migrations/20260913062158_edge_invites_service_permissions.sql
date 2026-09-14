-- =============================================================================
-- VALIDUM - PERMISOS MINIMOS PARA INVITACIONES DESDE EDGE FUNCTIONS
-- =============================================================================

-- Las tablas fueron creadas mediante SQL y no heredaron permisos CRUD para
-- service_role. La API administrativa de Auth sí podía crear la invitación,
-- pero el segundo paso (registrar la membresía) fallaba con permission denied.
-- Se conceden únicamente las operaciones que usa invite-organization-user.
grant usage on schema public to service_role;
grant select on table public.profiles, public.organizations to service_role;
grant select, insert, update on table public.organization_members to service_role;
