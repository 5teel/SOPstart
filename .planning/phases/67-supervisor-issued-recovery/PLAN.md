# Phase 67 — Supervisor-issued Recovery

**Goal:** A worker who has forgotten their password or lost their phone gets back in through their supervisor or an admin, in person. The supervisor or admin opens the person in People and presses "Give a sign-in code". The worker types their email and that code on the login screen, is signed in, and sets a new password, adding a passkey if they want one. The code lasts 30 minutes, works once, works only for that person, and every issue and use is in the ledger. No SMS and no email.

**Depends on:** Phase 66. **Plan written:** 2026-10-24, without GSD.

## Facts this plan rests on
- Today there is **no "forgot password"** at all. A locked-out worker has no way back without Simon using the service role.
- The server can mint a session for a user with `auth.admin.generateLink({ type: 'magiclink', email })` and then `verifyOtp({ token_hash, type: 'magiclink' })` on the SSR cookie client. That is the same path `tests/evals/lib/session.ts:66` already uses. No email is sent, because the link is never delivered.
- `revoke_user_sessions` (00082, service role only) signs a person out everywhere.
- The People sheet already has per-person actions with D-05 authority rules (Phase 64 `src/actions/members.ts`).

## Decisions
- **D-01: who may issue.** A code can only be issued by someone who is active and at aal2 if elevated (Phase 66).

  | Issuer | Can issue for |
  |---|---|
  | Supervisor | Workers they supervise (`supervises` link) |
  | Admin or safety manager | Any active non-admin in their org |
  | Admin | Another admin, but that admin's MFA factors are reset (Phase 66 D-06) and every admin is notified |

  Nobody can issue a code for themselves, and nobody can issue one for a suspended or departed person.
- **D-02: the code.** 8 characters, base32 with no look-alike letters, shown once in large type with the person's name and the expiry ("Give this to Sam. It works once, until 10:42.").
  - Stored as HMAC-SHA256 with the Phase 66 pepper in `signin_codes(id, organisation_id, user_id, code_hash, issued_by, expires_at, used_at, attempts)`.
  - RLS is on with no policies, so only the service role touches it.
  - A new code for the same person voids any unused one.
- **D-03: brute force.** Every wrong attempt against the person's open code adds to `attempts`, and at 5 the code is void. The login screen gives one plain refusal for every failure ("That code didn't work. Ask your supervisor for a new one."), so it never confirms an email exists. Attempts are counted per email lookup, with no scheduled clean-up (ADR-0002). Expiry is checked at read time.
- **D-04: what using a code does.**
  1. Verify the code.
  2. Mark it used.
  3. Revoke all of the person's sessions, since a lost phone may still be signed in.
  4. Mint a fresh session (D-Facts).
  5. Log `signin_code_used`.
  6. Redirect on the server to `/profile?set-password=1`, where they must set a new password before going on.

  An elevated person, whose factors were reset, goes on to `/verify` to enrol again.
- **D-05: plain words.** "Give a sign-in code" (People), "Got a code from your supervisor?" (login), "Set a new password". No mention of "recovery", "token" or "OTP".

## Steps
1. **Migration 00087:** add the `signin_codes` table, the ledger kinds `signin_code_issued` and `signin_code_used`, and the registry and spec updates. Apply after `migration list`.
2. **`src/lib/members/signin-code.ts`** (plain module): generate, hash and compare (with `timingSafeEqual`), plus the expiry and attempt rules. Add `tests/phase67/signin-code.spec.ts`, which tests the module directly.
3. **Server actions**:
   - `issueSigninCode(subjectId)` in `src/actions/members.ts`: D-01 authority with the org from the session, voids the open code, inserts with the service role, records the decision, and returns the plain code once.
   - `signInWithCode({ email, code })` in `src/actions/auth.ts`: public, zod-validated, D-03 and D-04, with the session minted on the SSR client.
   - Both registered in `decision-writers.json`.
4. **People sheet:** a "Give a sign-in code" button when D-01 allows it, and a sheet that shows the code, the person's name and the expiry. Nothing is stored client-side.
5. **Login:** a "Got a code from your supervisor?" link opens an email field and a code field, then calls `signInWithCode`.
   **Profile:** the `set-password=1` state, a new password with confirmation through `updateUser({ password })`. The proxy holds the person on Profile until it is done. Offer "Add a passkey" (Phase 65) on the same screen.
6. **Same-commit duties:**
   - ADR-0029 "In-person sign-in codes are how people get back in; no SMS and no email reset".
   - Add the issue and use rows to `CAPABILITY-MATRIX.md`.
   - Add the People and login steps to `journeys.ts`, and add a `uat/tests.ts` entry.
7. **Deployed eval** `tests/evals/signin-code.eval.ts` covers:
   - **Issue:** eval-admin issues a code for eval-worker.
   - **Use:** in a fresh context, the worker uses it, lands on set-password, sets a new one and reaches home.
   - **Old session revoked:** the worker's old session is gone.
   - **Single use:** the same code is refused afterwards.
   - **Attempt cap:** a wrong code five times voids a new code.
   - **Ledger:** both rows are in the ledger.
   - **Authority:** a supervisor without the supervises link can't issue a code, and a suspended person can't be issued one.

   Read every phone and desktop screenshot. Restore the eval-worker password at the end so other evals keep working; the fixture script owns the password.
8. **Gates and push:** tsc, build, specs once, then push, wait for the deploy, run the evals and read every shot.

## Risks
- **The code is a bearer credential for 30 minutes.** Mitigated by: in-person handover only, never sent by the app; single use; expiry; attempt cap; and a ledger row naming the issuer. The sign-out also cuts off whoever held the lost phone.
- **Accounts that share an email address across sites:** there is one auth user per email. The code is bound to `user_id`, and the org check runs at issue time, so this is fine.

## Outcome (2026-10-24)

**Shipped.** A locked-out person can get back in through their supervisor or an admin, in person. **Give a sign-in code** is in the People sheet, and also under a supervisor's Sign-offs inbox in a list called **Your workers**. The code has 8 letters and is shown once, with the person's name and the time it stops working. On the login screen, **Got a code from your supervisor?** takes the email and the code. A good code signs the person out everywhere and signs them in here. The app then holds them on **Set a new password** (Profile) until they set one. Profile also offers Add a passkey. Every issue and every use is in the ledger. No SMS and no email.

**Commits** (master, pushed):

| Commit | What |
|---|---|
| `75c64ebc` | Migration 00088 (applied before the push), code module, `issueSigninCode` / `listSigninCodeWorkers` / `signInWithCode` / `setNewPassword`, proxy hold, People and supervisor UI, login form, Profile section, ADR-0029, CAPABILITY-MATRIX, journeys, UAT, decision-writers, kind specs repointed to 00088, phase67 spec, signin-codes lint, deployed eval |
| this commit | Outcome, `67-EVAL.md`, ROADMAP tick, learning |

**Gates.**
- `npx tsc --noEmit`: exit 0.
- `npm run build`: exit 0. The bundle gate is green: `/sops/[sopId]` is 838 KB (baseline 837) and `/` is 867 KB (baseline 869). Both match the Phase 66 numbers. The baseline was not touched.
- Targeted specs pass:
  - `tests/phase67` and `tests/lint` (signin-codes included);
  - the kind specs (phase56 shape and writers sweep, 59, 60, 64, 65, 66);
  - the specs that touch the edited files (phase 30/33/34/35/53/55/57/58/63).
  - Totals: 556 + 584 run, 0 failed (27 live-gated skipped). The one red, the pinned export count in `tests/phase64/member-actions.spec.ts`, was updated for the two new exports.
- `scripts/apply-phase67-migration.mjs` ran `migration list` (only 00088 pending), then `db push`. Every assertion passed:
  - `signin_codes` has RLS on, no policies, and no anon or authenticated grants.
  - `signin_code_try` is service_role only.
  - The authenticated role is refused both the table and the function.
  - The behaviour probe `nnnnnn|yn|nnn`: five wrong tries void the code; a good code works once (email case-insensitive); expired, suspended and unknown are refused.
  - The kind list has 46 kinds.
- The full local Playwright suite was **not** run, to save the shared OTP budget. The targeted runs above cover every spec that reads the files changed.

**Evals on sopstart.com** (`75c64ebc` deployed, "Deploy to Fly" run 40038689836 succeeded, `/api/version` = HEAD):
- `signin-code.eval.ts`: **6/6 passed on the first run.**
  - SC-01: issue; the hash is stored, the plain code is not, about 30 minutes, ledger row.
  - SC-02: use, then held on Set a new password (`/` bounces back), mismatch refused, home. The old refresh token is refused, the new password signs in, the flag is cleared, and the `signin_code_used` row has the worker as actor in the eval-site org.
  - SC-03: the same code is refused; an unknown email gets the identical sentence.
  - SC-04: five wrong tries void a fresh code (attempts = 5), and the right one is then refused.
  - SC-05: a suspended person has no button, and a rewritten request is refused by the server with no row.
  - SC-06: a supervisor sees only their linked worker. A request rewritten to an unlinked worker is refused, with no row.
- **Full deployed suite, once:** 140 passed, 0 failed, 0 skipped (33 min). Report: `67-EVAL.md`.
- **Screenshots read:**
  - desktop 1440: `67-code-shown-desktop`, `67-supervisor-refused-desktop`, plus `65-login-desktop` (the new link sits under the password form) and `64-person-sheet` (Give a sign-in code beside Suspend / Reset), both regression checks;
  - phone 390: `67-set-password-phone`, `67-home-after-code-phone`, `67-code-refused-phone`;
  - `59-supervisor` (supervisor home unchanged).

**Rate limit check.** The live auth config has `rate_limit_verify` 30 per 5 minutes per IP and `rate_limit_email_sent` 2 per hour.
- `generateLink` is an admin call and sends no email.
- The server-side `verifyOtp` shares the Fly machine's verify bucket.
- It runs only after a good code, so an attacker cannot drain it.
- The details are in ADR-0029.

**Deviations from the plan.**

| Plan | What happened | Why |
|---|---|---|
| Step 1: migration 00087 | 00088 | Phase 66 used 00086 and 00087 |
| D-01: an admin or safety manager issues for "any active non-admin" | A safety manager issues for workers and supervisors. An admin or safety manager subject can only be given a code by an admin, and their second steps are reset through the Phase 66 `resetMemberFactors` | A safety manager who lost their phone needs the factor reset too, and only an admin may reset (ADR-0028 D-06) |
| Step 2: compare with `timingSafeEqual` in the module | The compare runs inside `signin_code_try` on one locked row | A count kept outside one locked row races. The stored value is an HMAC that can't be attacked byte by byte. Recorded in ADR-0029 |
| Step 2: the module holds the authority rule | `mayIssueSigninCode` lives in `src/lib/members/authority.ts` | The People sheet (client) uses it too, and the code module imports `node:crypto` |
| Step 4: supervisors use "People" | Supervisors have no People tab, so they get **Your workers** under the Sign-offs inbox (`listSigninCodeWorkers`, their own active workers only) | D-01 row 1 needed an entry point |
| Step 5: "the proxy holds the person on Profile" | `app_metadata.must_set_password` is set with the service role before the session is minted. The proxy redirects every page (not API routes) to `/profile?set-password=1`. `setNewPassword` clears the flag and refreshes the token | The person cannot clear the flag, and it rides in the signed token with no database read in the proxy. Recorded in ADR-0029 |
| Step 7: eval-admin issues for eval-worker; restore eval-worker's password | A throwaway worker (and a throwaway suspended worker) in the eval-site org are made and removed by the eval. eval-worker was never touched | Using a code revokes every session the person holds, which would break the other evals' eval-worker contexts during the full run. The fixture script sets no password for eval-worker, so there was nothing to restore |
| Step 7: authority eval "a supervisor without the supervises link" | The linked supervisor's own request is rewritten in flight to an unlinked worker | The UI never offers that button, so the server rule is proved directly |
| Extra | `setNewPassword` writes no ledger row | `signin_code_used` records the recovery; no third kind was planned |

**Follow-ups.**
- `src/lib/supabase/middleware.ts:10` has a `prefer-const` lint error from before this phase (`let response`); untouched.
- The live-gated local probes from the Phase 66 follow-up are still open.
- If a site ever needs more than 30 code sign-ins in 5 minutes on one machine, raise `rate_limit_verify`.
- A sole admin who loses everything still needs Simon with the service role (ADR-0028/0029).

**Nothing for Simon to do.** `RECOVERY_PEPPER` was reused, there is no new secret, and the migration is applied. To try it: as an admin, open People, open a worker, then **Give a sign-in code**.
