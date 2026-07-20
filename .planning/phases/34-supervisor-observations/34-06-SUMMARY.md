---
phase: 34-supervisor-observations
plan: 06
subsystem: frontend
tags: [react, client-component, org-model, blueprint-ui, observations]

requires:
  - phase: 34-supervisor-observations (34-04)
    provides: "src/actions/observations.ts — listObservationsForPerson, getObservationLabels, setObservationLabels"
  - phase: 34-supervisor-observations (34-05)
    provides: "RecordObservationModal, VerdictButtons, ObservationRow (src/components/observations/)"
provides:
  - "src/components/admin/org-model/PersonPanel.tsx — entry point A: person side panel (info + history + record CTA)"
  - "onSelectPerson prop on OrgChartCanvas / OrgColumnsBoard; selectedPerson state in TeamViewShell"
  - "src/components/admin/observations/ObservationLabelsCard.tsx — D-02 org verdict-label editor"
  - "Observation labels" CONFIG section on /admin/settings"
affects: [34-07, 34-08, 34-09, 35]

tech-stack:
  added: []
  patterns:
    - "React 'adjusting state when a prop changes' render-time pattern (prevPersonId useState, setState called conditionally during render) — reused from 34-05's RecordObservationModal to satisfy react-hooks/set-state-in-effect; the fetch effect's only setState calls live inside its Promise.all(...).then() callback"
    - "Section-list panel body (PersonPanel) — plain <section> blocks so Phase 35's per-worker training record can be appended without a rewrite (D-03 growth-point), no derived-state logic added this phase"

key-files:
  created:
    - src/components/admin/org-model/PersonPanel.tsx
    - src/components/admin/observations/ObservationLabelsCard.tsx
  modified:
    - src/components/admin/org-model/OrgChartCanvas.tsx
    - src/components/admin/org-model/OrgColumnsBoard.tsx
    - src/components/admin/org-model/TeamViewShell.tsx
    - src/app/(protected)/admin/settings/page.tsx

key-decisions:
  - "PersonPanel fetches on personId change (not a separate open flag) — TeamViewShell always mounts PersonPanel, so a person prop transition from null->person or person A->person B is the panel's 'open' moment; matches the plan's fetch-on-open requirement without an extra prop."
  - "Person-chip onClick gated on `!person.isVacancy && Boolean(person.id)` in both OrgChartCanvas and OrgColumnsBoard identically — vacancy chips (id: null) can never open the record flow, satisfying T-34-06-03."

requirements-completed: [OBS-01]

duration: ~20min
completed: 2026-07-20
---

# Phase 34 Plan 06: PersonPanel + Org-Chart Wiring + Verdict Labels Summary

**Shipped entry point A (D-03): clicking a named person in either org view opens a side panel with observation history and a worker-pre-filled "Record observation" CTA, plus the D-02 per-org verdict-label editor on /admin/settings — the primary "walk the floor" recording path.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-20
- **Tasks:** 3 completed
- **Files modified:** 6 (2 new, 4 modified)

## Accomplishments

- `PersonPanel` — a `'use client'` slide-over over both org views: header (name + role/dept line), an ink-900 "+ Record observation" CTA with "~30 seconds · worker pre-filled, just pick the SOP" caption, and an "Observation history" list of `ObservationRow`s (loading skeleton, "No observations yet" empty state, newest first). The CTA opens the shared `RecordObservationModal` with the worker pre-filled; `onRecorded` bumps a refresh key that re-fetches history. Body is a plain `<section>` list — the explicit growth point for Phase 35's per-worker training record.
- `OrgChartCanvas` and `OrgColumnsBoard` both accept an optional `onSelectPerson` prop and now fire it only for named (non-vacancy, non-null-id) person chips — vacancy chips get no `onClick` and no `cursor-pointer` class, staying inert. `TeamViewShell` owns `selectedPerson` state and mounts `PersonPanel` as a sibling of both views, so switching between Chart/Columns view keeps the panel behaviour identical.
- `ObservationLabelsCard` — two renamable text inputs (default "Performed to SOP" / "Needs support") wired to `setObservationLabels`, with a "display-only, canonical values unchanged" caption, inline success/error, and disabled-while-pending via `useTransition`. `/admin/settings/page.tsx` fetches `getObservationLabels()` alongside its existing `Promise.all` reads and renders the card in a new "Observation labels" CONFIG section, mirroring the existing "Approval chains" block shell.

## Task Commits

1. **Task 1: PersonPanel (info + observation history + record CTA)** — `b1b8620`
2. **Task 2: Wire person-chip clicks in both org views through TeamViewShell** — `4d2dd26`
3. **Task 3: Org verdict-label editor on /admin/settings (D-02)** — `3c6680c`

## Files Created/Modified

- `src/components/admin/org-model/PersonPanel.tsx` — new: side panel (info + history + record CTA)
- `src/components/admin/org-model/OrgChartCanvas.tsx` — modified: `onSelectPerson` prop, named-chip onClick
- `src/components/admin/org-model/OrgColumnsBoard.tsx` — modified: `onSelectPerson` prop, named-chip onClick
- `src/components/admin/org-model/TeamViewShell.tsx` — modified: `selectedPerson` state, mounts `PersonPanel`
- `src/components/admin/observations/ObservationLabelsCard.tsx` — new: D-02 label editor
- `src/app/(protected)/admin/settings/page.tsx` — modified: fetches `getObservationLabels()`, renders new CONFIG section

## Decisions Made

- See `key-decisions` in frontmatter.
- Reused the exact "adjusting state when a prop changes" pattern from 34-05's `RecordObservationModal` for `PersonPanel`'s history reset (tracked via `prevPersonId` useState, not a ref) — this codebase's ESLint config flags synchronous `setState` at the top of a `useEffect` body, and this pattern is already the established fix.
- Kept `PersonPanel`'s body to exactly the plan's three parts (header, CTA, history) with no derived-state logic, per the plan's explicit "keep it lean" instruction — the Phase 35 growth point is a comment + section-list shape, not scaffolding.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- `npx tsc --noEmit` clean (whole project).
- `npx eslint` clean for all 6 files.
- `npx playwright test --project=phase34` — 10 passed, 9 correctly skipped (runtime specs owned by 34-04/34-08/34-09, unaffected by this plan).
- `grep -rn -- "--brand-yellow"` in the two new files returns zero real references (only an explanatory code comment).
- Entry point A is fully live: named person -> side panel -> record with worker pre-filled, in both org views; vacancies inert; admins can rename verdict labels per org.
- No blockers for 34-07 (activity row action, entry point B), 34-08 (worker profile section), or 34-09.

---
*Phase: 34-supervisor-observations*
*Completed: 2026-07-20*
