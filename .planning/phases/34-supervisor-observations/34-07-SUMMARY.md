---
phase: 34-supervisor-observations
plan: 07
subsystem: frontend
tags: [react, client-component, activity, observations]

requires:
  - phase: 34-supervisor-observations (34-04)
    provides: "src/actions/observations.ts — recordObservation, getObservationLabels, listWorkerSopsForPicker"
  - phase: 34-supervisor-observations (34-05)
    provides: "src/components/observations/RecordObservationModal.tsx — shared recording modal"
provides:
  - "Entry point B (D-03): header 'Record observation' button + per-completion 'I observed this' row action on /activity"
affects: []

tech-stack:
  added: []
  patterns:
    - "stopPropagation()/preventDefault() on an inner button inside a full-row <Link> (CLAUDE.md StepPhotoZone precedent) — prevents the row action from also navigating to the completion detail page"
    - "Lightweight inline worker-picker dropdown built from data already in state (workerOptions) instead of a new worker-search component — ladder rung 2/6"

key-files:
  created: []
  modified:
    - src/components/activity/CompletionSummaryCard.tsx
    - src/app/(protected)/activity/SupervisorActivityView.tsx

key-decisions:
  - "Header button opens a small anchored dropdown listing the view's existing workerOptions (already computed from loaded completions) rather than building a new worker-search surface — per the plan's own ponytail note to reuse workerOptions/sopOptions already in state. Selecting a worker opens RecordObservationModal with no presetSopId/presetCompletionId, so the modal's own SOP picker (listWorkerSopsForPicker) handles that."
  - "CompletionSummaryCard now requires a sopId prop (previously not passed at all) so the row action can pre-fill it into the observe context; SupervisorActivityView threads completion.sop_id through."

requirements-completed: [OBS-01]

duration: ~10min
completed: 2026-07-20
---

# Phase 34 Plan 07: Activity Entry Point B (header button + row action) Summary

**Wired the supervisor `/activity` view's two Entry Point B affordances — a header "Record observation" button (worker-picker dropdown) and a per-completion "I observed this" row action (worker+SOP+completion pre-filled) — both opening the shared `RecordObservationModal` from 34-05, with the row action never triggering the row's own navigation to the completion detail page.**

## Performance

- **Duration:** ~10 min
- **Completed:** 2026-07-20
- **Tasks:** 2 completed
- **Files modified:** 2 (no new files)

## Accomplishments

- `CompletionSummaryCard` gained an optional `onObserve` prop plus a required `sopId` prop. When `onObserve` is supplied, an outline `--accent-ok` "👁 I observed this" button renders inside the row; its click handler calls `e.stopPropagation(); e.preventDefault();` before invoking `onObserve({ workerId, workerName, sopId, sopTitle, completionId })`, so the parent `<Link href="/activity/[id]">` navigation never fires. The button is omitted entirely when `onObserve` is not passed, so any other consumer of this card (currently none) is unaffected.
- `SupervisorActivityView` now imports and hosts one `RecordObservationModal`, driven by a single `observe: { worker, presetSopId?, presetCompletionId? } | null` state slot. The header "＋ Record observation" button (ink-900 primary, next to the "Activity" heading) toggles a small anchored dropdown listing the view's already-computed `workerOptions`; picking a worker opens the modal with no SOP/completion preset (the modal's own picker handles SOP selection). Each `CompletionSummaryCard`'s `onObserve` callback sets `observe` with `presetSopId`/`presetCompletionId` from that row's completion (D-11 free link).

## Task Commits

1. **Task 1: 'I observed this' row action on CompletionSummaryCard** — `e6f4bce`
2. **Task 2: Header button + shared modal host in SupervisorActivityView** — `b86ea41`

## Files Created/Modified

- `src/components/activity/CompletionSummaryCard.tsx` — `sopId` + `onObserve` props, row-action button with stopPropagation/preventDefault guard
- `src/app/(protected)/activity/SupervisorActivityView.tsx` — `observe` state, header button + worker-picker dropdown, `RecordObservationModal` host, `sopId`/`onObserve` wired into each card

## Decisions Made

- See `key-decisions` in frontmatter.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- `npx tsc --noEmit` clean.
- `npx eslint` on both modified files: 0 errors (one pre-existing unrelated `_role` unused-var warning).
- `npx playwright test --project=phase34`: 10 passed, 9 correctly skipped (runtime specs owned by other plans) — no regressions.
- `grep -q stopPropagation src/components/activity/CompletionSummaryCard.tsx` passes.
- Entry point B is live: header button (manual worker pick) + per-completion row action (pre-filled, no navigation bleed).
- No blockers for downstream plans.

---
*Phase: 34-supervisor-observations*
*Completed: 2026-07-20*
