# Personas sub-pages — audit and fixes (batch 3)

**Date:** 2026-10-27
**Scope:** `CambiarEstadoModal`, `NovedadSaldoModal`, `RetirosCDATSection`, the
shared `obtenerSubcoleccion` helper and two lookup helpers in `database.ts`.
**Rule applied:** read/write only columns that exist in the Supabase schema. No
schema or policy changes.

These are the write paths used by the landing page (`SolicitudesFixed`) and the
user detail page (`ConsultarUsuarioDetalle`), so they were audited next.

## 1. `src/components/personas/CambiarEstadoModal.tsx`

This modal changes the state of a withdrawal. Both branches were broken.

**CDAT withdrawals (`confirmacionretiros`):**

- It called `actualizarDocumento('Cdats/<uuid>/confirmacionretiros', ...)`.
  `toSupabaseTable` does not parse paths, so the request went to a table named
  `Cdats/<uuid>/confirmacionretiros` and always failed.
- It wrote `observation` and `confirmationDate`. Neither column exists in
  `confirmacionretiros` (the real ones are `observaciones`, `fecharetiro` and
  `chanelpay`).
- It read the CDAT with the Firestore shim (`doc`/`getDoc`) and wrote
  `saldoDisponible`, which does not exist (real column: `saldo_disponible`).

Now it uses native Supabase:

```ts
supabase.from('confirmacionretiros')
  .update({ estados, observaciones, chanelpay?, fecharetiro?, updated_at })
  .eq('id', docId)
```

and, on rejection, reads `cdats.saldo_disponible` and writes back
`saldo_disponible + monto`.

**Savings withdrawals (`transactions`):**

- It wrote `confirmationDate` and `chanelpay`, so every “Completado” action
  failed with a missing-column error. Real columns: `confirmation_date`,
  `chanel_pay`.
- The two payment-date pickers were decorative: no date was ever persisted.

Now `confirmation_date` comes from the confirmed payment date and
`chanel_pay` is written on completion; `observation` stays as before.

**Other fixes:**

- The “Fecha de rechazo” picker was removed. It had no destination column, so
  it silently discarded the value.
- Errors surface the PostgREST message instead of a generic string.
- Debug `console.log` calls removed.

## 2. `src/components/personas/NovedadSaldoModal.tsx`

- Dropped the unused shim imports (`doc`, `getDoc`, `db`).
- Fixed the pre-existing `'add' | 'debit'` → `'add' | 'remove'` type error.
- Payload field mapping corrected:
  - document: `nro_documento → nit → id` (was `numeroDocumento`, never present)
  - `empresaId` from `user_profiles.empresa` (was `ahorros.company.id`, never present)
  - `userRef` prefers `id` (uuid) because `transactions.user_ref` is `uuid`
  - phone fallback `phone_number → telefono1`
- All `alert()` calls replaced with toasts, including the invalid-amount,
  invalid-detail and wrong-OTP paths.
- The OTP is no longer printed to the browser console (it was logged in
  plaintext; the flow still emails it to the corporate inbox).
- Saving now reports the Supabase/PostgREST error message.

## 3. `src/components/personas/RetirosCDATSection.tsx`

The list was **always empty**. It called
`obtenerSubcoleccion('Cdats/<uuid>', 'confirmacionretiros')`, which queried
`confirmacionretiros.cdat_id` (column does not exist) and then threw.

- It now queries `confirmacionretiros` by `id_cdat`, using `cdats.id_cdat` from
  the CDAT row it already loaded.
- `cdat.idCdat` → `cdat.id_cdat`. The old alias does not exist, so the product
  column rendered “CDAT undefined” and the modal received no transaction id.
- `retiro.ID` → `retiro.id_field` (business id) with `retiro.id` fallback.
- `retiro.fechaSolicitud` → `retiro.fecha_solicitud`.
- Detail modal `canalPago` now reads `chanelpay` (was the bank name).
- Removed the unused `Timestamp` shim import and the unused
  `mockRetiroCDATData` array.
- Row keys use the row `id` instead of `retiro.ID`.

## 4. `src/supabase/database.ts`

- `obtenerSubcoleccion` special-cases `confirmacionretiros`: it resolves
  `cdats.id_cdat` from the document uuid and filters by it. This also fixes
  `Dashboard.tsx`, which used the same helper.
- `TABLE_MAP` gained `RetirosCdat` / `retiros_cdat`.
- `buscarUsuarioPorDocumento` falls back from `nit` to `nro_documento` (used by
  `Verificaciones`).
- `buscarUsuarioPor` already had that fallback from batch 2.

## 5. `src/pages/personas/Verificaciones.tsx`

- `alert()` replaced with toasts for “no results” and search errors.
- The search term is trimmed, the Enter key uses `onKeyDown`, and the page
  resets to 1 after any search/refresh.
- The loader now shows the spinner and reports failures instead of failing
  silently.
- Removed the unused parent `useNavigate`.

## Verification

- `npx tsc -p tsconfig.app.json --noEmit`: 8 pre-existing errors remain
  (`CrearCDATSection` ×1, `FondosIndependientes` ×7). The
  `NovedadSaldoModal` error is gone.
- `npm run build`: passes (3,838 modules).
- Shim consumers: 10 files / 11 specifiers → 7 files / 7 specifiers.

## Deferred / needs a decision

1. **Rejection date is not stored.** `transactions` and `confirmacionretiros`
   have no rejection-date column. The picker was removed rather than pretending
   to save it.
2. **`LegalizacionSection` reads `RetirosCdat`.** `retiros_cdat` has no FK to
   `cdats` (only `monto`, `fecharetiro`, `estado`), so
   `obtenerSubcoleccion('Cdats/<id>', 'RetirosCdat')` still cannot filter by
   CDAT. Needs a product/schema decision.
3. **`obtenerSubcoleccion` generic path** still probes `cdat_id`, `parent_id`
   and `ahorros_id`; only the `confirmacionretiros` case is correct today.
4. **`NovedadSaldoModal` reloads the window** after success
   (`window.location.reload()`). It works, but a parent callback would be
   cleaner.
5. **OTP is generated client-side** and compared against client state. That is
   unchanged behaviour; moving it server-side is a security decision.
