---
phase: 33-per-sop-access-granularity-wayfinder-builder-header
plan: 06
subsystem: ui
tags: [react, wiring-patch-bay, org-model, access-grants, playwright]

# Dependency graph
requires:
  - phase: 32-visual-org-model-library-permissions
    provides: OrgTree (areas[].departments[].roles[].people[]), resolveEffectiveAccess, WiringPatchBay D-hybrid bay (area/dept/org jacks)
  - phase: 33-01
    provides: role/person SubjectType support in access_grants (SOP-target grant schema groundwork)
provides:
  - Full org ladder (site → area → department → role → person) as expandable, selectable tiers in WiringPatchBay teams column
  - Vacancy chips rendered dashed and non-interactive
  - leftEndpoint generalized to nearest-collapsed-ancestor (area/department/role tiers)
affects: [33-05, 33-07, 33-08, 33-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chain-based nearest-collapsed-ancestor wire anchoring (walk root-first chain, stop at first collapsed tier) generalizes single-tier collapse redirects"
    - "Through-role person chains with legacy flat-chain fallback for grant subjects predating the roles model"

key-files:
  created: []
  modified:
    - src/components/admin/wiring/WiringPatchBay.tsx
    - src/styles/blueprint-theme.css
    - tests/phase32/wiring-at-scale.spec.ts
    - tests/phase33/teams-ladder.spec.ts

key-decisions:
  - "leftEndpoint rebuilt on the existing `chains` map (root-first ChainLink[]) rather than a bespoke deptAreaId lookup — one generalized walk covers area/department/role collapse instead of three near-duplicate special cases"
  - "Only ONE wiring-at-scale pin needed repointing (the leftEndpoint body) — verified all other ~15 pins individually against new source rather than blanket-rewriting, per the 2026-07-13 stale-guard-class learning"
  - "Legacy bottom-of-column person list filtered to exclude tree-resident person ids, preventing duplicate jack rendering for a person who is both a tree role member and a pre-existing grant subject"

patterns-established:
  - "Pattern 3 (RESEARCH): extend expandedX Set-per-tier state + chains + peopleIndex + leftEndpoint together whenever a new tier is added to an expand/collapse ladder"

requirements-completed: [SC-1]

# Metrics
duration: 25min
completed: 2026-07-19
---

# Phase 33 Plan 06: Full org ladder in WiringPatchBay teams column Summary

**Extended WiringPatchBay's teams column from org/area/dept to the full site→area→dept→role→person ladder, generalizing wire anchoring to nearest-collapsed-ancestor and routing person grants through their role.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-19T03:02:31Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Dept rows now twist open to reveal role rows (filled/budgeted count badge); role rows twist open to reveal person rows — mirrors the shipped area twist machinery exactly
- Vacancy chips (`p.isVacancy`) render dashed via a new `.jack.vacancy` CSS rule and carry no `onClick` — verified by both a source-contract test and a regex isolating the vacancy JSX block
- `chains` memo grows role chains (`org→area?→dept→role`) and through-role person chains (`…→role→person`); the flat legacy `org→person` chain is preserved only for grant subjects not present in any tree role
- `peopleIndex` grows role→members entries so blast-radius/people-count badges work at the role tier
- `leftEndpoint` rewritten from an area-only `deptAreaId` lookup to a general chain walk that anchors a wire at the nearest collapsed ancestor across area/department/role tiers — a strict generalization, not a parallel code path
- Search (`matchIds`) extended to role/person names, with auto-expand of `expandedDepts`/`expandedRoles` (not just `expandedAreas`) so a match is never hidden behind a collapsed twist
- `resolveEffectiveAccess(chain, grantsByUnit)` call, the D-11 comment, and the absence of `revokeGrant` all verified unchanged (pinned by both spec files)

## Task Commits

1. **Task 1: Full org ladder in the teams column** - `2de973f` (feat)
2. **Task 2: Repoint wiring-at-scale pins + flip teams-ladder spec** - `99ea710` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/components/admin/wiring/WiringPatchBay.tsx` - expandedDepts/expandedRoles state, renderDeptRow/renderRoleRow/renderPersonRow, generalized leftEndpoint, extended chains/peopleIndex/matchIds/isLeftId/focusLabel
- `src/styles/blueprint-theme.css` - `.jack.vacancy` dashed/inert styling (declared tokens only: `--ink-300`)
- `tests/phase32/wiring-at-scale.spec.ts` - repointed the one stale pin (leftEndpoint body line changed with the generalization)
- `tests/phase33/teams-ladder.spec.ts` - flipped live from Wave-0 `test.fixme` stub to real source-contract assertions; runtime browser check kept as an honest `test.fixme` (Railway-only UAT convention)

## Decisions Made
- Generalized `leftEndpoint` via the existing `chains` map instead of adding a second `deptRoleId`/`roleAreaId`-style lookup map — the chain already encodes the full root-to-leaf ancestry, so a single root-first walk that stops at the first collapsed tier is both correct (nothing below a collapsed ancestor is ever rendered, so the walk order can't produce a mismatched anchor) and shorter than three near-duplicate special cases.
- Kept vacancy rows as a distinct render branch inside `renderPersonRow` (returns early, no `onClick`, no `ref`) rather than rendering a normal jack with a disabled click handler — matches the plan's "no id to grant" framing literally: there is nothing to register as a node or wire endpoint for a slot with no person id.

## Deviations from Plan

None — plan executed exactly as written. The two updated file comments (module header's WIRE-UP bullet, and the "Person-level jacks" doc comment) were stale-doc touch-ups within the same file already in scope, not scope additions.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SC-1 fully shipped: the teams column now mirrors `OrgTree` exactly, all five tiers are expandable/selectable/grantable via the existing `handleLeftClick`/`pending`/`createGrant` connect-mode mechanics — no new mechanics were needed.
- `npx tsc --noEmit` clean; `npx playwright test tests/phase32/wiring-at-scale.spec.ts tests/phase33/teams-ladder.spec.ts --project=phase32 --project=phase33` → 19 passed, 2 fixme (skipped) runtime smokes.
- Plan 33-05 (disjoint files, same wave) and downstream 33-07/08/09 can build on the full ladder without further WiringPatchBay teams-column changes.

## Self-Check: PASSED

- FOUND: src/components/admin/wiring/WiringPatchBay.tsx
- FOUND: src/styles/blueprint-theme.css
- FOUND: tests/phase32/wiring-at-scale.spec.ts
- FOUND: tests/phase33/teams-ladder.spec.ts
- FOUND commit: 2de973f
- FOUND commit: 99ea710

---
*Phase: 33-per-sop-access-granularity-wayfinder-builder-header*
*Completed: 2026-07-19*
