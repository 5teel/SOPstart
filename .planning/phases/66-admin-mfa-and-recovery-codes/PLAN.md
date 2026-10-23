# Phase 66 — Admin MFA and Recovery Codes

**Goal:** Admins and safety managers prove a second factor before any admin action: their session must be **aal2**, enforced in the server guards and in RLS for elevated writes. They can use an authenticator app, or a passkey registered as an MFA factor. Enrolling issues ten one-time recovery codes, stored hashed and each usable once. Every enrolment, removal and recovery-code use writes a ledger row.

**Depends on:** Phase 65. **Plan written:** 2026-10-24, without GSD.

## Facts this plan rests on
- Supabase MFA:
  - **TOTP** is documented and stable: `auth.mfa.enroll({ factorType: 'totp' })`, then `challenge`, then `verify`. Verifying promotes the session to **aal2** and signs out the user's other sessions.
  - **WebAuthn as an MFA factor** exists in supabase-js (`mfa.webauthn`). Its docs are thin, so step 1 proves it.
  - `auth.mfa.getAuthenticatorAssuranceLevel()` returns `currentLevel` and `nextLevel`. The JWT carries an `aal` claim.
- Supabase has **no built-in recovery codes**, so we build them.
- Guards: `requireAdminContext()` (`src/lib/auth/guards.ts:22`) reads `getSessionContext()`, which verifies the JWT locally, so `aal` is available without a round trip.
- Elevated RLS uses `public.current_user_role() in ('admin','safety_manager')`. Since migration 00082 this re-checks the membership row.

## Decisions
- **D-01: who.** Every member whose role is `admin` or `safety_manager`.
  - Supervisors and workers are not required to use a second factor, though they may.
- **D-02: hard requirement, no grace period.** The first time an elevated person signs in after the deploy, they enrol before reaching any admin screen. They can still use the worker side of the app at aal1 (read and run SOPs). Only admin actions and admin screens need aal2.
- **D-03: which factors.** An authenticator app (TOTP) always works. A passkey MFA factor is offered only if step 1 proves `mfa.webauthn` works end to end. A Phase 65 sign-in passkey does not count as a second factor.
- **D-04: enforcement in two places.**
  - **App:** `requireAdminContext()` returns `{ error: 'Confirm it\'s you' , needsAal2: true }` when `aal !== 'aal2'`. Admin pages redirect from the server component (or proxy) to `/verify?next=…`, never via a client effect.
  - **Database:** a new helper `public.is_elevated()` returns `current_user_role() in ('admin','safety_manager') and (auth.jwt() ->> 'aal') = 'aal2'`. Every policy arm that today grants admin or safety-manager writes switches to it.
  - The signed `aal` claim is safe to trust (unlike org and role, it is not membership state). The service-role paths already go through the app guard.
- **D-05: recovery codes.**
  - Ten codes of the form `xxxx-xxxx` (base32, no look-alike letters), shown once at enrolment with Copy and Download as text. They are stored as HMAC-SHA256 with a server pepper (`RECOVERY_PEPPER`, a Fly secret) in a new table `mfa_recovery_codes(user_id, code_hash, used_at)`.
  - Row level security is on with **no** policies, so only service-role code touches the table.
  - Using a code (on `/verify` while signed in at aal1):
    1. mark the code used;
    2. delete the person's MFA factors through `auth.admin.mfa.deleteFactor`;
    3. log the use to the ledger;
    4. send them to enrol again, which issues fresh codes.
  - Attempts are capped at 5 per 15 minutes per user. The count is kept in a column, because ADR-0002 rules out scheduled jobs.
- **D-06:** Removing your last factor is refused while you hold an elevated role. Another admin can **reset** your factors from People (aal2 required, logged, and every admin is notified). That is the escape route when someone loses everything, and it works together with Phase 67.
- **D-07: evals.** `eval-admin` enrols TOTP with a fixed secret kept in the eval env (`EVAL_ADMIN_TOTP_SECRET`, gitignored and held in the vault). `tests/evals/lib/session.ts` mints aal2 by doing challenge and verify with a code computed locally with Node `crypto` HMAC (RFC 6238, about 15 lines, no new dependency). Every existing admin eval keeps working through that helper.

## Steps
1. **Spike.**
   - With a throwaway account: TOTP enrol, challenge, verify, then check that `aal2` appears in the access token and survives a refresh.
   - Try `mfa.webauthn` enrol and verify in Chromium with the virtual authenticator.
   - Write the outcome in the plan (keep or drop D-03 passkey).
2. **Migration 00086.**
   - Add `public.is_elevated()`.
   - Audit every policy using `current_user_role() in ('admin','safety_manager')` (grep the migrations, then list them with `pg_policies` live) and switch the write arms to `is_elevated()`. Read arms stay at aal1, so an admin can still see the worker side.
   - Add the `mfa_recovery_codes` table, the attempt columns and the ledger kinds `mfa_enrolled`, `mfa_removed`, `mfa_reset`, `recovery_codes_issued` and `recovery_code_used`.
   - Write an applier with audit, assertions and rollback, modelled on `scripts/apply-phase64-migration.mjs`. The assertions check two things: an aal1 admin token fails an elevated write, and an aal2 token passes.
3. **Guards:** `aal` in `SessionContext`; `requireAdminContext` and the `require*` guards that grant elevated rights need aal2. Grep every `['admin', 'safety_manager']` check in `src/actions` and `src/lib/auth`, and run them through one helper (one classifier per question).
4. **`/verify` route**, server component plus a small client form. It has three states:
   - **enrol:** QR code and setup key, confirm with a code, then show the recovery codes;
   - **challenge:** enter a code, with a "Use a recovery code" link;
   - **recovery:** enter a recovery code.
   It ends with a server redirect to a validated `next`.
5. **Server actions** in `src/actions/mfa.ts`: `issueRecoveryCodes`, `useRecoveryCode`, `resetMemberFactors` (admin, aal2, same org, cannot reset yourself), and `recordFactorChange` (verified against `auth.admin.mfa.listFactors`, the same pattern as Phase 65 D-04).
6. **Profile:** a "Second step at sign-in" section to see your factors, add a passkey factor if D-03 holds, and see recovery codes left (count only, with Make new codes). **People sheet:** "Reset sign-in steps" for admins.
7. **Proxy and pages:** admin routes (`/admin/*`, the Office admin tabs, Settings) check aal on the server and redirect to `/verify`. Worker routes are untouched.
8. **Same-commit duties:**
   - ADR-0028 "Elevated roles need aal2; recovery codes are ours". It refines ADR-0024 and ADR-0025, and states that `aal` is the one claim policies may trust.
   - Update `CAPABILITY-MATRIX.md`, adding aal2 to every elevated row.
   - Add the enrol, challenge and recovery steps to `journeys.ts`, and add a `uat/tests.ts` entry.
9. **Specs:**
   - `tests/phase66/`: source contract, a guard-coverage lint (every elevated role check goes through the aal2 helper), and a recovery code spec covering format, single use, hashing and the attempt cap.
   - Kind specs.
10. **Deployed eval** `tests/evals/mfa.eval.ts`, with every phone and desktop screenshot read:
    - a fresh admin is sent to `/verify`, enrols, sees the codes, and reaches Settings;
    - in a new session, signing in challenges, a wrong code is refused, and the right one gets in;
    - using a recovery code wipes the factors, forces enrolment again, and the old code is now refused;
    - an aal1 admin token is refused an elevated write through REST;
    - the worker side works at aal1.
    Re-run `office`, `people` and `home` through the aal2 session helper.
11. **Rollout and push:**
    - Tell Simon before the deploy: Simon and Joe enrol on their next admin visit.
    - Wire `RECOVERY_PEPPER` and `EVAL_ADMIN_TOTP_SECRET` into the vault and Fly with `use-key.ps1`, never printing them, and write them without a BOM.
    - Run the gates, push, run the evals and read every shot.

## Risks
- **Lockout:** an elevated person who loses both their factor and their codes. Mitigated by D-06 (another admin resets them) and Phase 67. With a single admin left, the fallback is Simon using the service role. Document that in the ADR.
- **Policy sweep misses an arm:** an elevated write then stays open at aal1. Mitigated by the live assertion over all `pg_policies` that mention `current_user_role` and by a lint that greps migrations after 00086.
- **Evals:** every admin eval depends on the aal2 session helper. Change the helper first and run one admin eval before the policy migration goes live.
