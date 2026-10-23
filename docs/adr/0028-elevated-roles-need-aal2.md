# ADR-0028: Elevated roles need aal2; recovery codes are ours

- **Status:** Accepted
- **Date:** 2026-10-24
- **Decided by:** Simon (Phase 66 plan approved 2026-10-24)
- **Refines:** ADR-0024 (RLS re-checks the membership row) and ADR-0025 (membership writes); ADR-0027 (a passkey sign-in is aal1)
- **Enforced by:** `tests/phase66/mfa.spec.ts`, `tests/lint/elevated-aal2.spec.ts`, `scripts/apply-phase66-migration.mjs` (live sweep and aal probe) · `tests/evals/mfa.eval.ts`

## Context
An admin or safety manager can publish, delete and rewrite SOPs, change people and their access, and change the
site. A stolen password was enough to do all of that. Supabase Auth has TOTP MFA (enrol, challenge, verify) and
signs the session's assurance level into the access token as the `aal` claim. Supabase has no recovery codes we
can switch on (supabase-js 2.118 has an experimental API, but the project's auth config offers no setting for it),
and the hosted project refuses WebAuthn as an MFA factor ("Enabling of MFA with WebAuthn not currently supported").

## Decision
1. **Who:** every member whose role is `admin` or `safety_manager`. Supervisors and workers may set up a second
   step but are never asked for it.
2. **Hard requirement, no grace period, worker side open.** Straight after signing in, an elevated person lands on
   `/verify` (set up, or enter a code). Admin screens and admin actions need an aal2 session; reading and running
   SOPs does not ("Not now" opens the home, and the account menu offers "Confirm it's you for admin work").
3. **One classifier in the app.** `src/lib/auth/elevated.ts` (`isElevatedRole`, `needsSecondStep`).
   `getSessionContext()` reports an elevated member whose token is not `aal2` as `role: 'worker'` (the real role
   is `memberRole`), so every existing role check in pages, actions and API routes fails closed without each one
   knowing about aal. `requireAdminContext()` returns `{ error: "Confirm it's you", needsAal2: true }`;
   `requireSopEditAccess()` refuses too, so an elevated approver cannot slip through the approver path at aal1.
   The proxy sends `/admin/*` to `/verify?next=…` and the SOP page sends `?mode=edit` there, both on the server.
4. **One classifier in the database.** `public.is_elevated()` = `current_user_role() in ('admin','safety_manager')
   and auth.jwt() ->> 'aal' = 'aal2'`. Migration 00087 moved every write policy arm that named an elevated role
   onto it (including the `om.role` EXISTS arms, which now also scope to the session organisation, and the
   sign-off approver arm, which keeps working at aal1 only for non-elevated approvers). Reads stay at aal1; each
   ALL policy kept a SELECT twin with its old predicate. **`aal` is the one claim policies may trust:** it is
   signed session state, not membership state (organisation and role are still re-checked from the row, ADR-0024).
5. **TOTP only.** A Phase 65 sign-in passkey is aal1 and is not a second factor; WebAuthn MFA is off until the
   hosted project allows it.
6. **Recovery codes are ours.** Ten codes `xxxx-xxxx` (31 letters, no look-alikes), shown once with Copy and
   Download, stored as HMAC-SHA256 with the server pepper `RECOVERY_PEPPER` (a Fly secret, also in the vault) in
   `mfa_recovery_codes` (RLS on, no policies, no grants: service role only). A code is used on `/verify` at aal1:
   marked used in one conditional update, the person's factors deleted through the admin API, the use logged; they
   then set up again, which issues a fresh set and retires the old one. At most 5 tries per 15 minutes, counted in
   `mfa_recovery_attempts` by `mfa_recovery_attempt()` on the try itself (ADR-0002, no job resets it).
7. **Every change is logged** (ADR-0008): `mfa_enrolled`, `mfa_removed`, `mfa_reset`, `recovery_codes_issued`,
   `recovery_code_used`. Factor rows follow a check against `auth.admin.mfa.listFactors` for the session user.
8. **The way back when everything is lost.** An elevated person cannot remove their last factor. Another admin
   (aal2) can **Reset sign-in steps** from the People sheet: never on yourself, only someone in your organisation;
   logged as `mfa_reset`, and every other active admin gets a `signin_reset` notification.

## Consequences
- **Lockout residual:** a sole admin who loses their phone and every recovery code has no admin to reset them. The
  fallback is Simon with the service role (delete the factors with `auth.admin.mfa.deleteFactor`), as for any
  account recovery. Phase 67 covers account recovery more broadly.
- Deleting a factor ends the sessions that were confirmed with it (Supabase); an aal1 session survives, which is
  what lets a recovery-code user set up again in the same session.
- Evals: the persistent elevated fixtures each keep one TOTP factor whose secret sits in `.env.local` and the vault
  (`scripts/eval-mfa-fixtures.mjs`); `tests/evals/lib/session.ts` mints aal2 for any elevated account.
- Platform-admin policies (`is_platform_admin()`, global blocks) are outside this ADR: platform admins are a
  Potenco concept, not an organisation role. Two tables named for admins (`video_generation_jobs`,
  `sop_pipeline_runs`) let any member write their own organisation's rows; that was so before and is unchanged.
