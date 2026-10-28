# Personas sub-pages — audit and fixes (batch 4)

**Date:** 2026-10-27
**Scope:** `src/components/personas/EstadoGeneralCDATSection.tsx` (the CDAT
"Estado general" view rendered by `SolicitudesFixed`).
**Rule applied:** read only columns that exist in the Supabase schema; no schema
or policy changes.

## What was wrong

1. **The table was 100% mock.** Every cell came from a 10-row
   `mockEstadoGeneralData` array; the real `cdats` rows were loaded but never
   rendered.
2. **Every field name was the old Firestore camelCase** and does not exist in
   Supabase: `Estado`, `Inversion`, `FechaApertura`, `FechaFinalizacion`,
   `Tiempo`, `EA`, `idCdat`. Because of that, even if the table had used the
   loaded rows, status filters, counts and sorting would all have been empty.
3. **The chart was mock data** (`chartData` with hard-coded monthly values).
4. **Pagination was hard-coded** to pages `1 2 3 … 16`, so clicking past the
   real number of rows produced an empty table.
5. The "Tipo de búsqueda" select was decorative (it did not filter anything and
   listed document types).
6. `getStatusColor(cdat.Estado)` called `.toLowerCase()` on a possibly
   `undefined` value.

## Changes

### Data mapping

- Added `mapCdat(row)`, which converts the raw `cdats` row (snake_case) into the
  view model: `id_cdat`, `inversion`, `ganancias`, `rendimiento`, `ea`,
  `tiempo`, `estado`, `fecha_apertura`, `fecha_finalizacion`, `firmado`,
  `retefuente_monto`, `retefuenteporcentaje`, `tipooperacion`, `origenrecursos`,
  `saldo_disponible`, `archivos`, `comprobantes`, `observaciones`.
- Added `toModalCdat(cdat)`, which converts the view model back to the
  camelCase shape `CDATDetailModal` expects (`Inversion`, `Ganancias`,
  `FechaApertura`, `Tiempo`, `EA`, ...). The modal keeps working unchanged.

### Chart

- Replaced the mock array with `buildChartData(cdats, retiros, granularidad)`:
  - **Aperturados** = sum of `cdats.inversion` grouped by `fecha_apertura`.
  - **Anticipos** = sum of `confirmacionretiros.monto` grouped by
    `fecha_solicitud` (fallback `fecharetiro`, then `created_at`).
  - Grouping is by month (last 12 months) or by year (last 5 years).
- The "Meses / Años" select is now wired to that granularity instead of being
  decorative.
- Empty state ("Sin datos para graficar") when there is nothing to plot.
- Y-axis uses a compact formatter (`k` / `M`) instead of assuming thousands.

### Table, filters and pagination

- Filters, counts, sorting and cells now read the mapped model, so `estado`,
  `inversion`, dates, `tiempo` and `ea` display real values.
- "Tipo de búsqueda" became a working **"Buscar por"** select:
  `Todos | Nombre | Documento | ID`. The search term is trimmed and matched per
  field; "Todos" searches name, document and `id_cdat`.
- `Todos (n)` uses `cdatsData.length` instead of the mock length.
- Pagination is computed from the filtered rows
  (`totalPages`, sliding window of up to 5 page buttons, clamped next/prev).
  Added a "Página X de Y (N CDATs)" label.
- Current page resets on filter/search changes and is clamped when the filtered
  result shrinks.
- `getStatusColor` now guards against a missing/empty status.
- `formatearFecha` handles ISO strings (`new Date(string)`), `Date`, `{seconds}`
  and objects with `toDate`; invalid values render "Sin fecha" instead of
  throwing.
- Removed the unused `Timestamp` shim import, the unused `Dialog`/icon imports
  and the debug `console.log` calls.

## Verification

- `npx tsc -p tsconfig.app.json --noEmit`: same 8 pre-existing errors only
  (`CrearCDATSection` ×1, `FondosIndependientes` ×7). No new errors.
- `npm run build`: passes (3,838 modules, ~22s).
- Shim consumers: 7 files / 7 specifiers → **6 files / 6 specifiers**.

## Deferred / needs a decision

1. **Chart granularity is a fixed window.** It shows the last 12 months / last
   5 years regardless of how old the data is. Historic data older than the
   window is still visible in the table but not in the chart. A date-range
   picker would be the next step if needed.
2. **Anticipos are not filtered by type.** `confirmacionretiros` rows of any
   `tipodeoperacion` contribute to the series, because the chart label is
   "Anticipos" and all withdrawal requests are anticipos of the CDAT. If only
   `tipodeoperacion = 'retiro'` should count, add `.eq('tipodeoperacion',
   'retiro')` to the query.
3. **`confirmacionretiros` is loaded in full** (4 columns) to build the series.
   It is a small table today; if it grows, move the aggregation to a view/RPC.
4. **"Pendiente de firma" is treated as a status.** It is derived from the same
   `cdats.estado` text column, matching the existing behaviour of the other
   Personas views.
