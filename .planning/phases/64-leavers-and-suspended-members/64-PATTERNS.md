# Phase 64: Leavers and Suspended Members - Pattern Map

**Mapped:** 2026-10-21
**Files analyzed:** 17 (new/modified groups)
**Analogs found:** 15 / 17

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `supabase/migrations/00082_member_status.sql` | migration | batch/DDL | `00081_user_approval.sql` (hook), `00080_complete_walk.sql` (grants), `00076` (kind CHECK) | exact |
| `scripts/apply-phase64-migration.mjs` | script | batch | `scripts/apply-phase60-migration.mjs` | exact |
| `src/lib/members/state.ts` | service (plain module) | CRUD | `src/lib/members/remove.ts` | exact |
| `src/lib/members/active.ts` | utility | request-response | `src/lib/members/labels.ts` (`userLabels`) | role-match |
| `src/lib/auth/paused.ts` | service | request-response | `remove.ts` (admin client scoped by explicit id) | partial |
| `src/actions/members.ts` | server action | request-response | `removeMember` in `src/actions/auth.ts:461-507` | exact |
| `src/actions/auth.ts` (edit: delete `removeMember`, status-aware invite/join/switch/role) | server action | CRUD | itself | exact |
| `src/actions/governance.ts`, `approvals.ts`, `departments.ts` (reassign, active-only) | server action | CRUD | `setSopOwner` `governance.ts:120-171` | exact |
| `src/lib/governance/load-inbox.ts` (handover rows) | service | request-response | existing `unowned` flow (`classify.ts:33`, `governance.ts:395-401`) | exact |
| `src/app/(protected)/pending/page.tsx` | page (SSR) | request-response | itself | exact |
| `src/components/office/PeopleTab.tsx` | component | event-driven | `RemoveDialog` `:111-182`, button `:974-987` | exact |
| `src/lib/decisions/shape.ts`, `read.ts`, `types/database.types.ts` | config | n/a | existing `member_removed` entries | exact |
| `tests/lint/member-status.spec.ts` | test (lint) | transform | `tests/lint/ledger-every-action.spec.ts`, `rls-org-scope.spec.ts` | role-match |
| `tests/phase64/*.spec.ts` + `playwright.config.ts` project | test | n/a | `tests/phase59/people-actions.spec.ts` | role-match |
| `tests/evals/people.eval.ts` | test (eval) | request-response | `tests/evals/office.eval.ts` (disposable worker `:67-70, 256-279`) | exact |
| `docs/adr/0024-...md`, CAPABILITY-MATRIX, `journeys.ts`, `uat/tests.ts` | docs/config | n/a | `docs/adr/0000-template.md`; matrix row 54; `journeys.ts:519`; `tests.ts:354-372` | exact |
| `departments.ts` `reassignApprovalStep` (D-17) | server action | CRUD | `setSopOwner`, `approveStep` `approvals.ts:176-215` | role-match |

## Pattern Assignments

### `src/lib/members/state.ts` (service, CRUD)
**Analog:** `src/lib/members/remove.ts` (read in full). Keep the header rationale (plain module, no `'use server'`, service role, session org is the scope).

```ts
import { createAdminClient } from '@/lib/supabase/admin'
const { data, error } = await createAdminClient()
  .from('organisation_members')
  .delete()            // becomes .update({ status: to, status_changed_at, status_changed_by })
  .eq('id', memberId)
  .eq('organisation_id', organisationId)
  // add .eq('status', from)  -> double click is a clean error
  .select('id')
if (error) { console.error('[deleteOrgMember] delete error', error); return 0 }
return data?.length ?? 0   // 0 = failure
```
Then, for `to` in suspended|left: `admin.rpc('revoke_user_sessions', { p_user_id })`. Failure is reported, never rolled back. Order: update, revoke, ledger.

### `src/actions/members.ts` (server action, request-response)
**Analog:** `removeMember`, `src/actions/auth.ts:461-507`. Copy the guard sequence and the ledger call.

```ts
const { supabase, userId, role, organisationId } = await getSessionContext()
if (!userId) return { error: 'Not authenticated' }
if (!role || !['admin', 'safety_manager'].includes(role)) return { error: 'Admin access required' }
if (!organisationId) return { error: 'No organisation' }
if (!z.string().uuid().safeParse(memberId).success) return { error: 'Member not found' }
const { data: target } = await supabase.from('organisation_members')
  .select('user_id, role').eq('id', memberId).eq('organisation_id', organisationId).maybeSingle()
if (target.user_id === userId) return { error: '... yourself' }
if (target.role === 'admin' && role !== 'admin') return { error: 'Only an admin ...' }
// last-admin: count with .eq('role','admin').eq('status','active')  <- NEW filter (auth.ts:486-490 lacks it)
const rec = await recordDecision({
  kind: 'member_suspended',            // | member_left | member_reinstated
  subject: { kind: 'member', id: target.user_id },
  summary: 'Suspended a person',       // plain literal, 1-200 chars
  details: { role: target.role, from, to, signed_out: boolean },   // no email
})
return { success: true, logged: rec.ok }
```
Each exported action must contain `recordDecision(` (ledger-every-action lint). Exports async only.

### Owner reassignment (`setSopOwner`, `setDepartmentOwner`, `setApprovalChain`, `reassignApprovalStep`)
**Analog:** `src/actions/governance.ts:129-170`. Change the member check to active-only and keep the rest.

```ts
const { data: member } = await regularSupabase.from('organisation_members').select('id')
  .eq('user_id', userId).eq('organisation_id', ctx.organisationId)
  .eq('status', 'active')              // NEW
  .maybeSingle()
if (!member) return { error: 'Owner must be a member of this organisation' }
...
.update({...}).eq('id', sopId).select('id')
if (!updated || updated.length === 0) return { error: 'SOP not found' }
await recordDecision({ kind: 'owner_change', subject: { kind: 'sop', id: sopId }, sopId, summary: '...', details: { owner_user_id: userId } })
```
New reassign actions reuse `owner_change` with `details.target`. `reassignApprovalStep` follows `approveStep` (`approvals.ts:176-215`) for snapshot access.

### `src/app/(protected)/pending/page.tsx`
**Analog:** itself. Add a paused branch beside the `status === ...` blocks (lines 29-46); `data-status="paused"` goes on the existing `data-testid="pending"` div (line 28).

```tsx
const { supabase, userId, role } = await getSessionContext()
if (!userId) redirect('/login'); if (role) redirect('/')
...
<div data-testid="pending" data-status={status} className="blueprint-frame max-w-md">
```
Paused read: `pausedMemberships(userId)` in `src/lib/auth/paused.ts`, admin client filtered by session user id only (suspended user cannot read own row under RLS). Approval pending/declined keep precedence. Copy: "Your access to {org} has been paused. Talk to your supervisor." Keep the Enquiries mailto and `pending-sign-out` form.

### Migration `00082_member_status.sql`
**Analogs:**
- Grants (`00080_complete_walk.sql:44-45`), for `revoke_user_sessions`:
```sql
revoke all on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
```
- Hook: copy `00081_user_approval.sql:62-110` body, add `and status = 'active'` to both selects (`:83-87`, `:90-95`), keep `grant execute ... to supabase_auth_admin` (`:112`).
- Kind CHECK: drop and recreate `decisions_kind_check` with the full `00076` list plus `member_suspended`, `member_left`, `member_reinstated`.
- Helpers: RESEARCH.md Pattern 1 SQL verbatim. Pattern 4 for `revoke_user_sessions`.
- Also: add column `status text not null default 'active' check (...)`, `status_changed_at`, `status_changed_by`; 10 raw-claim policy rewrites; `sop_observations_read_org` own-arm AND org helper; `sop_observation_refs_in_org` (`00053:20-29`) add status; `revoke update ... from authenticated; grant update (role) ...`.
- Style: header comment on the why, idempotent (`create or replace`, `if not exists`, `drop ... if exists`), named policies, `to authenticated`.

### `src/components/office/PeopleTab.tsx`
**Analog:** itself. `RemoveDialog` (`:111-182`, testids `people-remove-dialog/-confirm/-cancel`), pending state `:456-458`, `confirmRemove` `:524`, render `:773-787`, button `:974-987`. Replace with a state dialog (Suspend / Has left / Reinstate), "Suspended" `.tag`, collapsed "Former staff" group. Keep the try/finally pending-reset pattern (`people-tab.spec.ts` WR-03). Invoke `Skill("sketch-findings-SOPstart")` first.

### Inbox handover (`load-inbox.ts`, `governance.ts:395-401`)
**Analog:** existing `memberSet` -> `ownerIsActiveMember` -> `classifyGovernanceRow` `unowned` (`classify.ts:33`). Make the set active-only and SOP handover appears as the existing "No owner" row with `OwnerPicker`. Add rows for department owner, chain steps, pending snapshot steps, open `do_sop` asks (`requests.target_user_id`), workers whose supervisors are all inactive.

### `src/lib/members/active.ts`
**Analog:** `src/lib/members/labels.ts` `userLabels()`. Export `activeMemberIds(admin, orgId, ids?)` and `memberStatusMap(admin, orgId, ids)`. Labels add "(left)" / "(suspended)" suffix from the map.

### `tests/evals/people.eval.ts`
**Analog:** `tests/evals/office.eval.ts:67-70, 256-279` (disposable `eval-site-disposable-<run>@sopstart.invalid`, admin `createUser` with `email_confirm: true`, `user_metadata.eval_fixture`, service-role membership insert, `afterAll` delete). Use `signInAsEmail(context, email)` from `tests/evals/lib/session.ts`; one mint per file. Prove cut-off with the minted `access_token` in an anon supabase-js client (rows before, zero after), `refreshSession` with the old refresh token errors, `[data-testid="pending"][data-status="paused"]` on `/`. Screenshots prefixed `64b-`. Remove the Remove leg at `office.eval.ts:881, 905-917`.

### Tests to update (not create)
`tests/phase59/people-actions.spec.ts:99-131`, `people-tab.spec.ts:30,41,98`, `capability-matrix.spec.ts:29`, `tests/phase56/decision-writers-sweep.spec.ts:53`, `scripts/decision-writers.json:43,63` (add entries for new writers of `organisation_members`), `ledger-read.spec.ts:22,40,57` (repoint latest-migration constant from 00076 to 00082), `decision-kinds-live.spec.ts:128`.

## Shared Patterns

### Org from session, write filtered by org, empty result = failure
**Source:** `remove.ts` + `setSopOwner`. Apply to every new action. `.eq('organisation_id', organisationId)` and `.select('id')` on every write; never a client org id.

### Ledger (ADR-0008)
**Source:** `recordDecision` calls above. Register new kinds in four places: DB CHECK, `src/lib/decisions/shape.ts:13-23` (`DECISION_KINDS`), `src/lib/decisions/read.ts:30-71` (`KIND_GROUPS.people`, `KIND_WORDS`), `src/types/database.types.ts:1887/1905/1923`. Keep `member_removed` in all (history).

### Status filter on every `organisation_members` reader
**Apply to:** the ~30 call sites listed in RESEARCH.md Q1 table. Active-only for identity checks, pickers, recipients and counts; all rows for People list and label maps. Enforce with `tests/lint/member-status.spec.ts` (every `from('organisation_members')` in `src/` is on an allowlist or has a status filter; no `.delete()` on the table). Register in a Playwright project regex and confirm with `npx playwright test --list`.

### Hand-edited types and registration
`database.types.ts` is hand-maintained: add `status`, `status_changed_at`, `status_changed_by` to Row/Insert/Update. Add `MemberStatus` to `src/types/auth.ts`.

## No Analog Found

| File | Role | Reason |
|---|---|---|
| `revoke_user_sessions` SQL function | DB function over `auth.sessions` | No existing function touches the auth schema; use RESEARCH.md Pattern 4 with the `00080` grant shape |
| Helper redefinition reading the membership row | RLS helper | Current helpers (`00001:46-65`) read claims only; use RESEARCH.md Pattern 1 |

## Metadata

**Analog search scope:** `src/actions`, `src/lib/members`, `src/lib/governance`, `src/app/(protected)/pending`, `supabase/migrations`, `tests/` (paths taken from RESEARCH.md; remove.ts, auth.ts:455-509, governance.ts:118-172, pending/page.tsx and 00080:38-46 read directly)
**Not re-read, line refs from RESEARCH.md:** PeopleTab, 00081, office.eval, specs
**Pattern extraction date:** 2026-10-21
