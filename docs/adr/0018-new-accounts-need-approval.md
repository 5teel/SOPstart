# ADR-0018: Every new account waits for a SOPstart admin's approval

- **Status:** Accepted
- **Date:** 2026-10-16
- **Decided by:** Simon ("all new users need to be approved by me")
- **Enforced by:** `supabase/migrations/00081_user_approval.sql` (table, trigger, access-token hook), `src/actions/user-approval.ts`

## Context
SOPstart is invitation-only (public sign-up is off), but any site admin can invite anyone. Simon wants to see and approve every new person before they reach a site.

## Decision
1. **Per account, not per site.** `user_approvals` holds one row per auth user: `pending`, `approved` or `declined`.
2. **The gate is the access token.** Until the row says `approved`, `custom_access_token_hook` leaves `organisation_id` empty and `user_role` `pending` (plus an `approval` claim). Every RLS policy keyed on `current_organisation_id()` then refuses the account, and the app sends it to `/pending` ("Waiting for approval"). No page-level check is needed for safety.
3. **Who waits.** A deferred trigger on `auth.users` writes the row at commit: an account created already confirmed and not invited (our own service-role scripts and tests) is approved; an invited or self-registered account waits. Everyone who existed on 2026-10-16 was approved.
4. **Who decides.** Platform admins (`platform_admins`, Potenco) on `/admin/approvals` (linked from Settings). `decideNewUser` re-checks `is_platform_admin()` on the caller's session, writes with the service role and logs `approve`/`reject` (subject `user`) to the ledger in the decider's site.
5. An approved person gets in on their next token: "Check again" on `/pending` refreshes it.

## Consequences
- A newly invited person cannot open anything until approved, even after accepting the invite.
- Turning someone down leaves their account and memberships in place but closed; approving later opens them.
- If public sign-up is ever switched on, those accounts wait too (they are not confirmed at creation).

## How to comply
- Never read org data for a session without the token's organisation claim; never add a service-role path that trusts a membership row alone.
- Test and script accounts that must work immediately are created with `email_confirm: true` and no invite.
