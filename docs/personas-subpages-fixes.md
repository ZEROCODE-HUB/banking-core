# Personas sub-pages — audit and fixes (batch 2)

**Date:** 2026-10-27
**Scope:** `ConsultarUsuarios`, `ConsultarUsuarioDetalle`, `Verificaciones`,
`VerificacionDetalle`, plus the shared `UserInfoModal` and `CDATDetailModal`.
**Rule applied:** read/write only columns that exist in the Supabase schema. No
schema or policy changes.

## 1. `src/pages/personas/ConsultarUsuarios.tsx`

Findings:

- `userData` was never set. The result card, the “Ver detalles completos”
  button, the bottom tabs and `UserInfoModal` were unreachable; the page
  navigates to the detail route immediately on a successful search.
- Tabs (`Ahorro`, `Crédito`, `CDAT`, `Comentarios`, `Vehículos`, `Historial`,
  `Información adicional`) looked clickable but did nothing. They duplicate the
  detail page tabs.
- Searching by cédula only queried `user_profiles.nit`, so users stored with
  `nro_documento` were reported as “no encontrado”.
- Empty/whitespace searches were accepted, and Enter did not submit.
- The select labelled “Tipo de documento” actually chooses email/celular/cédula.

Fixes:

- Removed the unreachable result card, tabs, modal, related state and imports.
  The right-hand card now gives stable search instructions.
- `buscarUsuarioPor` (shared helper) falls back from `nit` to `nro_documento`
  when a document search misses. This also fixes the same lookup in the detail
  page, `EstadoGeneral` and `CrearCDATSection`.
- Input is trimmed, blank searches are rejected, Enter submits, and the
  label is now “Buscar por”.
- Errors are reported safely with `error instanceof Error`.

## 2. `src/pages/personas/ConsultarUsuarioDetalle.tsx`

This page was the largest remaining shim consumer. Its two `collection/query/
where/getDocs` calls were rewritten as native Supabase queries (see
`docs/migration/phase-2-native-supabase.md`, file 4).

Functional fixes:

| Area | Before | After |
|---|---|---|
| Withdrawals total | shim `ahorrosId` / `firebaseDate` | native `ahorros_id`, `firebase_date` |
| Deposits total | shim query | native query |
| CDAT totals | `cdat.Inversion`, `cdat.Ganancias` (always undefined) | `inversion`, `ganancias` |
| CDAT state | `cdat.Estado` | `estado` |
| CDAT list id | `cdat.isAhorroCdat`, `cdat.idCdat` | `is_ahorro_cdat`, `id_cdat` |
| CDAT dates | `cdat.FechaFinalizacion.toDate()` | `fecha_finalizacion` via `formatDate` |
| CDAT modal | camelCase props from undefined aliases | snake → camel mapping at the modal boundary |
| Transaction detail | `withdrawalInfo`, `authorization`, `userName`, `isNovedadSaldo` | `withdrawal_info`, `authorization_ref`, `user_name`, `is_novedad_saldo` |
| Movement dates | `mov.fecharetiro.toDate()` on an ISO string (crash) | `formatDateTime` / `formatDate` |
| Movement bank/id | `nombredelbanc` (typo, absent), `ID` | `numbredebanco`, `id_field` |
| Documents | `userData.verificationPDF`, `ahorro.EA`, `cdat.Inversion` | `verification_pdf`, `ea`, `inversion` |
| Savings summary | `Total_Savings_PreApproval` | `total_savings_pre_approval` |
| Company label | `CompayName` | `compay_name` |
| Stale user data | accounts from the previous user persisted | cleared when the new user has none |

Two unused helpers (`obtenerBanco`, `esTransferenciaInterna`) that only read
non-existent aliases were removed. Expanding the movements of CDAT B while
CDAT A was selected now loads B's movements instead of showing A's.

## 3. `src/components/personas/UserInfoModal.tsx`

The modal (used by the detail page) read Firestore names that
`normalizeRows` never aliases. It now uses:

`tipo_documento`, `nro_documento`, `fecha_expedicion`, `ciudad_expedicion`,
`genero`, `flg_ppe`, `flg_relatives_ppe`, `funds_source`, `company_nit`,
`compay_name`, `ubicaciontrabajo`, `type_of_contact`,
`total_savings_pre_approval`.

The “linea de ahorro de nómina más reciente” sort now parses ISO dates instead
of relying on Firestore `seconds`.

## 4. `src/components/personas/CDATDetailModal.tsx`

- `calcularRetirosAnticipados` no longer calls `.toDate()` unguarded (it threw
  for every real CDAT) and returns `[]` when the plazo is empty or the start
  date is invalid.
- `formatAmount` coerces values and falls back to 0 instead of printing `NaN`.
- Totals coerce `Inversion`/`Ganancias` to numbers.

## 5. `src/pages/personas/Verificaciones.tsx` and `VerificacionDetalle.tsx`

The list card serialises a whitelist of user fields into router state. That
whitelist used Firestore names (`tipoDocumento`, `nroDocumento`,
`fechaExpedicion`, `ciudadExpedicion`, `Genero`, `figPPE`,
`figRelativasPPE`, `origenRecursos`, `tipoContrato`, `verificationPDF`,
`userType`). Every one of those was `undefined`, so the detail page showed
“No disponible” for documents, sex, PEP flags and resources.

Fixes:

- Both files now use the schema columns: `tipo_documento`, `nro_documento`,
  `fecha_expedicion`, `ciudad_expedicion`, `genero`, `flg_ppe`,
  `flg_relatives_ppe`, `verification_pdf`, `user_type`.
- `origenRecursos` → `funds_source` (text[]), joined for display, with
  `digite_otras_fuentes` as fallback.
- “Tipo de contrato” (no such column in `user_profiles`) → `tipo_vinculacion`.
- The card document number falls back `nro_documento → nit → id`.
- The search select label is now “Buscar por”.

## Verification

- `npx tsc -p tsconfig.app.json --noEmit`: same 9 pre-existing errors, no new
  ones.
- `npm run build`: passes (3,838 modules).
- Shim consumers: 11 files → 10 (`ConsultarUsuarioDetalle` removed).

## Deferred / needs a decision

1. **Admin reads are still RLS-limited.** `user_profiles` only allows
   `auth.uid() = id`, so an admin searching other users gets “no encontrado”
   unless a policy for the admin role is added.
2. **Saving the edited name** goes through `user_profiles` and is blocked by
   `update_own_profile` for anyone but the logged-in user. The edit control is
   therefore only usable on the admin's own profile today.
3. **“Usuarios Verificados” lists pending users.** `obtenerUsuariosVerificados`
   filters `confirmacion_verificado <> true` and requires a
   `verification_pdf`. Rename the section or change the query, depending on
   what the business wants.
4. **`VerificacionDetalle` only edits `display_name`.** The “Editar” button does
   not edit document images, PEP flags or verification status.
5. **Year selector defaults to 2025** in the detail page (`selectedYear`),
   regardless of the current date. This is a product choice; seed data appears
   to be 2025-oriented.
