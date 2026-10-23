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

## Spike result (step 1, 2026-10-24)
- **TOTP works.** Throwaway account: enrol, challenge, verify → the access token's `aal` is `aal2`, and it stays `aal2` after a refresh. A fresh sign-in is `aal1` with `nextLevel: 'aal2'`. A wrong code is `422 mfa_verification_failed`. The same code is accepted twice inside one 30 s window.
- **Supabase generates the TOTP secret**; enrol takes none. The eval fixtures' "fixed secret" is the one captured at enrolment (`scripts/eval-mfa-fixtures.mjs`).
- **Deleting a factor ends the sessions that were confirmed with it** (their refresh tokens fail); an aal1 session survives and can enrol again (second spike, same day). So eval fixtures are enrolled once and never re-enrolled per sign-in, and a recovery-code user sets up again in the same session.
- **An aal1 session cannot enrol a second factor** once one is verified (`insufficient_aal`): adding a factor needs aal2.
- **WebAuthn as an MFA factor: dropped (D-03 → TOTP only).** The Management API refuses `mfa_web_authn_enroll_enabled: true` with "Enabling of MFA with WebAuthn not currently supported". Auth config left unchanged (TOTP enrol and verify were already on).
- supabase-js 2.118 has experimental built-in recovery codes (`auth.mfa.recoveryCodes`), but the project's auth config exposes no recovery-code setting, so D-05 (our own table) stands.

## Outcome (2026-10-24)

**Shipped.** Admins and safety managers prove a second step (a code from an authenticator app) before any admin screen or write. This is enforced in the app through one classifier and in RLS through `public.is_elevated()`. Setting up issues ten one-time recovery codes; we store them hashed and each works once. Enrolment, removal, reset and every recovery-code use write a ledger row. **TOTP only**, because the hosted project refuses WebAuthn MFA.

**Commits** (master, pushed):

| Commit | What |
|---|---|
| `3fa36966` | Spike result; `tests/evals/lib/session.ts` mints aal2 for elevated accounts; `tests/evals/lib/totp.mjs` (RFC 6238); `scripts/eval-mfa-fixtures.mjs` enrols the four persistent elevated fixtures |
| `24036cdb` | App side: classifier, guards, proxy, `/verify`, `src/actions/mfa.ts`, Profile, People reset, account-menu link, editor redirect; migration 00086 (applied before deploy); ADR-0028, CAPABILITY-MATRIX, journeys, UAT, specs, lint |
| `269762fc` | Deployed eval `tests/evals/mfa.eval.ts` |
| `736e3ff3` | Migration 00087 policy sweep (applied after the app was live) and its spec |
| this commit | Outcome, learnings, ROADMAP tick |

**Order kept.** The steps ran as spike → eval helper (the methodology and sites evals passed through it on the old deploy) → app plus additive 00086 → deploy → 00087. Nothing broke the live site in between.

**Gates.**
- `npx tsc --noEmit` exit 0 and `npm run build` exit 0. The bundle gate held: `/sops/[sopId]` 838 KB against an 837 baseline, `/` 867 against 869, both within ±2. The baseline was not touched.
- `tests/phase66`, `tests/lint/elevated-aal2.spec.ts` and the repointed phase 53/56/59/60/63/64/65 specs pass.
- `apply-phase66-migration.mjs` passes every assertion:
  - the tables are service-role only;
  - the attempt cap runs `yyyyyny`;
  - 44 ledger kinds and `signin_reset` are accepted;
  - the sweep leaves no write policy on a plain elevated role (48 write policies);
  - an aal1 admin updates 0 SOPs and is refused a department insert, but still reads 18;
  - an aal2 admin updates 18 and the insert passes.

**Evals on sopstart.com.**
- `mfa.eval.ts`: MFA-01, 02, 03, 05 and 06 passed on `24036cdb` before 00087. MFA-04 (aal1 REST write refused, aal2 passes) passed after 00087.
- **Full deployed suite, once, after 00087** (`736e3ff3`): 133 passed, 1 failed. The failure was `site-editor.eval.ts`: the second machine's rename was not saved. In the same run the corner move and the SOP link on the same session did persist, so aal2 writes work. In the one fix round, a re-run of that file passed (2 of 2). It is a save-status race in that eval, not Phase 66.
- **Screenshots read:**
  - desktop 1440: `66-verify-enrol-desktop`, `66-verify-codes-desktop`, `66-home-aal1-desktop`, `66-people-reset-ask-desktop`;
  - phone 390: `66-verify-wrong-code-phone`, `66-home-after-code-phone`, `66-verify-recovery-phone`, `66-profile-second-step-phone`;
  - the site-editor failure shot.

**Secrets.**
- `RECOVERY_PEPPER`: 32 random bytes, base64. Written without a BOM to the vault and `.env.local`, then staged on Fly with `fly secrets import --stage` from a temp file (deleted afterwards). The `24036cdb` deploy took it up. The recovery-code round trip in MFA-01/05 proves it is live; the value was never printed.
- `EVAL_ADMIN_TOTP_SECRET`, `EVAL_SITE_ADMIN_TOTP_SECRET`, `EVAL_SITE_SAFETY_TOTP_SECRET` and `EVAL_TEMPLATE_ADMIN_TOTP_SECRET` are in the vault and `.env.local`. No CI runs evals, so no GitHub secret is needed.

**Deviations from the plan.**

| Plan | What happened | Why |
|---|---|---|
| D-03: passkey as an MFA factor | Dropped; TOTP only | The Management API refuses `mfa_web_authn_enroll_enabled` ("not currently supported") |
| D-07: eval-admin enrols "with a fixed secret" | Supabase generates the secret. Each persistent elevated fixture (four of them) is enrolled once and its secret stored; throwaway elevated accounts are enrolled on first sign-in | Enrol takes no secret. Deleting a factor ends the sessions confirmed with it, so re-enrolling per sign-in would kill an eval's other contexts |
| Step 3: run every elevated check through one helper | `getSessionContext()` reports an elevated member without aal2 as `worker` (`memberRole` keeps the real role). `requireAdminContext` and `requireSopEditAccess` also refuse explicitly | One choke point covers 60+ existing checks without editing each one; the lint guards that nothing else derives the caller's role |
| Step 2: one migration, 00086 | 00086 (additive) and 00087 (policy sweep) | `db push` applies every pending file, and the sweep had to wait for the app deploy |
| Step 2: sweep only `current_user_role()` arms | Also the `om.role` EXISTS arms (areas, collections, departments, roles) and the sign-off approver arm | They grant elevated writes too. The EXISTS arms did not scope the role to the session org either |
| Step 5: `useRecoveryCode` | Named `redeemRecoveryCode` | A `use*` name trips the React hooks lint at the call site |
| Step 6: add a passkey factor on Profile | Not built | D-03 dropped |
| Step 7: Office admin tabs redirect | No redirect needed | At aal1 the effective role is worker, so those tabs never render; the account menu offers "Confirm it's you for admin work" instead |
| Extra | "Not now: just read and run SOPs" on `/verify` | D-02 keeps the worker side open at aal1 |

**Follow-ups.**
- Live-gated local probes (phases 33/34/35/36/37/46/51) mint admin sessions at aal1. After 00087, their admin-write cases need the aal2 step-up from `tests/evals/lib/session.ts`. They also hit the shared OTP rate limit in this session's local run, which I ran twice.
- `site-editor.eval.ts` waits on `Saved ✓` before the rename's debounced save has fired. It should wait for the new name to be saved.
- Platform-admin policies (`is_platform_admin()`) are not aal2-gated (ADR-0028 residual). `video_generation_jobs` and `sop_pipeline_runs` let any member write their own organisation's rows; that was already so.
- Supabase's experimental built-in recovery codes could replace ours once the project offers the setting.
- A sole admin who loses their phone and every code needs Simon with the service role (ADR-0028).

**What Simon must do on his first admin visit** (Joe the same):
1. Install an authenticator app (Google Authenticator or Microsoft Authenticator).
2. Sign in. You land on "Set up a second step". Tap **Set up an authenticator app**, scan the QR code and type the six-digit code.
3. **Save the ten recovery codes** (Copy or Download) somewhere other than the phone. Then tap Continue.
4. From then on, each sign-in asks for the current code. If the phone is lost, use **Use a recovery code**, or ask the other admin to **Reset sign-in steps** from People.
