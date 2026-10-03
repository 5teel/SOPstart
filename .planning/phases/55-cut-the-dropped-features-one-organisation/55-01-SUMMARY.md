---
phase: 55-cut-the-dropped-features-one-organisation
plan: 01
subsystem: testing
tags: [playwright, deletion-guard, eval-fixtures, bundle-baseline, dropped-list]

requires:
  - phase: 54-admin-inbox-floor-library
    provides: deletion-sweep idiom (stripComments / walk / SELF exclusion)
provides:
  - scripts/dropped-features.json (127 entries, 13 features) - Phase 62 build-guard input
  - phase55 Playwright project with deletion-sweep, worker-path-contract, org-single specs
  - Eval walk fixture SOP + deleteEvalCompletions + cut-features eval skeleton
  - Pre-phase failure baseline and pre-phase bundle numbers
affects: [55-02..55-14, 62-build-guard]

tech-stack:
  added: []
  patterns:
    - "Dropped list as data (JSON) read by a per-feature fixme-gated sweep; each deleting plan appends its key to LIVE_FEATURES"

key-files:
  created:
    - scripts/dropped-features.json
    - tests/phase55/deletion-sweep.spec.ts
    - tests/phase55/worker-path-contract.spec.ts
    - tests/phase55/org-single.spec.ts
    - tests/evals/cut-features.eval.ts
    - tests/evals/lib/completion-cleanup.ts
    - .planning/phases/55-cut-the-dropped-features-one-organisation/55-BASELINE-FAILURES.md
  modified:
    - playwright.config.ts
    - tests/lint/no-dead-internal-hrefs.spec.ts
    - scripts/eval-fixtures.mjs
    - tests/evals/lib/session.ts
    - .gitignore
    - .planning/phases/55-cut-the-dropped-features-one-organisation/55-VALIDATION.md

key-decisions:
  - "Sweep scans comment-stripped src/ and tests/; this spec, tests/phase55/ and cut-features.eval.ts are excluded"
  - "Walk fixture SOP is unassigned and on no machine so plant-home pins and Now card never see it"

patterns-established:
  - "Per-feature describe: test.fixme(!LIVE_FEATURES.includes(feature)) then files-gone, src refs, tests refs, AI model keys, journeys routes"

requirements-completed: [CUT-01, CUT-02, ORG-01]

duration: ~40min
completed: 2026-10-03
---

# Phase 55 Plan 01: Wave 0 guards, dropped list and before-numbers Summary

**Data-driven dropped-features list (127 entries, 13 features) with a per-feature file-and-reference deletion sweep, the worker-path and one-org contracts, a dedicated walk eval fixture, and the recorded pre-phase failure and bundle baselines.**

## Performance

- **Tasks:** 3/3
- **Files:** 6 created + 6 modified; no `src/` file changed (`git diff 0f3e89f HEAD -- src` is empty)

## Accomplishments

- `scripts/dropped-features.json`: 127 entries (routes, API paths, files, dirs, symbol patterns, 8 packages, 6 AI model keys, 2 jobs) plus an allow list for the colour token and the inert voice-note block type.
- `tests/phase55/deletion-sweep.spec.ts`: each feature fixme until its plan flips it; live now are 24 tests (survivor list for D-01..D-05 and the inert block contracts, and a not-vacuous check). `PACKAGES_LIVE` gates the uninstall check for 55-13.
- `worker-path-contract.spec.ts` (6 fixme blocks for 55-02/55-03/55-09) and `org-single.spec.ts` (D-06 no browser `auth.signUp(` and D-02 invitation channel live now; 55-12 blocks fixme).
- Walk fixture: "Eval walk fixture SOP" (published, unassigned, no machine, step 2 `photo_required`), created in the eval-site org and verified idempotent on a second run. `deleteEvalCompletions` refuses the real org.
- Before-numbers: `/sops/[sopId]/page` = **1045 KB**, `/sops/page` = **936 KB** (baseline file 1048 / 940, untouched). Full suite once: 1911 passed, 24 failed (8 live OTP in phase46, 16 stale non-live), 339 skipped.

## Task Commits

1. Task 1 - dropped list + sweep + phase55 project + href floors: `8e98fcb`
2. Task 2 - contracts, walk fixture, cleanup helper, eval skeleton: `81c6764`
3. Task 3 - baselines, gitignore, validation: `473c473`

## Pattern narrowing (Task 1)

Every `ref` and `pattern` was run against today's `src/` and `tests/`; all hits sit in files this phase deletes, or in kept files that the RESEARCH Section 2 / Section 9 table already names for surgical edit. Two items needed a decision:

- **Narrowed:** the library symbol `addBlockToSection` matched a log message in the KEPT parser (`parsed-sop-to-layout-data.ts:819`, plus its kept test). The pattern now uses a negative lookahead so the phrase "addBlockToSection failed" is not matched.
- **Found, not in the Section 2 table:** `youtubeUrlSchema` and the "That doesn't look like a YouTube URL" message in `src/lib/validators/sop.ts` (the YouTube route's validator). The youtube sweep will flag it; 55-07 must delete it with the route.

## Mutation proof (guards are not vacuous)

- Sweep: set `org-signup` and `library` live; files-gone, src-reference, tests-reference (library) and journeys blocks went red with the real offending lines, while the clean `tests/ has no reference` for org-signup stayed green. Reverted.
- D-06: planted `supabase.auth.signUp({})` in a temp src file, the spec went red, file removed, green.

## Deviations from Plan

None - plan executed as written. The walk fixture's `sop_steps` insert includes `time_estimate_minutes: 1` (mirrors the plant fixture's step shape); no assignment or machine link was added.

## Deferred / hand-offs

- Railway cron / Shotstack dashboard check for callers of `recover-renders` and the video routes (VALIDATION manual-only row) cannot be derived from the repo; owner is 55-08.
- 55-VALIDATION "Validation Sign-Off" and `nyquist_compliant` left for the verifier.

## Known Stubs

None. The `fixme` bodies in `cut-features.eval.ts` are intentional scaffold, authored in 55-03 and 55-14.

## Self-Check: PASSED

- Files created: all 7 present; commits `8e98fcb`, `81c6764`, `473c473` exist.
- `npx playwright test --project=phase55`: 26 passed, 83 skipped; `npx tsc --noEmit` clean; `--list --project=evals` shows 6 `cut-features` tests.
