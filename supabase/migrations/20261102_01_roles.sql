-- ============================================================================
-- 01. Roles canónicos, estado de verificación y auditoría
--
-- Aplicar antes de la migración 02. Es seguro ejecutarla sobre la base actual:
-- renombra `user_type` a `role`, normaliza los valores existentes y deriva el
-- estado de verificación de los datos que ya están guardados.
--
-- Rollback: supabase/migrations/20261102_01_roles_rollback.sql
-- ============================================================================

begin;

-- 1. `user_type` -> `role` -----------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'user_type'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'role'
  ) then
    alter table public.user_profiles rename column user_type to role;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'role'
  ) then
    alter table public.user_profiles add column role text;
  end if;
end $$;

-- 2. Normalizar valores heredados ---------------------------------------------
-- `Basic User` era un cliente; un rol ausente también es un cliente. Los roles
-- de personal deben asignarse explícitamente, nunca por defecto.
update public.user_profiles
set role = case
  when role is null then 'customer'
  when lower(replace(replace(trim(role), ' ', ''), '_', '')) in ('crmsuperadmin', 'superadmin') then 'crm_superadmin'
  when lower(replace(replace(trim(role), ' ', ''), '_', '')) in ('admin', 'administrador') then 'admin'
  when lower(replace(replace(trim(role), ' ', ''), '_', '')) = 'supervisor' then 'supervisor'
  when lower(replace(replace(trim(role), ' ', ''), '_', '')) in ('basicuser', 'customer', 'cliente') then 'customer'
  else 'customer'
end;

alter table public.user_profiles alter column role set default 'customer';
alter table public.user_profiles alter column role set not null;

alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('crm_superadmin', 'admin', 'supervisor', 'customer'));

-- 3. Estado de verificación ----------------------------------------------------
-- Permisos (`role`) y flujo de verificación (`verification_status`) son cosas
-- distintas: la cola se filtra por `submitted`, no por rol.
alter table public.user_profiles add column if not exists verification_status text;

update public.user_profiles
set verification_status = case
  when role in ('crm_superadmin', 'admin', 'supervisor') then 'not_required'
  when confirmacion_verificado = true then 'approved'
  when verification_pdf is not null and verification_pdf <> '' then 'submitted'
  else 'pending'
end
where verification_status is null;

alter table public.user_profiles alter column verification_status set default 'pending';
alter table public.user_profiles alter column verification_status set not null;

alter table public.user_profiles drop constraint if exists user_profiles_verification_status_check;
alter table public.user_profiles
  add constraint user_profiles_verification_status_check
  check (verification_status in ('not_required', 'pending', 'submitted', 'approved', 'rejected'));

-- 4. Trazabilidad de la revisión ----------------------------------------------
alter table public.user_profiles
  add column if not exists verification_reviewed_by uuid references public.user_profiles(id) on delete set null;
alter table public.user_profiles
  add column if not exists verification_reviewed_at timestamptz;

-- 5. Auditoría de cambios de rol ----------------------------------------------
create table if not exists public.role_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.user_profiles(id) on delete set null,
  target_id uuid not null references public.user_profiles(id) on delete cascade,
  previous_role text,
  new_role text not null,
  created_at timestamptz not null default now()
);

create index if not exists role_audit_created_at_idx on public.role_audit (created_at desc);
create index if not exists role_audit_target_id_idx on public.role_audit (target_id);

-- 6. Fuente única del rol para RLS --------------------------------------------
-- `security definer` evita recursión cuando las políticas de user_profiles
-- necesitan leer el rol del propio llamador.
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_profiles where id = auth.uid() limit 1;
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

commit;
