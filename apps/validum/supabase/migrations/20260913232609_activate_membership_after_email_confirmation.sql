create or replace function private.activate_membership_after_email_confirmation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    update public.organization_members
       set status = 'active',
           active = true,
           accepted_at = coalesce(accepted_at, now()),
           revoked_at = null,
           updated_at = now()
     where user_id = new.id
       and status = 'invited';
  end if;
  return new;
end;
$$;

revoke all on function private.activate_membership_after_email_confirmation() from public, anon, authenticated;

drop trigger if exists activate_membership_after_email_confirmation on auth.users;
create trigger activate_membership_after_email_confirmation
after update of email_confirmed_at on auth.users
for each row
execute function private.activate_membership_after_email_confirmation();

-- Corrige invitaciones que fueron aceptadas antes de instalar el disparador.
update public.organization_members as membership
   set status = 'active',
       active = true,
       accepted_at = coalesce(membership.accepted_at, now()),
       revoked_at = null,
       updated_at = now()
 where membership.status = 'invited'
   and exists (
     select 1
       from auth.users as auth_user
      where auth_user.id = membership.user_id
        and auth_user.email_confirmed_at is not null
   );
