---
phase: 64-leavers-and-suspended-members
reviewed: 2026-10-23T14:49:05Z
depth: deep
diff: 6ded9ed6..HEAD -- src supabase scripts
files_reviewed: 43
files_reviewed_list:
  - supabase/migrations/00082_member_status.sql
  - scripts/apply-phase60-migration.mjs
  - scripts/apply-phase64-migration.mjs
  - scripts/decision-writers.json
  - src/actions/approvals.ts
  - src/actions/assignments.ts
  - src/actions/auth.ts
  - src/actions/competency.ts
  - src/actions/departments.ts
  - src/actions/governance.ts
  - src/actions/grants.ts
  - src/actions/members.ts
  - src/actions/observations.ts
  - src/actions/office.ts
  - src/actions/org-model.ts
  - src/actions/people.ts
  - src/actions/versioning.ts
  - src/app/(protected)/admin/settings/page.tsx
  - src/app/(protected)/pending/page.tsx
  - src/components/admin/governance/OwnerPicker.tsx
  - src/components/office/ApprovePanel.tsx
  - src/components/office/DecisionsTab.tsx
  - src/components/office/InboxRow.tsx
  - src/components/office/InboxTab.tsx
  - src/components/office/OrgChart.tsx
  - src/components/office/PeopleTab.tsx
  - src/lib/auth/paused.ts
  - src/lib/auth/session-context.ts
  - src/lib/auth/sites.ts
  - src/lib/decisions/read.ts
  - src/lib/decisions/shape.ts
  - src/lib/governance/inbox.ts
  - src/lib/governance/load-inbox.ts
  - src/lib/journeys/journeys.ts
  - src/lib/members/active.ts
  - src/lib/members/authority.ts
  - src/lib/members/remove.ts
  - src/lib/members/state.ts
  - src/lib/notifications/write.ts
  - src/lib/requests/ask-core.ts
  - src/lib/uat/tests.ts
  - src/types/auth.ts
  - src/types/database.types.ts
findings:
  critical: 0
  high: 1
  medium: 3
  low: 7
  total: 11
status: issues_found
---

# Phase 64: Code Review Report

**Reviewed:** 2026-10-23T14:49:05Z
**Depth:** deep (00082 traced against every earlier policy on `organisation_members` and every `organisation_members` subquery in `supabase/migrations/`; server actions traced to `getSessionContext`, `changeMemberState`, `recordDecision`, `stopAskingCore`, `approveStep`)
**Files Reviewed:** 43
**Status:** issues_found

## Summary

The main cut works. The two helpers now check the membership row (`status = 'active'`) instead of trusting the token. The hook skips non-active rows. The ten raw-claim policies are rewritten. `status` can't be updated by a session client. `revoke_user_sessions` can only be run by `service_role`. Every app read of `organisation_members` goes through `getSessionContext` (no other `getUser`/`getClaims` caller in `src/actions`, `src/app/api`, `src/lib`).

Verified as correct:
- **No PostgREST or Storage path left for a suspended or departed member.** Each policy that subqueries `organisation_members` directly (departments, areas, roles, collections, `*_self_read`) runs that subquery under `org_members_can_view_own_org`, so the person sees zero rows.
- **Server actions.** Org comes from the session. Writes filter on `organisation_id` and `status` (`state.ts:29-40`). Self-change is refused, and only an admin can change an admin. The last-admin count includes active admins only. Each change writes a ledger row.
- **Join code.** A suspended or departed person can't rejoin with the join code (`auth.ts:155-168` reads with the service role, and the `(organisation_id, user_id)` unique constraint backs it up).
- **Re-invite.** Re-inviting is admin-only. It reactivates a `left` row and refuses a `suspended` one.

The findings below are about what is still open around the edges:
- One INSERT path on the same table that this phase hardened for UPDATE.
- A race in the last-admin check.
- A separation-of-duties hole in `reassignApprovalStep`.
- A cross-tenant read that was already there before this phase and answers the "can org A affect org B" question.

## Critical Issues

None.

## High

### HI-01: `organisation_members` INSERT is still open to session clients, so a safety manager can create an admin and get around D-05

**File:** `supabase/migrations/00082_member_status.sql:40-44` (only UPDATE locked); live policy `supabase/migrations/00002_rls_policies.sql:19-25` (`admins_can_insert_members`)
**Issue:** 00082 revokes UPDATE and grants back only `update (role)`. The INSERT grant stays, and so does the INSERT policy, whose only check is `organisation_id = current_organisation_id() and current_user_role() in ('admin','safety_manager')`. Nothing limits the inserted `role`, `status`, `status_changed_by` or `status_changed_at`. Research row 267 records the blanket INSERT/UPDATE/DELETE table grant as live.
**Failure scenario:**
1. A safety manager in org A sends `POST /rest/v1/organisation_members {"organisation_id":"<A>","user_id":"<uuid of a second approved account they control or a colluder>","role":"admin"}` with their own access token. The policy passes and returns 201.
2. That account signs in. The hook issues it org A with role `admin`.
3. It can now suspend, mark as left, or demote every real admin (`applyMemberState` only checks `role === 'admin'` on the caller).

This gets around D-05 ("only an admin can change an admin's state") and the admin-only rule in `inviteWorker` (`auth.ts:211`). It also lets any admin or safety manager insert rows with a made-up `status_changed_by`.

Precondition: a second account that the platform has already approved (ADR-0018). The policy is from before this phase, but D-05 depends on it and this phase locked down the other write paths on this table.
**Fix:** every app insert already uses the service role except `acceptInvite`, and RLS already blocks that one for a fresh invitee (research A3):
```sql
revoke insert, delete on public.organisation_members from anon, authenticated;
drop policy if exists "admins_can_insert_members" on public.organisation_members;
```
Then move the `acceptInvite` insert to the service role, but **not** keyed on `user_metadata.organisation_id` / `invited_role`. `user_metadata` can be written by the user through `auth.updateUser({ data })`. Keep the invite server-side (an `invites` row or `app_metadata`) and read it from there.

## Medium

### ME-01: Two admins can suspend each other at the same moment and leave no active admin

**File:** `src/actions/members.ts:45-56`, `src/lib/members/state.ts:28-40`
**Issue:** the last-admin check is a count followed by a separate update. The update only checks the target's `status`, never how many admins are left. The target's `role` isn't checked again either.
**Failure scenario:**
1. Org with two active admins, A and B. A clicks Suspend on B while B clicks Suspend on A.
2. Both requests count 2 active admins and pass. Each conditional update matches a different row, so both succeed.
3. The org has zero active admins. Safety managers can't reinstate an admin (`members.ts:43`), so recovery needs a service-role fix in SQL.

The same race exists between `updateMemberRoleSafe` (demote, `auth.ts:566-579`) and a concurrent suspend.

A smaller variant: a safety manager reads the target as `worker`, an admin promotes them in the meantime, and the safety manager's update still suspends the new admin, because the update doesn't filter on `role`.
**Fix:** enforce it in the database so every path is covered. Lock per organisation and recount inside the transaction:
```sql
create or replace function public.keep_one_active_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'admin' and old.status = 'active'
     and (new.role <> 'admin' or new.status <> 'active') then
    perform 1 from public.organisations where id = old.organisation_id for update;
    if not exists (select 1 from public.organisation_members
                   where organisation_id = old.organisation_id and id <> old.id
                     and role = 'admin' and status = 'active') then
      raise exception 'last active admin' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger organisation_members_keep_admin before update on public.organisation_members
  for each row execute function public.keep_one_active_admin();
```
Also add `.eq('role', target.role)` to the `changeMemberState` update, so a role that changed in the meantime is refused.

### ME-02: `reassignApprovalStep` lets one person complete a chain that needs two people (including via suspend, take the step, approve, reinstate)

**File:** `src/actions/approvals.ts:289-361` (target check `297-308`, write `341-347`)
**Issue:** the target only has to be an active admin or safety manager. The target can be the caller. The target can also be someone who already approved an earlier step of the same version, or who is named on a later step. `approveStep` (`approvals.ts:180-229`) only checks that the caller matches the next step. So handing the step to yourself lets you approve it.
**Failure scenario:**
1. Chain snapshot: [step 0: SM Alice, step 1: SM Bob]. Alice approves step 0.
2. Alice marks Bob as left or suspends him. Safety managers may do that to each other.
3. Alice runs `reassignApprovalStep(sop, alice)`, then `approveStep` publishes the SOP.
4. Alice reinstates Bob.

Every step is in the ledger, but the frozen two-person chain was met by one person. Before this phase, a step frozen on a named person could only be completed by that person.
**Fix:** before the write, refuse a target who already approved this version or is named on another step:
```ts
const { data: prior } = await (supabase as any).from('sop_approvals').select('approver_user_id')
  .eq('sop_id', sopId).eq('version', sop.version).eq('action', 'approved')
if (userId === ctx.userId || (prior ?? []).some((r: { approver_user_id: string }) => r.approver_user_id === userId)
    || steps.some((st, i) => i !== nextIndex && st.userId === userId)) {
  return { error: 'Pick someone who has not already approved this SOP.' }
}
```
(Drop the `userId === ctx.userId` clause if self-handover is intended, and record that decision in ADR-0024.)

### ME-03: Cross-tenant read: any active admin or safety manager reads every organisation's `member_departments` and `users_sub_trades` rows

**File:** `supabase/migrations/00035_departments_schema.sql:160-169` (`member_departments_self_read`), `supabase/migrations/00030_sub_trades.sql:53-63` (`users_sub_trades_self_read`). Neither was redefined later (grep across `supabase/migrations/`).
**Issue:** the admin arm is `exists (select 1 from organisation_members om where om.user_id = auth.uid() and om.role in ('admin','safety_manager'))`. It checks the caller's own role but never ties the **target row** to the caller's organisation. These junction tables have no `organisation_id` column. Research row 266 marks these policies "Covered". That is true for a suspended caller (the subquery sees no rows), but it misses this hole: for an active admin the arm is true for every row in the table. 00048 fixed exactly this for `sop_access_people`, but not for these two.
**Failure scenario:** an admin of org A runs `GET /rest/v1/member_departments?select=*` and receives every organisation's `(member_id, department_id, assigned_by)` rows, which tie user ids to other tenants' departments. `users_sub_trades` returns the same kind of cross-tenant data. This was there before Phase 64, but it answers "can an active member of org A affect org B" with a yes for reads.
**Fix:** use the 00048 shape:
```sql
drop policy if exists "member_departments_self_read" on public.member_departments;
create policy "member_departments_self_read" on public.member_departments for select to authenticated
  using (member_id = auth.uid()
    or (public.current_user_role() in ('admin','safety_manager')
        and exists (select 1 from public.departments d
                    where d.id = member_departments.department_id
                      and d.organisation_id = public.current_organisation_id())));
```
For `users_sub_trades`, do the same with a join to the target's membership in `current_organisation_id()`, as 00048 does. Also add `tests/lint/` coverage so `rls-org-scope` catches an admin arm that has no target-org predicate.

## Low

### LO-01: `reassignApprovalStep` can write an old snapshot over a newer, resubmitted chain

**File:** `src/actions/approvals.ts:341-347`
**Issue:** the update is filtered only by `id` and `approval_state = 'pending'`. It doesn't check `version` or the snapshot it read.
**Failure scenario:**
1. An admin opens the handover row. In the meantime the SOP is sent back and resubmitted, so it has a new version and a new `approval_snapshot` and is `pending` again.
2. The admin's reassign writes `next` (built from the old snapshot) over the new chain. The new chain's steps are lost without any error.

**Fix:** add `.eq('version', sop.version)` to the update. Treat zero rows as "That has already changed. Refresh and try again."

### LO-02: The new approval-step holder is never told

**File:** `src/actions/approvals.ts:339-360` (compare `approveStep` `244-255`, which calls `notifyNextApprover`)
**Issue:** after a reassign, the row leaves "Needs a new owner" (its holder is now active), and the new holder gets no notification.
**Failure scenario:** an admin hands Bob's step to Carol. Carol never hears about it, so the SOP sits pending with nothing flagging it.
**Fix:** after the write, call `notifyNextApprover({ organisationId: ctx.organisationId, sopId, sopTitle, version: sop.version, stepIndex: nextIndex, step: { userId, label }, actorId: ctx.userId })`. Select `title` in the read.

### LO-03: The paused redirect in `acceptInvite` can't be reached

**File:** `src/actions/auth.ts:361-380`
**Issue:** in Postgres, the RLS `WITH CHECK` runs before the unique-index check. An invitee's token carries no admin claim for the invite org, so `admins_can_insert_members` rejects the insert with `42501` before `23505` is ever raised. The new `if (memberError)` branch (369-380) only runs for a code that this path never produces.
**Failure scenario:** a suspended or departed person opens an old invite link and gets "Failed to complete account setup" instead of the paused page that D-08 calls for.
**Fix:** before the insert, read the row's status with the service role (scoped to the invite org). If a non-active row exists, redirect to `/pending` before attempting the insert. See also HI-01.

### LO-04: The `sop_observation_refs_in_org` SECURITY DEFINER can be called by any signed-in account and leaks membership

**File:** `supabase/migrations/00082_member_status.sql:227-240` (no revoke in 00053 or 00082)
**Issue:** this function takes user and org ids and bypasses RLS. That goes against ADR-0024 "How to comply" #5 and the CLAUDE.md rule. Its execute grant can't simply be revoked, because the INSERT policy calls it as the invoker.
**Failure scenario:** any authenticated token, including one for a suspended person, a departed person, or an account with no site, calls `rpc('sop_observation_refs_in_org', {p_sop_id, p_worker_id, p_org_id})`. From the result it can tell whether a given user is an active member of any organisation, and whether a SOP belongs to it. The caller needs the uuids.
**Fix:** drop the org parameter and use `public.current_organisation_id()` inside the function. Keep the policy call as `sop_observation_refs_in_org(sop_id, observed_worker_id)`.

### LO-05: Any member in the org can read who is suspended over REST

**File:** `supabase/migrations/00002_rls_policies.sql:13-16` (`org_members_can_view_own_org`, all columns), `00082:30-34` (new columns, no column grant)
**Issue:** the app shows `status` to admins and safety managers only (`getOrgMembers` and `getTeamMembersWithEmails` are admin-gated). But any worker can `GET /rest/v1/organisation_members?select=user_id,status,status_changed_by`. Suspension is described as covering things like investigations (D-01).
**Failure scenario:** a worker sees from the raw table that a colleague is `suspended` and which admin suspended them.
**Fix:** the simplest fix is to accept this and record it in ADR-0024. A column-level SELECT grant that leaves out `status` would also break every session-client filter on `status`: `session-context.ts:44`, `members.ts:33-52`, `auth.ts` role and state reads, `load-inbox.ts` `listHandover`, and `people.ts`. All of those would first have to move to the service role, scoped to the session org.

### LO-06: ADR-0024 says suspended and left people lose all access, but `using (true)` junction tables stay readable

**File:** `docs/adr/0024-membership-states-replace-removal.md:15`; policies `00035:112,135`, `00031:32-33`, `00046:257-258,280-281`
**Issue:** `sop_departments`, `sop_collections`, `role_members`, `sops_sub_trades` and `block_departments` are `using (true)` for every authenticated user. That was the D-02a design for uuid-pair junctions. So a suspended or departed person's still-valid token keeps reading every tenant's uuid pairs. ADR-0024 and the 64-01 summary ("matches no RLS policy") claim more than this.
**Failure scenario:** within the hour after a suspension, the person's token still returns `role_members` (who sits in which job role, across all orgs).
**Fix:** record this as an accepted residual in ADR-0024 (uuids only, no names). Or scope `role_members` and `sop_access_people`-style tables with the helper the way 00048 does.

### LO-07: Type drift in the hand-maintained types

**File:** `src/types/database.types.ts:43,2607`
**Issue:** `organisation_members.status` is typed `string`, so a misspelt state compiles and only the database CHECK catches it. `revoke_user_sessions` is typed `Returns: undefined`, but the SQL returns `integer` (`00082:247`). `reassignApprovalStep` also reads `sops` without `.eq('organisation_id', ctx.organisationId)` (`approvals.ts:310-314`). RLS covers that read, but it skips the project's convention of filtering by the session org.
**Fix:** type `status` as `MemberStatus` (Row/Insert/Update) and `Returns: number`. Add the org filter to the `sops` read and update.

---

_Reviewed: 2026-10-23T14:49:05Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
