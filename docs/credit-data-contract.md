# Credit portfolio data contract

Status: open. This document records what the application needs to show the
credit portfolio (Cartera), what the database actually contains today, and the
decisions required before the mock data can be replaced.

Audit command, read-only and safe to run at any time:

```bash
node scripts/audit-credit.mjs
```

It prints only counts and state labels, never names, documents or emails.

## 1. What the database contains today

Run on the current project:

| Table | Rows | What they are |
|---|---|---|
| `credito` | 2 | `firestore_id` values `mock_credito_123_1` and `mock_credito_123_2` |
| `cuota_creditos` | 2 | both have `estado` set to `demo` / `demo 2` |
| `user_profiles` | 6 | real profiles, but none referenced by the credits |

Every business column in `credito` is empty: `monto_total`, `cantidad_cuotas`,
`user_ref`, `estado_lista`, `fecha_lista`, `monto_lista`, `fechacreacion`,
`codigo`, `ea` and `tipo_credito_name` are null on both rows. Both rows were
created in the same second, which is the signature of a seed script.

Neither `cuota_creditos.credito_ref` value matches a credit id, a
`firestore_id` or a `codigo`. Both are orphans.

Conclusion: the tables exist and are readable, but they hold no portfolio. The
problem is population, not access.

## 2. Field mapping

What Cartera renders, and where it would come from.

| Cartera field | Source | State |
|---|---|---|
| `id` | `credito.codigo`, fallback `firestore_id` | Column exists, empty |
| `nombreCompleto` | `user_profiles.display_name` or `nombre` + `apellido` | Needs a working join |
| `numeroDocumento` | `user_profiles.nro_documento` | Needs a working join |
| `montoCredito` | `credito.monto_total` | Column exists, empty |
| `saldoPendiente` | Sum of unpaid `cuota_creditos.monto` | **Rule needed** |
| `fechaDesembolso` | `credito.fechacreacion` | Column exists, empty |
| `fechaVencimiento` | Not stored | **Rule needed** |
| `cuotasPagadas` | Count of `cuota_creditos` with a paid state | **Vocabulary needed** |
| `cuotasTotales` | `credito.cantidad_cuotas` | Column exists, empty |
| `diasMora` | Oldest unpaid due date vs today | **Rule needed** |
| `estadoCartera` | Derived from days in arrears | **Thresholds needed** |

There are two possible payment histories in the schema, and they must not be
mixed: the arrays `credito.estado_lista` / `monto_lista` / `fecha_lista`, and
the `cuota_creditos` rows. The adapter currently reads `cuota_creditos`, because
it is the only one with one row per instalment.

## 3. The join keys

`credito.user_ref` is `text`; `user_profiles.id` is `uuid`. A direct join is not
possible unless `user_ref` stores one of the text identifiers that
`user_profiles` also stores: `uid` (Firebase UID), `firestore_id`, or
`codigocredito`.

`cuota_creditos.credito_ref` is also `text`, so it may hold `credito.id`,
`credito.firestore_id` or `credito.codigo`. The audit reports which one matches.
Today, none does.

The adapter already tries all candidates in both directions, so no code change
will be needed once the convention is known. But the convention must be
confirmed, not guessed, because a wrong guess silently produces an empty
portfolio rather than an error.

## 4. Business rules still missing

1. **Saldo pendiente.** Is it the sum of unpaid instalments, or
   `monto_total - sum(paid instalments)`? The adapter sums unpaid instalments.
2. **Estado de una cuota.** Which exact strings mean paid, pending and waived?
   The adapter recognises `pagada`, `pagado`, `pago`, `completada`,
   `completado`, `paid` and the pending equivalents. Anything else is treated
   as unknown, and the row is reported as unresolved rather than guessed.
3. **Fecha de vencimiento.** Monthly, biweekly or another schedule? Is it the
   last instalment date or the credit's contractual end?
4. **Días de mora.** Is `cuota_creditos.fecha_pago` the due date or the payment
   date? Is there a grace period?
5. **Umbrales de cartera.** How many days make "mora temprana", "mora tardía",
   and when does a credit move to "castigo"?
6. **Castigo.** Is it a manual flag, a derived state, or a separate table?

## 5. Implementation status

Added, but not connected to the screen:

- `src/services/credit/creditMetrics.ts` — mapping and the pending formulas,
  each one returning `null` with a comment instead of a fabricated value.
- `src/services/credit/creditPortfolioSource.ts` — reads `credito`,
  `cuota_creditos` and `user_profiles` and returns resolved rows plus the list
  of unresolved rows and the fields they are missing.
- `src/services/credit/mockPortfolio.ts` — the current mock data, moved out of
  the page.

The switch defaults to mock:

```bash
VITE_CREDIT_PORTFOLIO_SOURCE=database
```

Even with the switch on, the current rows produce zero resolved credits, and
the result lists exactly which fields are missing. That is intentional: the
adapter is a diagnostic, not a source of invented numbers.

Rollback is deleting the three files and the flag; nothing else imports them.

## 6. Questions for the client

1. Where does the real credit portfolio live today, and can it be loaded into
   these tables?
2. Does `credito.user_ref` store the profile UUID, the Firebase UID, the
   `firestore_id`, or `codigocredito`?
3. Does `cuota_creditos.credito_ref` store `credito.id`, `firestore_id` or
   `codigo`?
4. Which strings in `cuota_creditos.estado` mean paid, pending and waived?
5. What is the instalment schedule, and how is the due date of each instalment
   determined?
6. What are the day thresholds for early arrears, late arrears and write-off?
