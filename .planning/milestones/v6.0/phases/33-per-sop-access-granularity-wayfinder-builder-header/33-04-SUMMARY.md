---
phase: 33-per-sop-access-granularity-wayfinder-builder-header
plan: 04
subsystem: ui
tags: [react, nextjs, builder, css-tokens, playwright]

# Dependency graph
requires:
  - phase: 33-01
    provides: phase33 Playwright project + stub specs (tests/phase33/wayfinder-header.spec.ts)
provides:
  - Light Wayfinder header (back/here/forward zones) replacing the dark builder top bar
  - Single "Tools for this SOP ▾" menu absorbing 4 SOP-actions links + 2 flow-modal triggers + delete-draft
  - Inline forward-chip lock reason ("Locked — N steps below still need checking") + third amber pending-approval chip state
affects: [builder, phase29-approval-chains, phase30-plain-language]

# Tech tracking
tech-stack:
  added: []
  patterns: [wayfinder-3-zone-header, single-self-describing-menu, declared-css-tokens-only]

key-files:
  created: []
  modified:
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageStepper.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/OrientationStrip.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowButton.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowEditButton.tsx
    - tests/phase30/list-rows.spec.ts
    - tests/phase33/wayfinder-header.spec.ts
    - src/lib/journeys/journeys.ts
    - src/lib/uat/tests.ts

key-decisions:
  - "BuilderStageStepper repurposed as the forward-zone renderer: computes the single next-stage chip (one ordinal ahead of activeStage) instead of the old 3-chip breadcrumb row; chips array literal unchanged (keeps 6 zero-repoint pinned specs green)"
  - "Pending-approval (Phase 29) takes priority over the next-stage chip regardless of activeStage — the whole SOP is blocked on an external approver no matter which internal stage is being viewed"
  - "--brand-yellow is not a declared CSS custom property anywhere in src/ (confirmed by grep) — used with an explicit var(--brand-yellow, #fbbf24) fallback per the 2026-07-14 undefined-token learning, rather than referencing it bare"
  - "BuilderFlowButton/BuilderFlowEditButton trigger buttons restyled in place as menu rows (no state lifted) — both already portal their own modals and accept sop/sopId props"

requirements-completed: [SC-6]

# Metrics
duration: ~35min
completed: 2026-07-19
---

# Phase 33 Plan 04: Wayfinder Builder Header Summary

**Rebuilt the SOP builder's dark top bar as a light 3-zone "Wayfinder" header (back/here/forward) with an inline lock-reason forward chip and one self-describing "Tools for this SOP" menu, replacing the scattered SopActionsMenu + two flow-trigger buttons — zero repoints needed on 6 pinned spec files.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-19T03:06:34Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Light Wayfinder bar (white bg, `--ink-100` hairline dividers) with back / "YOU'RE {EDITING|CHECKING|SENDING}" / forward zones, no dark `#0a0a0b` bar left
- Forward chip carries its lock reason inline ("Locked — N steps below still need checking"), goes green when ready, and shows a third amber "Waiting for approval" state when a Phase 29 approval chain is pending — regardless of which internal stage is active
- ONE "Tools for this SOP ▾" menu holds all 7 locked-label items (assign, versions, video, QR, see-flow, edit-flow, delete-draft); `BuilderFlowButton`/`BuilderFlowEditButton` render as menu rows inside the popover with zero state lifted
- `tests/phase30/list-rows.spec.ts` repointed to the new locked labels in the same commit as the source change (stale-guard class avoided); `tests/phase33/wayfinder-header.spec.ts` flipped from `test.fixme` stub to live source-contract assertions
- `journeys.ts` build/review step descriptions mention the new header; `uat/tests.ts` gained a `p33-wayfinder-header` review entry

## Task Commits

1. **Task 1: Wayfinder bar + single Tools menu** - `546a734` (feat)
2. **Task 2: Repoint list-rows labels, flip wayfinder spec, journeys/uat** - `b659293` (test)

**Plan metadata:** (final metadata commit handled by orchestrator — worktree mode)

## Files Created/Modified
- `src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx` - header rebuilt as Wayfinder bar + tools row; `SopActionsMenu` → `ToolsMenu`
- `src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageStepper.tsx` - forward-zone renderer: single next-stage chip with inline lock reason + pending-approval state
- `src/app/(protected)/admin/sops/builder/[sopId]/OrientationStrip.tsx` - dedupe: no longer restates the unlock condition already on the forward chip
- `src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowButton.tsx` - trigger restyled as a menu row ("See the flow diagram")
- `src/app/(protected)/admin/sops/builder/[sopId]/BuilderFlowEditButton.tsx` - trigger restyled as a menu row ("Edit the flow diagram")
- `tests/phase30/list-rows.spec.ts` - repointed off the 4 old menu labels onto the new locked labels
- `tests/phase33/wayfinder-header.spec.ts` - flipped live: 6 real source-contract tests
- `src/lib/journeys/journeys.ts` - build/review step details mention the Wayfinder header + inline lock reason
- `src/lib/uat/tests.ts` - added `p33-wayfinder-header` entry

## Decisions Made
- Kept `BuilderStageStepper`'s `chips` array (with `stage: 'build'/'review'/'publish'` + `label: 'Edit'/'Check'/'Send to workers'` literals) exactly as before — satisfies `tests/phase30/plain-language.spec.ts` pins without needing the old 3-chip visual, since the forward-zone render just computes `chips.find(c => c.ordinal === activeOrdinal + 1)`.
- `--brand-yellow` is referenced with a fallback (`var(--brand-yellow, #fbbf24)`) rather than bare, since it is not declared in `src/styles/blueprint-theme.css` or anywhere else in `src/` (confirmed by grep before writing any CSS, per the 2026-07-14 CLAUDE.md learning) — the plan text listed it as "declared" but the live grep says otherwise; the fallback keeps `tests/lint/no-undefined-css-tokens.spec.ts` green either way.
- Pending-approval chip state takes priority over the next-stage chip at all times (not just when `activeStage === 'publish'`) since the block applies to the whole SOP, not a specific internal tab.

## Deviations from Plan

None — plan executed as written. The one factual correction (brand-yellow not being a declared token) was handled per the CLAUDE.md fallback guidance already baked into the plan's own read_first pointer ("prefer `var(--x, fallback)` at the callsite when in doubt"), not a deviation from instructions.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- SC-6 shipped; the Wayfinder header is live on every builder stage and unaffected by the access-granularity track (33-02/33-03/33-05+), which touches only `grants.ts`/`WiringPatchBay.tsx`.
- All 6 zero-repoint pinned spec files (`builder-review-flow`, `publish-stage-approval`, `sb-auth-builder`, `sb-builder-infrastructure`, `scp-source-viewer`, `scp-parse-pipeline`) verified green with no edits.
- `npx tsc --noEmit` clean; full phase30 + phase29 + builder + phase33 + phase24-stubs + phase15-stubs (lint) suites green (86 tests across the two verification runs).

---
*Phase: 33-per-sop-access-granularity-wayfinder-builder-header*
*Completed: 2026-07-19*
