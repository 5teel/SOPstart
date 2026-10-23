# ADR-0029: In-person sign-in codes are how people get back in; no SMS and no email reset

- **Status:** Accepted
- **Date:** 2026-10-24
- **Decided by:** Simon (Phase 67 plan approved 2026-10-24); the calls marked "Claude's call" are overturnable at review
- **Refines:** ADR-0024 (sessions are revoked, the membership row decides), ADR-0028 (elevated roles need aal2; the factor reset)
- **Enforced by:** `supabase/migrations/00088_signin_codes.sql`, `scripts/apply-phase67-migration.mjs` (live assertions), `tests/phase67/signin-code.spec.ts`, `tests/lint/signin-codes.spec.ts` · `tests/evals/signin-code.eval.ts`

## Context
A worker who forgot their password or lost their phone had no way back without Simon and the service role. Workers on an
industrial site often share or lose phones, do not read work email, and stand next to their supervisor. SMS costs money and
can be swapped; an email reset reaches whoever holds the inbox, which on a shared site is often nobody.

## Decision
1. **A supervisor or admin gives the person a code, in person.** "Give a sign-in code" in the People sheet (admins and
   safety managers) and under a supervisor's Sign-offs inbox ("Your workers"). Who may issue (`mayIssueSigninCode()`):
   - a supervisor: the active workers they supervise (`supervisor_assignments`);
   - a safety manager: active workers and supervisors;
   - an admin: anyone active. For an admin or safety manager the Phase 66 `resetMemberFactors()` runs first (aal2,
     `mfa_reset`, every other admin told), so the code gets them back in to set up a second step again.
   - never yourself, never a suspended or departed person. The effective role decides, so an elevated issuer must be at aal2.
2. **The code:** 8 letters from the Phase 66 alphabet (no look-alikes), shown once in capitals with the person's name and
   the time it stops working. 30 minutes, single use. Stored as HMAC-SHA256 with `RECOVERY_PEPPER` (domain-separated with a
   `signin:` prefix) in `signin_codes` (RLS on, no policies, no anon/authenticated grants). A new code voids the person's
   unused one in that organisation. Logged as `signin_code_issued`.
3. **The check is one database function.** `signin_code_try(email, hash)` (service_role only) locks the person's newest
   open code, adds one to `attempts` on every wrong try (void at 5), reads expiry at the try (ADR-0002: nothing cleans up),
   requires the person to still be active in the code's organisation, and marks a good code used. A wrong code, an unknown
   email, a used, expired or void code and an inactive person all return null, and the login screen gives one sentence for
   all of them: "That code didn't work. Ask your supervisor for a new one." *Claude's call:* the plan's `timingSafeEqual`
   compare in the module was replaced by this locked compare in the database, because counting attempts outside one locked
   row races; the stored value is an HMAC the attacker cannot target byte by byte.
4. **Using a code** (`signInWithCode()`): revoke all the person's sessions (`revoke_user_sessions`, so a lost phone is
   cut off), set `app_metadata.must_set_password`, mint a fresh session with `auth.admin.generateLink({ type: 'magiclink' })`
   and `verifyOtp({ token_hash })` on the response cookies (no email is sent: the link is never delivered), log
   `signin_code_used`, and redirect on the server to `/profile?set-password=1`.
5. **The hold** (*Claude's call*): `must_set_password` lives in `app_metadata`, which only the service role can write, so
   the token carries it and the person cannot clear it. The proxy sends every page to `/profile?set-password=1` while it is
   set (API routes pass, so Profile's own sections load). `setNewPassword()` sets the password on the session, clears the
   flag with the service role, refreshes the session (the new token no longer carries it), and redirects on the server to
   the home, or to `/verify` for an admin or safety manager. Profile also offers Add a passkey (ADR-0027).
6. **Plain words:** "Give a sign-in code", "Got a code from your supervisor?", "Set a new password". Never "recovery",
   "token" or "OTP".

## Consequences
- **The code is a bearer credential for 30 minutes.** Mitigated by the in-person handover (the app never sends it), single
  use, expiry, the 5-try cap and the ledger row naming the issuer.
- **Rate limit (checked 2026-10-24):** the project's `rate_limit_verify` is 30 per 5 minutes per IP. The server's
  `verifyOtp` call comes from the Fly machine, so every code sign-in on one machine shares that bucket. `generateLink` is an
  admin call and sends no email, so `rate_limit_email_sent` (2 per hour) is not touched. An attacker cannot spend the bucket
  without a valid code, because the verify only runs after `signin_code_try` succeeds. Upgrade path if sites ever exceed 30
  code sign-ins in 5 minutes: raise the limit in the auth config.
- **An old access token lives out its hour** after the revoke (ADR-0024 residual): sessions and refresh tokens die at once.
- **Setting the password is not its own ledger row**; the use of the code is (ADR-0008 is met by `signin_code_used`).
- **One auth user per email across sites:** the code is bound to the user id and the issuing organisation; the session's
  organisation after sign-in is chosen by the access-token hook as for any sign-in.
- **A sole admin** who loses their phone and every recovery code still needs Simon with the service role (ADR-0028): nobody
  else may issue them a code.

## How to comply
- `signin_codes` and `signin_code_try` are touched only from `src/actions/members.ts` and `src/actions/auth.ts`, through
  the service-role client (`tests/lint/signin-codes.spec.ts`).
- Any new way back into an account reuses this path; do not add an email or SMS reset.
