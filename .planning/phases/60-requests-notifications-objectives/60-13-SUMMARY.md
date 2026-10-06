---
phase: 60-requests-notifications-objectives
plan: 13
subsystem: objectives-ui
tags: [objectives, lazy-modules, bundle-gate, shell, people-tab, evals]
requires: [60-09, 60-10, 60-12]
provides:
  - src/components/shell/ObjectiveLine.tsx (ObjectiveLine, useObjectives)
  - src/components/shell/ObjectiveSlot.tsx (lazy editor seam for admin surfaces)
  - src/components/shell/WorkerObjective.tsx (lazy worker line)
  - src/components/requests/ObjectiveEditor.tsx (set / change / confirm / two-step remove)
  - ShellFrame deptMeta slot; MachineBody / AdminMachineBody objective slot
affects: [60-14, 60-15, 60-16]
key-files:
  created:
    - src/components/shell/ObjectiveLine.tsx
    - src/components/shell/ObjectiveSlot.tsx
    - src/components/shell/WorkerObjective.tsx
    - src/components/requests/ObjectiveEditor.tsx
  modified:
    - src/components/sop/plant/MachinePanel.tsx
    - src/components/admin/governance/AdminMachinePanel.tsx
    - src/components/shell/ShellFrame.tsx
    - src/components/shell/WorkerShell.tsx
    - src/components/shell/AdminShell.tsx
    - src/components/office/PeopleTab.tsx
    - scripts/check-bundle-size.ts
    - tests/phase60/objective-meta.spec.ts
    - tests/lint/no-static-admin-lens-import.spec.ts
    - tests/evals/requests.eval.ts
key-decisions:
  - "The worker's objective line is its own next/dynamic chunk (WorkerObjective), not a static import: the static line plus its read cost the home route +3.9 KB (/page 838 against 834, Δ +4, over the ±2 gate). Diffing the summed file list against a build without the worker-side edits showed the whole delta was the app/page segment chunk (45226 to 49097 bytes), real code and not chunk churn, so the line moved behind a lazy seam"
  - "The editor seam is React.lazy + Suspense (ObjectiveSlot), not next/dynamic: next/dynamic's loading component receives no props, so it cannot show the plain line while the editor chunk loads. It is still a dynamic import with no static importer, and the lint allow-list pins ObjectiveEditor: []"
  - "useObjectives (one useQuery on OBJECTIVES_KEY, 5 min stale) lives in ObjectiveLine.tsx; the worker, admin shell and People row all read it, so one fetch serves all"
  - "Person subject id is the member's user_id (the core resolves person against organisation_members.user_id)"
requirements-completed: []
completed: 2026-10-06
---

# Phase 60 Plan 13: Objectives UI Summary

An objective now shows as one quiet 11 px mono line ("Objective · text · by 12 Nov · set by Jane", with agent and Unconfirmed chips for an agent-set one) under the machine name on both panels, under the department name, and as a second line on each People row; admins and safety managers set, change, confirm and remove it in place from a lazy editor, and workers see the line only.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | a28c01b7 | ObjectiveLine (+ useObjectives), ObjectiveEditor, ObjectiveSlot, component cases in objective-meta spec |
| 2 | 24c23770 | slots and placements, WorkerObjective lazy line, `By (optional)` markers, lint allow-list, placement cases, eval case |

## Placements

- **Machine, worker:** `MachineBody` `objective` slot under the `h2` (`mb-3`); WorkerShell passes a dynamic `WorkerObjective` (static line only).
- **Machine, admin:** `AdminMachineBody` `objective` slot; AdminShell passes `ObjectiveSlot` (`Set an objective`, dashed).
- **Department:** `ShellFrame` `deptMeta?(deptId)` under the department `h2` (`mt-1`); no router, no new `setPlace(` or `replaceState` (phase57 shell-structure green). Worker: `WorkerObjective`; admin: `ObjectiveSlot`.
- **Person:** People row second line (`data-testid="people-objective"`), `+ Objective` text style, `min-h-9`.

## Bundle

- Marker `By (optional)` added to both gated route groups; "Marker self-validation OK".
- Build 1 and build 2 identical: `/sops/[sopId]/page` 794 KB (baseline 792, Δ +2, unchanged since 60-11), `/page` 834 KB (baseline 834, Δ 0). `.bundle-baseline.json` untouched.
- First attempt (static line in the home route): `/page` 838, Δ +4, gate red. Dump of the summed file list before and after (worker-side edits reverted for the "before") differed only in `app/page-*.js` (+3871 bytes) and the webpack hash chunk; fixed by the lazy `WorkerObjective`, not by touching a baseline.

## Eval

`requests.eval.ts` 60-13 case authored and `--list`ed only (not run): admin sets a machine objective with a date and sees the receipt, opens Change (`60-objective-editor`), an agent write through `/api/ai-fields/write` (`objective.machine`, `SOPstart assistant`) reads `data-agent="true"` / `data-confirmed="false"` with both chips, Confirm gives the receipt and one `objective_confirmed` ledger row (`60-objective-meta`), department objective (`60-objective-meta-dept`), person objective on the People row with two-step remove (`60-objective-meta-person`), worker sees the line with no controls. Rows are cleaned in the existing afterAll.

## Results

`npx tsc --noEmit` clean; `npm run build` x2 exit 0. phase60 147 passed (29 skipped, later plans), phase52 72, phase54 59, phase57 116, phase59 146, phase15-stubs 46 plus the lint allow-list run (8), all green. No live probes; no full suite.

## Deviations from Plan

**1. [Rule 3 - Blocking] Worker line is lazy.** The plan wired a static `ObjectiveLine` into WorkerShell; that broke the `/page` gate (+4 KB). Moved behind `next/dynamic` (`WorkerObjective`), the fallback the phase anticipated. Consequence: on a worker's machine or department panel the line appears once its small chunk and the objectives query land, not on first paint.

**2. [Rule 3] Editor seam uses React.lazy + Suspense** rather than `next/dynamic` (see key-decisions); the specs assert the dynamic import and no static importer, and the lint allow-list gains `ObjectiveEditor: []`.

**3. `xl:col-span-12` on the People second line dropped:** the line sits inside the row wrapper, not the 12-column grid, so the class did nothing.

**4. Journeys:** `journeys.ts` not touched; the objective flows are covered by the 60-16 journeys / UAT task.

## Known Stubs

None.

## Threat Flags

None beyond the register: T-60-56 (editor mounted only in AdminShell and the People tab; the 60-09 core re-checks the role), T-60-57 (set-by words come from `listObjectives`), T-60-58 (editor behind a lazy import, marker on both routes, baselines untouched).

## Self-Check: PASSED

Four component files and this summary exist; commits a28c01b7 and 24c23770 exist. Not pushed, per instruction. STATE.md and ROADMAP.md untouched.
