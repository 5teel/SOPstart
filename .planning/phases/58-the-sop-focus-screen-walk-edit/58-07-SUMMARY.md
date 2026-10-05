---
phase: 58-the-sop-focus-screen-walk-edit
plan: 07
subsystem: on-ramps
tags: [parse, focus-steps, convertSop, on-ramps, wizard]
requires: [58-02, 58-03]
provides:
  - "src/lib/sop/focus-write.ts: writeFocusStepsForSop(admin, { organisationId, sopId }) -> { count } | { error }"
  - "upload, AI prompt, video, restructure all land sop_focus_steps (source_key 'new:' + uuid); none writes layout_data or block junctions"
  - "blank wizard inserts the SOP row only (no sections)"
affects: [58-12, 58-13, 58-14, 58-16]
key-files:
  created:
    - src/lib/sop/focus-write.ts
  modified:
    - src/app/api/sops/parse/route.ts
    - src/app/api/sops/ai-prompt/route.ts
    - src/app/api/sops/transcribe/route.ts
    - src/app/api/sops/restructure/route.ts
    - src/actions/sops.ts
    - tests/phase58/parse-pipelines.spec.ts
    - tests/phase58/repoint-inventory.spec.ts
    - tests/integration/scp-parse-pipeline.test.ts
    - playwright.config.ts
  deleted:
    - src/lib/parsers/__tests__/parser-creates-junctions.test.ts
key-decisions:
  - "Stage keys written by the document route are parsing, drafting, structuring (then completed / failed): the plan's 'reading' and 'checking' are not STAGE_TO_PLAIN keys, so the real ones were used"
  - "scp-parse-pipeline.test.ts is repointed, not deleted (plan text), so its inventory row moved from delete/58-07 to repoint/58-16; 58-07 appended to LIVE_PLANS"
  - "A conversion that yields zero steps fails the job, same as a gate failure (T-58-15)"
requirements-completed: []
completed: 2026-10-05
---

# Phase 58 Plan 07: On-ramps write focus steps Summary

**Upload, AI prompt, video and restructure now call `convertSop()` in-process through one writer and land `sop_focus_steps` with native keys before the job completes; nothing writes the block layout any more, and the blank wizard creates the SOP row alone.**

WRK-03 / FOC-02 are not ticked: the editor that reads these rows lands in 58-12/13 and the deployed eval proves them.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | `8988b4f2` | `focus-write.ts`; four routes repointed |
| 2 | `125d2f03` | blank wizard, trio-pinning tests, parse-pipelines spec, inventory |

## Routes changed

| Route | Change |
|---|---|
| `api/sops/parse` | layout converter, junction materialiser, provenance context and `layout_data` write removed (also their imports and `PARSER_VERSION`); `writeFocusStepsForSop` after the sections/steps/images inserts, before `completed`; failed job now also sets `current_stage: 'failed'` |
| `api/sops/ai-prompt` | layout + junction block removed; writer before `completed` |
| `api/sops/transcribe` | same; now clears the SOP's old sections first so a retry never duplicates |
| `api/sops/restructure` | same; clears old sections first (the plan said it already did; it did not) |

## Stage strings written (document route)

`parsing` (on start) -> `drafting` (before the model call) -> `structuring` (while focus steps are written) -> `completed`, or `failed`. All three working keys are `STAGE_TO_PLAIN` keys, asserted by the spec. The other routes already wrote their own stages and are unchanged.

## focus-write.ts

- Pins the SOP to the session organisation first (`sop_sections` / `sop_images` have no org column), then loads sections with steps and images exactly as the converter script does.
- Refuses (writes nothing) when `checkGate` fails or the conversion is empty; the route throws a plain "We couldn't turn this into steps." so the job is `failed`, never `completed` empty.
- Inserts in chunks of 500 with `source_key = 'new:' + uuid`, `run_id` null. Contains no `.delete(`.
- Rows path only in practice: these routes write no layout, so every section is read from its `sop_steps` rows; step images come from `sop_images.step_id`. Unattributed images stay in `sop_images` and are not attached to a step.

## Tests deleted / repointed

- **Deleted:** `src/lib/parsers/__tests__/parser-creates-junctions.test.ts` (its subject, junctions from the parser, is gone). The `phase21-unit` regex no longer names it. Side effect: its direct tests of `puckPropsToBlockContent` went with it; that module itself stays until 58-16.
- **Repointed:** `tests/integration/scp-parse-pipeline.test.ts` (SCP-PARSE-01 route half now asserts no `ProvenanceContext`; SCP-PARSE-05 route half asserts `writeFocusStepsForSop(` before `status: 'completed'` and no junction call). SCP-PARSE-02/03/04/06/07 untouched and green; the converter-module halves stay for 58-16.
- **Filled:** `tests/phase58/parse-pipelines.spec.ts`, 6 source-contract tests, no fixme.
- **Inventory:** the scp row changed to `repoint` / `58-16` (it still holds 58-16 tokens in its builder halves); `LIVE_PLANS` now `['58-07']`.
- Other hits of the layout grep (`phase26/*`, `sb-*`, `phase55/sop-pack`, `phase56/convert*`) test the converter or old builder modules, not these routes, and stay for 58-16.

## Verification

- `npx tsc --noEmit` clean; `npm run build` exit 0, bundle gates Δ 0 KB.
- Green: phase58 (75 passed, 45 skipped), phase56 `convert` (23), phase21-stubs 26, phase21-unit 9, phase26.5 42, phase57 117, phase11-stubs 19.
- Red, not from this plan (logged in `deferred-items.md`): phase26 `ai-overlay` (58-06's step-keyed flags; a 58-16 delete), phase25-integration `wizard-sop-dept` A4 (`__new__` literal gone from `SopMetadataFields.tsx` earlier), phase40 `dat01-category-column` (58-05 already logged).
- No OpenAI/Anthropic call was made.

## Freeze note (D-23)

SOPs created between this plan and 58-14 get focus steps but no `layout_data`, so they open EMPTY in the old builder (it reads only the layout) and open correctly in the new editor from 58-13. A blank-wizard SOP has no sections at all; the first section is added in the new editor ("Add a section", 58-12). The wizard form still collects section kinds; they are accepted and ignored until the wizard is reshaped.

## Deviations from Plan

**1. [Rule 1 - plan wrong about code] Stage names.** `reading` / `checking` are not `STAGE_TO_PLAIN` keys; used `parsing`, `drafting`, `structuring`.

**2. [Rule 1 - plan wrong about code] Restructure did not clear old sections.** The plan said it did. Without it, the writer would convert old and new sections together. Added the delete to restructure and transcribe.

**3. [Rule 3] Inventory row and `LIVE_PLANS`.** The Wave-0 inventory listed `scp-parse-pipeline.test.ts` as a 58-07 delete while the plan says repoint; row changed, and 58-07 added to `LIVE_PLANS` so the deleted junctions test passes the inventory's existence check.

**4. [Rule 2] Org pin in the writer, empty-result refusal, `kindIds` made optional** (the wizard still sends it but no longer needs a minimum of one).

## Known Stubs

None.

## Threat Flags

None beyond the plan's register: T-58-step-write (SOP pinned to the session org before any read or write), T-58-14 (text stored plain), T-58-converter (`new:` keys), T-58-15 (failed or empty conversion fails the job).

## Self-Check: PASSED

- `src/lib/sop/focus-write.ts` present; `parser-creates-junctions.test.ts` absent
- Commits `8988b4f2` and `125d2f03` exist
