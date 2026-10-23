# ADR-0024: Membership states replace removal

- **Status:** Accepted (the "deny all org data access" claim is narrowed by ADR-0025)
- **Date:** 2026-10-21
- **Decided by:** Simon (security discussion 2026-10-21; Claude's calls D-01..D-20 in `.planning/phases/64-leavers-and-suspended-members/64-CONTEXT.md`, overturnable at review)
- **Supersedes:** — (it refines ADR-0018's token gate; the approval gate itself is unchanged)
- **Enforced by:** `supabase/migrations/00082_member_status.sql`, `tests/phase64/member-status-migration.spec.ts`, `tests/lint/member-status.spec.ts`, `tests/evals/people.eval.ts`

## Context
- "Remove from the site" hard-deleted the membership row. The person's history lost its anchor, nothing stopped their open sessions, and nothing told the admin what they had owned.
- RLS read the organisation and role from the claims inside the access token (`current_organisation_id()`, `current_user_role()`). The token carries them for up to an hour (`jwt_exp` 3600 s), so a change to the membership table did not reach PostgREST or Storage until the token expired.
- Revoking a session does not shorten that: Supabase keeps accepting the access token of a revoked session until its `exp`. Only the database can cut access on the next request.

## Decision
1. **Three states on the membership row:** `active`, `suspended` (temporary), `left`. `organisation_members.status` (text + CHECK, default `active`) with `status_changed_at` and `status_changed_by`. Both `suspended` and `left` deny all org data access.
2. **The row decides, the token only selects.** `current_organisation_id()` and `current_user_role()` look up the caller's membership row for the organisation named in the token and require `status = 'active'`; the role is read from the row. The roughly 125 policies built on the helpers are covered without an edit. The access-token hook skips non-active rows, so a fresh sign-in lands on another active site or on `/pending`.
3. **No policy reads the token claims directly.** Ten policies did (escalation reports, voice notes, UAT feedback, two voice-bucket storage policies and a dead generated-videos one); they are rewritten onto the helpers and the dead one is dropped. The own-row arm of `sop_observations_read_org` is ANDed with the organisation predicate. `sop_observation_refs_in_org` needs an active worker.
4. **Status is service-role-only.** A signed-in user may update only the `role` column of `organisation_members`; state changes go through a server action using the service role.
5. **Suspend and Has left sign the person out of every session** with `public.revoke_user_sessions(uuid)` (deletes that user's `auth.sessions` rows; refresh tokens cascade; `service_role` only). The auth user is not banned.
6. **Hard delete is removed.** A membership row is never deleted from `src/`. Records stay attributed to the person (completions, sign-offs, observations, training, ledger rows). Reinstating works from either state, on the same row.
7. **The ledger records every state change** (`member_suspended`, `member_left`, `member_reinstated`, ADR-0008). `member_removed` stays in the kind list for old rows.
8. **`sop-videos` reads are scoped to the organisation folder.** The live check found 7 objects, all under an organisation folder (0 outside), so the bucket-wide SELECT is replaced by one pinned to `current_organisation_id()` (INSERT and UPDATE already were).

## Consequences
- **A role change applies on the next request**, not at token expiry (the role now comes from the row).
- **Signing someone out signs them out of every site they belong to.** The next sign-in lands on their latest active site. This is accepted: banning the account would lock them out of all sites, and the auth API has no per-site session revoke.
- **Signed links already issued live out their lifetime.** Download links up to 3600 s; signed upload links about 2 hours (assumption A1, not verified). Accepted residual.
- **Reinstating within the hour revives an old access token** until it expires. Accepted: it is the same person with the same rights again.
- **`walkthrough_progress` and `uat_feedback` own-row arms stay.** They hold no tenant data about the site.
- **The generated-videos policy is dropped.** It read `app_metadata`, matched nothing, and video generation left the product in Phase 55.
- **Per-policy cost:** each policy evaluation does an indexed lookup on `organisation_members` instead of reading JSON. Measured as the eval-site admin on the live project (`.planning/phases/64-leavers-and-suspended-members/64-BASELINE.md`): `count(*)` over `sops` 0.095 ms before and about 0.25 ms after; the 50 newest decisions 11.0 ms before and about 27 ms after (about 2.4x, far under 50 ms). Upgrade path if it ever matters: wrap helper calls in policies as `(select current_organisation_id())` so Postgres caches them per statement.
- **Applied before the app code.** The migration is backwards compatible with the deployed app (default `active`, same helper values for active members, `role` still updatable), so it ships first and later plans assume it.

## How to comply
- Never read the organisation or the role from the token in new code or new policies; call the helpers.
- Every read of `organisation_members` is active-only, or on the allowlist in `tests/lint/member-status.spec.ts` with a reason (People list and label maps need every state).
- Never delete a membership row in `src/`. Change the state with `changeMemberState()` and log it.
- A policy that narrows by `auth.uid()` ANDs the organisation helper in.
- A new `SECURITY DEFINER` function that takes a user or organisation id is `service_role` only.
