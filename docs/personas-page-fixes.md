# Personas page — audit and fixes

**Date:** 2026-10-27
**Scope:** `src/pages/personas/SolicitudesFixed.tsx` (landing page for
`/personas/solicitudes`, `/personas/retiro-ahorros`, `/personas/cdat`,
`/personas/consultar-ahorros`), plus the two files it depends on.
**Rule applied:** no schema changes. Every read/write uses only the columns
published in the Supabase schema skill.

## 1. Row mapping was reading fields that do not exist

The page consumed `userName`, `userIdNumber`, `userPhone`, `userEmail`,
`withdrawalInfo`, `authorization`, which is Firestore camelCase. `normalizeRows`
only aliases a fixed list (`firebaseDate`, `transactionType`, `ahorrosId`, ...),
so those reads were always `undefined` and the tables rendered blank names,
documents and bank accounts.

Fix: one shared mapper, `mapTransaccionRetiro`, used by both loaders
(`cargarRetiroAhorros`, `cargarTransaccionesSolicitudesAhorros`). It reads the
real columns:

| UI field | Column |
|---|---|
| nombre | `user_name` |
| documento | `user_id_number` |
| monto | `amount` |
| entidad / banco | `withdrawal_info.bankName`, fallback `bank` |
| fecha solicitud | `firebase_date` |
| fecha pago | `confirmation_date` |
| producto | `savingtipe` |
| teléfono | `user_phone` |
| email | `user_email` |
| cuenta | `withdrawal_info.accountNumber` |
| tipo cuenta | `withdrawal_info.accountType` |
| canal de pago | `chanel_pay` |
| observaciones | `observation` |
| id transacción | `authorization_ref`, fallback `id` |

`withdrawal_info` is jsonb with `{ bankName, accountNumber, accountType }`,
which matches how `NovedadSaldoModal` writes it.

## 2. CDAT tab showed mock rows

`mockCDATData` was hardcoded. It is replaced by a read-only query against
`cdats`:

```ts
supabase.from('cdats')
  .select('id,id_cdat,idusuario,inversion,ea,tiempo,rendimiento,' +
          'fecha_apertura,fecha_finalizacion,estado,nombreusuario,documentousuario,created_at')
```

Mapping uses `id_cdat`, `nombreusuario`, `documentousuario`, `inversion`,
`tiempo` (plazo in months) and `fecha_apertura`. The table renders
**Inversión** instead of Monto, hides the bank column, and labels the last
column **Plazo** instead of Tiempo.

## 3. Créditos tab was always empty

`getFilteredData()` returned `[]` for `seccion=creditos`. It now reads
`credito_solicitado_empresa`:

```ts
supabase.from('credito_solicitado_empresa')
  .select('id,id_field,nombre,documento,fecha_solicitud,empresa,estado,tipodecredito,monto_solicitud,created_at')
```

and the Empresa column header replaces “Entidad bancaria” in that view.

## 4. Status filter and badges were inconsistent

- `getFilteredData` compared against a fixed map, so `Activo`, `Finalizado`,
  `Aprobado`, `Pendiente de depósito` and empty states were silently dropped.
- Badges only colored three exact strings.

Now a single `matchesStatusFilter` (case-insensitive: pendiente/inicio,
complet/aprob/activo/finaliz, rechaz/eliminad) and `estadoBadgeClass` drive both
the rows and the badges.

The default filter is now section-aware: `PENDING` for Ahorros/Retiros, `ALL`
for CDAT/Créditos (those tables have no withdrawal states, so the old default
made them look empty).

## 5. Disconnected controls

- **Refresh** buttons existed in the header but `handleRefresh` only reloaded
  Retiros/Ahorros. It now reloads all four sections, is `async`, and drives the
  `refreshing` spinner.
- **Observaciones dialog** could not be opened. The `MessageCircle` action is
  back in the Retiros row and calls a new `actualizarObservacionTransaccion`,
  which updates only `transactions.observation` (+ `updated_at`) by `id`.
- **Submenu state** ignored `?seccion=`. It now initializes from the URL and
  stays in sync through an effect.
- **Tiempo column** was computed once and froze. A small `ElapsedTime`
  component ticks once per second per pending row instead of re-rendering the
  whole page.
- Empty tables now show *No hay registros para mostrar* (or *Cargando...*),
  and rows use `key={item.docId || index}`.

Dead code removed: `mockRetiroAhorrosData`, `mockAhorrosData`, `mockCDATData`,
`obtenerDocumento` import, the unused `AhorrosSubMenuType` /
`CDATSubMenuType` types and their state, and `setItemsPerPage`.

## 6. Schema write fix in `src/supabase/database.ts`

`crearTransaccionNovedadSaldo` wrote `authorization`, a column that does not
exist. It now writes `authorization_ref`. The rest of that payload was verified
column by column against the schema.

## 7. Detail modal status colors

`DetalleCompletadoModal.getStatusColor` now colors `Aprobado` green and
`Pendiente de retiro` / `Pendiente de depósito` yellow, so the values produced
by the new mapping no longer fall through to gray.

## Verification

- `npx tsc -p tsconfig.app.json --noEmit`: same 9 pre-existing errors, no new
  ones (`CrearCDATSection.tsx:857`, `NovedadSaldoModal.tsx:284`, 7 ×
  `FondosIndependientes.tsx`).
- `npm run build`: passes (3,838 modules).

## Known limitation (not caused by these changes)

RLS is active and the client uses the anon key. `transactions`, `cdats` and
`credito_solicitado_empresa` are readable only by the owning user, so an admin
logged in as themselves will see empty lists unless a policy for the admin role
is added. That is a policy/infra decision and was intentionally left untouched.

## Deferred (needs a product or schema decision)

1. **Tipo de documento filter** is UI-only. `user_profiles.tipo_documento`
   exists, but joining it by `user_ref` requires reading other users' profiles,
   which `select_own_profile` blocks. Left as a visual control for now.
2. **Solicitudes → Ahorros** still lists withdrawal transactions. There is no
   dedicated savings-request table in the schema, so the correct source is a
   product decision.
3. **Pausa modal** is still unreachable: nothing calls
   `setShowPausaModal(true)`. Either wire it to a real paused feature or remove
   the dialog.
4. **Solicitudes table has no Acciones column.** Only Retiros exposes
   change-state / detail / observations. Adding it to Ahorros/CDAT/Créditos
   requires deciding which actions apply to each entity.
5. **`/personas/consultar-ahorros`** still resolves to the CDAT view because of
   the `isCrearCDAT` fallback. The route needs its own target or redirect.
