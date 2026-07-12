---
phase: 28-ownership-review-lifecycle-governance-queue
plan: 04
subsystem: frontend
tags: [admin-ui, governance, ownership, review-lifecycle, journeys]

# Dependency graph
requires:
  - phase: 28-ownership-review-lifecycle-governance-queue
    provides: "setSopOwner/confirmSopCurrent/listGovernanceQueue/GovernanceRow server actions (28-03)"
provides:
  - "/admin/governance — single governance queue page with filter chips + one-click row actions"
  - "OwnerPicker.tsx — reusable ≤2-click inline owner reassignment popover"
  - "journeys.ts governance-queue journey (pathways coverage for /admin/governance)"
affects: [admin-sops-page (28-05 dashboard widget), 28-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One primary action per row selected by if/else-if flag priority (unowned > stale_role > confirm-current) — never more than one action visible"
    - "OwnerPicker popover mirrors SopDepartmentEditor's open/fetch-on-first-open/commit shape, reusing getOrgMembers instead of a second member query"

key-files:
  created:
    - "src/app/(protected)/admin/governance/page.tsx"
    - "src/components/admin/governance/GovernanceFilterChips.tsx"
    - "src/components/admin/governance/GovernanceQueueRow.tsx"
    - "src/components/admin/governance/OwnerPicker.tsx"
    - "tests/phase28/governance-queue.spec.ts"
  modified:
    - "src/lib/journeys/journeys.ts"

key-decisions:
  - "OwnerPicker.tsx built and committed in Task 1 (not deferred to Task 2 as the plan's files_modified listed) because GovernanceQueueRow imports it for the unowned-flag branch — task 1's own tsc/build verification would fail otherwise. Task 2 then only added the journeys.ts entry."
  - "Filter/classification stays entirely server-side (RSC) — the page filters the already-classified GovernanceRow[] by ?filter=, no client-side re-fetch or hydration mismatch risk."

requirements-completed: [GQ-01, GQ-02, GQ-03, OWN-02]

# Metrics
duration: 25min
completed: 2026-07-12
---

# Phase 28 Plan 04: Governance Queue UI Summary

**Single `/admin/governance` RSC page rendering `listGovernanceQueue()` rows through 5 filter chips (All/Overdue/Due soon/Unowned/Stale-role), with exactly one wired primary action per row (Confirm current / Assign owner via inline OwnerPicker / Fix assignment deep-link) and the new route mapped in journeys.ts in the same wave.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-12T07:45:00Z
- **Completed:** 2026-07-12T08:10:00Z
- **Tasks:** 3 completed
- **Files modified:** 6 (5 created, 1 modified)

## Accomplishments
- `/admin/governance/page.tsx` — copies the admin/sops auth+role guard verbatim, reads `?filter=` (default `all`), calls `listGovernanceQueue()`, filters the classified rows server-side, and shows a per-chip count plus an empty/clear state.
- `GovernanceFilterChips.tsx` — 5 chips (All/Overdue/Due soon/Unowned/Stale-role) linking to `/admin/governance?filter=<value>` (All → bare route), mirroring the `STATUS_TABS` render loop from `/admin/sops`.
- `GovernanceQueueRow.tsx` — one row, one wired primary action chosen by flag priority: `unowned` → `<OwnerPicker>`, else `stale_role` → `Fix assignment` link to `/admin/sops/[sopId]/assign`, else (overdue/due_soon) → `Confirm current` button that calls the real `confirmSopCurrent(row.id)` inside a `useTransition`, surfaces `{ error }` inline, and `router.refresh()`s on success.
- `OwnerPicker.tsx` — click 1 opens a popover (lazily fetches `getOrgMembers()` on first open — reused, not hand-rolled), click 2 picks a member or "No owner" → `setSopOwner(sopId, userId)` → close + `router.refresh()`. Total ≤2 clicks (OWN-02). Errors surfaced inline, never swallowed.
- `journeys.ts` — new `governance-queue` journey under the `Library & team` group with a `screen` step at `route: '/admin/governance'`, added in the same wave as the route (project convention).
- `tests/phase28/governance-queue.spec.ts` — 12 wired source-contract assertions: page calls `listGovernanceQueue(` + guards role + reads `params.filter`; row wires `confirmSopCurrent(row.id)` and branches on `flags.includes('unowned'/'stale_role')`; chips include all 5 filter values and link `?filter=`; OwnerPicker imports/calls `getOrgMembers()` and `setSopOwner(sopId, userId)` and surfaces `result.error`; journeys.ts contains `route: '/admin/governance'`.
- Full gate green: `npx playwright test --project=phase28 --project=phase28-unit` (35 passed, 3 fixme carried from 28-03), `npx tsc --noEmit` clean, `npm run build` clean (bundle gate Δ0 KB — this plan touches no worker-facing bundle).

## Task Commits

1. **Task 1: Governance queue page + filter chips + row (+ OwnerPicker, moved up from Task 2 — see Deviations)** - `e7dde12` (feat)
2. **Task 2: journeys.ts governance-queue entry** - `1dc9b7c` (docs)
3. **Task 3: Source-contract specs for queue + wiring** - `b774b64` (test)

_Plan metadata commit (this SUMMARY + STATE/ROADMAP) follows below._

## Files Created/Modified
- `src/app/(protected)/admin/governance/page.tsx` - Governance queue RSC page (auth guard, filter, empty/error states)
- `src/components/admin/governance/GovernanceFilterChips.tsx` - 5-chip filter nav
- `src/components/admin/governance/GovernanceQueueRow.tsx` - One row, one wired primary action
- `src/components/admin/governance/OwnerPicker.tsx` - ≤2-click inline owner reassignment popover
- `src/lib/journeys/journeys.ts` - New `governance-queue` journey, route `/admin/governance`
- `tests/phase28/governance-queue.spec.ts` - Wired source-contract coverage for all of the above

## Decisions Made
- OwnerPicker.tsx was written and committed as part of Task 1 rather than Task 2 as the plan's frontmatter `files_modified` implied, because `GovernanceQueueRow.tsx` (Task 1) imports it directly for the `unowned` branch — Task 1's own `tsc --noEmit` verification step would fail without it. Task 2 then only added the `journeys.ts` entry, matching its acceptance criteria unchanged.
- The page does all filtering/classification server-side against the already-computed `GovernanceRow[].flags` from `listGovernanceQueue()` — no client re-fetch per chip click, consistent with the RSC-first pattern used by `/admin/sops`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] OwnerPicker.tsx moved from Task 2 to Task 1's commit**
- **Found during:** Task 1, writing `GovernanceQueueRow.tsx` per the plan's own action text ("unowned → Assign owner (renders `<OwnerPicker sopId owner/>`)")
- **Issue:** The plan's `files_modified` frontmatter attributes `OwnerPicker.tsx` to Task 2, but Task 1's row component imports it directly — a genuine compile-order dependency. Committing Task 1 without it would leave `npx tsc --noEmit` broken at that commit boundary.
- **Fix:** Built the full `OwnerPicker.tsx` (matching Task 2's spec exactly — `getOrgMembers()` reuse, `setSopOwner()` wiring, inline error surfacing) and included it in the Task 1 commit. Task 2's commit then only added the `journeys.ts` entry.
- **Files modified:** `src/components/admin/governance/OwnerPicker.tsx` (created in Task 1's commit `e7dde12` instead of Task 2's)
- **Verification:** `npx tsc --noEmit` clean at both the Task 1 and Task 2 commit boundaries; Task 2's own verify script (`OwnerPicker must call setSopOwner` / `must reuse getOrgMembers` / `journeys.ts must map /admin/governance`) passed unchanged.
- **Committed in:** `e7dde12` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking compile-order dependency, no functional or scope change — OwnerPicker's implementation matches the plan's Task 2 spec verbatim, just landed one commit earlier)
**Impact on plan:** None on final state; only affects which task commit a file's diff appears under.

## Issues Encountered
None beyond the auto-fixed item above.

## User Setup Required
None — no external service configuration required. The page reads entirely from 28-03's existing server actions.

## Next Phase Readiness
- `/admin/governance` is live and reachable; `/pathways` will show `0 not-mapped` for it once viewed.
- 28-05 (dashboard widget + admin nav integration) can link into `/admin/governance?filter=...` directly — the page already reads `?filter=` and the 5 filter values match D28-05's spec exactly.
- No blockers.

---
*Phase: 28-ownership-review-lifecycle-governance-queue*
*Completed: 2026-07-12*

## Self-Check: PASSED

All created/modified files verified present; all task commit hashes (`e7dde12`, `1dc9b7c`, `b774b64`) verified in git log.
