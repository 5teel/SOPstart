---
phase: 35-competency-classifier-training-matrix-records
plan: 03
subsystem: training-matrix-ui
tags: [training-matrix, person-panel, csv-export, team-view, playwright]

dependency-graph:
  requires:
    - phase: 35-01
      provides: classifyCompetency, buildMatrix, generateTrainingCsv
    - phase: 35-02
      provides: getTrainingMatrix / getTrainingRecordForPerson / exportTrainingCsv server actions, StatePill, MatrixFiltersSchema/CsvExportFiltersSchema
  provides:
    - "TrainingMatrixView — third /admin/team view mode (matrix table + rollups + MTX-03 filters + D-16 export)"
    - "TrainingRecordSection — PersonPanel's per-worker training record (TRN-01)"
    - "downloadCsv (src/lib/competency/download-csv.ts) — shared client Blob-download helper"
    - "TeamViewShell 'matrix' view + focusSopId wiring"
  affects: [35-04 (worker /profile CompetencySection consumes getMyCompetencyStates), pathways/uat config]

tech-stack:
  added: []
  patterns:
    - "Fit-driven progressive compaction via ResizeObserver + measured column-width constant, not a hardcoded column-count threshold (D-07)"
    - "Two independent fetch effects (unfiltered option lists vs filtered matrix cut) so MTX-03 filter dropdowns never shrink to match the current selection"
    - "Shared downloadCsv() Blob helper forked verbatim from FlowGraphCanvas's PNG-export idiom — one generator, two entry points (D-16)"
    - "render-time prevPersonId reset idiom (react-hooks/set-state-in-effect) reused from PersonPanel for TrainingRecordSection"

key-files:
  created:
    - src/components/admin/competency/TrainingMatrixView.tsx
    - src/components/admin/competency/TrainingRecordSection.tsx
    - src/lib/competency/download-csv.ts
    - tests/phase35/training-matrix-view.spec.ts
    - tests/phase35/matrix-filters.spec.ts
    - tests/phase35/training-record.spec.ts
  modified:
    - src/components/admin/org-model/TeamViewShell.tsx
    - src/components/admin/org-model/PersonPanel.tsx
    - src/lib/journeys/journeys.ts
    - src/lib/uat/tests.ts

decisions:
  - "Compaction threshold computed from a ResizeObserver-measured container width divided by an estimated pill column width (COLUMN_WIDTH_PX), never a hardcoded column-count integer (RESEARCH Pitfall 5)"
  - "Matrix filter dropdown option lists (allPeople/allSops) come from a separate unfiltered per-department fetch, independent of the filtered matrix-cut fetch, so choosing a worker/SOP filter never removes other options from the dropdowns"
  - "'Awaiting sign-off' vs 'Read only' distinction (from 35-01/35-02) rendered directly via the existing StatePill component in both the matrix cell and the training-record SOP-block header — no second pill implementation"
  - "Export CSV buttons render inline with no disabled state and no loading-gate beyond a plain 'Exporting…' label swap — CMP-04 requires the control stay passive regardless of competency state, and it does (loading state is a UX affordance, not a competency-keyed gate)"

requirements-completed: [MTX-01, MTX-03, TRN-01, TRN-02, CMP-01]

duration: ~50min
completed: 2026-07-24
---

# Phase 35 Plan 03: Training Matrix + Records UI + CSV Export Summary

Built the primary v7.0 admin deliverable: the training matrix as a third `/admin/team` view mode and the per-worker training record inside `PersonPanel`, wired so a matrix cell click deep-links into the panel at the right SOP, and both surfaces stream `exportTrainingCsv()` output to a real CSV file download.

## What Was Built

**`src/components/admin/competency/TrainingMatrixView.tsx`** — Department-first matrix table (D-06: `departments[0]` default, no whole-org-at-once default) rendering `StatePill` per (person, required-SOP) cell, both-axis rollups (`N/M competent` per person, `N/M signed off` per SOP, with needs-support counts surfaced), and MTX-03 department/worker/SOP filter `<select>`s. Two independent fetch effects: one unfiltered per-department call populates the worker/SOP filter dropdown option lists, a second re-fetches the actual matrix on every department/worker/SOP change. Progressive compaction (D-07) measures the scroll container's width via `ResizeObserver` and divides by an estimated column-width constant (`COLUMN_WIDTH_PX`) to decide when to switch labelled pills for compact colored dots + a legend — no hardcoded column-count threshold. Every cell is a plain `<button onClick={() => onSelectCell(person.id, sop.id)}>` with zero `disabled=` anywhere (CMP-04). Native `<input type="date">` × 2 feed the D-16 completion-date range into the header's Export CSV button, whose handler calls `exportTrainingCsv({ departmentId, workerId, sopId, dateFrom, dateTo })` then `downloadCsv(result.csv, result.filename)` on success (surfacing `result.error` inline, no download, on failure).

**`src/components/admin/competency/TrainingRecordSection.tsx`** — PersonPanel's per-worker training record (TRN-01). One block per required SOP (D-12) headed by a `StatePill`, with completions (version + date + sign-off chain) and observations rendered as two separate lists beneath — deliberately not a merged flat timeline. A distinct "Other completed SOPs" section (D-13) renders completions outside the person's required set. `focusSopId` scrolls/highlights the matching block on open via a ref map + `scrollIntoView`. Resets on `personId` change using the render-time `prevPersonId` idiom (mirrors `PersonPanel`'s existing pattern, avoiding `react-hooks/set-state-in-effect`). Header carries its own Export CSV button calling `exportTrainingCsv({ workerId: personId })` then `downloadCsv()`.

**`src/lib/competency/download-csv.ts`** — `downloadCsv(csv, filename)`, a one-function client module forking the `FlowGraphCanvas` PNG-export idiom verbatim (`Blob` → `document.createElement('a')` → `URL.createObjectURL` → `.click()` → `URL.revokeObjectURL`). Both export entry points import this single helper — no duplicated Blob logic.

**`src/components/admin/org-model/TeamViewShell.tsx`** (modified) — View union extended to `'chart' | 'columns' | 'matrix'`, `VIEW_OPTIONS` gains `{ value: 'matrix', label: '▦ Matrix' }`. New `focusSopId` state; `handleSelectCell` resolves the clicked person's display name/role from the already-loaded `OrgTree` (via a new `personLabelFromTree` helper mirroring `OrgColumnsBoard`'s tree-walk) and sets both `selectedPerson` and `focusSopId`; both reset together when the panel closes.

**`src/components/admin/org-model/PersonPanel.tsx`** (modified) — `PersonPanelProps` gains `focusSopId?: string | null`; the Phase-35 growth-point comment is replaced with `<TrainingRecordSection personId={person.id} focusSopId={focusSopId} />` as a third section sibling of the Record CTA and Observation history.

**`journeys.ts` / `uat/tests.ts`** — New `training-matrix-records` journey (persona Supervisor/Admin) covering the matrix toggle → cell click → PersonPanel record → CSV export flow, plus a step referencing the worker `/profile` "My competency" section (lands in Plan 04; route already covered by other journeys so `/pathways` shows 0 not-mapped). Three layman UAT items added under "Phase 35 — Training matrix & records": matrix visibility, cell-click deep-link, CSV export/columns.

## Verification

- `npx playwright test --project=phase35` — 53 passed, 5 skipped (the 4 staged `test.fixme` RLS runtime probes from 35-02 + the `CompetencySection.tsx` guard skip pending Plan 04) — zero failures
- `npx playwright test --project=phase35-unit` — 17 passed
- `npx tsc --noEmit` — clean
- `npm run build` — compiled successfully; `/sops/[sopId]` worker bundle Δ +1 KB (1057 KB vs 1056 KB baseline, within ±2 KB tolerance) — competency/matrix code is admin-route-only, worker bundle stays effectively flat
- `npx playwright test --project=phase32 tests/phase32/org-chart-build.spec.ts` — 12 passed, 1 skipped (no regressions from the `TeamViewShell`/`PersonPanel` prop changes)

## Deviations from Plan

None — plan executed as written across all four tasks. Both original Task 1/2 import-assertion tests were updated in Task 4 to match the augmented import lines (`getTrainingMatrix, exportTrainingCsv` / `getTrainingRecordForPerson, exportTrainingCsv, type TrainingRecord`) — this is the exact extension the plan's Task 4 `<action>` specified for those two spec files, not an unplanned deviation.

## Known Stubs

None. Every rendered surface is wired to a real server action; no hardcoded empty arrays, no placeholder text, no unwired data sources.

## Threat Flags

None beyond the plan's own `<threat_model>` register — no new network endpoints, auth paths, or schema changes were introduced. All reads/writes route through the existing 35-02 role-gated, org-self-enforced server actions; the CSV download is a passive client-side Blob save over an already-authorized string response, not a new route.

## Self-Check: PASSED

- FOUND: src/components/admin/competency/TrainingMatrixView.tsx
- FOUND: src/components/admin/competency/TrainingRecordSection.tsx
- FOUND: src/lib/competency/download-csv.ts
- FOUND: tests/phase35/training-matrix-view.spec.ts
- FOUND: tests/phase35/matrix-filters.spec.ts
- FOUND: tests/phase35/training-record.spec.ts
- FOUND: src/components/admin/org-model/TeamViewShell.tsx (modified)
- FOUND: src/components/admin/org-model/PersonPanel.tsx (modified)
- FOUND commit faf80d2 (Task 1)
- FOUND commit 61fa545 (Task 2)
- FOUND commit 8fc813e (Task 3)
- FOUND commit d02c213 (Task 4)

---
*Phase: 35-competency-classifier-training-matrix-records*
*Completed: 2026-07-24*
