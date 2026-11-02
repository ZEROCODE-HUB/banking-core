-- ============================================================================
-- Rollback de 20261102_01_roles.sql
--
-- Devuelve `role` a `user_type` y elimina el estado de verificación y la
-- auditoría. Se pierden los estados `approved`/`rejected` que no estén
-- reflejados en `confirmacion_verificado`.
-- ============================================================================

begin;

drop function if exists public.current_user_role();
drop table if exists public.role_audit;

alter table public.user_profiles drop constraint if exists user_profiles_verification_status_check;
alter table public.user_profiles drop column if exists verification_reviewed_at;
alter table public.user_profiles drop column if exists verification_reviewed_by;
alter table public.user_profiles drop column if exists verification_status;

alter table public.user_profiles drop constraint if exists user_profiles_role_check;

update public.user_profiles
set role = case role
  when 'crm_superadmin' then 'CRM SuperAdmin'
  when 'admin' then 'Admin'
  when 'supervisor' then 'Supervisor'
  else 'Basic User'
end;

alter table public.user_profiles alter column role drop default;
alter table public.user_profiles alter column role drop not null;
alter table public.user_profiles rename column role to user_type;

commit;
