-- ============================================================================
-- 20261104_01. Corrección de tipo en rechazo de retiros
--
-- `transactions.ahorros_id` es text en la base actual, mientras `ahorros.id`
-- es uuid. La versión de `rechazar_retiro` de la migración 05 comparaba
-- directamente ambas columnas y fallaba con:
--   operator does not exist: uuid = text
--
-- Esta migración conserva el mismo contrato y la misma atomicidad, pero
-- convierte explícitamente `ahorros_id` a uuid y valida el valor antes de
-- bloquear la cuenta.
--
-- Requiere 20261102_05_withdrawal_reject.sql.
-- Rollback: supabase/migrations/20261104_01_withdrawal_reject_uuid_fix_rollback.sql
-- ============================================================================

begin;

create or replace function public.rechazar_retiro(
  p_transaction_id uuid,
  p_observation text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_tx public.transactions%rowtype;
  v_account public.ahorros%rowtype;
  v_account_id uuid;
  v_balance_before numeric(14, 2);
  v_balance_after numeric(14, 2);
begin
  if v_actor is null then
    raise exception 'Sesión no válida' using errcode = '28000';
  end if;

  if not public.is_staff() then
    raise exception 'No autorizado para rechazar retiros' using errcode = '42501';
  end if;

  select * into v_tx
  from public.transactions
  where id = p_transaction_id
  for update;

  if not found then
    raise exception 'Transacción no encontrada';
  end if;

  if v_tx.transaction_type <> 'Withdrawal' then
    raise exception 'La transacción no es un retiro';
  end if;

  -- Idempotencia: si otro intento ya rechazó el retiro, no se vuelve a abonar.
  if v_tx.status = 'REJECTED' then
    if v_tx.ahorros_id is not null then
      begin
        v_account_id := v_tx.ahorros_id::uuid;
        select monto_total into v_balance_after
        from public.ahorros
        where id = v_account_id;
      exception when invalid_text_representation then
        v_balance_after := null;
      end;
    end if;

    return jsonb_build_object(
      'ok', true,
      'already_rejected', true,
      'transaction_id', v_tx.id,
      'reference', v_tx.authorization_ref,
      'amount', v_tx.amount,
      'balance_after', v_balance_after
    );
  end if;

  if v_tx.status <> 'PENDING' then
    raise exception 'Solo se puede rechazar un retiro pendiente';
  end if;

  if v_tx.ahorros_id is null then
    raise exception 'El retiro no tiene una cuenta de ahorro asociada';
  end if;

  begin
    v_account_id := v_tx.ahorros_id::uuid;
  exception when invalid_text_representation then
    raise exception 'El retiro no tiene una cuenta de ahorro válida';
  end;

  if coalesce(v_tx.amount, 0) <= 0 then
    raise exception 'El monto del retiro no es válido';
  end if;

  select * into v_account
  from public.ahorros
  where id = v_account_id
  for update;

  if not found then
    raise exception 'Cuenta de ahorro no encontrada';
  end if;

  v_balance_before := coalesce(v_account.monto_total, 0);
  v_balance_after := v_balance_before + v_tx.amount;

  update public.transactions
  set status = 'REJECTED',
      observation = coalesce(nullif(btrim(p_observation), ''), observation),
      last_updated = now(),
      updated_at = now()
  where id = v_tx.id;

  update public.ahorros
  set monto_total = v_balance_after,
      updated_at = now()
  where id = v_account_id;

  return jsonb_build_object(
    'ok', true,
    'already_rejected', false,
    'transaction_id', v_tx.id,
    'reference', v_tx.authorization_ref,
    'amount', v_tx.amount,
    'balance_before', v_balance_before,
    'balance_after', v_balance_after
  );
end;
$$;

revoke all on function public.rechazar_retiro(uuid, text) from public, anon;
grant execute on function public.rechazar_retiro(uuid, text) to authenticated;

commit;
