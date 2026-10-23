# ADR-0025: Membership rows are written by the service role only; the last admin is kept by the database; two accepted residuals

- **Status:** Accepted
- **Date:** 2026-10-24
- **Decided by:** Claude, fixing the Phase 64 code review (2026-10-24); overturnable by Simon at review
- **Supersedes:** — (refines ADR-0024: it narrows ADR-0024's "deny all org data access" claim, see Consequences; ADR-0024 stays accepted)
- **Enforced by:** `supabase/migrations/00083_member_hardening.sql`, `scripts/apply-phase64b-migration.mjs` (live assertions), `tests/phase64/member-hardening.spec.ts`, `tests/lint/rls-org-scope.spec.ts`

## Context
- The Phase 64 review (`.planning/phases/64-leavers-and-suspended-members/64-REVIEW.md`) found that ADR-0024 locked UPDATE on `organisation_members` but left the 00002 INSERT policy live, so a safety manager could insert an admin row over REST (HI-01).
- The last-admin rule was a count followed by a separate update, so two admins could suspend each other at once (ME-01).
- `reassignApprovalStep` let one person take and approve a step in a chain meant for two (ME-02).
- Two junction tables answered an admin of one site with every site's rows (ME-03), and the observation reference check took any organisation id (LO-04).
- Two smaller gaps (LO-05, LO-06) are cheaper to accept than to close. They are recorded here because ADR-0024 says more than is true.

## Decision
1. **Membership rows are inserted and deleted only by the service role.** `admins_can_insert_members` is dropped. INSERT and DELETE on `organisation_members` are revoked from `anon` and `authenticated`. A session keeps SELECT, plus UPDATE of `role` under the 00062 admin policy.
2. **An invite lives in `app_metadata`.** `inviteWorker()` writes `invite_org_id` and `invite_role` with the service role. `acceptInvite()` reads only those, validates the role, reads the row's status first (a suspended or departed person goes to `/pending`) and inserts with the service role. `user_metadata` is user-writable, so it is never the source of an organisation or a role.
3. **The database keeps one active admin per organisation.** The `keep_one_active_admin` BEFORE UPDATE trigger locks the organisation row (`for no key update`) and recounts before any change that suspends, marks as left or demotes an active admin. The app's own count stays as the friendly message, and the trigger's refusal is worded the same way. The state change also filters on the role the caller saw.
4. **A reassigned approval step never goes to the caller, to anyone who already approved this version, or to anyone named on another step.** The write is a compare-and-swap on version and snapshot, and the new holder is notified.
5. **A policy arm that only checks the caller's role must also tie the row to an organisation.** `member_departments_self_read` and `users_sub_trades_self_read` put the organisation predicate outside the own-row / role OR.
6. **`sop_observation_refs_in_org(sop_id, worker_id)` is an exception to ADR-0024 "How to comply" #5.** It takes a user id and stays executable by `authenticated`, because the insert policy calls it as the inserting user. It answers only for the caller's own organisation (`current_organisation_id()`), which the caller can already read.

## Consequences
- **A fresh invitee can accept again.** Their token has no organisation yet, so the old session-client insert was refused by RLS. Invitees from before 00083 who have never signed in had their invite copied into `app_metadata` by the migration. An invite sent by the old code between the apply and the deploy needs a re-send.
- **Recovering an organisation with no active admin needs SQL.** The trigger also refuses the service role, so `scripts/` and org-merge work that takes the last admin away must add another admin first. Deleting members (org deletion) is not affected.
- **Accepted residual (LO-05): any active member can read who is suspended or has left over REST** (`organisation_members.status`, `status_changed_by`). The app shows states to admins and safety managers only. A column grant that hides `status` would break every session-client status filter (`session-context.ts`, `members.ts`, `auth.ts`, `load-inbox.ts`, `people.ts`). Upgrade path: move those reads to the service role, scoped to the session organisation, then revoke SELECT on the state columns.
- **Accepted residual (LO-06): the uuid-pair junctions stay `using (true)`.** These are `sop_departments`, `sop_collections`, `role_members`, `sops_sub_trades` and `block_departments`. They hold uuids only, no names, and `using (true)` avoids the RLS recursion trap noted in 00035 / 00046. So ADR-0024's "suspended and left deny all org data access" means all organisation-scoped data. Those uuid pairs stay readable to any signed-in token, including a suspended or departed person's token until it expires. Upgrade path: scope a junction through a SECURITY DEFINER helper the way 00048 scoped `sop_access_people`.

## How to comply
- Never write a membership row with a session client. Use the service role, with the organisation taken from the session or from a server-written invite.
- Never read an organisation, a role or any authority from `user_metadata`.
- A policy arm of the form "the caller is an admin" also ties the row to `current_organisation_id()` (`tests/lint/rls-org-scope.spec.ts` checks this).
- A script that demotes or suspends admins expects `last active admin` (P0001) when it would leave none.
