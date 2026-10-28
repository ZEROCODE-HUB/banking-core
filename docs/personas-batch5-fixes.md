# Personas sub-pages — audit and fixes (batch 5)

**Date:** 2026-10-28
**Scope:** last native-Supabase rewrites plus the complete Firebase retirement.
**Rule applied:** read/write only columns that exist in the Supabase schema; no
schema or policy changes.

## Files covered

| File | Work |
|---|---|
| `src/components/personas/LegalizacionSection.tsx` | CDAT signature queue reads native `cdats` |
| `src/components/personas/CrearCDATSection.tsx` | Native `cdats` + `confirmacionretiros` writes; local PDF assets |
| `src/pages/fondos/FondosIndependientes.tsx` | Native `ahorros` / `transactions` / `user_profiles`; mock stats removed |
| `src/pages/credito/EstadoGeneral.tsx` | Native credit-status grouping and `guardarHabilitacion` |
| `src/utils/excelReportes.js` | Native Excel report reads |
| `src/utils/excelReportesAhorro.js` | Native transaction report reads |

## What changed

### LegalizacionSection

- Reads pending-signature CDATs through the native data layer (`obtenerColeccion('Cdats')`,
  which maps to `cdats`).
- Works with the real snake_case row shape instead of the old camelCase aliases.
- Filters on the real `firmado` / `estado` values.

### CrearCDATSection

- Removed `auth.currentUser` (Firebase-style) usage; the flow no longer depends
  on a global auth object.
- Inserts the CDAT into `cdats` (generating `id_cdat` when needed) and then
  inserts the initial deposit into `confirmacionretiros` using `id_cdat`.
- If the initial deposit fails, the CDAT stays created and the user is told the
  deposit could not be registered, instead of silently succeeding.
- `retiros_cdat` rows are not written: that table has no FK to `cdats`.
- Anticipated withdrawals are derived from `tiempo`, `fecha_apertura`,
  `ganancias` and `inversion`.
- PDF generation now uses four locally bundled assets (see below). No network
  request is required to render the contract.

### FondosIndependientes

- Replaced shim queries with direct `ahorros`, `transactions` and `user_profiles`
  reads.
- Removed every mock statistic. Month, year-to-date and total balances come from
  approved deposits/withdrawals.
- Excludes 2026 novelty-saldo movements using `firebase_date`.
- The prior TypeScript errors (undefined helpers) are gone.

### credito/EstadoGeneral

- Loads `habilitar_credito` once and groups rows by `estado` in memory; tab
  counts are real.
- Validation, signature and disbursement tabs render actual rows rather than
  mock data.
- Added `guardarHabilitacion(table, uid, payload)` for native upserts. Only
  schema columns are written; the non-existent `empresaId` / `empresaDocId`
  fields and the `user_profiles` habilitación update were dropped.

### Excel utilities

- `excelReportes.js` and `excelReportesAhorro.js` read `user_profiles`,
  `ahorros` and `transactions` directly through Supabase.
- Dead duplicate report functions and legacy timestamp handling were removed.
- `ahorros.transactions` (jsonb) remains the benefits source; there is no
  dedicated benefits column.

## PDF assets

The source images were downloaded once and are now bundled by Vite. The
originals remain in Firebase Storage / the FlutterFlow bucket and were **not**
deleted.

| Local file | Role |
|---|---|
| `src/assets/pdf-logo.png` | horizontal color logo, header left (42×23 mm) |
| `src/assets/pdf-logo-bw.png` | vertical mark, top-right (10×18 mm) |
| `src/assets/pdf-sello.jpg` | "VERIFICADO" seal |
| `src/assets/pdf-vigilado.jpg` | "VIGILADO — Superintendencia de la Economía Solidaria" stamp |

## Firebase retirement

- Deleted `src/supabase/firestore-shim.ts` (zero importers).
- Deleted `src/TestFirebase.tsx` and removed its import/route from `App.tsx`.
- Removed `db` / `auth` / `storage` aliases from `src/supabase/config.ts`.
- Uninstalled the `firebase` package (82 packages removed).
- Deleted `src/utils/archivoFirestore.js` (unreferenced).
- Deleted `FIREBASE_STORAGE_RULES.md` (obsolete operations doc).
- Removed the `firebaseDate` alias from `normalizeRows`; every consumer now reads
  `firebase_date` directly.
- Reworded remaining Firebase/Firestore comments in `database.ts`, `auth.ts`,
  `storage.ts`, `UserInfoModal.tsx`, `HistorialSection.tsx` and
  `ConsultarUsuarioDetalle.tsx`.

### Allowed remaining identifiers

- `firebase_date` — real `transactions` column.
- `firestore_id` — real legacy migration column.

Neither is an SDK reference and neither should be renamed.

## Verification

```
npx tsc -p tsconfig.app.json --noEmit   # 0 errors
npm run build                          # success, 3,841 modules, ~43s
```

The build emits `pdf-logo-*.png`, `pdf-logo-bw-*.png`, `pdf-sello-*.jpg` and
`pdf-vigilado-*.jpg` under `dist/assets/`.

## Follow-up (2026-10-28): "Tiempo" column

The `Solicitudes → Ahorros` and `Retiros` tables previously rendered a live
`setInterval` counter that incremented every second from `firebase_date`. That
was a display-only value introduced during the refactor, not a database column.

Verified against the schema and the live REST API:

- `ahorros.tiempo` does not exist.
- `transactions.tiempo` does not exist.
- The only related database values are `transactions.firebase_date`,
  `confirmation_date`, `last_updated` and `updated_at`.

The live interval was removed. `Tiempo` is now a static duration computed from
those database timestamps:

- **Pendiente** — elapsed from `firebase_date` to the moment the table is
  loaded/refreshed (no ticking).
- **Rechazado** — `last_updated` / `updated_at` minus `firebase_date`.
- **Completado** — `-`.

Durations longer than 24 hours render as `Xd HH:MM:SS`. A persisted duration
would require a new database column, which is outside the no-schema-change
rule.

## Follow-up (2026-10-28): Cartera actions

The row action in `src/pages/credito/Cartera.tsx` had no handler. No existing
modal fits the portfolio shape:

- `DetalleCompletadoModal` expects a withdrawal request (bank, account,
  payment channel).
- `CDATDetailModal` expects a CDAT.
- `UserInfoModal` expects a user profile plus savings.
- The credit detail dialog in `credito/EstadoGeneral.tsx` is inline and
  application-specific.

A dedicated `src/components/credito/CarteraDetailModal.tsx` was added and the
`FileText` action now opens it with the selected portfolio row. Cartera still
uses `mockedPortfolio`; migrating it to the `credito` table is a separate task.

## Deferred

1. `sello` / `vigilado` are now local, but if the brand assets change they must
   be re-downloaded and committed manually.
2. `Solicitudes → Ahorros` still lists withdrawal transactions because there is
   no dedicated savings-request table.
3. `tipoDocumento` filtering on the Personas landing still needs a
   `user_profiles.tipo_documento` join, blocked by `select_own_profile` RLS.
4. `obtenerSubcoleccion` still probes non-existent `cdat_id` / `parent_id` /
   `ahorros_id` columns for every table except `confirmacionretiros`.
5. Cartera statistics and rows still come from `mockedPortfolio`; wiring the
   `credito` table (and its payment schedule) is the next migration step.

