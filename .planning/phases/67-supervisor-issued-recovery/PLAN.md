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
