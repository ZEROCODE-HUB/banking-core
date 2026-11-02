-- ============================================================================
-- Rollback de 20261102_04_rls.sql
--
-- Devuelve el acceso permisivo anterior. Solo usar si la aplicación deja de
-- funcionar por una política y se necesita recuperar el servicio.
-- ============================================================================

begin;

drop trigger if exists user_profiles_enforce_role_change on public.user_profiles;
drop function if exists public.enforce_role_change();

drop policy if exists user_profiles_select on public.user_profiles;
drop policy if exists user_profiles_update on public.user_profiles;
drop policy if exists role_audit_select on public.role_audit;
drop policy if exists role_audit_insert on public.role_audit;

alter table public.user_profiles disable row level security;
alter table public.role_audit disable row level security;

do $$
declare
  tabla text;
begin
  foreach tabla in array array[
    'ahorros',
    'transactions',
    'cdats',
    'confirmacionretiros',
    'services',
    'habilitar_credito',
    'credito_solicitado_empresa',
    'retiros_cdat',
    'empresa',
    'vehiculos',
    'comentarios'
  ]
  loop
    if to_regclass(format('public.%I', tabla)) is not null then
      execute format('drop policy if exists %I on public.%I', tabla || '_staff_all', tabla);
      execute format('alter table public.%I disable row level security', tabla);
    end if;
  end loop;
end $$;

-- Restaurar los grants que Supabase concede por defecto.
grant select, insert, update, delete on all tables in schema public to anon;
grant usage, select on all sequences in schema public to anon;

drop function if exists public.is_staff();
drop function if exists public.is_superadmin();

commit;
