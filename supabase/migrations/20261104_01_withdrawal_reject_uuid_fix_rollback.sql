-- ============================================================================
-- Rollback de 20261104_01. Corrección de tipo en rechazo de retiros
--
-- Restaura la definición de `rechazar_retiro` de la migración 05, que comparaba
-- directamente `ahorros.id` (uuid) con `transactions.ahorros_id` (text).
-- Esa versión vuelve a fallar con `operator does not exist: uuid = text`.
--
-- Solo debe usarse para revertir el esquema a un estado anterior conocido.
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

  if v_tx.status = 'REJECTED' then
    select monto_total into v_balance_after
    from public.ahorros
    where id = v_tx.ahorros_id;

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

  if coalesce(v_tx.amount, 0) <= 0 then
    raise exception 'El monto del retiro no es válido';
  end if;

  select * into v_account
  from public.ahorros
  where id = v_tx.ahorros_id
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
  where id = v_account.id;

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
