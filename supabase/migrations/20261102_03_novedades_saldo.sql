-- ============================================================================
-- 03. Novedad de saldo con OTP del lado del servidor y aplicación atómica
--
-- Requiere 20261102_01_roles.sql y 20261102_02_role_guard.sql.
--
-- Qué cambia:
--   * Crea `novedades_saldo` (solicitud + estado del OTP + referencia) y
--     `novedades_saldo_eventos` (bitácora de cada paso).
--   * El OTP se genera y se envía desde el proxy de correo, nunca desde el
--     navegador. La base guarda únicamente el hash bcrypt.
--   * `aplicar_novedad_saldo` bloquea la solicitud y la cuenta, valida el
--     saldo, inserta la transacción y mueve el saldo en una sola transacción.
--   * No se permite dejar el saldo en negativo. Si el negocio decide lo
--     contrario, este es el único punto que hay que ajustar.
--
-- Seguridad:
--   * Las tablas quedan sin permisos directos para `anon` y `authenticated`.
--     Solo se llega a ellas por las funciones `security definer`.
--   * `registrar_otp_novedad` solo se puede ejecutar con la service role key,
--     porque la usa el proxy y no el navegador.
--
-- Rollback: supabase/migrations/20261102_03_novedades_saldo_rollback.sql
-- ============================================================================

begin;

-- pgcrypto aporta `crypt` y `gen_salt`. Supabase lo instala en `extensions`;
-- el `search_path` de las funciones incluye también `public` por si una
-- instalación local lo tiene allí.
create extension if not exists pgcrypto with schema extensions;

-- 1. Solicitudes ---------------------------------------------------------------
create table if not exists public.novedades_saldo (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  ahorros_id uuid not null references public.ahorros(id) on delete restrict,
  target_user_ref uuid,
  target_user_name text,
  target_user_email text,
  operation_type text not null check (operation_type in ('add', 'debit')),
  amount numeric(14, 2) not null check (amount > 0),
  detail text not null check (length(btrim(detail)) > 0),
  status text not null default 'pending_otp' check (
    status in ('pending_otp', 'otp_sent', 'otp_verified', 'applied', 'expired', 'rejected', 'failed')
  ),
  requested_by uuid not null references public.user_profiles(id) on delete restrict,
  approved_by uuid references public.user_profiles(id) on delete set null,
  applied_by uuid references public.user_profiles(id) on delete set null,
  idempotency_key uuid not null default gen_random_uuid(),
  otp_hash text,
  otp_expires_at timestamptz,
  otp_attempts integer not null default 0 check (otp_attempts >= 0),
  otp_max_attempts integer not null default 5 check (otp_max_attempts between 1 and 20),
  otp_sent_at timestamptz,
  otp_verified_at timestamptz,
  transaction_id uuid references public.transactions(id) on delete set null,
  balance_before numeric(14, 2),
  balance_after numeric(14, 2),
  error_message text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint novedades_saldo_requester_idempotency_key unique (requested_by, idempotency_key)
);

create index if not exists novedades_saldo_status_idx on public.novedades_saldo (status);
create index if not exists novedades_saldo_ahorros_id_idx on public.novedades_saldo (ahorros_id);
create index if not exists novedades_saldo_requested_by_idx on public.novedades_saldo (requested_by);
create index if not exists novedades_saldo_created_at_idx on public.novedades_saldo (created_at desc);

-- 2. Bitácora -----------------------------------------------------------------
create table if not exists public.novedades_saldo_eventos (
  id bigserial primary key,
  novedad_id uuid not null references public.novedades_saldo(id) on delete cascade,
  event_type text not null,
  actor_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists novedades_saldo_eventos_novedad_id_idx
  on public.novedades_saldo_eventos (novedad_id, created_at);

-- 3. updated_at ---------------------------------------------------------------
create or replace function public.touch_novedad_saldo_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists novedades_saldo_touch_updated_at on public.novedades_saldo;
create trigger novedades_saldo_touch_updated_at
  before update on public.novedades_saldo
  for each row
  execute function public.touch_novedad_saldo_updated_at();

-- 4. Crear solicitud ----------------------------------------------------------
-- El actor sale de `auth.uid()`; el cliente no puede elegirlo. El usuario
-- destino y sus datos se leen de la cuenta de ahorro, no del navegador.
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

  if v_role not in ('crm_superadmin', 'admin', 'supervisor') then
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

-- 5. Registrar / renovar OTP --------------------------------------------------
-- Solo la service role key. El proxy genera el código, lo envía por correo y
-- llama aquí para guardar el hash. El navegador nunca recibe el código.
create or replace function public.registrar_otp_novedad(
  p_novedad_id uuid,
  p_otp text,
  p_ttl_minutes integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_novedad public.novedades_saldo%rowtype;
  v_expires_at timestamptz;
begin
  if coalesce(auth.role(), '') not in ('', 'service_role') then
    raise exception 'Solo el servicio de correo puede registrar el OTP' using errcode = '42501';
  end if;

  if p_otp is null or p_otp !~ '^[0-9]{6}$' then
    raise exception 'El OTP debe tener seis dígitos';
  end if;

  if p_ttl_minutes is null or p_ttl_minutes < 1 or p_ttl_minutes > 30 then
    raise exception 'Vigencia de OTP inválida';
  end if;

  select * into v_novedad
  from public.novedades_saldo
  where id = p_novedad_id
  for update;

  if not found then
    raise exception 'Novedad de saldo no encontrada';
  end if;

  if v_novedad.status = 'applied' then
    raise exception 'La novedad ya fue aplicada';
  end if;

  if v_novedad.status = 'otp_verified' then
    raise exception 'El OTP de esta novedad ya fue verificado';
  end if;

  if v_novedad.otp_sent_at is not null and v_novedad.otp_sent_at > now() - interval '30 seconds' then
    raise exception 'Espera unos segundos antes de reenviar el código';
  end if;

  v_expires_at := now() + make_interval(mins => p_ttl_minutes);

  update public.novedades_saldo
  set otp_hash = crypt(p_otp, gen_salt('bf', 10)),
      otp_expires_at = v_expires_at,
      otp_attempts = 0,
      otp_sent_at = now(),
      otp_verified_at = null,
      approved_by = null,
      status = 'otp_sent',
      error_message = null
  where id = v_novedad.id;

  insert into public.novedades_saldo_eventos (novedad_id, event_type, actor_id, metadata)
  values (
    v_novedad.id,
    'otp_sent',
    null,
    jsonb_build_object('expires_at', v_expires_at)
  );

  return jsonb_build_object(
    'id', v_novedad.id,
    'reference', v_novedad.reference,
    'expires_at', v_expires_at,
    'status', 'otp_sent'
  );
end;
$$;

-- 6. Verificar OTP ------------------------------------------------------------
-- La verificación la hace un aprobador (admin o superadmin). El OTP viaja al
-- buzón de operaciones y no se guarda en claro en ningún lado.
create or replace function public.verificar_otp_novedad(
  p_novedad_id uuid,
  p_otp text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_role text := public.current_user_role();
  v_novedad public.novedades_saldo%rowtype;
  v_attempts integer;
begin
  if v_actor is null then
    raise exception 'Sesión no válida' using errcode = '28000';
  end if;

  if v_role not in ('crm_superadmin', 'admin') then
    raise exception 'No autorizado para aprobar novedades de saldo' using errcode = '42501';
  end if;

  select * into v_novedad
  from public.novedades_saldo
  where id = p_novedad_id
  for update;

  if not found then
    raise exception 'Novedad de saldo no encontrada';
  end if;

  if v_novedad.status = 'applied' then
    return jsonb_build_object(
      'ok', true,
      'already_applied', true,
      'status', 'applied',
      'reference', v_novedad.reference
    );
  end if;

  if v_novedad.status = 'otp_verified' then
    return jsonb_build_object(
      'ok', true,
      'already_verified', true,
      'status', 'otp_verified',
      'reference', v_novedad.reference
    );
  end if;

  if v_novedad.status not in ('pending_otp', 'otp_sent') then
    return jsonb_build_object(
      'ok', false,
      'code', 'not_available',
      'status', v_novedad.status,
      'message', 'La solicitud no está disponible para validar el código.'
    );
  end if;

  if v_novedad.otp_hash is null or v_novedad.otp_expires_at is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'not_sent',
      'status', v_novedad.status,
      'message', 'Todavía no se ha enviado un código para esta solicitud.'
    );
  end if;

  if v_novedad.otp_expires_at <= now() then
    update public.novedades_saldo
    set status = 'expired', error_message = 'OTP expirado'
    where id = v_novedad.id;

    insert into public.novedades_saldo_eventos (novedad_id, event_type, actor_id, metadata)
    values (v_novedad.id, 'otp_expired', v_actor, '{}'::jsonb);

    return jsonb_build_object(
      'ok', false,
      'code', 'expired',
      'status', 'expired',
      'message', 'El código expiró. Solicita uno nuevo.'
    );
  end if;

  if v_novedad.otp_attempts >= v_novedad.otp_max_attempts then
    update public.novedades_saldo
    set status = 'expired', error_message = 'Demasiados intentos de OTP'
    where id = v_novedad.id;

    insert into public.novedades_saldo_eventos (novedad_id, event_type, actor_id, metadata)
    values (v_novedad.id, 'otp_locked', v_actor, '{}'::jsonb);

    return jsonb_build_object(
      'ok', false,
      'code', 'locked',
      'status', 'expired',
      'message', 'Se agotaron los intentos. Solicita un código nuevo.'
    );
  end if;

  if p_otp is null or p_otp !~ '^[0-9]{6}$' or crypt(p_otp, v_novedad.otp_hash) <> v_novedad.otp_hash then
    v_attempts := v_novedad.otp_attempts + 1;

    update public.novedades_saldo
    set otp_attempts = v_attempts,
        status = case when v_attempts >= v_novedad.otp_max_attempts then 'expired' else status end,
        error_message = case when v_attempts >= v_novedad.otp_max_attempts then 'Demasiados intentos de OTP' else 'OTP incorrecto' end
    where id = v_novedad.id;

    insert into public.novedades_saldo_eventos (novedad_id, event_type, actor_id, metadata)
    values (
      v_novedad.id,
      'otp_failed',
      v_actor,
      jsonb_build_object('attempts', v_attempts, 'max_attempts', v_novedad.otp_max_attempts)
    );

    return jsonb_build_object(
      'ok', false,
      'code', case when v_attempts >= v_novedad.otp_max_attempts then 'locked' else 'invalid' end,
      'status', case when v_attempts >= v_novedad.otp_max_attempts then 'expired' else v_novedad.status end,
      'attempts_remaining', greatest(v_novedad.otp_max_attempts - v_attempts, 0),
      'message', case
        when v_attempts >= v_novedad.otp_max_attempts then 'Se agotaron los intentos. Solicita un código nuevo.'
        else 'Código incorrecto.'
      end
    );
  end if;

  update public.novedades_saldo
  set status = 'otp_verified',
      otp_verified_at = now(),
      approved_by = v_actor,
      error_message = null
  where id = v_novedad.id;

  insert into public.novedades_saldo_eventos (novedad_id, event_type, actor_id, metadata)
  values (v_novedad.id, 'otp_verified', v_actor, '{}'::jsonb);

  return jsonb_build_object(
    'ok', true,
    'status', 'otp_verified',
    'reference', v_novedad.reference
  );
end;
$$;

-- 7. Aplicar la novedad -------------------------------------------------------
-- Todo ocurre bajo los bloqueos de la solicitud y la cuenta. Si algo falla, la
-- transacción de la base revierte completa: no queda saldo movido sin
-- transacción ni transacción sin saldo movido.
create or replace function public.aplicar_novedad_saldo(
  p_novedad_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_role text := public.current_user_role();
  v_novedad public.novedades_saldo%rowtype;
  v_account public.ahorros%rowtype;
  v_balance_before numeric(14, 2);
  v_balance_after numeric(14, 2);
  v_transaction_id uuid;
  v_withdrawal_info jsonb;
begin
  if v_actor is null then
    raise exception 'Sesión no válida' using errcode = '28000';
  end if;

  if v_role not in ('crm_superadmin', 'admin') then
    raise exception 'No autorizado para aplicar novedades de saldo' using errcode = '42501';
  end if;

  select * into v_novedad
  from public.novedades_saldo
  where id = p_novedad_id
  for update;

  if not found then
    raise exception 'Novedad de saldo no encontrada';
  end if;

  -- Idempotencia: un doble envío devuelve el mismo resultado.
  if v_novedad.status = 'applied' then
    return jsonb_build_object(
      'ok', true,
      'already_applied', true,
      'status', 'applied',
      'reference', v_novedad.reference,
      'transaction_id', v_novedad.transaction_id,
      'balance_before', v_novedad.balance_before,
      'balance_after', v_novedad.balance_after
    );
  end if;

  if v_novedad.status <> 'otp_verified' then
    raise exception 'La novedad no tiene un OTP verificado';
  end if;

  select * into v_account
  from public.ahorros
  where id = v_novedad.ahorros_id
  for update;

  if not found then
    raise exception 'Cuenta de ahorro no encontrada';
  end if;

  v_balance_before := coalesce(v_account.monto_total, 0);
  v_balance_after := case
    when v_novedad.operation_type = 'add' then v_balance_before + v_novedad.amount
    else v_balance_before - v_novedad.amount
  end;

  if v_balance_after < 0 then
    raise exception 'Saldo insuficiente para debitar la novedad'
      using errcode = 'P0001',
            detail = format('Saldo disponible: %s; monto solicitado: %s', v_balance_before, v_novedad.amount);
  end if;

  v_withdrawal_info := case
    when v_novedad.operation_type = 'debit' then jsonb_build_object(
      'accountNumber', coalesce(v_account.codigo::text, v_account.user_ref::text),
      'accountType', v_account.savings_type,
      'bankName', 'Alianza Capital'
    )
    else null
  end;

  insert into public.transactions (
    user_ref,
    ahorros_id,
    ahorros_ref,
    amount,
    currency,
    description,
    status,
    transaction_type,
    authorization_ref,
    message,
    savingtipe,
    amount_from_savings,
    amount_from_total,
    sub_payment,
    is_novedad_saldo,
    firebase_date,
    last_updated,
    user_name,
    user_email,
    user_id_number,
    withdrawal_info,
    created_at,
    updated_at
  ) values (
    v_account.user_ref,
    v_account.id,
    v_account.id,
    v_novedad.amount,
    'COP',
    v_novedad.detail,
    'APPROVED',
    case when v_novedad.operation_type = 'add' then 'Depositado' else 'Withdrawal' end,
    v_novedad.reference,
    v_novedad.detail,
    v_account.savings_type,
    0,
    v_novedad.amount,
    true,
    true,
    now(),
    now(),
    v_account.user_name,
    v_account.user_email,
    v_account.user_nit,
    v_withdrawal_info,
    now(),
    now()
  )
  returning id into v_transaction_id;

  update public.ahorros
  set monto_total = v_balance_after,
      total_saving_value = case
        when v_novedad.operation_type = 'add' then coalesce(total_saving_value, 0) + v_novedad.amount
        else total_saving_value
      end,
      total_deposits = case
        when v_novedad.operation_type = 'add' then coalesce(total_deposits, 0) + v_novedad.amount
        else total_deposits
      end,
      last_deposit = case when v_novedad.operation_type = 'add' then now() else last_deposit end,
      last_withdrawal = case when v_novedad.operation_type = 'debit' then now() else last_withdrawal end,
      updated_at = now()
  where id = v_account.id;

  update public.novedades_saldo
  set status = 'applied',
      applied_by = v_actor,
      transaction_id = v_transaction_id,
      balance_before = v_balance_before,
      balance_after = v_balance_after,
      applied_at = now(),
      error_message = null
  where id = v_novedad.id;

  insert into public.novedades_saldo_eventos (novedad_id, event_type, actor_id, metadata)
  values (
    v_novedad.id,
    'applied',
    v_actor,
    jsonb_build_object(
      'transaction_id', v_transaction_id,
      'balance_before', v_balance_before,
      'balance_after', v_balance_after
    )
  );

  return jsonb_build_object(
    'ok', true,
    'already_applied', false,
    'status', 'applied',
    'reference', v_novedad.reference,
    'transaction_id', v_transaction_id,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after
  );
end;
$$;

-- 8. Permisos -----------------------------------------------------------------
-- Sin RLS, los grants son la primera barrera: el navegador no toca las tablas
-- directamente. Las funciones definer son la única puerta de entrada.
revoke all on public.novedades_saldo from public, anon, authenticated;
revoke all on public.novedades_saldo_eventos from public, anon, authenticated;
revoke all on sequence public.novedades_saldo_eventos_id_seq from public, anon, authenticated;

-- El proxy usa la service role key para leer la solicitud y registrar el OTP.
grant select, insert, update, delete on public.novedades_saldo to service_role;
grant select, insert, update, delete on public.novedades_saldo_eventos to service_role;
grant usage, select on sequence public.novedades_saldo_eventos_id_seq to service_role;

revoke all on function public.touch_novedad_saldo_updated_at() from public;

revoke all on function public.crear_novedad_saldo(uuid, text, numeric, text, uuid) from public, anon;
grant execute on function public.crear_novedad_saldo(uuid, text, numeric, text, uuid) to authenticated;

revoke all on function public.verificar_otp_novedad(uuid, text) from public, anon;
grant execute on function public.verificar_otp_novedad(uuid, text) to authenticated;

revoke all on function public.aplicar_novedad_saldo(uuid) from public, anon;
grant execute on function public.aplicar_novedad_saldo(uuid) to authenticated;

revoke all on function public.registrar_otp_novedad(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.registrar_otp_novedad(uuid, text, integer) to service_role;

commit;
