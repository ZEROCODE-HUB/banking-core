-- ============================================================================
-- 04. Crear novedades de saldo: superadmin y admin únicamente
--
-- Requiere 20261102_03_novedades_saldo.sql.
--
-- Cambia la guardia de `crear_novedad_saldo` para que un supervisor no pueda
-- iniciar una novedad. La verificación y la aplicación ya estaban limitadas a
-- `crm_superadmin` y `admin`; ahora las tres operaciones comparten el mismo
-- conjunto de roles.
--
-- Rollback: supabase/migrations/20261102_04_novedad_roles_rollback.sql
-- ============================================================================

begin;

create or replace function public.crear_novedad_saldo(
  p_ahorros_id uuid,
  p_operation_type text,
  p_amount numeric,
  p_detail text,
  p_idempotency_key uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_role text := public.current_user_role();
  v_account public.ahorros%rowtype;
  v_existing public.novedades_saldo%rowtype;
  v_id uuid;
  v_reference text;
begin
  if v_actor is null then
    raise exception 'Sesión no válida' using errcode = '28000';
  end if;

  -- Un supervisor puede consultar, pero no iniciar una novedad de saldo.
  if v_role not in ('crm_superadmin', 'admin') then
    raise exception 'No autorizado para crear novedades de saldo' using errcode = '42501';
  end if;

  if p_operation_type is null or p_operation_type not in ('add', 'debit') then
    raise exception 'Tipo de operación inválido';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto debe ser mayor a cero';
  end if;

  if p_detail is null or length(btrim(p_detail)) = 0 then
    raise exception 'El detalle es obligatorio';
  end if;

  select * into v_account from public.ahorros where id = p_ahorros_id;
  if not found then
    raise exception 'Cuenta de ahorro no encontrada';
  end if;

  -- Reintento del mismo formulario: devolver la solicitud ya creada.
  if p_idempotency_key is not null then
    select * into v_existing
    from public.novedades_saldo
    where requested_by = v_actor and idempotency_key = p_idempotency_key;

    if found then
      return jsonb_build_object(
        'id', v_existing.id,
        'reference', v_existing.reference,
        'status', v_existing.status,
        'expires_at', v_existing.otp_expires_at,
        'reused', true
      );
    end if;
  end if;

  v_reference := 'NOV-' || to_char(now(), 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.novedades_saldo (
    reference,
    ahorros_id,
    target_user_ref,
    target_user_name,
    target_user_email,
    operation_type,
    amount,
    detail,
    status,
    requested_by,
    idempotency_key
  ) values (
    v_reference,
    v_account.id,
    v_account.user_ref,
    v_account.user_name,
    v_account.user_email,
    p_operation_type,
    p_amount,
    btrim(p_detail),
    'pending_otp',
    v_actor,
    coalesce(p_idempotency_key, gen_random_uuid())
  )
  returning id into v_id;

  insert into public.novedades_saldo_eventos (novedad_id, event_type, actor_id, metadata)
  values (
    v_id,
    'created',
    v_actor,
    jsonb_build_object(
      'operation_type', p_operation_type,
      'amount', p_amount,
      'ahorros_id', v_account.id
    )
  );

  return jsonb_build_object(
    'id', v_id,
    'reference', v_reference,
    'status', 'pending_otp',
    'expires_at', null,
    'reused', false
  );
end;
$$;

-- `create or replace` conserva los permisos, pero se declaran explícitamente
-- para que la migración sea reproducible en una base restaurada.
revoke all on function public.crear_novedad_saldo(uuid, text, numeric, text, uuid) from public, anon;
grant execute on function public.crear_novedad_saldo(uuid, text, numeric, text, uuid) to authenticated;

commit;
