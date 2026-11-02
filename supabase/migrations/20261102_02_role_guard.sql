-- ============================================================================
-- 02. Guardia de cambios de rol (sin RLS)
--
-- Se puede aplicar junto con 01. No activa RLS ni cambia el acceso a tablas:
-- solo impide que una sesión que no sea CRM SuperAdmin cambie un rol, y evita
-- que se elimine el último superadministrador.
--
-- Requiere 20261102_01_roles.sql.
-- Rollback: supabase/migrations/20261102_02_role_guard_rollback.sql
-- ============================================================================

begin;

-- Helpers que reutilizará la migración de RLS en la fase de endurecimiento.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role(), '') in ('crm_superadmin', 'admin', 'supervisor');
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role(), '') = 'crm_superadmin';
$$;

revoke all on function public.is_staff() from public;
revoke all on function public.is_superadmin() from public;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.is_superadmin() to authenticated;

create or replace function public.enforce_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sin JWT (SQL Editor, migraciones) o con service role, el cambio es
  -- administrativo y se permite. Las peticiones de la aplicación siempre
  -- traen un rol: authenticated o anon.
  if coalesce(auth.role(), '') in ('', 'service_role') then
    return new;
  end if;

  if new.role is distinct from old.role then
    if coalesce(public.current_user_role(), '') <> 'crm_superadmin' then
      raise exception 'Solo CRM SuperAdmin puede cambiar roles';
    end if;

    if old.role = 'crm_superadmin' and new.role <> 'crm_superadmin' then
      if (
        select count(*)
        from public.user_profiles
        where role = 'crm_superadmin' and id <> old.id
      ) = 0 then
        raise exception 'Debe existir al menos un CRM SuperAdmin';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists user_profiles_enforce_role_change on public.user_profiles;
create trigger user_profiles_enforce_role_change
  before update on public.user_profiles
  for each row
  execute function public.enforce_role_change();

commit;
