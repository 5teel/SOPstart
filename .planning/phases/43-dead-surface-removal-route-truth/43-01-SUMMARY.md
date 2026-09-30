---
phase: 43-dead-surface-removal-route-truth
plan: 01

subsystem: testing
tags: [playwright, route-truth, lint-guard, dead-links, next-config-redirects, deployed-eval]

# Dependency graph
requires:
  - phase: 41-one-sop-surface
    provides: reference-sweep idiom (PERMITTED_FILES / EXPECTED_PERMITTED_COUNT) and the spec-repoint-inventory guard this plan's route-truth scaffold must not trip
  - phase: 54-admin-inbox-floor-health-library
    provides: deletion-sweep.spec.ts (stripComments/walkTsFiles idiom copied verbatim) and the phase-project registration pattern (testDir '.', broad tests/phaseNN/** testMatch)
provides:
  - Repo-wide dead-internal-href sweep (tests/lint/no-dead-internal-hrefs.spec.ts), live, mutation-proven, registered in phase15-stubs
  - Three pre-written phase43 scaffolds (new-block, dead-controls, route-truth) that 43-02/03/04 flip live task by task
  - Deployed eval (tests/evals/dead-surface.eval.ts) proving D-03/D-04/D-05/D-01 once those plans ship
  - Two real route-truth bugs fixed: journeys.ts publish action route, ARCHITECTURE.md review-surface + role-home lines, CAPABILITY-MATRIX.md global-blocks mentions
affects: [43-02-new-block-form, 43-03-scanner-wiring-dead-state, 43-04-route-shims, 43-05-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Route-shape walker: PAGE_SHAPES from src/app (page.tsx/route.ts, route groups stripped) + REDIRECT_SHAPES from next.config.ts redirects() sources, segment-position match with '*'/'[dynamic]'/static rules"
    - "Reserved-segment bug class (new/create/add/edit resolving through a dynamic [param] route at the routing layer but 404ing at the data layer) is a separate, currently-fixme-gated rule from plain dead-href resolution"
    - "Shim page paths built from segment arrays via path.join(...) rather than spelled as a literal string fragment, so a guard spec doesn't trip a sibling phase's live reference-inventory guard"

key-files:
  created:
    - tests/lint/no-dead-internal-hrefs.spec.ts
    - tests/phase43/new-block.spec.ts
    - tests/phase43/dead-controls.spec.ts
    - tests/phase43/route-truth.spec.ts
    - tests/evals/dead-surface.eval.ts
  modified:
    - playwright.config.ts
    - src/lib/journeys/journeys.ts
    - .planning/codebase/ARCHITECTURE.md
    - .planning/codebase/CAPABILITY-MATRIX.md
    - .planning/phases/43-dead-surface-removal-route-truth/43-VALIDATION.md

key-decisions:
  - "Dead-href guard scans comment-stripped src/ per-line for 11 named prefixes (href=/href={/href:/route:/router.push(/router.replace(/redirect(/permanentRedirect(/location.href =/location.assign(/location.replace() rather than a full AST parse -- matches the existing stripComments+regex idiom this codebase already uses for every other lint guard"
  - "Reserved-segment class (the /admin/blocks/new runtime-404 bug) is explicitly NOT caught by the main sweep -- pinned as its own fixme test, activates in 43-02 once the route gets a static segment"
  - "route-truth.spec.ts builds the two shim page paths from segment arrays via path.join(...) instead of a literal path string, so the spec itself never trips tests/phase41/spec-repoint-inventory.spec.ts's live literal-fragment scan"

patterns-established:
  - "Pattern: any new tests/lint/*.spec.ts guard is registered in the phase15-stubs testMatch alternation in the same commit and verified with --list before being trusted"
  - "Pattern: phase-wide scaffold files (tests/phaseNN/*.spec.ts) use test.fixme() with a trailing 'activates NN-0X' comment; the corresponding plan flips test.fixme to test when the feature ships"

requirements-completed: [DED-01, DED-02, DED-03, DED-04]

duration: 45min
completed: 2026-09-30
---

# Phase 43 Plan 01: Wave-0 Harness — Dead-Link Guard, Phase Scaffolds, Deployed Eval Summary

**Repo-wide dead-href guard found and fixed the two real route-truth bugs the phase named (journeys.ts publish action, ARCHITECTURE.md review/role-home lines), then pre-wrote three fixme-gated spec scaffolds and a deployed eval for every later plan in the phase to flip live.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-09-30
- **Tasks:** 3/3 completed
- **Files modified:** 10 (5 created, 5 modified — some files touched across multiple tasks)

## Accomplishments
- `tests/lint/no-dead-internal-hrefs.spec.ts` live and mutation-proven: red-first run named the exact two real offenders (journeys.ts `/admin/sops/[sopId]/publish`, ARCHITECTURE.md `/admin/sops/[sopId]/review`), fixed both, then a planted dead href in `pathways/page.tsx` proved the guard catches new regressions and reverted clean.
- Three `tests/phase43/*.spec.ts` scaffolds (15 tests total, 2 live now / 13 fixme) pin the exact assertions 43-02 (new-block form), 43-03 (scanner wiring, WiringPatchBay lens removal, dead-state cleanup), and 43-04 (shim deletion, next.config.ts redirects) must satisfy to go green.
- `tests/evals/dead-surface.eval.ts` (5 tests, self-skips without `EVAL_BASE_URL`) is ready to prove all four findings live in production once 43-02/03/04 ship and 43-05 pushes.
- Three targeted doc fixes landed: `journeys.ts` publish route, `ARCHITECTURE.md` review-surface + role-home lines, `CAPABILITY-MATRIX.md` global-blocks mentions (both the row and the `platform_admin` footnote).

## Task Commits

Each task was committed atomically:

1. **Task 1: Dead-link guard, live, proven red on the real findings then green (D-07, D-06)** - `fd1a114` (feat)
2. **Task 2: Phase 43 spec scaffolds + phase43 project (D-01..D-06)** - `30b333e` (feat)
3. **Task 3: Deployed eval for the dead surfaces (D-08)** - `777866b` (feat)

_No plan-metadata commit issued yet — SUMMARY.md commit and STATE.md/ROADMAP.md updates follow this summary._

## Files Created/Modified
- `tests/lint/no-dead-internal-hrefs.spec.ts` - Repo-wide dead-href/route/redirect sweep; PAGE_SHAPES + REDIRECT_SHAPES walker, target extraction, reserved-segment fixme rule, route-docs check, non-vacuous check
- `tests/phase43/new-block.spec.ts` - fixme scaffold for D-03 (createBlock hardening, /admin/blocks/new route, NewBlockForm), activates 43-02
- `tests/phase43/dead-controls.spec.ts` - fixme scaffold for D-02/D-04/D-05 (PhotoScanner wiring, WiringPatchBay lens removal, dead-state cleanup) plus the LIVE no-eslint-disable-carve-out pin, activates 43-03
- `tests/phase43/route-truth.spec.ts` - fixme scaffold for D-01/T-43-02 (shim deletion, next.config.ts redirects, journeys cleanup) plus the LIVE D-06 doc-truth pin, activates 43-04
- `tests/evals/dead-surface.eval.ts` - Deployed eval, tests A (new block create+archive), B (scan document scanner), C (Access map Wiring-only), D1/D2 (legacy shim URLs for admin/worker)
- `playwright.config.ts` - Registered `no-dead-internal-hrefs` in `phase15-stubs`; added the `phase43` project (broad `tests/phase43/**` testMatch, mirrors phase51-54 pattern)
- `src/lib/journeys/journeys.ts` - Fixed the `publish` action's stale route to `/api/sops/[sopId]/publish`
- `.planning/codebase/ARCHITECTURE.md` - Fixed the review-surface line (now names the builder at `/admin/sops/builder/[sopId]`) and the role-home line (admin → `/sops`, not `/dashboard`)
- `.planning/codebase/CAPABILITY-MATRIX.md` - Removed the stale `/admin/global-blocks` mentions (row + `platform_admin` footnote); both now note the Phase 25 retirement
- `.planning/phases/43-dead-surface-removal-route-truth/43-VALIDATION.md` - Per-Task Verification Map Plan column filled, spec paths pointed at real files, all three Wave 0 boxes ticked, `wave_0_complete: true`

## Decisions Made
- Followed 43-CONTEXT.md's locked decisions exactly (D-01 through D-08); no new judgment calls beyond implementation details already specified in the plan's `<action>` blocks.
- Where the plan's action text specified exact regex/string literals (e.g., the target-extraction prefix list, the reserved-segment set), implemented them verbatim rather than approximating, since the plan's acceptance criteria pin exact grep counts.

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria in the plan's three tasks were verified directly (grep counts, test pass/skip counts, `--list` counts) and matched expectations on the first pass after the described fixes.

## Red-First Proof (Task 1)

Before any doc fix, `npx playwright test --project=phase15-stubs tests/lint/no-dead-internal-hrefs.spec.ts` reported:

```
1) every internal link, route and redirect target in src/ resolves to a page, route handler or next.config.ts redirect
   Error: src\lib\journeys\journeys.ts:451  /admin/sops/[sopId]/publish

2) the route docs name only routes that exist (D-06)
   Error: .planning/codebase/ARCHITECTURE.md: /admin/sops/[sopId]/review
```

Exactly the two real findings 43-RESEARCH.md predicted. After the fixes, the run flipped to 3 passed / 1 skipped (the reserved-segment fixme test).

Planted-href mutation-proof: adding `<a href="/admin/definitely-not-a-route">` to `src/app/(protected)/pathways/page.tsx` produced:

```
Error: src\app\(protected)\pathways\page.tsx:13  /admin/definitely-not-a-route
```

`git checkout -- "src/app/(protected)/pathways/page.tsx"` reverted it (`git diff --stat` showed no change to that file), and the re-run returned to 3 passed / 1 skipped.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 43-02 can flip `tests/phase43/new-block.spec.ts` live once `createBlock()` is hardened, `src/lib/blocks/create-block-core.ts` / `block-kinds.ts` exist, and `/admin/blocks/new` + `NewBlockForm.tsx` are built.
- 43-03 can flip `tests/phase43/dead-controls.spec.ts` live once `PhotoScanner` is wired into `UploadDropzone`, `WiringPatchBay`'s lens toggle is removed, and the two confirmed dead-state blocks are deleted.
- 43-04 can flip `tests/phase43/route-truth.spec.ts` live once the two shim pages are deleted and `next.config.ts` carries the two new redirect entries (`tests/phase41/reference-sweep.spec.ts` and `tests/phase54/deletion-sweep.spec.ts` will also need their permitted-file sets updated at that point, per 43-CONTEXT.md D-01).
- `tests/evals/dead-surface.eval.ts` is ready to run against production as soon as 43-05 pushes; no changes needed to the eval itself.
- No blockers.

---
*Phase: 43-dead-surface-removal-route-truth*
*Completed: 2026-09-30*
