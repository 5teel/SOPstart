# Phase 64: Leavers and Suspended Members - Research

**Researched:** 2026-10-21
**Domain:** Supabase RLS / auth session revocation / membership lifecycle in a Next.js 16 server-action app
**Confidence:** HIGH (all RLS and code paths read from the live DB and the repo; the revoke mechanism and token behaviour are doc-backed; two items flagged [ASSUMED])

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**States**
- D-01: Three states on the membership row: `active`, `suspended` (temporary, e.g. long leave or an investigation), `left` (no longer works here). Store as a column on `organisation_members` with `status_changed_at`, `status_changed_by`. Default `active`; existing rows backfill `active`.
- D-02: Both `suspended` and `left` deny all org data access. The difference: `left` also triggers the owner handover list and moves the person out of the default People list into a collapsed "Former staff" group. `suspended` stays in the main list with a plain-word tag ("Suspended").
- D-03: Reinstate works from either state back to `active`, same row, same history. Re-inviting a `left` person's email reactivates their existing row instead of creating a second membership.
- D-04: Hard delete of a membership is removed from the product. The server path that only the Remove button used is deleted too (CLAUDE.md: deleting a feature's UI means dropping the server params only it supplied).

**Who can do it**
- D-05: Same authority as today's `removeMember`: admin and safety_manager; only an admin can change an admin's state; nobody changes their own state; the last active admin cannot be suspended or marked left (count active admins, not all admin rows).

**Cutting access**
- D-06: Access must stop on the next request. Every RLS path that resolves "is this user a member of this org / what is their role" must require `status = 'active'`. Research must establish how membership is resolved today (helper SQL functions, JWT custom claims, `getSessionContext`, `org-model/resolve-access`) and cover every one; if any path reads org/role from JWT claims, it must also be closed.
- D-07: Also revoke the person's sessions (refresh tokens) so open tabs fail on their next refresh. Users can belong to several orgs (site switcher, demo orgs), so do not ban the auth user; revoke sessions only. Research picks the mechanism (Supabase admin API vs a service-role-only SQL function over `auth.sessions` / `auth.refresh_tokens`).
- D-08: A suspended / left user who signs in sees a plain page: "Your access to {org} has been paused. Talk to your supervisor." Reuse `/pending` if it fits.

**Records kept**
- D-09: Nothing attributed to the person is deleted or reassigned automatically. Names still show on completions, sign-offs and ledger rows, with "(left)" or "(suspended)" where a name is shown in governance views.

**Owner handover**
- D-10: When a person is marked `left` (and also on `suspended`, since work can't wait), everything waiting on them appears in a "Needs a new owner" list in the Office for admin / safety_manager: SOPs they own (`sops.owner_user_id`), and any pending sign-offs, approvals, requests or review-due items assigned to them. Research must enumerate every "assigned to a user" column.
- D-11: Reassignment uses the existing `OwnerPicker` / governance actions; each reassignment logs a ledger row. No automatic reassignment.

**Ledger**
- D-12: New decision kinds: member suspended, member left, member reinstated; owner reassignment reuses the existing kind if one exists.

**Same-commit duties (CLAUDE.md)**
- D-13: New ADR "Membership states replace removal" (next number after 0023).
- D-14: `.planning/codebase/CAPABILITY-MATRIX.md` rows for suspend / has left / reinstate / reassign.
- D-15: `src/lib/journeys/journeys.ts` and `src/lib/uat/tests.ts` updated; `/pathways` stays at 0 not-mapped.
- D-16: Deployed eval (`tests/evals/people.eval.ts` or extend `office.eval.ts`) against sopstart.com: suspend a fixture member -> that member's session gets no SOP data and sees the paused page -> reinstate -> access returns; owner handover list shows a SOP owned by a left fixture. Fixtures key on their own markers; no "exactly N" assertions.

### Claude's Discretion
Column name / enum vs check constraint, migration number, exact UI copy (plain words, no "block"/"walk"/"rooms"), placement of the handover list inside the Office, guard tests in `tests/lint/` if checkable (e.g. no `.delete()` on `organisation_members`).

### Deferred Ideas (OUT OF SCOPE)
- Passkeys + devices list with revoke; admin aal2; recovery codes; supervisor recovery codes; SMS invites; SSO/SCIM (later phases of the security plan).
- Notifying the suspended person by email.
</user_constraints>

<phase_requirements>
## Phase Requirements

No requirement IDs exist yet (`MEMB` prefix is unused in `.planning/REQUIREMENTS.md`). Proposed for the planner to add:

| ID | Description | Research Support |
|----|-------------|------------------|
| MEMB-01 | `organisation_members.status` (`active`/`suspended`/`left`), `status_changed_at`, `status_changed_by`; backfill active; check constraint (D-01, D-02) | Migration 00082 sketch; text + CHECK matches `user_approvals.status` and `decisions.kind` precedent |
| MEMB-02 | Data access stops on the very next request: redefine the two RLS helpers, the access-token hook, the raw-JWT-claim policies and the `sop_observations_read_org` own-arm (D-06) | Q1 inventory; helper logic proved on a session-private temp table (suspended -> NULL/NULL) |
| MEMB-03 | Suspend / Has left revokes the person's sessions without banning the user (D-07) | `revoke_user_sessions(uuid)`, service_role only; no admin-API equivalent exists |
| MEMB-04 | `suspendMember` / `markMemberLeft` / `reinstateMember` with D-05 authority rules and active-admin counting | Q4: `removeMember` is the template; `updateMemberRoleSafe` last-admin count must also count active only |
| MEMB-05 | People UI: Suspend, Has left, Reinstate; "Suspended" tag; collapsed "Former staff"; "(left)" / "(suspended)" in governance views (D-02, D-09) | PeopleTab seams at lines 111-182, 519-538, 974-987 |
| MEMB-06 | Hard delete removed: `removeMember`, `deleteOrgMember`, `src/lib/members/remove.ts` and the Remove button deleted; guard forbids `.delete()` on `organisation_members` in `src/` (D-04) | Q4 caller and test list |
| MEMB-07 | Paused page for a non-active member (D-08) | Q7: extend `/pending`; read memberships with the admin client scoped to the session user id |
| MEMB-08 | Invite, join-by-code, accept-invite and site-switch honour state; re-inviting a `left` person reactivates the row (D-03) | Q6 |
| MEMB-09 | "Needs a new owner" list in the Office + reassign with `OwnerPicker`/`setSopOwner`; owner and approver pickers offer active members only (D-10, D-11) | Q3 column list; existing `unowned` flag and Inbox "No owner" row |
| MEMB-10 | Ledger kinds `member_suspended`, `member_left`, `member_reinstated`; every state change and reassignment logs (D-12, ADR-0008) | Q5 registration points |
| MEMB-11 | App-layer populations count active members only (notifications, role recipients, asks, training lanes, people counts, last-admin counts) | Q1 table "app readers" |
| MEMB-12 | Same-commit duties: ADR-0024, CAPABILITY-MATRIX, journeys, uat tests (D-13..D-15) | Q9 shapes |
| MEMB-13 | Deployed eval proves the cut-off, paused page, reinstate, handover and re-invite (D-16) | Q8 |
</phase_requirements>

## Summary

**RLS is claim-based, and that is the central finding.** 125 of the 158 live policies (public + storage) gate on two SQL helpers, `current_organisation_id()` and `current_user_role()`, which read `auth.jwt()` claims (`supabase/migrations/00001_foundation_schema.sql:46-65`, still the live definitions). The claims are minted by `custom_access_token_hook` (latest body `00081_user_approval.sql:62-110`) when a token is issued. `jwt_exp` is 3600 s on the live project [VERIFIED: Management API config read]. So merely adding `status = 'active'` to the hook would leave a suspended person fully able to read and write org data through PostgREST for up to an hour. Revoking sessions does not help either: Supabase documents that access tokens of revoked sessions stay valid until `exp` [CITED: supabase.com/docs/guides/auth/signout]. The only way to meet D-06 ("next request") is to make the two helpers verify the membership row in the database on every call. The proposed body was tested on a session-private temp table against live data and returned org+role for an active admin and NULL/NULL once the row was `suspended` or the claim was the `pending` claim.

**The cut needs five SQL changes plus an app-layer sweep.** (1) Redefine the two helpers (closes about 125 policies including storage). (2) Add `status = 'active'` to both queries in the hook. (3) Rewrite the 10 policies that read raw `auth.jwt()` claims (escalation_reports x3, sop_voice_notes x2, uat_feedback x2, three storage policies); the tables are dead in `src/` but still reachable over PostgREST. (4) Narrow the own-arm of `sop_observations_read_org` (`observed_worker_id = auth.uid()` has no org predicate and would survive the helper fix). (5) Lock `organisation_members` UPDATE to the `role` column for `authenticated` so `status` is service-role-only (today any admin can PATCH any column over REST). In the app, about 30 call sites read `organisation_members` directly (service role or session); each needs a `status` decision (identity checks and pickers need active only, the People list and label maps need everything). The reliable control is a lint guard that forces every `from('organisation_members')` into an allowlist or a status filter.

**Session revocation has no admin-API route.** `auth.admin.signOut(jwt, scope)` takes the target's own JWT (`node_modules/@supabase/auth-js/src/GoTrueAdminApi.ts:110`; installed auth-js 2.100.0), so one user's sessions cannot be killed by user id; `updateUserById({ban_duration})` bans the whole account and is excluded by D-07. Use a `SECURITY DEFINER` function `public.revoke_user_sessions(p_user_id uuid)` that deletes from `auth.sessions` (cascades to `auth.refresh_tokens` and `auth.mfa_amr_claims`); `postgres` has DELETE on both, `service_role` does not [VERIFIED: has_table_privilege on live DB]. Grant EXECUTE to `service_role` only (same shape as `complete_walk`, `00080:44-45`). The handover list is mostly an extension of what already exists: the governance queue already flags a SOP whose owner is not a current member as `unowned` (`src/lib/governance/classify.ts:33`, built from a member set at `governance.ts:395-401`), so making that member set active-only turns left owners into the existing "No owner" Inbox rows with `OwnerPicker`. The genuinely new handover items are chain approvers, in-flight approvals, department owners, open `do_sop` asks and supervisor links.

**Primary recommendation:** One migration `00082_member_status.sql` (column, hook, two helpers, ten raw-claim policies, one own-arm fix, column-level UPDATE lock, `revoke_user_sessions`, ledger kinds); one plain module `src/lib/members/state.ts` that does update -> revoke -> (caller logs); three thin server actions; the Remove path deleted; `getSessionContext`, `/pending`, the invite/join/switch paths and the ~30 membership readers swept under a lint guard; deployed eval `people.eval.ts` with its own disposable members.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| "Is this caller an active member, in which org, with which role" for data access | Database (RLS helpers) | API/Backend (`getSessionContext`) | Token claims are stale for up to 1 h; only the DB can answer per request. PostgREST and Storage evaluate RLS without touching app code |
| Token org/role claim at sign-in | Database (access-token hook) | — | Selects which org a new token is for; must skip non-active rows so a fresh login lands on another org or `/pending` |
| Session revocation | Database (SECURITY DEFINER over `auth.sessions`) | API/Backend (service-role RPC call) | No admin-API route by user id; deletion is what `/logout` does |
| State change authority (self, last admin, admin-only-for-admin) | API/Backend (server action) | Database (column privilege) | Rules are app logic; column-level UPDATE revoke stops an admin bypassing them over REST |
| Ledger row | API/Backend (`recordDecision`) | Database (kind CHECK) | ADR-0008; org and actor come from the session |
| Paused page | Frontend Server (SSR `/pending`) | API/Backend (admin read scoped by session user id) | Suspended user cannot read own membership row under RLS, so a server read is needed |
| People UI (tags, Former staff, buttons) | Browser/Client (PeopleTab) | API/Backend (`getTeamMembersWithEmails` returns status) | Presentation only; the server decides allowed transitions |
| Needs-a-new-owner list | API/Backend (server read in `load-inbox`) | Browser/Client (Inbox row + `OwnerPicker`) | Reads span `sops`, `departments`, `approval_chains`, `requests`, `supervisor_assignments`; admin-only |

## Standard Stack

### Core
No new packages. Everything below is already installed. [VERIFIED: package.json, node_modules]

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | 2.100.0 (range ^2.99.3) | service-role client for the state write and the `rpc('revoke_user_sessions')` call | existing `createAdminClient()` (`src/lib/supabase/admin.ts`) |
| `@supabase/ssr` | ^0.6.1 | cookie session; `getClaims()` verifies the JWT locally (middleware + `getSessionContext`) | unchanged |
| Postgres 15+ / Supabase Auth (GoTrue) | live; latest auth migration `20260831180000` | `auth.sessions` / `auth.refresh_tokens` FK cascade | [VERIFIED: live query] |
| Zod | existing | `z.string().uuid()` on member ids, as `removeMember` does (`auth.ts:468`) | convention |
| Playwright | existing | source-contract specs, live probes, deployed evals | convention (CLAUDE.md) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Helper does a DB lookup | Short `jwt_exp` (5 min) | Bounds exposure but never meets "next request"; rejected |
| Helper does a DB lookup | RLS check that the token's `session_id` still exists in `auth.sessions` | Doc-endorsed ([CITED: supabase.com/docs/guides/auth/sessions]) and would also kill a revoked session instantly, but it is per-user not per-org, so it cannot express "suspended in A, still active in B"; revoke still needed. Not adopted |
| `revoke_user_sessions` SQL function | `auth.admin.updateUserById(id, { ban_duration })` | Bans the account in every org; excluded by D-07 |
| `revoke_user_sessions` SQL function | `auth.admin.signOut(jwt)` | Needs the target's own JWT; unavailable |
| text + CHECK status | Postgres enum | Enum needs `ALTER TYPE` for any later state; `user_approvals.status` and `decisions.kind` already use text + CHECK |

**Installation:** none.

**Version verification:** `node_modules/@supabase/auth-js/package.json` = 2.100.0, `supabase-js` = 2.100.0 [VERIFIED: file read]. `GoTrueAdminApi` exposes `signOut(jwt, scope)`, `deleteUser`, `updateUserById`, `listUsers`, `generateLink`, `inviteUserByEmail`, `createUser`, `getUserById`, factor/OAuth admin methods; no revoke-by-user-id method (`GoTrueAdminApi.ts:110-353`).

## Package Legitimacy Audit

No external packages are installed or recommended in this phase, so slopcheck does not apply. Packages removed due to slopcheck [SLOP]: none. Packages flagged [SUS]: none.

## Architecture Patterns

### System Architecture Diagram

```
Admin / safety manager (People sheet)
   | click Suspend | Has left | Reinstate
   v
server action  suspendMember / markMemberLeft / reinstateMember     (src/actions/members.ts, 'use server')
   | getSessionContext -> role, organisationId (session only)
   | authority: role in {admin,safety_manager}; target admin => caller admin;
   |            target.user_id != caller; leaving admin => count ACTIVE admins > 1
   v
changeMemberState()  plain module  src/lib/members/state.ts          (service role, org from session)
   | 1. UPDATE organisation_members SET status, status_changed_at/by
   |      WHERE id = :member AND organisation_id = :session_org AND status = :from  .select('id')   (empty => fail)
   | 2. if to suspended|left:  rpc('revoke_user_sessions', {p_user_id})   -> DELETE auth.sessions (cascade refresh tokens)
   |      failure is reported ("access stopped; sign-out lands on their next refresh"), never rolled back
   v
recordDecision({ kind: member_suspended | member_left | member_reinstated, subject: member })   (ADR-0008)
   v
receipt in Office  +  invalidate PEOPLE_KEY / inbox

Next request from the suspended person's EXISTING tab (token still valid <= 1 h):
   browser -> Next.js middleware (getClaims, local verify: passes) -> page / server action
        getSessionContext -> organisation_members read under RLS
            RLS helper current_organisation_id():  jwt org claim AND membership row status='active'  -> NULL
            => zero rows => role null, organisationId null  => "/" redirects to /pending (paused copy)
   browser -> PostgREST / Storage (direct, same token)
            every policy that uses the helpers evaluates to false => 0 rows / 42501
   token expires or tab refreshes -> refresh token's session row is gone -> getClaims fails -> cookies cleared -> /login
   fresh sign-in -> custom_access_token_hook skips non-active rows -> another org, or claim org null + role 'pending' -> /pending

Needs a new owner (Office, admin/safety_manager):
   load-inbox: governance rows (owner not in ACTIVE set => existing 'unowned' flag => Inbox "No owner" row => OwnerPicker/setSopOwner)
             + handover rows: department owner, chain steps naming the person, pending approval_snapshot steps,
               open do_sop asks, workers whose only supervisor left
```

### Recommended Project Structure
```
supabase/migrations/00082_member_status.sql      # column, hook, helpers, policy rewrites, UPDATE lock, revoke fn, kinds
scripts/apply-phase64-migration.mjs              # copy-adapt apply-phase60-migration.mjs (db push, Management API fallback, assertions)
src/types/auth.ts                                # + MemberStatus = 'active' | 'suspended' | 'left'
src/lib/members/state.ts                         # changeMemberState() - plain module, service role (replaces remove.ts)
src/lib/members/active.ts                        # activeMemberIds()/memberStatusMap() - the one place readers ask "who is active"
src/actions/members.ts                           # suspendMember, markMemberLeft, reinstateMember (async exports only)
src/lib/auth/paused.ts                           # pausedMemberships(userId) for /pending (admin client, session user id only)
src/lib/governance/load-inbox.ts                 # + handover rows
src/app/(protected)/pending/page.tsx             # + paused branch
src/components/office/PeopleTab.tsx              # state dialog, tags, Former staff group
docs/adr/0024-membership-states-replace-removal.md
tests/phase64/*.spec.ts                          # + playwright.config.ts project 'phase64'
tests/lint/member-status.spec.ts                 # register in a project regex (check with --list)
tests/evals/people.eval.ts
```

### Pattern 1: Helpers verify the membership row (the D-06 core)
**What:** keep the JWT claim as the *org selector* (it carries `active_org_id` choice and the ADR-0018 approval gate), but require a live active membership for that org and take the role from the row.
**When to use:** replaces `current_organisation_id()` and `current_user_role()` in place, same names, same `STABLE SECURITY DEFINER SET search_path = ''`, so none of the 125 dependent policies change.
**Example:**
```sql
-- Source: tested read-only against live data on a session-private temp table, 2026-10-21
create or replace function public.current_organisation_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select m.organisation_id from public.organisation_members m
  where m.user_id = auth.uid()
    and m.organisation_id = nullif(auth.jwt() ->> 'organisation_id', 'null')::uuid
    and m.status = 'active'
$$;
create or replace function public.current_user_role() returns public.app_role
language sql stable security definer set search_path = '' as $$
  select m.role from public.organisation_members m
  where m.user_id = auth.uid()
    and m.organisation_id = nullif(auth.jwt() ->> 'organisation_id', 'null')::uuid
    and m.status = 'active'
$$;
```
Side effects: a role change now takes effect on the next request instead of at token expiry (a gain); a `pending` claim now yields NULL instead of raising `invalid input value for enum app_role` (today `'pending'::app_role` errors inside every policy for a pending account) [VERIFIED: live helper source; the NULL behaviour confirmed in the temp-table test]. Unique `(organisation_id, user_id)` guarantees one row.

### Pattern 2: Access-token hook skips non-active rows
Add `and status = 'active'` to **both** selects in the 00081 body (`organisation_members` active-org lookup, and the "most recently joined" fallback, `00081:83-87` and `00081:90-95`). Keep the `grant execute ... to supabase_auth_admin` line (`00081:112`). A user suspended in their `active_org_id` falls back to their latest active org, else claim org `null` and role `pending` -> `/pending`.

### Pattern 3: One state module, thin actions
`changeMemberState({ memberId, organisationId, actorId, from, to })` in a plain module (no `'use server'`, no way for a client to call it; same reason as `remove.ts:1-12`). The actions in `src/actions/members.ts` do the guards then call it, then `recordDecision`. Each exported action contains `recordDecision(` so `tests/lint/ledger-every-action.spec.ts` passes without an exclusion.

### Pattern 4: Revoke function (service_role only)
```sql
-- Source: shape of 00080_complete_walk.sql:44-45; deletion semantics per supabase.com/docs/guides/auth/signout
create or replace function public.revoke_user_sessions(p_user_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  delete from auth.sessions where user_id = p_user_id;   -- refresh_tokens + mfa_amr_claims cascade (FK ON DELETE CASCADE)
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
```
The function takes a user id, so it must never be reachable by `authenticated` (CLAUDE.md Security: SECURITY DEFINER functions taking an id parameter are `service_role` only). The org check lives in the calling action (target must be a membership row of the session org).

### Pattern 5: The one place that says who is active
`src/lib/members/active.ts`: `activeMemberIds(admin, orgId, ids?)` and `memberStatusMap(admin, orgId, ids)` so notifications, pickers, lanes and labels do not each re-write a filter. Pair with `tests/lint/member-status.spec.ts` (below).

### Anti-Patterns to Avoid
- **Adding the status check to the hook only.** Leaves up to 1 h of full RLS access.
- **Banning the auth user.** Locks the person out of every other org (D-07).
- **Reading org/role from the JWT in new code.** `parseJwtPayload` and the middleware claim read are cosmetic redirects only; keep it that way and do **not** add a DB call to middleware (CLAUDE.md / LEARNINGS 2026-07-13: navigation latency).
- **Deleting the membership row, even for cleanup.** FK `ON DELETE CASCADE` from `auth.users` is the only deletion left (eval teardown deletes the auth user via service role; that stays outside `src/`).
- **Counting admins without a status filter** (`auth.ts:486-490` and `573-577` both do today).
- **Using a client-supplied org id.** Org comes from `getSessionContext()`; the write is filtered `.eq('organisation_id', organisationId)` and ends `.select('id')` with empty = failure (CLAUDE.md Security).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Revoking sessions | Custom token blacklist, middleware DB check, or ban | `revoke_user_sessions` over `auth.sessions` | GoTrue treats the table as source of truth; refresh then fails with a clean sign-out |
| "Next request" cut-off | Per-route status checks in server actions | Helper functions in RLS + `getSessionContext` null role | PostgREST and Storage requests bypass the app entirely; RLS is the only universal gate |
| Owner reassignment | A new reassign mechanism | `setSopOwner` (`governance.ts:120-170`, logs `owner_change`) + `OwnerPicker` | D-11; already validates the owner is a member of the session org |
| "SOP has no owner" detection | New query | `classifyGovernanceRow` `unowned` flag (`classify.ts:33`) fed by an active-only member set | Already drives Inbox chip `owner` and `InboxRow` branch `owner` |
| Ledger kinds | Free-text kinds | `DECISION_KINDS` + CHECK widening + `KIND_GROUPS` / `KIND_WORDS` | Three registries are spec-locked to one another |
| Names of departed people | Copy names into rows | `userLabels()` (`src/lib/members/labels.ts`) | The auth user is never deleted, so labels keep resolving; add a status map for the "(left)" suffix |
| Paused page | New route | Extend `/pending` | Already renders status variants and a sign-out form |

**Key insight:** the dangerous part is not the new column; it is the ~30 places that treat "a row exists in `organisation_members`" as "is a member". Treat that as the unit of work and guard it mechanically.

## Findings by Question (file:line evidence)

### Q1. Every path that resolves membership / role

**SQL (live DB read via Management API, read-only):**

| Path | Evidence | Reads | Needs |
|------|----------|-------|-------|
| `public.current_organisation_id()` | `00001_foundation_schema.sql:46-54`; live def identical (no later redefinition: grep of `supabase/migrations`) | `auth.jwt() ->> 'organisation_id'` | Redefine (Pattern 1) |
| `public.current_user_role()` | `00001:57-65` | `auth.jwt() ->> 'user_role'` | Redefine (Pattern 1) |
| `custom_access_token_hook` | latest body `00081:62-110` (supersedes `00017:11-58`, `00001:68-97`); hook enabled, `hook_custom_access_token_uri = pg-functions://postgres/public/custom_access_token_hook` [VERIFIED: config read] | `organisation_members` x2, `user_approvals`, `user_metadata.active_org_id` | `and status = 'active'` on both selects |
| 125 of 158 live policies | live `pg_policies` dump | the two helpers | covered by Pattern 1, no edit |
| Raw-claim policies (10) | live `pg_policies` | `auth.jwt()->>'organisation_id'` / `'user_role'` directly | Rewrite to the helpers: `escalation_reports` (`escalation_insert_own`, `escalation_select_scoped`, `escalation_update_supervisor`), `sop_voice_notes` (`voice_notes_insert_own`, `voice_notes_select_org`), `uat_feedback` (`uat_feedback_insert_own`, `uat_feedback_read_org`), `storage.objects` (`voice_bucket_insert_own`, `voice_bucket_select_org`, `org members can read generated videos` which reads `app_metadata` and so already matches nothing). `escalation_reports`, `sop_voice_notes`, the two buckets have no reference in `src/` (grep), but are PostgREST-reachable |
| Own-arm without org predicate | `sop_observations_read_org`: `(org = helper AND role in (...)) OR (observed_worker_id = auth.uid())` | `auth.uid()` | Change the arm to `observed_worker_id = auth.uid() AND organisation_id = current_organisation_id()` (this is the Security-learning "permissive arms OR together" case). The other 30 helper+uid policies AND the org predicate first (checked line by line) |
| Direct `organisation_members` subqueries | `member_departments_self_read`, `users_sub_trades_self_read`, `sop_access_people_self_read` (admin arm); `areas/collections/departments/roles_admin_*` (`exists (select ... from organisation_members om where om.user_id = auth.uid() and om.role in (...))`) | the table under the caller's own RLS | Covered: the subquery runs under `org_members_can_view_own_org` (`organisation_id = current_organisation_id()`), so a suspended caller sees zero rows. Own-row arms (`member_id = auth.uid()`) stay: harmless data about themselves |
| `organisation_members` policies | live: `admins_can_insert_members` (check org + admin/safety_manager), `admins_can_update_member_roles` (using org; check org AND admin), `org_members_can_view_own_org` (select org). No DELETE policy (LEARNINGS 2026-10-06) | helpers | Keep. Table grants give `authenticated` blanket UPDATE/INSERT/DELETE [VERIFIED: role_table_grants]; add `revoke update ... ; grant update (role) ...` so `status*` is service-role-only |
| SECURITY DEFINER helpers reading membership | `sop_observation_refs_in_org` (`00053:20-29`, `exists ... organisation_members` for the *observed worker*) | row existence | Add `status = 'active'` (observing a left worker should fail). `is_sop_sign_off_approver` (`00066:30`) uses the helpers, covered. `current_user_department_ids`, `current_user_sub_trades`, `sop_in_user_person_grants` use `auth.uid()` only and are always ANDed with the org helper in their policies |
| Storage bucket `sop-videos` | live policy `Authenticated users can read from sop-videos` = `bucket_id = 'sop-videos'` only (accepted gap T-40-14-05 in `00059:15-19`) | nothing | Pre-existing cross-tenant read, also open to suspended users who know a path; see Open Question 3 |
| Tables keyed on user only | `walkthrough_progress` (own rows, no org column, 5 rows), `uat_feedback` update/delete own | `auth.uid()` | Leave; no tenant data. Document in the ADR |

**App (TypeScript):**

| Path | Evidence | Reads from JWT? | Action |
|------|----------|-----------------|--------|
| `getSessionContext` | `src/lib/auth/session-context.ts:24-51`: `getClaims()` for `sub`/`email`; the **org claim only selects** which membership row (`:36-41`); `role` and `organisationId` come from the row | org claim as selector only | Add `.eq('status','active')` (belt and braces; RLS already returns nothing once the helper is fixed). Result for a suspended caller: `role null, organisationId null` |
| `requireAdminContext` | `guards.ts:22-29` uses `getSessionContext` | no | covered |
| `requireSopEditAccess` | `guards.ts:71-142`; uses session org | no | covered |
| Middleware | `src/lib/supabase/middleware.ts:29-30, 103`: `getClaims()` local verify; `user_role` claim only chooses the redirect after `/login` | claim, cosmetic | none; do not add a DB call |
| `loginWithEmail` | `auth.ts:118-119` `roleHome(claims.user_role)` | claim, cosmetic | none (suspended login -> claim `pending` -> `/pending`) |
| `org-model/resolve-access.ts`, `resolve-sop-access.ts` | pure functions over caller-supplied lists; **no membership read** (grep of `organisation_members` in both: none) | no | none; their member inputs come from `getTeamMembersWithEmails` / grants, so the People filter covers them |
| API routes under `src/app/api/sops/[sopId]/{download-url,parse-job,route,sections}` | use `createClient()` + RLS only, no app guard | n/a | covered by RLS fix only. Already-issued signed URLs live up to their TTL (3600 s in `download-url/route.ts:24`) [VERIFIED: grep] |
| Direct service-role membership readers | table below | no | each needs a status decision |

**Direct `organisation_members` readers in `src/` (the sweep list; line = the query):**

| File:line | Purpose | Status rule |
|-----------|---------|-------------|
| `actions/auth.ts:44` `switchSite` | may the user switch to org | active only |
| `actions/auth.ts:73` `setSiteHidden` | is the caller admin of org (admin client, explicit ids) | **active only** (a suspended admin could otherwise hide the site) |
| `actions/auth.ts:155` `joinWithInviteCode` | already a member? | read status; non-active -> paused message, never insert |
| `actions/auth.ts:230, 243` `inviteWorker` | already a member / add existing | status-aware: `left` -> reactivate (D-03); `suspended` -> "reinstate" error |
| `actions/auth.ts:334` `acceptInvite` | session insert; `23505` treated as success | after 23505 read status; non-active -> `/pending`, not success |
| `actions/auth.ts:380` `getTeamMembersWithEmails` | People list | return all + `status`; UI partitions |
| `actions/auth.ts:472, 487` `removeMember` | target + admin count | deleted / replaced |
| `actions/auth.ts:563, 574` `updateMemberRoleSafe` | target + admin count | count **active** admins; refuse role change on non-active |
| `actions/assignments.ts:39` `getOrgMembers` | owner picker, chain editor, label maps | add `includeInactive` option; default active-only; label callers (`governance.ts:445`, `approvals.ts:444`) pass true |
| `actions/governance.ts:135` `setSopOwner` | new owner must be a member | active only |
| `actions/governance.ts:399` `listGovernanceQueue` | `memberSet` -> `ownerIsActiveMember` | **active only** (this alone drives SOP handover) |
| `actions/approvals.ts:106` `setApprovalChain` | step must be admin/safety_manager | active only |
| `actions/departments.ts:153` | owner role labels | all (labels) |
| `actions/departments.ts:388` `setDepartmentOwner` | owner must be a member | active only |
| `actions/departments.ts:451, 478` | `callerOrgId`, `assignMemberDepartments` | active only |
| `actions/competency.ts:62-67, 323` | `callerOrgId`, person-in-org | active only |
| `actions/grants.ts:63-68` | `callerOrgId` | active only |
| `actions/observations.ts:334, 445` | observed worker's role; recipients admins/safety managers | active only (recipients: never notify a left admin) |
| `actions/org-model.ts:275` | seat a person in a role | active only |
| `actions/people.ts:53` | supervisor link targets | active only |
| `actions/versioning.ts:248` | users with a role, for new-version notices | active only |
| `lib/auth/sites.ts:8` `mySites` | site picker | active only |
| `lib/notifications/write.ts:35` `notify`, `:141` `membersWithRole` | recipients | active only. `signOffRecipients` (`:120-136`) must filter supervisors to active **before** the "no supervisors -> admins" fallback, otherwise a left sole supervisor yields zero recipients |
| `lib/objectives/core.ts:80` | subject person exists | active only |
| `lib/requests/ask-core.ts:85, 274` | ask target exists; ask targets list | active only |
| `actions/competency.ts` `getTrainingMatrix` (`:147-151`) | people come from `member_departments` with **no** membership join | filter `personIds` to active members so left staff leave the training lanes (records stay under "Former staff") |

### Q2. Session revocation for one user without a ban

- **Installed:** `@supabase/auth-js` 2.100.0 / `supabase-js` 2.100.0 [VERIFIED]. Admin API has `signOut(jwt, scope)` (needs the user's own JWT), `updateUserById` (ban), `deleteUser`; nothing keyed by user id (`GoTrueAdminApi.ts:110-353`). Web search found no revoke-by-user-id either [LOW-MEDIUM: negative claim from docs + source read].
- **Mechanism chosen:** `public.revoke_user_sessions(uuid)` (Pattern 4). Live check: `postgres` has DELETE on `auth.sessions` and `auth.refresh_tokens`; `service_role` has no DELETE; `auth.refresh_tokens.session_id` and `auth.mfa_amr_claims.session_id` are `ON DELETE CASCADE` to `auth.sessions` [VERIFIED: live query]. Migrations applied through the Management API run as `postgres`, so the function is owned by a role that can delete.
- **Live token facts:** `jwt_exp` 3600, refresh-token rotation on (reuse interval 10 s), `sessions_timebox` 0, `sessions_inactivity_timeout` 0, `sessions_single_per_user` false [VERIFIED: config read]. 2,989 session rows exist today (the eval suite mints many), so a `delete ... where user_id =` must always carry the user id.
- **What a live access token does after revoke:** it stays valid until `exp`: "Access Tokens of revoked sessions remain valid until their expiry time" and "sessions are removed from the database entirely" on sign-out [CITED: supabase.com/docs/guides/auth/signout, supabase.com/docs/guides/auth/sessions]. `getClaims()` in middleware and `getSessionContext` is a local verify, so it still passes; PostgREST validates signature only. Therefore the revoke does **not** provide the D-06 cut-off by itself; the helper redefinition does. The revoke adds: the tab cannot refresh (refresh token's session row is gone) so it is signed out within 1 h at worst, and a re-login must go through the hook.
- **Multi-org consequence:** deleting all sessions signs the person out of their other orgs too (D-07 accepts this). On their next sign-in the hook picks their latest active org. State this in the ADR.
- **Residual window:** signed URLs already issued (<= 3600 s for downloads; signed upload URLs 2 h [ASSUMED: GoTrue/Storage default]) keep working until expiry. Document as accepted.
- **Order:** update row first (the control), revoke second (best effort, reported), ledger third.

### Q3. Every column that assigns work to a user

From live `pg_constraint` (FK to `auth.users`) and name-pattern scan of uuid columns [VERIFIED]:

| Column | Meaning | Handover? |
|--------|---------|-----------|
| `sops.owner_user_id` | SOP owner / review owner (no separate review-owner column; `review_due_at` is per SOP; `sop_review_cadences` is per category and has only `updated_by`) | **Yes** - existing `unowned` flag once the member set is active-only; reassign = `setSopOwner` |
| `departments.owner_user_id` | department owner (`setDepartmentOwner`, `departments.ts:380-400`) | **Yes** - new row kind, reassign via `setDepartmentOwner` (active-only target) |
| `approval_chains.steps[].userId` (jsonb, no FK) | named approver in a category chain (`approvals.ts:100-112`, `ChainStep` in `lib/governance/approvals.ts`) | **Yes** - chain config naming a non-active person; fix via `setApprovalChain` |
| `sops.approval_snapshot[].userId` while `approval_state = 'pending'` (jsonb) | the in-flight chain frozen at submit; `approveStep` requires `stepMatchesCaller` on the next unapproved step (`approvals.ts:176-215`) | **Yes** - stuck forever if the next step names a left person. No existing action edits the snapshot. See Open Question 1 |
| `requests.target_user_id` (no FK) | an ask to a named person (`kind = 'do_sop'`, `state = 'open'`) | **Yes** - list; actions: existing `stopAsking`/answer paths |
| `supervisor_assignments.supervisor_id` (FK, cascade) | who sign-offs notify/route to | **Yes, informational** - workers whose supervisors are all non-active; notifications already fall back to admins once `signOffRecipients` filters active. Relink via existing `setSupervision` |
| `completion_sign_offs.supervisor_id`, `sop_approvals.approver_user_id`, `sop_observations.observed_by`, `sop_review_events.reviewed_by`, `sops.last_reviewed_by/uploaded_by/clear_approved_by`, `sop_focus_steps.verified_by_admin_id`, `sop_ai_findings.cleared_by`, `standards.created_by`, `ai_model_settings.updated_by`, `decisions.actor_id` | **Who did it** (history) | No. Stay attributed (D-09) |
| `sop_completions.worker_id`, `sop_walks.worker_id`, `sop_observations.observed_worker_id`, `sop_assignments.user_id` (individual), `sop_completion_signatures.roster_user_id` | the person's own work and obligations | No handover. Keep records; drop from lanes/denominators (training matrix, ask targets) |
| `role_members.member_id`, `member_departments.member_id`, `sop_access_people.member_id`, `users_sub_trades.user_id` | seats and access mappings | No handover; people lists must filter to active. Rows stay (reinstate restores them) |
| `notifications.user_id`, `worker_notifications.user_id/subject_user_id` | inbox of the person | No |
| `objectives` (subject person), `requests.raised_by_user/answered_by` | history | No |
| `escalation_reports.submitted_by/acknowledged_by`, `walkthrough_progress.user_id`, `uat_feedback.user_id`, `sop_voice_notes.created_by`, `sop_voice_qa_log.user_id` | dead or non-tenant | No |

Assessor status is derived from competency (no assigned column), so nothing to hand over [VERIFIED: `00056_assessor_governance.sql`]. Pending sign-offs on completions are **not** assigned to a person: any supervisor/admin in scope can act (RLS `supervisors_see_supervised_*` plus admin policies), so there is no "sign-off waiting on X" beyond the supervisor links and chain steps above.

### Q4. What `removeMember` / `deleteOrgMember` touch

- `removeMember` (`src/actions/auth.ts:461-507`): session guard, target read in session org, self/admin/last-admin checks (`:479-495`), `deleteOrgMember` (`:497`), `recordDecision` kind `member_removed`. `deleteOrgMember` (`src/lib/members/remove.ts:15-34`): service-role delete filtered `id` + `organisation_id`, `.select('id')`.
- **Only caller:** `src/components/office/PeopleTab.tsx:524` (`confirmRemove`); UI at `:111-182` (`RemoveDialog`, testids `people-remove-dialog/-confirm/-cancel`), `:456-458` state, `:773-787`, button `:974-987` (`people-remove`, copy "Remove from the site").
- **Specs / evals / data referencing them (all must be updated or deleted):**
  - `tests/phase59/people-actions.spec.ts:99-131` (`removeMember` body shape; helper shape; decision-writers registration; summaries)
  - `tests/phase59/people-tab.spec.ts:30, 41, 98` (testid, `removeMember(`, WR-03 try/finally list incl. `setRemovePending(false)`)
  - `tests/phase59/capability-matrix.spec.ts:29` (Manage team row must contain `removeMember()`, `deleteOrgMember()`, `src/lib/members/remove.ts`, `member_removed`)
  - `tests/phase56/decision-writers-sweep.spec.ts:53` (`LIVE_WRITERS` entry) and `scripts/decision-writers.json:43` (extraHook), `:63` (allow entry for `deleteOrgMember`)
  - `tests/phase59/ledger-read.spec.ts:22, 40, 57` and `tests/phase56/decision-kinds-live.spec.ts:128`
  - `tests/phase63/org-chart.spec.ts:40` (negative list; harmless, may drop `removeMember`)
  - `tests/evals/office.eval.ts:881, 905-917` (Remove leg of the People case, test starting `:822`)
  - `.planning/codebase/CAPABILITY-MATRIX.md:54`, `docs/LEARNINGS.md:25` (history, leave), `src/actions/governance.ts:395-398` (comment that says removeMember hard-deletes: rewrite)
- `member_removed` stays in the CHECK, `DECISION_KINDS`, `KIND_GROUPS.people` and `KIND_WORDS` because existing ledger rows carry it (the ledger is append-only; `decisions_no_update_delete` trigger, `00070:93-109`). It is simply never written again. Note `tests/phase59/ledger-read.spec.ts:52-58` reads the **latest** migration kind list (`00076`) and asserts it equals `DECISION_KINDS`: repoint that constant to `00082`.
- `decision-writers` sweep treats `organisation_members` as a guarded table (`decision-writers.json` `tables`): every new function that writes it needs an `entries`/`extraHooks` line (or an `allow` with reason) and a `LIVE_WRITERS` entry.

### Q5. Decision ledger

- `recordDecision(input, opts?)` in `src/lib/decisions/record.ts`: input `DecisionInput { kind, subject: {kind, id}, sopId?, summary (1-200 chars, plain literal), details?, agent?, supersedes? }`; org and actor from `getSessionContext()` only; service-role insert; fail-soft returning `{ ok: true, id } | { ok: false, error }`; callers return `logged: rec.ok`. Existing member usage: `subject: { kind: 'member', id: target.user_id }` (`auth.ts:500-505`, `270-275`, `600-605`). `details` must carry no email (spec `people-actions.spec.ts` asserts it).
- Kinds are registered in four places that specs lock together: DB CHECK `decisions_kind_check` (last widened by `00076`), `DECISION_KINDS` (`src/lib/decisions/shape.ts:13-23`), `KIND_GROUPS` / `KIND_WORDS` (`src/lib/decisions/read.ts:30-71`, `people` group is the home), and `src/types/database.types.ts:1887/1905/1923` (hand-maintained union; edit by hand). Also `tests/phase56/decision-kinds-live.spec.ts` (one probe per kind) and `scripts/decision-writers.json`.
- **Add:** `member_suspended` ("Suspended someone"), `member_left` ("Marked someone as left"), `member_reinstated` ("Reinstated someone"), all into `KIND_GROUPS.people`. Drop-and-recreate the CHECK in `00082` with the full 00076 list plus the three (idempotent, as 00073/00074/00076 did). Reassignment reuses `owner_change` (`setSopOwner`, `governance.ts:165-169`). For the new reassign actions (department owner, approval step) reuse `owner_change` with `details.target` rather than inventing more kinds. Details for state changes: `{ role, from, to, via?: 'invite', signed_out: boolean }`.

### Q6. Invite flow with an existing (left) membership

- `inviteWorker` (`auth.ts:192-277`, admin only): lists auth users (`:215`), finds `existing` by email, then `already` = any `organisation_members` row for (user, org) -> returns "already a member" (`:229-235`) **regardless of state**. An existing non-pending account is added directly with `insert` (`:242-252`, no email); only a brand-new address gets `inviteUserByEmail` (`:254-267`). So a `left` person (who has an auth account) is never emailed: change `:229-235` to read `status` and, for `left`, run `changeMemberState(left -> active)` (set `role = newRole`, log `member_reinstated` with `details.via = 'invite'`); for `suspended` return "They are suspended. Reinstate them from their card."
- `acceptInvite` (`:283-346`) inserts with the invitee's **own session** (`:334`); live policy `admins_can_insert_members` requires an admin caller in the same org, so for a fresh invitee this insert looks like it should fail RLS (claim org null). Not verified end to end; see Open Question 4. Treat `23505` (`:336`) by reading status: non-active -> redirect `/pending`.
- `joinWithInviteCode` (`:126-185`): the `existingMember` check (`:154-163`) is service-role and state-blind, and the unique `(organisation_id, user_id)` blocks a second insert, so a left/suspended person **cannot rejoin with the site code** today and cannot after the change; improve the message ("Your access to X is paused. Talk to your supervisor.").
- Reactivation goes through the service-role state module, never a second insert.

### Q7. `/pending` and ADR-0018 reuse

- `src/app/(protected)/pending/page.tsx:18-60`: `if (!userId) redirect('/login'); if (role) redirect('/')`; reads `user_approvals` for the account under RLS and renders `pending` / `declined` / `approved` copy, `data-testid="pending"` with `data-status`, Enquiries mailto, sign-out form. `src/app/page.tsx:29`: `if (!role) redirect('/pending')`. A suspended member has `role = null` after the change, so they arrive here with no new redirect code.
- Add a fourth branch: approval `approved` AND at least one non-active membership -> `data-status="paused"`, copy "Your access to {org} has been paused. Talk to your supervisor." (multiple orgs: names joined). The member cannot read their own row or the organisation under RLS, so read via `createAdminClient()` in a plain module, filtered by the **session user id** only (`src/lib/auth/paused.ts`). Approval states keep precedence (pending/declined copy first).
- ADR-0018's mechanism is the same shape as D-06 (gate in the token) but inherits the same 1 h staleness for a *later* decline of an approved account; out of scope here. Opportunistic: the helper could also require `user_approvals.status = 'approved'`; not recommended in this phase (scope creep, ADR change).

### Q8. Eval infrastructure

- Runner: `npm run eval -- --phase 64` (`scripts/run-evals.mjs`): waits for the Fly deploy of HEAD (sha at `/api/version`, then the "Deploy to Fly" workflow), runs `--project=evals --workers=1`, writes `.planning/evals/latest/` and `64-EVAL.md`. Self-skips without `EVAL_BASE_URL` (`office.eval.ts` header).
- Sessions: `tests/evals/lib/session.ts` `signInAs(context, role)` and `signInAsEmail(context, email)` mint a real session via admin `generateLink` + `verifyOtp` and write the `sb-<ref>-auth-token` cookie; one mint per role per file (shared OTP budget). `signInAsEmail` works for any throwaway address.
- Fixtures: eval-site org "SOPstart Eval Site" holds `siteAdmin`, `siteWorker`, `siteSupervisor`, `siteSupervisorIdle`, `siteSafety`, plus `EVAL_SITE_WORKER2_EMAIL` (no session minted). `office.eval.ts:67-70, 256-261, 273-279` already creates a **disposable** `eval-site-disposable-<run>@sopstart.invalid` worker (admin `createUser` with `email_confirm: true`, `user_metadata.eval_fixture`, membership insert via service role) and deletes it in `afterAll`. Do the same in the new eval: create its own members per run, so no other eval sees a suspended or left fixture and `scripts/eval-fixtures.mjs` needs **no change**. A confirmed, non-invited account is auto-approved by the `queue_new_user` trigger (`00081:33-53`), so the disposable member gets a session without a platform-admin step.
- Teardown: service-role delete of the membership row and `auth.admin.deleteUser` stay in `tests/` (the `src/` lint does not apply). Ledger rows are permanent and live in the eval-site org only.
- **Proving "next request" without reading the cookie:** use the minted session's `access_token` with a supabase-js client (anon key) to query `sops` before and after the suspend; the same token must return rows then zero rows. Then reload `/` in the member's browser context and assert `[data-testid="pending"][data-status="paused"]`. Prove revoke by calling `refreshSession` with the pre-suspend `refresh_token` and expecting an error.
- Screenshot names: `office.eval.ts` already uses a `64-` prefix for unrelated shots (`64-people-board`, `64-person-sheet`); use `64b-` or a distinct word to avoid collisions in `.planning/evals/latest/`.

### Q9. Conventions

- **Migrations:** next is `00082` (latest `00081_user_approval.sql`). Style: header comment explaining the *why*, idempotent (`drop ... if exists`, `create or replace`, `add column if not exists`), policies named, `to authenticated`, org predicate via `public.current_organisation_id()`, grants/revokes explicit, CHECK for kinds dropped and recreated with the full list. Apply via `scripts/apply-phase64-migration.mjs` copy-adapted from `apply-phase60-migration.mjs` (supabase `db push`, Management API fallback, post-apply assertions through raw SQL, `MIGRATION_FILES` array; check `npx supabase migration list` first). Do not apply the migration after the code deploy: apply first (additive and backwards-compatible: default `active`, old code unaffected).
- **RLS lint:** `tests/lint/rls-org-scope.spec.ts` parses final policy state across migrations; any rewritten policy must keep an org predicate. Register new specs in a Playwright project (`playwright.config.ts` has per-phase projects up to `phase63`; add `phase64` with `testMatch: /tests\/phase64\/.*\.(spec|test)\.ts$/`, and put `tests/lint/member-status.spec.ts` in the project regex that lists the other lint specs; confirm with `npx playwright test --list`).
- **CAPABILITY-MATRIX row format:** `| Capability | worker | supervisor | admin | safety_manager | chain approver | Enforced at |` with ✅ / ⚠ / 🕒 / `—` and file/function names in the last cell; "Manage team" (line 54) is the row to rewrite; add rows "Suspend, mark as left or reinstate a person" and "Reassign what a leaver owned"; update "Last updated". `tests/phase59/capability-matrix.spec.ts:24-33` asserts the Manage team row's contents: update it in the same commit.
- **journeys.ts:** entry `{ id, group, persona, title, summary, steps: [{ id, type: 'start'|'screen'|'action'|'decision'|'end', label, route?, detail?, to? }] }`. Edit the `people` journey step `sheet` (`journeys.ts:519` says "or removes them") and add a step for the handover list and one for the paused page (`pending-home` at `:68` already maps `/pending`; extend its `detail`). No new route is added, so "All screens" stays at 0 not mapped; `home.eval` asserts "0 not mapped yet" (`home.eval.ts:814`).
- **uat tests.ts:** entry `{ id, dateAdded, category, title, status: 'active', summary, tryIt: string[], links: [{label, href}], questions: [{id, text}] }` (see `adr20-people-chart`, `tests.ts:354-372`). Write as plain click-paths + yes/no questions (memory: layman language).
- **ADR:** `docs/adr/0000-template.md` (Status/Date/Decided by/Supersedes/Enforced by; Context, Decision, Consequences, How to comply). Next number is `0024` (index ends at 0023). Add the row to `docs/adr/README.md`; `Enforced by`: `tests/lint/member-status.spec.ts`, `supabase/migrations/00082_member_status.sql`, `tests/evals/people.eval.ts`. It does not supersede ADR-0018; it refines the access-token gate by making RLS verify the row.
- **Types:** `src/types/database.types.ts` is hand-maintained (user_approvals "postdates" it); add `status`, `status_changed_at`, `status_changed_by` to `organisation_members` Row/Insert/Update by hand.
- **UI rules:** plain words (no "block", "walk", "rooms"; guards in `tests/lint/`); tokens only in `src/styles/blueprint-theme.css`; red for danger only, sentence-case headings; reuse `.tag` for the "Suspended" tag and the existing dialog pattern of `RemoveDialog`. Invoke `Skill("sketch-findings-SOPstart")` before the People UI work (project rule).

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 56 `organisation_members` rows (live estimate); no status today. Past `member_removed` ledger rows (kept, append-only). People removed before this phase are gone (their auth user, completions and ledger rows remain; nothing to restore) | Data migration: `add column status text not null default 'active'` backfills; code edit: stop deleting |
| Live service config | Auth hook `hook_custom_access_token_uri = pg-functions://postgres/public/custom_access_token_hook` stays as is (function body replaced in place); no dashboard change | Re-assert the hook is enabled and the new body is live in the apply script |
| OS-registered state | None - verified: no scheduled jobs exist (ADR-0002); Fly.io deploy from `master` | None |
| Secrets/env vars | `SUPABASE_SERVICE_ROLE_KEY` (already used by `createAdminClient`), `SUPABASE_ACCESS_TOKEN` for the apply script. No new vars | None |
| Build artifacts | `src/types/database.types.ts` hand edit; bundle baseline gate (`npm run build` postbuild `check-bundle-size`) may move with PeopleTab changes | Record gate numbers after build; never rewrite the baseline to pass |

## Common Pitfalls

### Pitfall 1: Fixing the hook only
**What goes wrong:** tokens issued before suspension keep org+role claims for up to 3600 s; every policy on the helpers still passes.
**Why it happens:** RLS reads `auth.jwt()`, not the table.
**How to avoid:** helper redefinition (Pattern 1); the live probe in the eval compares the same token before and after.
**Warning signs:** a spec that only greps the hook for `status`.

### Pitfall 2: Permissive own-arm
**What goes wrong:** `observed_worker_id = auth.uid()` (sop_observations_read_org) lets a left person read observations about themselves regardless of the helper.
**How to avoid:** AND the org helper into the arm (Security learning: permissive policies OR together; a narrowing arm must be ANDed with the org predicate). Re-audit with a live `pg_policies` dump in Wave 0 rather than trusting the migration history (the history dump found 154 policies, the live DB has 158).

### Pitfall 3: State-blind "already a member" and "member exists" checks
**What goes wrong:** pickers and validators accept a suspended person as owner/approver/ask target; `switchSite`/`setSiteHidden` let a suspended admin act; role recipients include people who cannot act.
**How to avoid:** the sweep table in Q1 plus `tests/lint/member-status.spec.ts` (below).

### Pitfall 4: Last-admin counted over all rows
**What goes wrong:** with a suspended admin row, the last *active* admin can be demoted or suspended (`auth.ts:486-490` and `573-577` count every admin).
**How to avoid:** count `status = 'active'` in all three actions; also refuse role changes on non-active members.

### Pitfall 5: Admin can bypass the app rules over REST
**What goes wrong:** `authenticated` has table-level UPDATE and the admin UPDATE policy lets an admin PATCH `status` (including their own, or the last admin).
**How to avoid:** `revoke update on public.organisation_members from authenticated; grant update (role) on public.organisation_members to authenticated;` after confirming no `src/` or test code updates other columns with a session client (only `updateMemberRoleSafe` does, `auth.ts:584-590`; grep `tests/` for `.update(` on the table before applying).

### Pitfall 6: Zero-row writes look like success
**What goes wrong:** the new service-role update matches nothing (wrong org, wrong `from` state) and returns no error (LEARNINGS 2026-10-06).
**How to avoid:** `.select('id')`, treat empty as failure, include `.eq('status', from)` so a double click is a clean error not a second ledger row.

### Pitfall 7: Fallback to admins after filtering
**What goes wrong:** `signOffRecipients` falls back to admins only when `supervisor_assignments` is empty; a left sole supervisor leaves the list non-empty but all-inactive, and `notify()` (which drops non-members) then sends nothing.
**How to avoid:** filter to active first, then fall back.

### Pitfall 8: Training lanes and head counts
**What goes wrong:** `getTrainingMatrix` builds people from `member_departments` with no membership join; "N people can see this", seats and People counts would include leavers.
**How to avoid:** `activeMemberIds()` at every population source; leavers keep their record and appear under Former staff.

### Pitfall 9: Realtime of the UI vs the DB
**What goes wrong:** a suspended person's open tab renders stale client state until the next server call.
**How to avoid:** accepted; every server action and read already derives role from `getSessionContext`, which now returns null. No client polling (ADR-0002 spirit).

### Pitfall 10: Redirect and server-action races (Next 16.2.1)
**What goes wrong:** a client effect + `router.replace` to `/pending` orphans in-flight server actions (CLAUDE.md).
**How to avoid:** the redirect to `/pending` stays server-side (`page.tsx:29`); do not add a client-side "you were suspended" redirect.

### Pitfall 11: Helper cost
**What goes wrong:** each policy evaluation now does an indexed lookup instead of a JSON read.
**How to avoid:** the table has 56 rows today and `unique (organisation_id, user_id)`; run `EXPLAIN ANALYZE` of `select count(*) from sops` and the decisions list as `authenticated` before and after in Wave 0. Upgrade path if it ever matters: wrap calls as `(select current_organisation_id())` in policies for InitPlan caching. # ponytail: not done now; the DB is tiny.

## Code Examples

### Hook (diff against 00081)
```sql
-- both selects gain the filter; everything else is unchanged from 00081_user_approval.sql:62-110
select organisation_id, role into member_record from public.organisation_members
where user_id = (event->>'user_id')::uuid and organisation_id = active_org and status = 'active' limit 1;
...
select organisation_id, role into member_record from public.organisation_members
where user_id = (event->>'user_id')::uuid and status = 'active' order by created_at desc limit 1;
-- keep: grant execute on function public.custom_access_token_hook to supabase_auth_admin;
```

### Column and lock
```sql
alter table public.organisation_members
  add column if not exists status text not null default 'active',
  add column if not exists status_changed_at timestamptz,
  add column if not exists status_changed_by uuid references auth.users(id) on delete set null;
alter table public.organisation_members drop constraint if exists organisation_members_status_check;
alter table public.organisation_members add constraint organisation_members_status_check
  check (status in ('active','suspended','left'));
revoke update on public.organisation_members from authenticated;
grant update (role) on public.organisation_members to authenticated;   -- status* are service-role only
```
Keep the existing three policies; `admins_can_update_member_roles` needs no change (its `WITH CHECK` already restates the org predicate, `00062`).

### State change module
```ts
// src/lib/members/state.ts - plain module (no directive), service role. Org comes from the caller's session.
export async function changeMemberState(a: { memberId: string; organisationId: string; actorId: string; from: MemberStatus[]; to: MemberStatus }) {
  const admin = createAdminClient()
  const { data, error } = await admin.from('organisation_members')
    .update({ status: a.to, status_changed_at: new Date().toISOString(), status_changed_by: a.actorId })
    .eq('id', a.memberId).eq('organisation_id', a.organisationId).in('status', a.from)
    .select('user_id, role')
  if (error || !data?.length) return { ok: false as const }
  let signedOut = true
  if (a.to !== 'active') {
    const { error: e } = await admin.rpc('revoke_user_sessions', { p_user_id: data[0].user_id })
    signedOut = !e
  }
  return { ok: true as const, userId: data[0].user_id as string, role: data[0].role as string, signedOut }
}
```

### Action authority (mirror of `removeMember` `auth.ts:461-495`, with status)
```ts
if (target.user_id === userId) return { error: 'You cannot change your own access.' }
if (target.role === 'admin' && role !== 'admin') return { error: 'Only an admin can change an admin.' }
if (target.role === 'admin' && to !== 'active') {
  const { count } = await supabase.from('organisation_members').select('id', { count: 'exact', head: true })
    .eq('organisation_id', organisationId).eq('role', 'admin').eq('status', 'active')
  if ((count ?? 0) <= 1) return { error: 'There has to be at least one admin.' }
}
```

### Paused read
```ts
// src/lib/auth/paused.ts - plain module; userId is the session user id, never a parameter from the client
const { data } = await createAdminClient().from('organisation_members')
  .select('status, organisations ( name )').eq('user_id', userId).neq('status', 'active')
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hard delete of the membership | status column; row kept | this phase | history and reinstate work; FK targets survive |
| RLS trusts token claims | RLS re-checks the row | this phase | role and status changes apply on the next request |
| `getUser()` per request | `getClaims()` local ES256 verify | 2026-07-13 (existing) | token validity is not a revocation check, which is why the DB check is needed |

**Deprecated/outdated:** `removeMember`, `deleteOrgMember`, `member_removed` (kind kept for old rows only), the comment at `governance.ts:395-398`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Signed upload URLs from Storage live about 2 h | Q2 residual window | Residual window slightly longer; documentation only |
| A2 | After the session row is deleted, `@supabase/ssr` middleware `getClaims()` on an expired token fails the refresh and clears cookies, giving a clean redirect to `/login` | Architecture diagram | The deployed eval's refresh-token probe and a reload after token expiry will show it; failure mode is an error page instead of a login redirect |
| A3 | `acceptInvite`'s session-client insert is blocked by `admins_can_insert_members` for a fresh invitee | Q6 | Out of scope; if it works through some path I missed, nothing changes for this phase |
| A4 | Rewriting the 10 raw-claim policies cannot break a live flow because the tables/buckets have no `src/` callers (grep) | Q1 | A direct PostgREST consumer (agent/integration) of `uat_feedback` insert would be affected; `uat_feedback` IS used (`src/actions/uat.ts`) so its rewrite must be eval-checked |
| A5 | Per-policy cost of the helper lookup is negligible at current size (56 members) | Pitfall 11 | Slower lists at scale; measure in Wave 0 |
| A6 | Adding `SELECT` org-scoping to `sop-videos` storage would not break admin source-url reads | Open Question 3 | Video SOP source download breaks for admins; keep optional and eval-gated |

## Open Questions (RESOLVED)

Resolutions (2026-10-21): Q1 → CONTEXT D-17 (`reassignApprovalStep`, plan 64-05). Q2 → D-18 (Sign-offs inbox chip, plan 64-05). Q3 → D-19 (scope by data in plan 64-01, else accepted residual in ADR-0024). Q4 → plan 64-02 Task 2: A3 checked against the live `organisation_members` unique constraint (assert 23505 is the duplicate code for (organisation_id, user_id)) and recorded in the 64-02 SUMMARY; if it cannot be confirmed, ADR-0024 records it as an accepted residual. Q5 → deferred by CONTEXT, no action.

1. **In-flight approvals whose next step names a left person.**
   - Known: `approveStep` demands `stepMatchesCaller(steps[next])`; the snapshot is frozen at submit; nothing edits it (`approvals.ts:176-215`).
   - Unclear: desired remedy. Options: (a) a small `reassignApprovalStep(sopId, newUserId)` that rewrites that snapshot step (service role, active admin/safety-manager target, logs `owner_change`), (b) tell the admin to send the SOP back and resubmit after fixing the chain.
   - Recommendation: (a), one action, because "No automatic reassignment" is satisfied and otherwise the SOP is stuck. Role-named steps need no handover while any active holder of the role exists.
2. **Where the handover list lives.** Discretion item. Recommendation: Inbox (Sign-offs section), because the `owner` chip and `OwnerPicker` already live there; add a "Needs a new owner" chip/group that also carries the non-SOP rows (department owner, chain step, in-flight approval, open ask, orphaned workers). Do not add a tab.
3. **`sop-videos` bucket-wide SELECT** (`Authenticated users can read from sop-videos`, accepted gap T-40-14-05). A suspended or left person who still knows a path can read a video SOP source. Recommendation: scope SELECT to the org folder prefix with the helper in `00082` if the eval shows `source-url` and `transcribe` still work; otherwise record it as an accepted residual in the ADR.
4. **`acceptInvite` insert path (A3).** Verify once with a throwaway invite; do not widen scope.
5. **Notify the person?** Deferred by CONTEXT (no email). No action.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase Management API (`SUPABASE_ACCESS_TOKEN` in `.env.local`) | migration apply, live policy audit, post-apply assertions | yes | read-only queries succeeded 2026-10-21 | `npx supabase db push` with DB password |
| `npx supabase` CLI | `migration list`, `db push` | yes (devDependency ^2.22.6) | — | Management API raw SQL |
| Local Docker / local Supabase | not needed | no (daemon not running) | — | use live project, as every prior phase did |
| Node / Playwright | specs, evals | yes | Node 22.16 | — |
| `gh` CLI | `run-evals.mjs` deploy-wait | yes (logged in) | — | `--no-wait` |
| Fly.io deploy via push to `master` | deployed eval | yes | — | — |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright (source-contract specs, live-DB probes, deployed evals) |
| Config file | `playwright.config.ts` (add project `phase64`; evals run under project `evals`) |
| Quick run command | `npx playwright test --project=phase64 --project=phase59 --project=phase56` |
| Full suite command | `npm run build` then `npx tsc --noEmit` then `npm run test`; after push `npm run eval -- --phase 64` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MEMB-01 | column + CHECK + default + backfill; `status*` UPDATE-locked | source-contract (migration parse) | `npx playwright test tests/phase64/member-status-migration.spec.ts` | Wave 0 |
| MEMB-02 | helpers contain `status = 'active'`; hook has it in both selects; no raw `auth.jwt()->>'organisation_id'` policy survives in final policy state; `sop_observations_read_org` own-arm ANDed | source-contract + extend `tests/lint/rls-org-scope.spec.ts` | `npx playwright test tests/phase64 tests/lint/rls-org-scope.spec.ts` | Wave 0 / exists |
| MEMB-02 | **same token** reads SOPs before suspend and none after (PostgREST, not the app) | deployed eval | `npm run eval -- --phase 64` | Wave 0 |
| MEMB-03 | `revoke_user_sessions` service_role only; action order update -> rpc -> recordDecision; old refresh token rejected | source-contract + deployed eval | as above | Wave 0 |
| MEMB-04 | authority: self refused, admin-only-for-admin, last ACTIVE admin, `.select('id')` empty = failure, `.in('status', from)` | source-contract on `members.ts` / `state.ts` | `npx playwright test tests/phase64/member-actions.spec.ts` | Wave 0 |
| MEMB-05 | testids `people-suspend`, `people-left`, `people-reinstate`, "Suspended" tag, `people-former` group collapsed, WR-03 try/finally for new calls | source-contract (update `tests/phase59/people-tab.spec.ts`) + eval screenshots | `npx playwright test tests/phase59/people-tab.spec.ts tests/phase64` | exists (edit) |
| MEMB-06 | no `.delete(` on `organisation_members` in `src/`; `removeMember`, `deleteOrgMember`, `remove.ts` absent | lint | `npx playwright test tests/lint/member-status.spec.ts` | Wave 0 |
| MEMB-07 | `/pending` has `paused` branch with admin read scoped to session user; eval shows copy | source-contract + eval | as above | Wave 0 |
| MEMB-08 | `inviteWorker` reactivates `left`, refuses `suspended`; join/accept/switch non-active handling | source-contract + eval (re-invite leg: one membership row for the user) | as above | Wave 0 |
| MEMB-09 | active-only owner set => leaver's SOP flagged `unowned`; handover rows present; reassign logs `owner_change` | unit (`classify.test`-style on the inbox derivation) + eval | `npx playwright test tests/phase64/handover.spec.ts` | Wave 0 |
| MEMB-10 | three kinds in CHECK (00082), `DECISION_KINDS`, `KIND_GROUPS.people`, `KIND_WORDS`, `decision-writers.json`, live probe | update `ledger-read`, `decision-writers-sweep`, `decision-kinds-live`, `people-actions` specs | `npx playwright test tests/phase56 tests/phase59` | exists (edit) |
| MEMB-11 | every `from('organisation_members')` in `src/` is allowlisted or filters status | lint (windowed grep + allowlist, as `decision-writers` does) | `npx playwright test tests/lint/member-status.spec.ts` | Wave 0 |
| MEMB-12 | matrix row text; `journeys.ts` 0 not-mapped; uat entry shape; ADR index row | update `tests/phase59/capability-matrix.spec.ts`; `home.eval` pathways assertion | `npx playwright test tests/phase59/capability-matrix.spec.ts` | exists (edit) |
| MEMB-13 | `tests/evals/people.eval.ts` cases below | deployed eval | `npm run eval -- --phase 64` | Wave 0 |

**Deployed eval cases (`people.eval.ts`, eval-site org, own disposable members, assert by NAME not count, `SLOW` after each navigation, read every screenshot):**
1. Suspend: admin opens the person sheet, Suspend, confirm; receipt contains "Suspended" + ` · logged in the decision ledger`; row stays in the main list with a "Suspended" tag.
2. Cut-off: the member's pre-suspend access token returns SOPs before and zero after (direct supabase-js call); member context reload shows `pending[data-status="paused"]` with the exact copy; pre-suspend refresh token is rejected.
3. Reinstate: admin Reinstate; member signs in again (`signInAsEmail`); home loads and the same query returns rows.
4. Has left + handover: seed a SOP owned by a second disposable member, mark them Has left; they move to a collapsed "Former staff" group; the Inbox shows a "No owner"/"Needs a new owner" row for that SOP; `OwnerPicker` offers only active people; reassign clears the row and the ledger (People/Ownership chips) shows both entries.
5. Re-invite a left person by email: same membership row id, status active, ledger "Reinstated someone".
6. Guards: cannot suspend self; last active admin refused (disposable throwaway-org admin if needed, never the shared admin).
7. Update `office.eval.ts` People case: replace the Remove leg (`:905-917`) with Suspend/Reinstate or delete it; `:881` assertion on the invited row.

### Sampling Rate
- **Per task commit:** `npx playwright test --project=phase64` plus the touched phase project(s)
- **Per wave merge:** `npx tsc --noEmit` and the quick command above
- **Phase gate:** `npm run build` (judge by exit code; record the bundle gate numbers), `npm run test` once, push, then `npm run eval -- --phase 64` once (shared OTP budget: do not loop)

### Wave 0 Gaps
- [ ] `tests/phase64/` specs listed above and the `phase64` project in `playwright.config.ts`
- [ ] `tests/lint/member-status.spec.ts` registered in a project regex (verify with `--list`)
- [ ] `tests/evals/people.eval.ts`
- [ ] Live `pg_policies` re-dump before writing the migration (the policy inventory above was taken 2026-10-21; re-run it so the 10 raw-claim policies and the own-arm are still the full set)
- [ ] `EXPLAIN ANALYZE` before/after for the helper change
- [ ] Framework install: none

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | sessions revoked via `revoke_user_sessions`; hook refuses non-active rows; no ban |
| V3 Session Management | yes | refresh-token session rows deleted; access token residual <= 3600 s neutralised by RLS re-check; signed-URL residual documented |
| V4 Access Control | yes | RLS helpers verify membership row; org from session only; column-level UPDATE lock; last-active-admin and self-change rules; `service_role`-only SECURITY DEFINER |
| V5 Input Validation | yes | `z.string().uuid()` on member ids; transitions allowlisted (`from` states) |
| V6 Cryptography | no | none hand-rolled; JWT verification stays with Supabase |
| V7 Logging | yes | `recordDecision` for every state change and reassignment (ADR-0008), no email in details |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stale JWT claims after removal | Elevation of privilege | helpers re-check `organisation_members.status` per request |
| Permissive policy arm bypass (own-row arm) | Information disclosure | AND the org helper into every own-row arm; live policy audit |
| Admin PATCHes `status` over REST to dodge app rules | Tampering | `grant update (role)` only; writes via service role module |
| Cross-tenant write via client org id | Tampering | org from `getSessionContext()`, write filtered by it, `.select('id')` |
| Service-role path trusting a membership row | Elevation of privilege | `status = 'active'` on `switchSite`, `setSiteHidden`, `callerOrgId` variants; lint guard |
| SECURITY DEFINER function with an id parameter exposed to clients | Information disclosure / Tampering | `revoke all ... from public, anon, authenticated; grant execute to service_role` |
| Rejoin with the site code | Elevation of privilege | unique `(organisation_id, user_id)` + state-aware message; invite code only creates new rows |
| Ledger forgery | Repudiation | `recordDecision` service-role only; ledger append-only triggers (`00070:93-109`) |
| Already-issued signed URLs | Information disclosure | accepted residual (<= TTL), stated in ADR |

## Project Constraints (from CLAUDE.md)

- Service-role writes take org from the **session**, never from a fetched row or a client param, and filter `.eq('organisation_id', ...)`.
- Permissive policies OR together: a narrowing arm must be ANDed with the org predicate; a `WITH CHECK` replaces `USING`, so restate the org predicate; session `.update()`/`.delete()` end in `.select('id')` and treat empty as failure.
- `SECURITY DEFINER` functions taking an org (or user) id parameter are `service_role` only.
- Every `'use server'` export is a public endpoint and must be async; deleting a feature's UI means dropping the server params only it supplied.
- Redirects belong in the proxy or a server component, never a client effect + `router.replace`.
- Never derive first render from `navigator` / `window` / `Date.now()`.
- Design tokens only in `src/styles/blueprint-theme.css`; plain words in the UI (no "block", "walk", "rooms"); glove-friendly tap targets; sentence-case headings; red for danger.
- Binding docs: accepted ADRs (0002 no scheduled jobs, 0008 ledger every action, 0018 approval) bind the plan; structural decision -> new ADR in the same commit plus a `tests/lint/` guard if checkable.
- Same-commit duties: `journeys.ts` (0 not-mapped), `CAPABILITY-MATRIX.md`, ADR, `uat/tests.ts`; plan-phase adds these as explicit tasks.
- Deployed evals: `npm run eval -- --phase 64` after pushing; read the screenshots; no manual UAT checklists; assert by name, no "exactly N"; start after the "Deploy to Fly" workflow for HEAD completes.
- Guards grep comments too: describe banned patterns in words; new `tests/lint/*.spec.ts` must be in a Playwright project regex (check with `--list`).
- Build: `npm run build` is the gate (tsc alone is not enough); never rewrite a bundle baseline; judge by exit code.
- Fail-open pipelines / thinking-mode LLM rules do not apply to this phase.
- Memory notes: never hand Simon local/Playwright instructions for UAT; no background processes left running; push `master` after commits.
- Project skill: `sketch-findings-SOPstart` before People/Office UI work.

## Sources

### Primary (HIGH confidence)
- Live database, read-only via Supabase Management API (2026-10-21): `pg_policies` (158 rows), `pg_proc` definitions, `pg_constraint` FKs to `auth.users`, `has_table_privilege`, `information_schema` grants and columns, `config/auth` selected non-secret keys (`jwt_exp`, hook URI, session settings), `storage.buckets`
- Repository: `supabase/migrations/00001, 00017, 00045, 00053, 00056, 00059, 00062, 00070, 00073-00081`; `src/lib/auth/*`, `src/lib/supabase/middleware.ts`, `src/actions/{auth,governance,assignments,approvals,departments,competency,grants,observations,org-model,people,versioning,office}.ts`, `src/lib/{members,notifications,requests,objectives,governance,decisions}/*`, `src/components/office/{PeopleTab,InboxRow}.tsx`, `src/app/{page.tsx,(protected)/layout.tsx,(protected)/pending/*}`, `tests/**`, `scripts/{decision-writers.json,eval-fixtures.mjs,run-evals.mjs,apply-phase60-migration.mjs}`, `docs/adr/*`, `.planning/codebase/CAPABILITY-MATRIX.md`
- `node_modules/@supabase/auth-js/src/GoTrueAdminApi.ts` (v2.100.0)
- https://supabase.com/docs/guides/auth/sessions (sessions removed on sign-out; `session_id` claim vs `auth.sessions`; access tokens short-lived)
- https://supabase.com/docs/guides/auth/signout (access tokens of revoked sessions remain valid until `exp`)

### Secondary (MEDIUM confidence)
- Web search (Supabase JS/Swift reference summaries): admin `signOut` takes the user's JWT; no revoke-by-user-id found

### Tertiary (LOW confidence)
- Signed-upload-URL lifetime (A1) and the exact `@supabase/ssr` cookie-clearing behaviour on a dead refresh token (A2): training knowledge, to be proven by the eval

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new packages; versions read from `node_modules`
- Architecture (RLS/claims/helpers): HIGH - live DB dump plus a temp-table test of the new helper logic
- Session revocation: HIGH on mechanism and privileges (live), MEDIUM on end-user UX details (A2)
- Handover enumeration: HIGH on columns (live FK scan), MEDIUM on the approval-snapshot remedy (design choice, Open Question 1)
- Pitfalls: HIGH - each tied to a file:line or a live policy

**Research date:** 2026-10-21
**Valid until:** 2026-11-04 (14 days: policies and the hook change often; re-dump `pg_policies` in Wave 0)
