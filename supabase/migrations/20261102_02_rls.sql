-- ============================================================================
-- 02. RLS: el servidor es el límite real del rol
--
-- Requiere 20261102_01_roles.sql. Aplicar primero en un proyecto de staging:
-- las políticas cambian el acceso de todas las sesiones autenticadas.
--
-- Objetivo:
--   * nadie sin sesión lee ni escribe datos (se revoca `anon`);
--   * un cliente solo ve su propio perfil;
--   * el personal ve y edita perfiles;
--   * solo CRM SuperAdmin cambia roles y ve la auditoría;
--   * las tablas de negocio quedan restringidas al personal.
--
-- Rollback: supabase/migrations/20261102_02_rls_rollback.sql
-- ============================================================================

begin;

-- 1. Helpers de rol ------------------------------------------------------------
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

-- 2. Perfiles ------------------------------------------------------------------
alter table public.user_profiles enable row level security;

drop policy if exists user_profiles_select on public.user_profiles;
create policy user_profiles_select
  on public.user_profiles
  for select
  to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists user_profiles_update on public.user_profiles;
create policy user_profiles_update
  on public.user_profiles
  for update
  to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Sin políticas de insert/delete: crear o borrar perfiles queda reservado al
-- service role (provisionamiento y recuperación).

-- 3. Un rol solo lo cambia el superadministrador -------------------------------
create or replace function public.enforce_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- El service role se usa para recuperación y migraciones.
  if coalesce(auth.role(), '') = 'service_role' then
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

-- 4. Auditoría -----------------------------------------------------------------
alter table public.role_audit enable row level security;

drop policy if exists role_audit_select on public.role_audit;
create policy role_audit_select
  on public.role_audit
  for select
  to authenticated
  using (public.is_superadmin());

drop policy if exists role_audit_insert on public.role_audit;
create policy role_audit_insert
  on public.role_audit
  for insert
  to authenticated
  with check (public.is_superadmin());

-- 5. Tablas de negocio ---------------------------------------------------------
-- La aplicación de este repositorio es una consola interna: no hay portal de
-- clientes. Por eso todas estas tablas quedan para el personal. Cuando exista
-- un portal de clientes se agregan políticas de lectura por propietario.
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
      execute format('alter table public.%I enable row level security', tabla);
      execute format('drop policy if exists %I on public.%I', tabla || '_staff_all', tabla);
      execute format(
        'create policy %I on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())',
        tabla || '_staff_all',
        tabla
      );
    end if;
  end loop;
end $$;

-- 6. Cerrar el acceso anónimo --------------------------------------------------
-- La clave anónima sigue siendo necesaria para iniciar sesión, pero sin sesión
-- no debe poder leer ni escribir ninguna tabla pública.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

commit;
