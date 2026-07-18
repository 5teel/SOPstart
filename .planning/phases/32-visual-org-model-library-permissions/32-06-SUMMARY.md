---
phase: 32-visual-org-model-library-permissions
plan: 06
subsystem: ui
tags: [react, typescript, svg, org-chart, layout-algorithm, css]

# Dependency graph
requires:
  - phase: 32-04
    provides: "src/types/org-model.ts (OrgTree/OrgTreeArea/OrgTreeDepartment/OrgTreeRole/OrgPerson) + src/actions/org-model.ts (listOrgTree, createRole, createArea, ...)"
provides:
  - "src/lib/org-model/auto-layout.ts — layoutOrgTree(), pure deterministic leveled-tree layout (org→area→department→role, fixed depth per node type)"
  - "src/components/admin/org-model/OrgChartCanvas.tsx — Node Chart client component (bezier connectors, vacancy chips, capacity counts, add-affordance ghosts)"
  - "src/components/admin/org-model/ViewToggle.tsx — reusable segmented view switcher"
affects: [32-07, 32-08, org-model-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "layoutOrgTree bottom-up 'slot span' + top-down centered placement — deterministic leveled-tree layout with zero overlap-resolution pass (dedicated to org charts, distinct from FlowGraphCanvas's step-graph depth layering)"
    - "getBoundingClientRect() + imperative path.setAttribute('d', ...) for SVG bezier connectors, recomputed on window resize — FlowGraphCanvas idiom reused for pixel-accurate connectors independent of the pure layout's box coordinates"
    - ".node/.person-chip/.view-toggle/.org-add-ghost CSS added to blueprint-theme.css translating org-model-views.md verbatim, scoped under body[data-theme=\"paper\"]"

key-files:
  created:
    - src/lib/org-model/auto-layout.ts
    - src/lib/org-model/__tests__/auto-layout.test.ts
    - src/components/admin/org-model/OrgChartCanvas.tsx
    - src/components/admin/org-model/ViewToggle.tsx
  modified:
    - src/styles/blueprint-theme.css

key-decisions:
  - "Added .node/.person-chip/.view-toggle/.org-add-ghost CSS to blueprint-theme.css even though it wasn't in the plan's files_modified list — the sketch CSS patterns had no prior stylesheet declaration anywhere in the codebase, and without them every element in these two components would render invisibly (Rule 2 — CLAUDE.md 2026-07-14 undefined-CSS-token class of bug). Confirmed every var(--x) used resolves to a :root declaration before committing."
  - "Add-affordance ghosts (+ Add role, + ADD DEPARTMENT) call org-model.ts's createRole and departments.ts's createDepartment directly from the client component via a caller-supplied onChange callback — 32-06 is chart-rendering scope only, so OrgChartCanvas owns no fetch/refresh state itself; the /admin/team page wiring (owning onChange -> refetch) is 32-07's job."
  - "Connector anchor points are computed live via getBoundingClientRect() against the canvas container rather than derived purely from layoutOrgTree's x/y — this keeps the layout function's contract minimal (pure geometry only) while giving pixel-accurate bezier paths that tolerate CSS reflow (e.g. role nodes growing taller than their reserved row height when they carry many person chips)."

patterns-established:
  - "layoutOrgTree(tree) is the ONE pure org-chart layout function — any future org-model view needing box positions (blast-radius overlay, drill-in, wiring trace) must call it, never hand-position nodes (org-model-views.md § What to Avoid)"

requirements-completed: [SC-1]

# Metrics
duration: 20min
completed: 2026-07-18
---

# Phase 32 Plan 06: Node Chart Auto-Layout + Canvas Summary

**Pure deterministic leveled-tree auto-layout (`layoutOrgTree`) plus the `OrgChartCanvas` client component — org→area→department→role nodes on 20px grid paper with SVG bezier connectors, dashed vacancy chips, and role capacity counts, built to sketch 001's Node Chart spec.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-18T08:26:23Z (approx, per STATE.md)
- **Completed:** 2026-07-18T08:41:08Z
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- `src/lib/org-model/auto-layout.ts` — `layoutOrgTree(tree: OrgTree)`, a pure (no DOM/no I/O) bottom-up "slot span" + top-down centered-placement algorithm: org root (depth 0) → areas (depth 1) → departments (depth 2, null-area depts attach directly under root with no synthetic area) → roles (depth 3, people render as chips inside role nodes, not separate layout nodes)
- 5-test behavioral proof (`__tests__/auto-layout.test.ts`, run under the existing `phase32-unit` project) covering determinism, null-area dept parenting, even sibling spacing, parent-centering, and canvas-extent coverage — real RED (`throw new Error('not implemented')`, 5/5 failed) then GREEN (5/5 passed) TDD cycle
- `src/components/admin/org-model/OrgChartCanvas.tsx` (`'use client'`) — renders `layoutOrgTree()` output as absolutely-positioned `.node` divs on `bg-grid`, with one SVG underlay drawing cubic-bezier parent→child connectors via `getBoundingClientRect()` + `setAttribute('d', ...)`, redrawn on window resize; vacancies render as `.person-chip.vacant` dashed chips (never styled as an error); role nodes show `filled/budgeted` capacity via the existing `.pill` class; dashed `+ Add role` / `+ ADD DEPARTMENT` ghost affordances wired to `createRole`/`createDepartment`
- `src/components/admin/org-model/ViewToggle.tsx` (`'use client'`) — reusable controlled segmented control for the ⊞ Chart / ▤ Columns switcher (and 32-08's wiring-view switcher)
- `.node`, `.node.org-root`, `.person-chip`, `.person-chip.vacant`, `.view-toggle`, `.org-add-ghost` CSS added to `blueprint-theme.css`, translating org-model-views.md's CSS patterns verbatim, scoped under `body[data-theme="paper"]`

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure leveled-tree auto-layout** — RED `86a5b28` (test), GREEN `9c58f22` (feat)
2. **Task 2: OrgChartCanvas + ViewToggle components** — `9382b17` (feat)

**Plan metadata:** (this commit, docs: complete plan)

_TDD note: Task 1 followed the real RED→GREEN cycle — the implementation was staged to a `throw new Error('not implemented')` stub, the test suite was run and confirmed 5/5 failing, that stub was committed as the `test(...)` commit, then the real implementation was restored, re-run (5/5 passing), and committed as the `feat(...)` commit._

## Files Created/Modified
- `src/lib/org-model/auto-layout.ts` - pure `layoutOrgTree()` leveled-tree layout function
- `src/lib/org-model/__tests__/auto-layout.test.ts` - 5-test behavioral proof (determinism, null-area parenting, spacing, centering, extent coverage)
- `src/components/admin/org-model/OrgChartCanvas.tsx` - Node Chart client component
- `src/components/admin/org-model/ViewToggle.tsx` - shared segmented view switcher
- `src/styles/blueprint-theme.css` - `.node`/`.person-chip`/`.view-toggle`/`.org-add-ghost` CSS additions

## Decisions Made
- CSS additions to `blueprint-theme.css` (not in the plan's `files_modified`) were necessary — see key-decisions above (Rule 2 auto-add, CLAUDE.md 2026-07-14 undefined-token class).
- Add-affordance ghosts call the 32-04 create actions directly with a `window.prompt()`-based name entry (ponytail: no bespoke inline-add UI this plan — 32-07 owns full `/admin/team` page interaction polish); calls `onChange?.()` on success so the page-level caller decides how to refetch.
- `NODE_HEIGHT`/`ROW_HEIGHT`/etc. exported from `auto-layout.ts` (in addition to the plan's single `layoutOrgTree` export) so `OrgChartCanvas` can position its add-ghost affordances without duplicating magic numbers — kept as simple constant re-exports, no behavioral change to the layout contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added `.node`/`.person-chip`/`.view-toggle`/`.org-add-ghost` CSS to blueprint-theme.css**
- **Found during:** Task 2 (OrgChartCanvas + ViewToggle components)
- **Issue:** The plan's `files_modified` list only covered the two new component files, but org-model-views.md's CSS patterns (`.node`, `.person-chip`, `.view-toggle`) were never declared anywhere in the codebase. Without adding them, every rendered element in the chart would be visually broken — the exact "undefined CSS token" class of bug flagged in CLAUDE.md's [2026-07-14] learning.
- **Fix:** Added the sketch's CSS patterns verbatim to `blueprint-theme.css`, scoped under `body[data-theme="paper"]` matching the file's established convention (`.pill`, `.evidence-btn`, etc.). Confirmed every `var(--x)` referenced across both new component files and the new CSS resolves to a `:root` declaration (`--paper-1`, `--ink-300/400/500/900`, `--accent-step`, all pre-existing).
- **Files modified:** src/styles/blueprint-theme.css
- **Verification:** `grep -oE "var\(--[a-zA-Z0-9-]+" ... | sort -u` cross-checked against `:root` declarations — zero undeclared tokens.
- **Committed in:** `9382b17` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical — CSS token safety)
**Impact on plan:** Necessary to make the delivered components render visibly at all; no scope creep beyond the plan's own acceptance criterion ("every `var(--…)` token used resolves to a declaration in blueprint-theme.css").

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `layoutOrgTree`, `OrgChartCanvas`, and `ViewToggle` are ready for 32-07 to wire into `/admin/team/page.tsx` alongside a new `OrgColumnsBoard.tsx` (Columns alt view) — `tests/phase32/org-chart-build.spec.ts` (SC-1, `test.fixme`) is flipped live in 32-07 per its own header comment, not this plan.
- `ViewToggle` is a pure controlled component (`options`/`value`/`onChange`) ready for reuse in 32-08's ⌇/▦/◉ wiring-view switcher with no changes needed.
- `npx tsc --noEmit` clean; `npx eslint` clean on all new/modified files; `phase32-unit` (11/11) and `phase32` (11 passed, 6 fixme-skipped, 0 failed) Playwright projects both green.

---
*Phase: 32-visual-org-model-library-permissions*
*Completed: 2026-07-18*

## Self-Check: PASSED

- FOUND: src/lib/org-model/auto-layout.ts
- FOUND: src/lib/org-model/__tests__/auto-layout.test.ts
- FOUND: src/components/admin/org-model/OrgChartCanvas.tsx
- FOUND: src/components/admin/org-model/ViewToggle.tsx
- FOUND: 86a5b28 (Task 1 RED commit)
- FOUND: 9c58f22 (Task 1 GREEN commit)
- FOUND: 9382b17 (Task 2 commit)
