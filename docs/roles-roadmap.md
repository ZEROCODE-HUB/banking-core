# Roles and Permissions — Proposed Roadmap

**Status:** Phases 0, 2, 4 and 5 implemented in code. Phase 1 and the role-change guard are ready to apply. Phase 3 (RLS) is deferred to a separate hardening phase, as agreed.
**Date:** 2 November 2026
**Scope:** The six items from the roles review, plus the `user_type = 'Basic User'` filter in the verification queue.

See `supabase/migrations/README.md` for application order, verification steps and rollback.

## 1. Where we are today

A snapshot of the six profiles at the time of this review:

| Profile | `user_type` | Verification PDF | `confirmacion_verificado` |
|---|---|---|---|
| mock_admin@alianza.com | Admin | no | true |
| flavianboke@gmail.com | CRM SuperAdmin | no | null |
| mock1@alianza.com | Basic User | yes | false |
| mock2@alianza.com | Basic User | yes | false |
| mwitawangeri@gmail.com | null | no | null |
| andres@zerocode.la | null | yes | null |

What this tells us:

- One profile has `CRM SuperAdmin`. That is the only account that can currently see the Novedad de saldo button and the Verificaciones menu entry. It was set by hand.
- Two profiles have no role at all, and one of them has a verification document uploaded.
- `user_type` is free text with no constraint, so any value can be written.
- There are no `roles`, `user_roles` or `permissions` tables.
- Nothing in the application writes `user_type`, so role assignment is a manual database operation today.
- The API returns `user_profiles` rows to an anonymous request, so reads are not protected by RLS.

## 2. Design decisions proposed

**Separate permission from profile kind.** `user_type` currently does two jobs: it says what a person may do (Admin, SuperAdmin) and what kind of person they are (Basic User, a customer). Those are different questions and they should not share a column. Permissions belong in `role`; whether someone is a customer or staff belongs in the verification workflow.

**Four roles, no more.** `crm_superadmin`, `admin`, `supervisor`, `customer`. A roles table and a permission matrix are not justified for six profiles. A check constraint plus application constants gives the same safety with far less machinery. If the client later needs per-permission control, the `role` column can become a foreign key without changing the rest of the design.

**Deny by default.** A missing or unrecognised role must grant nothing. The current `'Admin'` fallback in `Auth.tsx` does the opposite and must go first.

**The server is the boundary.** Hiding a button is presentation. A role is only real when the database refuses the operation. That is Phase 3, and it is the phase that matters most.

**One migration, reviewed once.** Phases 1 and 3 both change the schema. They should be written as reviewed SQL in the repository, applied deliberately, with a rollback script, rather than clicked through the dashboard.

## 3. Roadmap

### Phase 0 — Stop the bleeding (no schema change, about 3 hours)

Closes item 6, partially closes items 2 and 5.

- Remove the `'Admin'` fallback in `Auth.tsx` so an unset role grants nothing.
- Make `AuthContext` the only place that resolves the role, so a fresh login and a page reload produce the same result.
- Add `src/auth/roles.ts` with the role constants and a single `hasRole()` helper.
- Replace the two literal comparisons in `MainLayout.tsx` and `ConsultarUsuarioDetalle.tsx` with the helper.
- Remove the fake Autorización card, or replace it with a clear "not available" state, so the interface stops implying a control that does not exist.
- Remove the fallback in `obtenerUsuariosVerificados` that returns every profile when the filtered query fails.

**Why first:** these are small, reversible, and they close an accidental privilege escalation and a data leak without touching the database.

**Exit criteria:** the same user has the same role after login and after reload; a profile without a role sees no admin features; no code path returns all profiles on error.

### Phase 1 — Canonical data model (one migration, needs approval, about 3 hours)

Closes item 1. Prerequisite for Phase 3.

- Rename `user_type` to `role` and constrain it to the four values, with `customer` as the default.
- Add `verification_status` with the values `not_required`, `pending`, `submitted`, `approved`, `rejected`.
- Backfill all six profiles: assign roles, and derive verification status from the existing PDF and confirmation fields.
- Keep `confirmacion_verificado` for one release as a compatibility mirror, then retire it.

**Why rename rather than add:** there are six rows and four code references. Keeping both `user_type` and `role` would create two sources of truth, which is the problem we are trying to remove.

**Approval needed:** yes, schema change. One migration, one rollback script.

**Open dependency:** new profiles are not created by any trigger in this repository, so the provisioning path is unknown. If a profile is created without a role, the default must be `customer`, never staff.

### Phase 2 — Code alignment (no schema change, about 4 hours)

Closes items 2 and 5.

- Add the `Role` union type and label mapping (database key to Spanish display text).
- Replace every remaining `user_type` reference with `role`.
- Add a `RequireRole` route wrapper and apply it to `/personas/verificaciones` and its detail page.
- Update the profile card and dialog to show the mapped label, with "Sin rol" for a missing value.

**Exit criteria:** `tsc` and the build pass; a `customer` account cannot open administrator routes by URL; no role string is written inline.

### Phase 3 — Server enforcement (schema and policies, 1 to 1.5 days)

Closes item 3. This is the real security boundary.

- Add a `public.current_user_role()` function, `security definer`, `stable`, with a pinned `search_path`, reading the caller's role from `user_profiles` by `auth.uid()`.
- Write RLS policies per table. Read your own profile; staff read clients according to role; role changes only by `crm_superadmin`.
- Revoke anonymous access to `user_profiles` and to every table that currently accepts anonymous writes.
- For money-moving operations (`transactions`, `ahorros`), prefer moving the write behind an RPC or Edge Function so the policy can simply refuse direct client writes. This links directly to the Novedad de saldo work and should be planned together.
- Test a matrix of four roles against the main actions before applying to production.
- Keep the service role key server-side only, for recovery.

**Order matters:** roles must be populated in Phase 1 before policies are enabled, or staff will be locked out. Apply during low activity with the rollback script ready.

### Phase 4 — Role management and audit (about 1 day)

Closes item 4.

- Add a `role_audit` table recording actor, target, previous role, new role, timestamp and reason.
- Add a screen for `crm_superadmin` to change a role, with an explicit confirmation for elevation.
- Every change writes an audit row; no direct database edits are needed afterwards.

**Why not skip it:** without it, roles drift back to null as profiles are created, and there is no record of who granted administrator access.

### Phase 5 — Verification queue (about half a day, can run in parallel after Phase 1)

Closes the filter problem described in section 4.

## 4. The `user_type = 'Basic User'` filter

### What it does now

`obtenerUsuariosVerificados` in `src/supabase/database.ts` selects profiles where:

- `verification_pdf` is present, **and**
- `user_type = 'Basic User'`, **and**
- `confirmacion_verificado` is not `true`.

### Three problems

**It reassigns a permission field to mean "customer".** The moment an administrator's role changes, they leave or enter the queue. The two concepts should not be coupled.

**It silently drops real users.** `andres@zerocode.la` has a verification document but no role, so the query excludes them. A row with a null `confirmacion_verificado` is also excluded, because SQL's "not equal" does not match nulls. The queue therefore shows two mock users and hides a real one.

**The queue has no exit.** Nothing in the application ever writes `confirmacion_verificado`, and the detail screen only edits the display name. Once someone appears in the queue they stay there forever, unless the database is edited by hand.

There is also a separate defect worth fixing immediately: when the filtered query fails, the function returns **every profile** with no filter, including documents and phone numbers. That fallback should return an empty list and log a static error.

### Recommendation

Replace the role filter with an explicit workflow state:

- `verification_status = 'submitted'` for the queue.
- `approved` or `rejected` when a reviewer decides, with the reviewer and timestamp recorded.
- `pending` when a customer exists but has not uploaded a document.
- `not_required` for staff.

The query becomes one condition on workflow state, not on permissions:

```
.eq('verification_status', 'submitted')
```

Staff carry `not_required` and never enter the queue. The query also returns only the columns the list needs, not `select('*')`.

**If the client wants the smallest possible change,** keep `user_type` and backfill the two null profiles to `customer`, then include nulls explicitly in the confirmation condition. That restores the missing user and stops the role/queue coupling from getting worse, but it leaves the queue unmanageable because nothing can mark a review complete. I recommend the explicit status field even in the minimal version, because without it the queue cannot function.

## 5. Effort summary

| Phase | Effort | Schema change | Approval |
|---|---|---|---|
| 0. Stop the bleeding | 3 hours | no | code review |
| 1. Data model | 3 hours | yes | required |
| 2. Code alignment | 4 hours | no | code review |
| 3. Server enforcement | 1–1.5 days | yes | required |
| 4. Role management | 1 day | yes | required |
| 5. Verification queue | 0.5 day | no (after Phase 1) | code review |

Total is roughly four working days if done in sequence, or about three if Phase 5 runs alongside Phase 1 and Phase 2. No new licences are required. The only external prerequisite is a safe place to test the policies, ideally a second Supabase project used as staging.

## 6. Open questions for the client

1. Are there staff accounts beyond the one administrator and the two mock users, and what should each be allowed to do?
2. Should a supervisor be able to approve a Novedad de saldo, or is that reserved for the super-administrator? This decides whether the OTP flow is dual control or single-operator.
3. Is `Basic User` meant as a customer label, a permission level, or both? The answer decides whether it survives the migration at all.
4. Does any external process, such as the Firebase import, write `user_type`? If it does, the rename needs to be coordinated.
5. Can we have a separate Supabase project for testing RLS? Applying policies for the first time directly to production is the main risk in Phase 3.
6. Should customers be able to see and correct their own data, or is every change made by staff? This determines how much of the profile table needs write policies.

## 7. What I would do first

Phase 0 this week, because it removes an accidental administrator path and a data leak without touching the schema. Then Phase 1 as a single reviewed migration, so Phase 2 and Phase 3 have something stable to build on. The verification queue fix can follow immediately after Phase 1 and does not need to wait for the rest.
