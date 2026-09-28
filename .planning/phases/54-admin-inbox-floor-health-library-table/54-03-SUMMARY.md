---
phase: 54-admin-inbox-floor-health-library-table
plan: 03
subsystem: ui
tags: [react, nextjs, next-dynamic, svg, governance, site-editor]

requires:
  - phase: 54-01
    provides: admin-health.ts (machineHealth, machinePanelSops, AdminSopBadge), listSiteHealthForOrg
  - phase: 54-02
    provides: "/governance route, GovernanceInbox, GovernanceRow shape"
  - phase: 52
    provides: PlantStage (worker scene renderer) and camera maths in scene.ts
provides:
  - "PlantStage health paint mode (optional health?: 'bad' | 'due' | 'ok' per machine)"
  - AdminMachinePanel (admin sibling of the worker MachinePanel, owner/review badges + Open/Edit)
  - AdminFloorHealth (health-lit floor + panel + no-site fallback for /governance's right column)
  - "/governance two-column layout (inbox + floor)"
affects: [54-04, 54-05, 54-06]

tech-stack:
  added: []
  patterns:
    - "Caller-classified rendering: PlantStage paints a health value it never computes -- admin-health.ts is the one classifier, PlantStage stays a dumb renderer shared by worker and admin surfaces"
    - "next/dynamic({ ssr:false }) reach into the plant directory from outside it, with no import (including import type) of plant-directory symbols -- prop shapes matched structurally instead"

key-files:
  created:
    - src/components/admin/governance/AdminMachinePanel.tsx
    - src/components/admin/governance/AdminFloorHealth.tsx
  modified:
    - src/components/sop/plant/PlantStage.tsx
    - "src/app/(protected)/governance/page.tsx"
    - tests/phase54/admin-machine-panel.spec.ts

key-decisions:
  - "Reworded the two health aria-labels ('a procedure here has nobody responsible' / 'a review is due here') instead of the plan's literal 'no owner' / 'is overdue' text -- the plan's own acceptance criteria (grep -cE \"unowned|overdue|reviewDueAt\") and its own Task-1 test instructions ('PlantStage contains none of unowned, overdue, owner, reviewDueAt') directly conflict with the literal aria-label wording it also specifies. Kept the grep/test contract (PlantStage never spells the classification words) and preserved the semantic meaning."

patterns-established:
  - "Any future PlantStage caller that needs a new paint mode should extend PlantStageMachine additively (optional field) and add a branch to polygonPaint + the pin block, exactly as health was added -- never fork the renderer."

requirements-completed: [ADM-02]

duration: 45min
completed: 2026-09-29
---

# Phase 54 Plan 03: PlantStage Health Paint + Admin Floor Health Summary

**PlantStage gains an optional caller-classified health paint (red !/amber ↻/green dot), a new AdminMachinePanel shows owner and review-due per SOP with Open/Edit, and AdminFloorHealth composes them into /governance's right column via a lazy PlantStage import -- with a "Draw your site" fallback for orgs with no site.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-09-29
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- `PlantStage` additively supports an admin health paint mode (`bad`/`due`/`ok`) without ever reading governance flags, owners, or dates itself -- worker `PlantHome` callers are byte-unaffected (no `health` prop passed).
- New `AdminMachinePanel` renders owner + review-due per linked SOP with NO OWNER / REVIEW DUE / DRAFT / OK badges, Open (SOP page) and Edit (builder) links, and an "Add one" empty state -- kept entirely out of the worker `MachinePanel` and the worker bundle.
- New `AdminFloorHealth` composes `machineHealth()` + `machinePanelSops()` (both from 54-01's `admin-health.ts`) over the same `gov.rows` the inbox already reads, so the floor and the inbox read from one classification, never two. `PlantStage` is reached only through `next/dynamic({ ssr: false })`.
- `/governance` now renders a `grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]` layout: `GovernanceInbox` on the left, `AdminFloorHealth` on the right (stacks below on phone).
- `npm run build` confirms zero bundle impact on `/sops/page` and `/sops/[sopId]/page` (Δ 0 KB each vs baseline; `.bundle-baseline.json` untouched) -- the admin floor code never reaches a worker route.

## Task Commits

Each task was committed atomically:

1. **Task 1: PlantStage health paint + the admin machine panel** - `856f4be` (feat)
2. **Task 2: AdminFloorHealth and the /governance right column** - `98daa82` (feat)

_This plan's SUMMARY commit follows as plan metadata (see below)._

## Files Created/Modified
- `src/components/sop/plant/PlantStage.tsx` - additive `health?: 'bad' | 'due' | 'ok'` on `PlantStageMachine`; dashed escalate/decision tint in `polygonPaint`; `data-health` on the polygon; a `plant-health-pin` (! / ↻ / dot) that replaces the count pin when `health` is set; label visibility extended for health states
- `src/components/admin/governance/AdminMachinePanel.tsx` - new: sprite/no-photo, department colour, machine name, per-SOP badge + owner/review line + Open/Edit, empty state with "Add one"
- `src/components/admin/governance/AdminFloorHealth.tsx` - new: lazy `PlantStage`, health derivation via `machineHealth`/`machinePanelSops`, selection state, error/no-site/floor render branches
- `src/app/(protected)/governance/page.tsx` - two-column grid; renders `AdminFloorHealth` beside `GovernanceInbox` fed the same `gov.rows`
- `tests/phase54/admin-machine-panel.spec.ts` - replaced the Wave-0 `test.fixme` stubs with live source-contract tests for both tasks

## Decisions Made
- See `key-decisions` in frontmatter: reworded the two PlantStage aria-labels to avoid the literal substrings "owner"/"overdue" that the plan's own acceptance criteria and Task-1 test instructions ban from `PlantStage.tsx`, while keeping the same user-facing meaning (nobody responsible / a review is due).
- `AdminFloorHealth`'s `useMemo` is called unconditionally (before the error/no-site early returns) to satisfy the rules of hooks, with an internal `hasSite` guard deciding whether to compute the floor derivation -- the plan's prose describes the derivation as happening "otherwise", which this preserves functionally without violating hook-call ordering.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reworded PlantStage aria-labels to satisfy the plan's own word-ban grep**
- **Found during:** Task 1
- **Issue:** The plan's action text specified aria-labels `"${m.name}, a procedure here has no owner"` and `"${m.name}, a review here is overdue"`, but the same task's acceptance criteria (`grep -cE "unowned|overdue|reviewDueAt"` must be 0) and its own instruction to test-write "`PlantStage contains none of unowned, overdue, owner, reviewDueAt`" ban the substrings "owner" and "overdue" from the file -- a direct self-contradiction.
- **Fix:** Used `"a procedure here has nobody responsible"` (bad) and `"a review is due here"` (due) -- same meaning, no banned substrings.
- **Files modified:** `src/components/sop/plant/PlantStage.tsx`
- **Verification:** `grep -cE "unowned|overdue|owner|reviewDueAt" src/components/sop/plant/PlantStage.tsx` returns 0; `admin-machine-panel.spec.ts` asserts the same.
- **Committed in:** `856f4be` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug/self-contradiction in the plan text)
**Impact on plan:** No scope change -- cosmetic wording only, all truths/acceptance criteria satisfied as written.

## Issues Encountered
None beyond the deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `/governance` now shows both the inbox and the health-lit floor, satisfying ADM-02's "the machine shop has no owner for anything becomes a place on the floor" goal.
- 54-04 (admin library table) is unaffected -- it modifies a disjoint file set and was left untouched.
- `npm run build`, `npx tsc --noEmit`, and `--project=phase54 --project=phase52 --project=phase53 --project=phase26 --project=phase15-stubs` are all green at HEAD (`98daa82`).

---
*Phase: 54-admin-inbox-floor-health-library-table*
*Completed: 2026-09-29*
