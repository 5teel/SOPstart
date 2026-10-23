# ADR-0027: Passkeys through Supabase Auth; RP ID sopstart.com; aal1

- **Status:** Accepted
- **Date:** 2026-10-24
- **Decided by:** Simon (plan approved 2026-10-24; the supabase-js pin delegated to the orchestrator)
- **Supersedes:** none
- **Enforced by:** `tests/phase65/passkeys.spec.ts`, `tests/lint/passkeys.spec.ts` · `tests/evals/passkeys.eval.ts`

## Context
People sign in with an email and a password. Typing a password on a phone with gloves on is slow, so people
should be able to use the phone's face, fingerprint or screen lock. Supabase Auth has its own passkey sign-in
(experimental). The other option was SimpleWebAuthn with sessions minted by us.

## Decision
1. **Supabase's built-in passkeys.** That keeps one session system and nothing custom to secure, and the browser
   client writes the session cookies through `@supabase/ssr`. `@supabase/supabase-js` is pinned **exactly**
   (2.118.0, no caret) while the API is experimental. The `experimental.passkey` client flag is not used: 2.118
   ignores it.
2. **RP ID `sopstart.com`, origin `https://sopstart.com`, display name "SOPstart".** Set through the Management
   API (only the passkey and webauthn fields) and mirrored in `supabase/config.toml`. **Changing the RP ID later
   kills every passkey.** Supabase rejects an origin outside the RP ID, so `http://localhost:4200` cannot be an
   origin and passkeys do not work in local dev. `www.sopstart.com` only redirects, so it is not an origin.
3. **A passkey sign-in is an aal1 session, the same as a password.** It does not count as the admin second
   factor; Phase 66 decides that.
4. **The ceremony runs in the browser, the ledger row on the server.** `recordPasskeyChange()` checks the claim
   against `auth.admin.passkey.listPasskeys` for the session user before logging `passkey_added`. A removal runs
   on the server through the admin API (only for an id in the session user's own list) and is logged as
   `passkey_removed`. Org and actor come from the session (ADR-0008). Renaming is cosmetic and is not logged.
5. **No passkey call in server code except the admin API.** Server files never call `registerPasskey`,
   `signInWithPasskey` or `auth.passkey.*`.
6. **After a passkey sign-in the page reloads `/login`.** The proxy sends a signed-in visitor to the validated
   `?next=` or their role home, the same rule as a password sign-in. No client router redirect.
7. **The password stays.** No nag banners. Profile has a Passkeys section; the login screen has "Sign in with a
   passkey" above the password form, hidden where the browser has no WebAuthn.

## Consequences
- If Supabase changes or pulls passkeys, people still sign in with their password.
- A suspended or departed person can still complete a passkey ceremony, but the 00082 active-membership helpers
  hold them at `/pending`, as after a password sign-in. Their passkeys are not deleted.
- The client bundle grew by about 35 KB with supabase-js 2.118 (ROADMAP bundle decisions, 2026-10-24).
- Passkeys can only be tested on sopstart.com (deployed evals use a Chromium virtual authenticator).
