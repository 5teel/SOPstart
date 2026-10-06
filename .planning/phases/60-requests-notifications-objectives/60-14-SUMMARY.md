---
phase: 60-requests-notifications-objectives
plan: 14
subsystem: sop-objective
tags: [objectives, focus-read, browse, this-sop, bundle-gate, retirement]
requires: [60-09, 60-12, 60-13]
provides:
  - FocusSop.objective as ObjectiveView | null read from objectives (lineage root)
  - ObjectiveLine in the browse summary card; lazy "Make a request" on live SOPs
  - This SOP objective row on the shared lazy editor
affects: [60-15, 60-16, 60-17]
key-files:
  modified:
    - src/lib/sop/focus-read.ts
    - src/components/focus/BrowseDocument.tsx
    - src/components/focus/admin/ThisSopBlock.tsx
    - src/actions/focus-steps.ts
    - src/actions/versions.ts
    - tests/phase58/edit-actions.spec.ts
    - tests/phase58/edit-rail.spec.ts
    - tests/phase58/fork-draft.spec.ts
    - tests/phase58/frame-structure.spec.ts
    - tests/phase46/sop-edit-guard-wiring.spec.ts
    - tests/phase40/dat01-category-column.spec.ts
    - tests/phase60/objective-meta.spec.ts
    - tests/phase60/retirement-sweep.spec.ts
    - tests/phase60/repoint-inventory.spec.ts
    - tests/evals/requests.eval.ts
key-decisions:
  - "FocusSop.objective sits beside sop (not inside FocusSopMeta): the meta type is the sops row, and the column is no longer read from it"
  - "Set-by words use setByWords(label, null): SOP surfaces never show an email"
  - "This SOP reuses ObjectiveSlot (React.lazy seam from 60-13) rather than a second dynamic wrapper; the editor stays a lazy chunk with no static importer"
requirements-completed: []
completed: 2026-10-06
---

# Phase 60 Plan 14: SOP Objective Summary

The SOP objective now lives only in the `objectives` table (keyed on the lineage root): `loadFocusSop` reads it with the session client, the browse summary card shows it as the quiet `ObjectiveLine`, This SOP edits it with the shared lazy editor in any SOP state, and the old column writer and the fork copy are gone. A worker can raise a change-a-SOP or observe-me request from the browse summary card of a live SOP.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | see git log | `focus-read` reads `objectives`; `BrowseDocument` line and lazy "Make a request"; frame-structure allows the two objective files from shell |
| 2 | see git log | This SOP row; `setSopObjective` and `objectiveSchema` deleted; `forkDraft` stops copying the column; pins repointed; eval case |

## Read repoint

- `focus-read.ts`: `objective` dropped from the `sops` select; one `objectives` read (`subject_type = 'sop'`, `subject_id = lineageRoot(sop)`) in the existing `Promise.all`; set-by label via `userLabels` only when a person set it.
- Every importer of `focus-read` in `src/components` uses a type-only import.

## Deletions

- `setSopObjective` and `objectiveSchema` (focus-steps.ts); the `objective:` copy in `forkDraft` (versions.ts). The column is not dropped.
- `grep -rn setSopObjective src tests` returns lines under `tests/phase60/` only.

## Repointed pins

- phase58 `edit-actions` (export list, guard and 500-cap cases replaced by "written through setObjective, no focus-steps writer"), `edit-rail` (ObjectiveSlot, "Set an objective"), `fork-draft` (`objective` joins the skip-list of columns not copied), `frame-structure` (a focus file may import `shell/ObjectiveLine` and `shell/ObjectiveSlot`, nothing else from shell).
- phase46 `sop-edit-guard-wiring` (name removed from the guarded list).
- phase40 `dat01-category-column`: write-site count 41 -> 40 and the exemption row for the deleted writer removed (same-commit repoint of the tripwire).
- phase60: `objective-meta` browse cases live, `retirement-sweep` 60-14 block live, `'60-14'` appended to `LIVE_PLANS`.

## Bundle

- Build 1 and build 2 identical: `/sops/[sopId]/page` 794 KB (baseline 792, Δ +2, unchanged since 60-11), `/page` 834 KB (Δ 0). Marker self-validation OK. `.bundle-baseline.json` untouched. The static `ObjectiveLine` import in browse was measured first and cost nothing past the existing edge, so no extra lazy seam was added.

## Eval

`requests.eval.ts` 60-14 case authored and `--list`ed only (not run): admin sets the SOP objective from This SOP (`60-sop-objective-rail`); worker sees the line in `focus-summary`, opens "Make a request" (`60-composer`), sends an observe-me request with a run-id note, then starts walking and asserts no request trigger in the walk state. Rows are cleaned by the existing afterAll.

## Results

`npx tsc --noEmit` clean; `npm run build` x2 exit 0. phase60, phase58, phase55, phase15-stubs (572 passed, 38 skipped for later plans), phase46 `sop-edit-guard-wiring` (7), phase40 `dat01-category-column` (6) all green. No live probes; no full suite.

## Deviations from Plan

**1. [Rule 3 - Blocking] frame-structure pin.** `tests/phase58/frame-structure.spec.ts` bans any `@/components/shell` import from focus files; the plan requires the shared line and editor seam there. Repointed to allow exactly those two files.

**2. [Rule 3 - Blocking] dat01 write-site tripwire.** Deleting the writer drops one `sops` write site (41 -> 40) and its exemption row; updated with a dated note, per that spec's convention.

**3. Task 1 commit is not tsc-green on its own:** the code that stops reading `sop.objective` in `ThisSopBlock` belongs to task 2, so only the task 2 commit onward type-checks.

**4. Journeys / UAT config not touched:** no route added or moved.

## Known Stubs

None.

## Threat Flags

None beyond the register: T-60-59 (session client under `objectives_read_org`, lineage root of a SOP the session already reads), T-60-60 (editor mounted for admins only; the 60-09 core re-checks the role), T-60-61 (writer deleted; the retirement sweep asserts no `src/` write of the column).

## Self-Check: PASSED

Modified files exist; build and specs green as listed. Not pushed, per instruction. STATE.md and ROADMAP.md untouched.
