---
phase: 58-the-sop-focus-screen-walk-edit
plan: 04
subsystem: server-actions
tags: [server-actions, guards, ledger, focus-steps, step-images]
requires: [58-02, 58-03]
provides:
  - "requireSopEditAccess({ stepId }) locator arm"
  - "src/lib/sop/focus-read.ts: loadFocusSop + FocusSop types"
  - "src/lib/sop/editable.ts: editableSop (draft-only rule shared by focus-steps and sections)"
  - "src/actions/focus-steps.ts (13 exports), src/actions/findings.ts (clearFinding)"
  - "decision-writer entries for tickFocusStep, untickFocusStep, clearFinding"
affects: [58-05, 58-06, 58-12, 58-13]
key-files:
  created:
    - src/lib/sop/focus-read.ts
    - src/lib/sop/editable.ts
    - src/actions/focus-steps.ts
    - src/actions/findings.ts
  modified:
    - src/lib/auth/guards.ts
    - src/actions/sections.ts
    - scripts/decision-writers.json
    - tests/phase56/decision-writers-sweep.spec.ts
    - tests/phase58/edit-actions.spec.ts
key-decisions:
  - "editableSop lives in a plain module (not a private helper) because sections.ts needs the same rule and a 'use server' file cannot export a helper"
  - "removeStepImage deletes the sop_images row and storage object only for paths this editor uploaded for that step; parser-owned or shared paths are unlinked from the step only"
  - "addFocusStep inserts a blank step (text '') and renumbers the section so sort_order has no ties"
requirements-completed: []
completed: 2026-10-05
---

# Phase 58 Plan 04: Editor server surface Summary

**Every editor write over `sop_focus_steps` is now a guarded, session-org-scoped, draft-only server action; ticks and finding clears are admin-only and land in the ledger.**

Requirement ids FOC-02 and WRK-04 are not ticked: no UI calls these actions yet (58-12/13) and the deployed eval is what proves them.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 (and the tick/objective/image actions written in the same file) | `5a212038` | `{ stepId }` guard arm, `loadFocusSop`, `focus-steps.ts`, section draft checks |
| 2 | `1b1db17e` | `findings.ts`, decision-writer entries and LIVE_WRITERS |
| 3 | `bd0b4166` | `edit-actions` spec (12 live tests) |

Task 1 and the non-ledger part of Task 2/3 were written as one file, so `focus-steps.ts` landed in the first commit; the sweep stayed green at every commit because its discovery is keyed on the JSON.

## Exports and guards

| Export | File | Guard | Notes |
|---|---|---|---|
| `getFocusSop(sopId)` | focus-steps | `requireSopEditAccess({ sopId })` | `loadFocusSop` through the session client |
| `updateFocusStep` | focus-steps | `requireSopEditAccess({ stepId })` | text, kind, tip, photoRequired; draft only |
| `addFocusStep` | focus-steps | `requireSopEditAccess({ sectionId })` | blank step, section renumbered |
| `deleteFocusStep` | focus-steps | `requireSopEditAccess({ stepId })` | draft only |
| `moveFocusStep` | focus-steps | `requireSopEditAccess({ stepId })` | swap within section, renumber |
| `deleteFocusSection` | focus-steps | `requireSopEditAccess({ sectionId })` | pinned by `sop_id` (`sop_sections` has no org column); steps cascade |
| `tickFocusStep` / `untickFocusStep` | focus-steps | `requireAdminContext()` | step looked up by session org; ledger `verify` / `verify_withdrawn` after the write |
| `setSopObjective` | focus-steps | `requireSopEditAccess({ sopId })` | trim, empty to null, max 500, draft only |
| `setAllowForwardJump` | focus-steps | `requireAdminContext()` | draft only |
| `getStepImageUploadUrl` | focus-steps | `requireSopEditAccess({ stepId })` | server-chosen path, jpg/png |
| `attachStepImage` | focus-steps | `requireSopEditAccess({ stepId })` | prefix rebuilt from session org + SOP + step, UUID file, object must exist; `sop_images` row first |
| `removeStepImage` | focus-steps | `requireSopEditAccess({ stepId })` | see deviation 2 |
| `clearFinding` | findings | `requireAdminContext()` | finding by id AND session org AND uncleared; ledger `ai_finding_cleared` after the write |

No schema carries an organisation, user or agent field (pinned by the spec).

## Guard specs repointed

None needed: no existing spec pinned the locator list. `phase46` (30 tests, including the live approver probes), `phase56 decision-writers-sweep` (27) and `phase15-stubs no-bulk-verify-ui` all pass.

## Verification

- `npx tsc --noEmit` clean; `npm run build` exit 0, bundle gates unchanged (`/sops/[sopId]` 795 KB, `/` 831 KB, delta 0).
- `phase58` project: 59 passed, 55 skipped (other plans' stubs).

## Deviations from Plan

**1. [Rule 3] `editableSop` is a plain module, not a private helper.** `sections.ts` must apply the same rule and cannot import a function from a `'use server'` file; `src/lib/sop/editable.ts` takes the session org as a parameter.

**2. [Rule 2 - safety] `removeStepImage` only deletes the file and `sop_images` row for editor-uploaded paths** (under `{org}/{sop}/steps/{step}/`). A parser-owned path, or one another step or the old reading model still points at, is unlinked from the step but its file stays. The plan said always delete; that would risk breaking images the old page still reads until 58-16.

**3. [Rule 2] `attachStepImage` also checks the uploaded object exists** (storage `list`) before recording it, so `image_paths` never points at an upload that did not finish.

**4. Live block is a documented fixme.** The real actions read the session from request cookies, which Playwright cannot supply; the non-approver and foreign-org outcomes are for the deployed evals (58-12/13/18). The database half is already covered by `focus-rls-live`.

**5. Behaviour change to flag.** `updateSectionTitle` now refuses non-draft SOPs (plan task 1). The AI-field title registration calls it; on a published SOP it will return the "Published" message until the next version's draft is opened. This matches D-11; the builder that hosted that flow is retired in 58-16.

## Known Stubs

None. `addFocusStep` creates a step with empty text by design; the editor (58-12) puts the cursor in it, and `updateFocusStep` refuses an empty text, so a blank step can only be saved by being typed into.

## Threat Flags

None beyond the plan's register (T-58-step-write, T-58-gate, T-58-finding, T-58-objective, T-58-05, T-58-06, T-58-07), each asserted in `edit-actions.spec.ts`.

## Self-Check: PASSED

- Files present: focus-read.ts, editable.ts, focus-steps.ts, findings.ts, edit-actions spec
- Commits `5a212038`, `1b1db17e`, `bd0b4166` exist
