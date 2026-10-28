# Phase 2 — Native Supabase rewrite

**Date:** 2026-10-27 (completed 2026-10-28)
**Status:** Completed — the shim and the Firebase SDK have been removed.
**Strategy:** One file at a time, least risk first; the shim was deleted only
after every consumer had been rewritten against Supabase.

## Rules for every file

1. Replace `@/supabase/firestore-shim` + `db` imports with
   `import { supabase } from "@/supabase/config";`.
2. Replace `collection/query/where/getDocs/getDoc/doc` with
   `supabase.from('<table>').select('*')` plus `.eq(...)`.
3. Read snake_case columns directly (`firebase_date`, `transaction_type`,
   `is_novedad_saldo`, `is_ahorro_cdat`, `withdrawal_info`).
4. Convert Supabase `{ data, error }` into the thrown errors the UI already
   expects: `if (error) throw error;`.
5. Write snake_case columns, and set `created_at` / `updated_at` ISO strings
   explicitly (the shim used to add them automatically).
6. Gate: `npx tsc -p tsconfig.app.json --noEmit` must not add errors beyond the
   9 pre-existing ones, and `npm run build` must pass.

## Files migrated

### 1. `src/components/fondos/UserDetailModal.tsx` — read-only

- Query: `transactions` where `ahorros_id = user.id`.
- `transaction.firebaseDate` (shim wrapper with `.seconds`) replaced with
  `transaction.firebase_date` parsed by `new Date(...)`, guarded with
  `Number.isNaN(date.getTime())`.
- Field reads moved to snake_case: `transaction_type`, `is_novedad_saldo`,
  `is_ahorro_cdat`, `withdrawal_info.bankName`.
- Empty result now returns early instead of wrapping the whole block in
  `if (!querySnapshot.empty)`.
- Removed console noise that only echoed candidate amount fields.

**Behavior note (intentional correction):** the shim only aliased a fixed list of
camelCase fields (`firebaseDate`, `transactionType`, `ahorrosId`, …). It never
aliased `is_novedad_saldo` or `is_ahorro_cdat`, so the previous checks against
`transaction.isNovedadSaldo` / `transaction.isAhorroCdat` were always `undefined`.
Reading the real columns means:

- `"Transferencia interna"` now shows for novedad-saldo movements instead of `N/A`.
- `"CDAT"` can now show if a row has `is_ahorro_cdat = true`.
- A withdrawal with `withdrawal_info.bankName` now shows the bank name.

The transaction type mapping (`Depositado` / `Withdrawal` → labels) is unchanged.

### 2. `src/pages/contabilidad/ContabilidadAhorro.tsx` — no data access

- The file imported `collection, getDocs, query, where` and `db` but never used
  any of them. Both imports were removed. Zero behavior change.

### 3. `src/pages/productos/PortafolioServicios.tsx` — one read + two writes

Table: `services` (Firestore collection `Services`).

| Operation | Before (shim) | After (native) |
|-----------|---------------|----------------|
| Load | `getDocs(collection(db,'Services'))` | `.from('services').select('*')` |
| Update | `updateDoc(doc(db,'Services',id), { TypesOfProductName, EA, MV, ServiceMainType })` | `.from('services').update({ types_of_product_name, ea, mv, service_main_type, updated_at }).eq('id', id)` |
| Insert | `addDoc(collection(db,'Services'), { …, createdAt: new Date() })` | `.from('services').insert({ …, created_at, updated_at })` |

- Row mapping moved to `types_of_product_name`, `ea`, `mv`, `service_main_type`.
- `createdAt` (a `Date` object in the shim path) is now an ISO string, matching
  what the shim wrote via `new Date().toISOString()`.
- Two user-visible/log strings that said “Firebase” were changed to “Supabase”.
- `query` / `where` were imported but unused and were dropped with the shim import.

### 4. `src/pages/personas/ConsultarUsuarioDetalle.tsx` — read-only

- Both Firestore-style queries were replaced with native Supabase:
  - withdrawals: `transactions` where `ahorros_id in (...)`, `transaction_type =
    'Withdrawal'`, `status in ('APPROVED','PENDING')`, `firebase_date` between
    the selected year bounds.
  - deposits: `transactions` where `ahorros_id = ?`, `transaction_type =
    'Depositado'`, `status = 'APPROVED'`, same date bounds.
- CDAT reads moved from Firestore aliases (`cdat.Inversion`, `cdat.Ganancias`,
  `cdat.Estado`, `cdat.FechaFinalizacion`, `cdat.EA`, ...) to the real columns
  (`inversion`, `ganancias`, `estado`, `fecha_finalizacion`, `ea`, ...). The
  alias-only reads were always `undefined`, so totals and statuses were blank.
- `withdrawal_info`, `authorization_ref`, `user_name`, `is_novedad_saldo` and
  `is_ahorro_cdat` replace `withdrawalInfo`, `authorization`, `userName`,
  `isNovedadSaldo`, `isAhorroCdat` in the transaction detail panel.
- `verification_pdf`, `ea`, `total_savings_pre_approval` and `compay_name`
  replace their Firestore equivalents in the documents/summary blocks.
- `confirmacionretiros` movements now format `fecharetiro` safely (it is an ISO
  string, so the old `.toDate()` call would throw) and read `numbredebanco` /
  `id_field` instead of the non-existent `nombredelbanc` / `ID`.
- `cargarDatosAhorro` clears the previous user's accounts when the new user has
  none, instead of leaving stale rows on screen.
- `CDATDetailModal` now accepts ISO strings and zero/empty plazos instead of
  calling `.toDate()` on a string or dividing by zero.
- Two unused helpers that read only the non-existent aliases were removed.

### 5. `src/pages/fondos/FondosIndependientes.tsx` — native

- Replaced shim reads with `ahorros`, `transactions` and `user_profiles` queries.
- Removed the mock statistic cards; every total (month, YTD, savings balance) is
  now derived from real approved deposits/withdrawals.
- The 2026 novelty-saldo exclusion operates on `firebase_date` directly.

### 6. `src/pages/credito/EstadoGeneral.tsx` — native

- One read of `habilitar_credito` (plus `credito_solicitado_empresa`, `ahorros`
  and `user_profiles` where needed); per-tab counts are grouped in memory.
- Validation, signature and disbursement tabs render real rows instead of mock
  data.
- Added `guardarHabilitacion`, a native upsert helper for `habilitar_credito` /
  `credito_solicitado_empresa`. Only columns present in the schema are written
  (`empresaId` / `empresaDocId` do not exist and were dropped).

### 7. Excel utilities — native

- `src/utils/excelReportes.js` and `src/utils/excelReportesAhorro.js` read
  `user_profiles`, `ahorros` and `transactions` through the Supabase client.
- Removed dead duplicate report functions and the old `Timestamp` handling.
- `ahorros.transactions` (jsonb) remains the benefits source; no dedicated
  benefits column exists.

### 8. CDAT flow — native

- `src/components/personas/LegalizacionSection.tsx` reads `cdats` through the
  native data layer and works with snake_case fields.
- `src/components/personas/CrearCDATSection.tsx` inserts into `cdats` and then
  into `confirmacionretiros` natively. `retiros_cdat` rows are skipped because
  that table has no FK to `cdats`.
- Anticipated withdrawals are computed from `tiempo`, `fecha_apertura`,
  `ganancias` and `inversion`.
- The PDF now embeds the four locally bundled images listed below instead of
  remote Firebase/Google URLs.

## Verification

```
npx tsc -p tsconfig.app.json --noEmit
```

Final result: **0 errors**.

```
npm run build
```

Final result: **success, 3,840 modules, ~55s**. The four PDF assets are emitted
to `dist/assets/` (`pdf-logo-*.png`, `pdf-logo-bw-*.png`, `pdf-sello-*.jpg`,
`pdf-vigilado-*.jpg`), and the bundle contains **0** occurrences of `@firebase`,
`firebase/app`, `firebase/firestore`, or `initializeApp`.

## Firebase retirement — final state

| Removed | Detail |
|---|---|
| `src/supabase/firestore-shim.ts` | Dead compatibility shim, zero importers |
| `src/TestFirebase.tsx` + `/test-firebase` | Test page, import and route deleted from `App.tsx` |
| `db` / `auth` / `storage` aliases | Removed from `src/supabase/config.ts` (no importers) |
| `firebase` dependency | `npm uninstall firebase` (82 packages removed) |
| `firebase/*` Vite aliases | Removed earlier from `vite.config.ts` |
| `src/utils/archivoFirestore.js` | Unreferenced legacy base64 helper |
| `FIREBASE_STORAGE_RULES.md` | Obsolete Firebase Storage rules doc |
| `firebaseDate` camelCase alias | Removed from `normalizeRows`; consumers read `firebase_date` directly |

### Assets kept out of source control

The original logos remain hosted in Firebase Storage / the FlutterFlow project
bucket; they were **not deleted**. The app now imports local copies (downloaded
once, then bundled by Vite):

| Local file | Used for | Original location |
|---|---|---|
| `src/assets/pdf-logo.png` | CDAT header, horizontal color logo | Firebase Storage `alianza-b7y88v.appspot.com/Alianza Pdf logo.png` |
| `src/assets/pdf-logo-bw.png` | CDAT header, vertical mark | Firebase Storage `alianza-b7y88v.appspot.com/Alianza pdf logo design.png` |
| `src/assets/pdf-sello.jpg` | CDAT "VERIFICADO" seal | FlutterFlow project bucket |
| `src/assets/pdf-vigilado.jpg` | Superintendencia "VIGILADO" stamp | FlutterFlow project bucket |

### Allowed remaining mentions

Only real Supabase column names remain: `firebase_date` (`transactions`) and
`firestore_id` (legacy migration column present in most tables). These are
schema identifiers, not Firebase SDK usage, and must not be renamed. Historical
migration notes under `docs/` intentionally mention Firebase.
