-- ============================================================================
-- Rollback de 20261102_02_role_guard.sql
--
-- No tocar si la migración de RLS ya está aplicada: esa migración reutiliza
-- `is_staff()` e `is_superadmin()`.
-- ============================================================================

begin;

drop trigger if exists user_profiles_enforce_role_change on public.user_profiles;
drop function if exists public.enforce_role_change();
drop function if exists public.is_staff();
drop function if exists public.is_superadmin();

commit;
