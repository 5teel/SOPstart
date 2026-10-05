---
phase: 58-the-sop-focus-screen-walk-edit
plan: 18
subsystem: testing
tags: [eval, playwright, deployed-eval, validation, sign-off]
requires:
  - phase: 58-01..58-17
    provides: the focus screen, walk, editor, versions, parsing view and annotation, all pushed at 5119898c
provides:
  - deployed eval 60/60 against sopstart.com at 9a43d0bf with every 58-* screenshot read
  - post-retirement converter sweep recorded in 58-CUTOVER.md (zero SOPs needed steps)
  - 58-VALIDATION.md signed off; FOC-01..04, SOP-04, WRK-03, WRK-04 ticked
affects: [phase-59, verification]
tech-stack:
  added: []
  patterns:
    - "fixture guards key on their own source_key marker, not on 'any rows exist'"
key-files:
  created: [.planning/phases/58-the-sop-focus-screen-walk-edit/58-EVAL.md, .planning/phases/58-the-sop-focus-screen-walk-edit/58-18-SUMMARY.md]
  modified: [scripts/eval-fixtures.mjs, tests/evals/sop-focus.eval.ts, tests/evals/sop-ledger.eval.ts, tests/evals/cut-features.eval.ts, tests/evals/governance.eval.ts, tests/evals/one-screen.eval.ts, tests/evals/lib/completion-cleanup.ts, tests/integration/wizard-sop-dept.spec.ts, .planning/phases/58-the-sop-focus-screen-walk-edit/58-CUTOVER.md, .planning/phases/58-the-sop-focus-screen-walk-edit/58-VALIDATION.md, .planning/REQUIREMENTS.md, CLAUDE.md]
key-decisions:
  - "No Phase 58 product code changed in this plan: every red in the first deployed runs was fixture or eval code"
  - "Esc-to-place is pinned by the 58-10 source-contract spec (useFocusBack); the deployed eval proves Back and Esc closing a dialog first, not a bare Esc leaving the screen"
patterns-established:
  - "Run a plan's eval case against the deployed site as soon as the plan lands; a batch at the end costs six whole-suite runs and the OTP budget"
requirements-completed: [FOC-01, FOC-02, FOC-03, FOC-04, WRK-03, WRK-04, SOP-04]
duration: ~2h 20m
completed: 2026-10-05
---

# Phase 58 Plan 18: Deployed proof and sign-off Summary

**Deployed eval 60/60 on sopstart.com at `9a43d0bf` (all 18 phase-58 cases, no `test.fixme`), every `58-*` screenshot read, build and full suite green, validation signed off and the seven Phase 58 requirements ticked.**

## Performance

- **Duration:** about 2h 20m (most of it six ~10 minute whole-suite eval runs)
- **Completed:** 2026-10-05
- **Tasks:** 2
- **Files modified:** 12 (no `src/` change)

## Accomplishments

- Post-retirement sweep (`58-CUTOVER.md`): default dry run planned 0 inserts / 0 updates / 0 deletes over 92 SOPs; `--missing --all` reported `0 converted / 56 unchanged / 0 failed / 31 native left alone / 5 still parsing` (run `da4322c4`). Nothing needed steps; the SOPs still without steps are the empty shells already named in the cutover record, none published.
- Deployed eval run 6 (HEAD `9a43d0bf`, served by Railway): 60 passed / 0 failed / 0 skipped. Covers SC1 frame and compiled CSS, SC2 walk twice in one session, resume, jump-ahead, SC3 editor / findings / publish dialog / blank / this-SOP, SC4 parsing, parsing video and parse failed, SC5 addresses, superseded and phone, the SOP-04 new-version publish with a worker landing on v2 and v1 kept, and `58-annotate` (the `stage.toBlob` CORS risk from 58-17 did not materialise: Save baked the marks).
- All 25 `58-*` screenshots read and noted per shot in `58-EVAL.md`; no rendering defect found.
- `npm run build` exit 0 (bundle gate: `/sops/[sopId]` 792 KB = baseline, `/` 831 KB = baseline, editor in its own lazy chunk, Konva and source-viewer isolation ok, marker self-validation ok). Full `npm run test` once: 1928 passed, 205 skipped, 7 failed (see Issues for how each was closed).
- `58-VALIDATION.md` closed (`nyquist_compliant: true`, `wave_0_complete: true`, `status: complete`, approval line); REQUIREMENTS.md ticks FOC-01, FOC-02, FOC-03, FOC-04, SOP-04, WRK-03, WRK-04 (7 lines match the acceptance grep); `/pathways` journeys name `/sops/[sopId]` for browse, walk, edit, parsing and no deleted route.
- One CLAUDE.md Learnings entry (fixture guard keyed on "any rows", `\?` in template-literal `RegExp`, run-id filter, cleanup FK, assumptions contradicting the shipped design, OTP burn).

## Task Commits

1. **Task 1 (eval repairs; the run itself writes no code)** - `9a43d0bf` (test) - fixtures and eval assertions repaired; pushed.
2. **Task 2 (sign-off artefacts)** - docs commit with this SUMMARY, 58-EVAL.md, 58-CUTOVER.md, 58-VALIDATION.md, REQUIREMENTS.md, CLAUDE.md and the repointed `wizard-sop-dept` guard.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Walk fixture frozen at the converter's 2-step copy**
- **Found during:** Task 1, run 1
- **Issue:** `scripts/eval-fixtures.mjs` wrote the 5 walk steps "only when none exist"; the 58-14 converter had already created 2 steps from the Phase 55 rows, so the walk eval and `cut-features` waited for a hazard step that did not exist.
- **Fix:** guard on its own `new:eval-walk-hazard` key; replaces the converter copy once.
- **Files:** `scripts/eval-fixtures.mjs`

**2. [Rule 1 - Bug] Fixture AI findings had no `run_id`**
- **Issue:** `GET /ai-reviewer` returns a cleared row only for the newest run; a run-less fixture row vanished on Clear, so the "Cleared" line never showed.
- **Fix:** fixed fixture run id on insert and on drift repair. Product behaviour left as is (real findings always carry a run id).

**3. [Rule 1 - Bug] Four sibling assertions used `\?` in a template-literal `RegExp`**
- **Files:** `cut-features.eval.ts`, `governance.eval.ts` (2), `one-screen.eval.ts` - now `\\?`.

**4. [Rule 3 - Blocking] Completion cleanup knew nothing of walk signatures**
- **Issue:** `sop_completion_signatures` FK blocked `deleteEvalCompletions`, failing the next eval's `beforeAll`.
- **Fix:** delete signatures first (`tests/evals/lib/completion-cleanup.ts`).

**5. [Rule 1 - Bug] Evals asserting behaviour the design contradicts**
- SOP-04: a forked draft carries ticks (58-08), so the eval now ticks whatever is still unchecked instead of requiring a box. Ledger B: hazard/PPE come first in source order, so it asserts the group, not hazards-then-PPE. Focus SC5: `getByText` hit the rail row and the card (`.first()`). Ledger A: editor-native `EVAL focus` fixtures never get a conversion run (excluded by title, null-safe). `58-back-place` now waits for the machine's panel before the shot.

**6. [Rule 1 - Bug] Stale guard `wizard-sop-dept` A4**
- Pre-existing red from `deferred-items.md`; the `__new__` sentinel moved to `SopMetadataDialog.tsx` in an earlier refactor. Repointed (one line), 14/14 green.

**Total deviations:** 6 groups, all test/fixture code. **Impact:** none on product behaviour; the product passed as built.

## Issues Encountered

- Full suite: 7 failures. Six `phase46` live probes failed only with `verifyOtp failed: Request rate limit reached` (the six eval runs had spent the OTP budget); re-run once after the window reset: `phase46` 30/30. The seventh was the stale A4 guard above. No other failures, so the earlier `deferred-items.md` reds (phase11/12.5 old-builder specs, `ai-overlay`, `visual-block`, etc.) were closed by the 58-15 / 58-16 retirements.
- Esc leaving the screen (FOC-03 "Back or Esc") is proven by the Back click in the eval and the `useFocusBack` source-contract spec, not by a deployed bare-Esc case; the eval only presses Esc to close a dialog first. Ticked because the Esc handler is the same `goBack` the eval exercises; flagged here in case a bare-Esc case is wanted later.
- Eval `58-annotate`'s photo is the eval fixture scene (grey boxes), not a real photo; it proves the draw / save / bake path, not how marks look over a real step photo.

## Known Stubs

None.

## Threat Flags

None. T-58-27: fixture script and evals refuse the real org id (unchanged, `deleteEvalCompletions` refuses it). T-58-converter: `--missing` wrote nothing. T-58-28: screenshots read per shot, suite failures listed with causes.

## Self-Check: PASSED

- 58-EVAL.md, 58-CUTOVER.md, 58-VALIDATION.md, this SUMMARY exist; `grep -c "test.fixme" tests/evals/sop-focus.eval.ts` = 0; `nyquist_compliant: true` present; 7 requirement lines ticked.
- Commit `9a43d0bf` exists on master and was pushed; Railway served it (`/api/version`).
- STATE.md and ROADMAP.md untouched.
