# Phase 1 — De-alias Firestore imports

**Date:** 2026-10-27
**Status:** Completed
**Scope:** 14 files / 15 module specifiers

## Objective

Remove every direct dependency on the `firebase/firestore` module specifier while
preserving current runtime behavior. Queries still execute through the existing
Supabase-backed compatibility shim. No query logic was rewritten in this phase.

## Change pattern

Every static import was changed from:

```ts
import { collection, getDocs, query, where } from "firebase/firestore";
```

to:

```ts
import { collection, getDocs, query, where } from "@/supabase/firestore-shim";
```

One dynamic import in `CambiarEstadoModal.tsx` was changed the same way:

```ts
const { getDoc } = await import("@/supabase/firestore-shim");
```

Quote style was preserved in each file.

## Files changed

| # | File | Symbols imported |
|---|------|------------------|
| 1 | `src/pages/productos/PortafolioServicios.tsx` | `collection, getDocs, addDoc, updateDoc, doc, query, where` |
| 2 | `src/pages/fondos/FondosIndependientes.tsx` | `collection, getDocs, query, where, doc, getDoc` |
| 3 | `src/pages/personas/ConsultarUsuarioDetalle.tsx` | `collection, getDocs, query, where` |
| 4 | `src/pages/contabilidad/ContabilidadAhorro.tsx` | `collection, getDocs, query, where` |
| 5 | `src/pages/credito/EstadoGeneral.tsx` | `doc, updateDoc, setDoc, Timestamp, collection, query, where, getDocs, getDoc` |
| 6 | `src/components/fondos/UserDetailModal.tsx` | `doc, getDoc, collection, query, where, getDocs` |
| 7 | `src/components/personas/CrearCDATSection.tsx` | `doc, Timestamp` |
| 8 | `src/components/personas/CambiarEstadoModal.tsx` | `doc` + dynamic `getDoc` |
| 9 | `src/components/personas/NovedadSaldoModal.tsx` | `doc, getDoc` |
| 10 | `src/components/personas/RetirosCDATSection.tsx` | `Timestamp` |
| 11 | `src/components/personas/EstadoGeneralCDATSection.tsx` | `Timestamp` |
| 12 | `src/components/personas/LegalizacionSection.tsx` | `Timestamp` |
| 13 | `src/utils/excelReportes.js` | `collection, query, where, getDocs, limit` |
| 14 | `src/utils/excelReportesAhorro.js` | `collection, query, where, getDocs, limit` |

## Intentionally not changed

- `src/supabase/firestore-shim.ts` — still the runtime implementation.
- `vite.config.ts` — the four `firebase/*` aliases remain in place.
- `package.json` — `firebase` remains installed.
- All query construction, result handling, `Timestamp` usage, and field mapping.
- No files were deleted.

## Verification

### Module-specifier sweep

```powershell
Get-ChildItem src -Recurse -Include *.ts,*.tsx,*.js,*.jsx |
  Select-String "firebase/firestore"
```

Result: only two explanatory comments remain in `src/supabase/firestore-shim.ts`
(lines 2 and 256). Zero import specifiers remain.

### Type check

```powershell
npx tsc -p tsconfig.app.json --noEmit
```

Result: 9 errors, all pre-existing and unrelated to the import change. The failing
lines were confirmed unchanged in `HEAD`:

| File:line | Error |
|-----------|-------|
| `CrearCDATSection.tsx:857` | `auth.currentUser` does not exist on `SupabaseAuthClient` (Firebase-style auth access) |
| `NovedadSaldoModal.tsx:284` | `'add' \| 'debit'` passed where `'add' \| 'remove'` is expected |
| `FondosIndependientes.tsx:227-265` | Undefined `totalTransactionsWithBenefits` and `beneficiosAcumuladosReal` (7 errors) |

These should be fixed during the native rewrite phase, not by reverting this change.

### Production build

```powershell
npm run build
```

Result: success — 3,838 modules transformed, built in 54.26s.

Bundle check:

| Marker | Occurrences in `dist/assets/index-*.js` |
|--------|----------------------------------------|
| `@firebase` | 0 |
| `firebase/app` | 0 |
| `firebase/firestore` | 0 |
| `initializeApp` | 0 |

The Firebase SDK is no longer part of the production bundle.

### Diff

14 source files changed, one import line each (two in `CambiarEstadoModal.tsx`).
`src/App.tsx` also appears in `git diff`, but that modification pre-dates this
phase (it was already modified before Phase 1).

## Rollback

Revert only the 14 files listed above:

```powershell
git checkout -- `
  src/pages/productos/PortafolioServicios.tsx `
  src/pages/fondos/FondosIndependientes.tsx `
  src/pages/personas/ConsultarUsuarioDetalle.tsx `
  src/pages/contabilidad/ContabilidadAhorro.tsx `
  src/pages/credito/EstadoGeneral.tsx `
  src/components/fondos/UserDetailModal.tsx `
  src/components/personas/CrearCDATSection.tsx `
  src/components/personas/CambiarEstadoModal.tsx `
  src/components/personas/NovedadSaldoModal.tsx `
  src/components/personas/RetirosCDATSection.tsx `
  src/components/personas/EstadoGeneralCDATSection.tsx `
  src/components/personas/LegalizacionSection.tsx `
  src/utils/excelReportes.js `
  src/utils/excelReportesAhorro.js
```

Do not revert `src/App.tsx`; its change is unrelated to this phase.

## Next phase

1. Add `tsc --noEmit` to CI so shim/type drift is visible.
2. Rewrite consumers to native `supabase.from(...)` calls in risk order:
   - Read-only: `PortafolioServicios` load, `ConsultarUsuarioDetalle`,
     `ContabilidadAhorro`, `FondosIndependientes` reads, `UserDetailModal`.
   - Simple writes: `EstadoGeneral`, `CambiarEstadoModal`, `NovedadSaldoModal`.
   - Excel utilities.
   - Complex CDAT flow: `CrearCDATSection`, `LegalizacionSection`,
     `RetirosCDATSection`, `EstadoGeneralCDATSection`.
3. Fix the 9 pre-existing errors above while rewriting the affected files.
4. Only after all consumers are native: delete the shim, remove the Vite aliases,
   remove `firebase` from `package.json`, and rename `firebaseDate` /
   `firebase_date`.
