---
phase: 64-leavers-and-suspended-members
plan: 02
subsystem: auth
tags: [server-actions, supabase, rls, membership-status, ledger, pending-page]

requires:
  - phase: 64-01
    provides: organisation_members.status, active-checking RLS helpers, revoke_user_sessions, three ledger kinds
provides:
  - changeMemberState() service-role state write with revoke
  - suspendMember, markMemberLeft, reinstateMember server actions (D-05 authority)
  - pausedMemberships() and the /pending "Access paused" variant
  - status-aware join code, invite (left reactivates, suspended refused), accept invite, site switch/hide, role change, People list, session context, site picker
affects: [64-03, 64-04, 64-05, 64-06]

tech-stack:
  added: []
  patterns:
    - "State change conditional on the status the caller saw (from list); empty result is a refusal"
    - "Ledger write after the state write, revoke failure reported but never rolled back"

key-files:
  created:
    - src/lib/members/state.ts
    - src/actions/members.ts
    - src/lib/auth/paused.ts
    - tests/phase64/member-actions.spec.ts
  modified:
    - src/actions/auth.ts
    - src/lib/auth/session-context.ts
    - src/lib/auth/sites.ts
    - src/app/(protected)/pending/page.tsx
    - src/lib/journeys/journeys.ts
    - src/types/database.types.ts
    - scripts/decision-writers.json
    - tests/phase56/decision-writers-sweep.spec.ts
    - .planning/codebase/CAPABILITY-MATRIX.md

key-decisions:
  - "revoke_user_sessions typed into database.types.ts Functions (hand-maintained) instead of casting the client"
  - "Paused page applies only when the approval is approved; pending and declined keep precedence"

requirements-completed: [MEMB-02, MEMB-03, MEMB-04, MEMB-07, MEMB-08, MEMB-10, MEMB-12]

duration: 50min
completed: 2026-10-23
---

# Phase 64 Plan 02: Membership state actions and state-aware auth Summary

**Suspend, Has left and Reinstate exist server-side with admin-only authority, a ledger row each and session revocation; every entry path now refuses or reactivates by status, and a paused person sees "Your access to {site} has been paused."**

## Accomplishments

- `changeMemberState()` updates status, `status_changed_at`, `status_changed_by` (and optionally role) with the service role, filtered by id, session organisation and the expected status, ending in a select; then `revoke_user_sessions` for suspended or left.
- `applyMemberState` (internal) plus the three exports enforce: admin or safety manager, never self, only an admin changes an admin, last active admin kept, stale state refused. Ledger kinds `member_suspended` / `member_left` / `member_reinstated` with role, from, to, signed_out (no email).
- `getSessionContext` and `mySites` read active rows only; `switchSite`, `setSiteHidden` need an active row; join code refuses a paused person; `inviteWorker` reactivates a left person's row (logged `member_reinstated`, `via: 'invite'`, no email) and refuses a suspended one with a pointer to Reinstate; `acceptInvite` sends a non-active duplicate to `/pending`; `updateMemberRoleSafe` refuses non-active targets and counts active admins; `TeamMember` carries `status` and `status_changed_at`.
- `/pending` shows "Access paused" for an approved account with only paused sites.
- Registered in the decision-writers sweep, capability-matrix row added, pathways pending-home step extended.

## Task Commits

| Task | Commit | What |
|---|---|---|
| 1 RED | `7898348c` | failing source contract |
| 1 GREEN | `c6eb9dea` | state module, three actions, writer registration, matrix row |
| 2 | `8eac0254` | auth paths, session context, sites, `revoke_user_sessions` type |
| 3 | `be4c268c` | paused page, journeys step; pushed to origin master |

## Verification Evidence

- **Spec before / after:** `member-actions.spec.ts` ran 16 failed before the files existed (RED, `7898348c`); 16 of 16 pass after Task 3.
- **Grep acceptance:** members.ts has 3 `^export async function` and 3 `^export `; state.ts `.update(` precedes `rpc('revoke_user_sessions'`; `changeMemberState(` precedes `recordDecision(` in `applyMemberState`; `eq('status', 'active')` present in the admin count.
- **tsc:** `npx tsc --noEmit` exit 0.
- **Build:** `npm run build` exit 0. Bundle gates: `/sops/[sopId]/page` 802 KB (baseline 802, delta 0); `/page` 831 KB (baseline 834, delta -3, same as 64-01, not from this plan). `.bundle-baseline.json` untouched.
- **Projects (once):** `--project=phase64 --project=phase59 --project=phase56`: 270 passed, 17 skipped, 3 failed. The 3 are the pre-existing Phase 59 failures already in `deferred-items.md` (`repoint-inventory` x2, `retirement-sweep` `updateRole` shape). `tests/lint`: 61 passed.
- **A3 (unique constraint, live, read-only Management API):** `organisation_members_organisation_id_user_id_key UNIQUE (organisation_id, user_id)` exists (plus the primary key). So the `acceptInvite` 23505 branch is reachable and the status read after it is the right shape; no read-first change needed.
- **Deployed smoke:** waited for "Deploy to Fly" of `be4c268c` to complete and `/api/version` to serve it. `home.eval.ts` against https://sopstart.com: 17 of 17 passed, no red. Screenshots read: `63-home-worker-desktop` (worker home with map and list), `63-home-section-people` (admin sees all 6 people), `63-home-read-supervisor` (supervisor Read view). Every role signs in to the home after the session-context change.

## Deviations from Plan

**1. [Rule 3 - Blocking] `revoke_user_sessions` missing from hand-maintained `database.types.ts`**
- **Found during:** Task 2 tsc
- **Fix:** added `revoke_user_sessions: { Args: { p_user_id: string }; Returns: undefined }` to Functions.
- **Commit:** `8eac0254`

**2. [Plan detail] Spec asserts `from: [seen]`** rather than `from: [target.status]`: the DB type of `status` is `string`, so it is cast once to `MemberStatus` as `seen`. Same behaviour.

No other deviations.

## Deferred Issues

Three Phase 59 spec failures (see 64-01 `deferred-items.md`); none touches a file changed here.

## Known Stubs

None. No UI calls the three actions yet (plan 64-03).

## Threat Flags

None beyond the plan's threat model; T-64-10..T-64-17 mitigations are in code and covered by the source contract; T-64-17 by the deployed home eval.

## Self-Check: PASSED

- Files present: state.ts, members.ts, paused.ts, member-actions.spec.ts, this summary.
- Commits `7898348c`, `c6eb9dea`, `8eac0254`, `be4c268c` in git log; pushed to origin master.
