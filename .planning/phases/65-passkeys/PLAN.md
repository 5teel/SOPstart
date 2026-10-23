# Phase 65 — Passkeys

**Goal:** People sign in with a passkey (Face ID, fingerprint or the phone's screen lock) instead of typing a password. They add a passkey from Profile after a normal sign-in. The password stays as the fallback. Adding or removing a passkey writes a ledger row (ADR-0008).

**Depends on:** Phase 64 (live). **Plan written:** 2026-10-24, without GSD.

## Facts this plan rests on
- Today sign-in is **email + password** (`loginWithEmail`, `src/actions/auth.ts:95`, `signInWithPassword`). There is no emailed-code login and no "forgot password" flow (Phase 67 covers getting back in).
- Supabase Auth has **experimental passkey sign-in** ([docs](https://supabase.com/docs/guides/auth/passkeys)).
  - Methods: `auth.registerPasskey()`, `auth.signInWithPasskey()` (discoverable credentials, so no email needed first), and `auth.passkey.list / update / delete`.
  - Admin methods: `auth.admin.passkey.listPasskeys({ userId })` and `deletePasskey`.
  - Errors: `passkey_disabled`, `too_many_passkeys`, `webauthn_*`.
  - It needs **supabase-js ≥ 2.105.0** (installed: 2.100.0) and opt-in on the client: `auth: { experimental: { passkey: true } }`.
  - Project config: `[auth.passkey] enabled`, `[auth.webauthn] rp_id / rp_display_name / rp_origins`, or the Management API `PATCH /v1/projects/{ref}/config/auth` (`passkey_enabled`, `webauthn_rp_*`).
- "Experimental, API may change" is acceptable because the password stays: if Supabase changes or pulls passkeys, sign-in still works.

## Decisions
- **D-01:** Supabase's built-in passkeys, not SimpleWebAuthn with sessions minted by us. That keeps one session system, nothing custom to secure, and cookies through `@supabase/ssr`. Revisit only if step 1 shows it can't run on our SSR cookie client.
- **D-02:** RP ID `sopstart.com`. Origins: `https://sopstart.com`, plus `https://www.sopstart.com` if it serves, plus `http://localhost:4200` for dev.
  - Changing the RP ID later kills every passkey, so it is recorded in the ADR.
- **D-03:** A passkey sign-in is an ordinary aal1 session, the same as a password. It does **not** satisfy the admin second factor; Phase 66 decides that separately.
- **D-04:** The passkey ceremony runs in the browser, because it has to (WebAuthn is a browser API). The ledger row is written by a server action called afterwards, `recordPasskeyChange(kind)`.
  - The action checks the claim against `auth.admin.passkey.listPasskeys({ userId })` for the session user, so nobody can fake a row.
  - Org and actor come from the session.
- **D-05:** Where it shows up:
  - Profile gets a "Passkeys" section: add, rename, remove, and a list with friendly name and date.
  - Login gets a "Sign in with a passkey" button above the password form.
  - No nag banners (attention ranking: quiet).
- **D-06:** A suspended or departed person can't use a passkey to get back in, because the Phase 64 RLS denies them on the first request. The paused page shows as it does after a password sign-in. Removing a person does not need to delete their passkeys.

## Steps
1. **Spike and upgrade.**
   - Bump `@supabase/supabase-js` to ≥ 2.105 and check `@supabase/ssr` 0.6.1 still type-checks; bump it if needed.
   - Add the `experimental.passkey` option to the browser client (`src/lib/supabase/client.ts`) only. Server clients don't need it.
   - Run `npx tsc --noEmit`, `npm run build`, and the bundle gate. Record the `/page` number, because the larger client may move it; diff the chunk list before deciding.
2. **Project config.**
   - Turn on passkeys and set the RP fields through the Management API with `SUPABASE_ACCESS_TOKEN`. If no token is wired, Simon flips it in the dashboard; the plan stops there and asks.
   - Mirror the settings in `supabase/config.toml`.
   - Prove it with a call to `auth.passkey.list()` on a signed-in session that does not return `passkey_disabled`.
3. **Migration 00085.**
   - Add two ledger kinds, `passkey_added` and `passkey_removed`, to the decisions kind check.
   - Update the kind registries (`src/lib/decisions/shape.ts`, `read.ts`) and the kind specs pinned to the count, as 64-01 did.
   - Apply with `supabase db push` after `migration list`.
4. **Server action `recordPasskeyChange`** in `src/actions/passkeys.ts`.
   - Zod input `{ kind, passkeyId, friendlyName? }`, session user only.
   - For an added passkey, verify the id is now present via the admin list; for a removed one, verify it is now absent. Then call `recordDecision()`.
   - Register it in `scripts/decision-writers.json`.
5. **Profile UI**, `src/components/profile/PasskeysSection.tsx`.
   - List, add, rename and remove, with glove-size targets and tokens only.
   - Plain words: "Passkey", "Add a passkey", "Use your phone's face or fingerprint unlock to sign in". Errors map to plain sentences.
6. **Login UI.**
   - Add a "Sign in with a passkey" button on `src/app/(auth)/login`.
   - On success it routes the way `loginWithEmail` does: role home, or a validated `?next=`. Do this with a server redirect in a route or action, not a client effect (CLAUDE.md Learning).
   - On a browser with no WebAuthn, hide the button.
7. **Same-commit duties:**
   - ADR-0027 "Passkeys through Supabase Auth; RP ID sopstart.com; aal1".
   - `journeys.ts`: the login passkey path and the Profile passkeys step.
   - `CAPABILITY-MATRIX.md` row: anyone signed in manages their own passkeys.
   - `uat/tests.ts`.
8. **Specs**, in `tests/phase65/`:
   - source contract: experimental flag only on the browser client, and the action verifies through the admin list and records the decision.
   - kinds spec.
   - lint: no passkey call in a server file except through the admin API.
9. **Deployed eval**, `tests/evals/passkeys.eval.ts`. It uses a Chromium CDP virtual authenticator (`WebAuthn.enable` + `addVirtualAuthenticator`, internal transport, resident key, user verification) and checks:
   - eval-worker adds a passkey on Profile, signs out, and signs in with the passkey to land on the home;
   - the ledger shows "Added a passkey";
   - they remove it, and a passkey sign-in then fails with a plain message;
   - phone 390 and desktop 1440 screenshots, all read.
10. **Gates and push.** Run `tsc`, `build` (exit code), the phase65 and lint specs once, push, wait for the "Deploy to Fly" run, run the eval, read the shots, and add a learning if one was earned.

## Risks
- The experimental API changes under us. Pin the exact supabase-js version, not a caret, while it is experimental.
- SSR cookies: `signInWithPasskey` returns a session in the browser client. Confirm `@supabase/ssr` writes the cookies so server components see it on the next request; step 1 proves this before any UI.
- iOS Safari needs user activation for the ceremony; tie it to a button click.
