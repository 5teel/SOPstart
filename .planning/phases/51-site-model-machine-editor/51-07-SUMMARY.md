---
phase: 51-site-model-machine-editor
plan: 07
subsystem: testing
tags: [playwright, deployed-eval, konva, supabase, site-model]

requires:
  - phase: 51-01..51-06
    provides: site model schema, RLS, server actions, Konva editor, /admin/site route, builder machine picker
provides:
  - Live deployed-site eval (tests/evals/site-editor.eval.ts) proving ROADMAP success criterion 5 end-to-end on https://sopstart.com
  - Third isolated eval fixture org "SOPstart Eval Site" + eval-site-admin account, so the eval can safely reset a site before every run
  - Phase 51 final gate: full suite compared against baseline, build/bundle gate, deployed eval, screenshots read, validation sign-off
affects: [52-worker-site-home, 53-machine-qr-scanning, 54-admin-inbox]

tech-stack:
  added: []
  patterns:
    - "Eval fixture isolation: a feature whose eval must destructively reset state gets its OWN org/account, never the shared eval-admin/eval-worker org"
    - "Scene-pixel -> screen-pixel mapping for Konva evals: read data-scale/data-x/data-y off the canvas element, compute screen = box + (x,y) + scenePt*scale"

key-files:
  created:
    - tests/evals/site-editor.eval.ts
  modified:
    - tests/evals/lib/session.ts
    - scripts/eval-fixtures.mjs
    - .planning/phases/51-site-model-machine-editor/51-VALIDATION.md
    - .planning/phases/51-site-model-machine-editor/51-EVAL.md

key-decisions:
  - "Eval-only org "SOPstart Eval Site" with its own admin fixture (eval-site-admin@sopstart.com), never the shared SOPstart eval org, so the eval's destructive per-run site reset can never touch Simon's real site map (D-15, T-51-07-A)."
  - "Bounded shot()'s waitForLoadState('networkidle') to an explicit 5s timeout — Playwright's default is unbounded and relies entirely on the outer test timeout, so an un-idle page silently eats the whole test budget."
  - "test.setTimeout(600_000) and a CREATE_SLOW=60s constant on every save-triggering wait, as headroom for the occasional slow production save round-trip observed during debugging."

requirements-completed: [SIT-02, SIT-03, SIT-04]

duration: ~2h20m
completed: 2026-09-28
---

# Phase 51 Plan 07: Final gate — deployed eval, full-suite comparison, sign-off Summary

**Authored the live site-editor deployed eval against an isolated eval-only org, ran every phase gate, pushed, and got all 12 deployed evals (including both new site-editor tests) passing against https://sopstart.com at commit 1c415d7 — proving ROADMAP success criteria 2-5 end-to-end.**

## Performance

- **Duration:** ~2h 20m (most of it re-running the deployed eval while debugging two eval-script bugs found live)
- **Completed:** 2026-09-28
- **Tasks:** 2/2 completed
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Wrote `tests/evals/site-editor.eval.ts`: upload a fixture scene, draw two polygons (the second after zoom+pan), name them, tag a department, drag a corner, link/unlink a SOP from both the editor panel and the builder's Tools menu, reload, and prove via a service-role DB read that stored polygons are scene-pixel and independent of zoom/pan (D-02) — plus a worker-redirect test.
- Added a third eval fixture — `eval-site-admin@sopstart.com`, admin of an isolated "SOPstart Eval Site" org — to `session.ts` and `scripts/eval-fixtures.mjs`, so the eval's per-run destructive site reset can never touch the real SOPstart org (hard-asserted in the eval's `beforeAll`).
- Ran every phase-51 gate in order: `tsc`, `phase51`/`phase26`/`phase15-stubs` projects (288 passed), the full suite once (16 pre-existing baseline failures reproduced exactly, plus transient Supabase Auth OTP rate-limit failures on `phase46` live probes — expected per `51-BASELINE-FAILURES.md`'s own Wave-2 note), `npm run build` with the bundle gate green and `.bundle-baseline.json` unchanged since `736f44a`.
- Pushed to `origin master`, ran `node scripts/eval-fixtures.mjs`, then `npm run eval -- --phase 51` against the live Railway deploy — found and fixed two real bugs in the eval script itself (see Deviations), then got **12/12 deployed evals green**, read all three required screenshots (no visual defects), and signed off `51-VALIDATION.md`.

## Task Commits

1. **Task 1: Eval-site fixture org and the live site-editor eval** - `cf9d1e1` (feat)
2. **Task 2 fix: correct eval bugs found running live** - `1c415d7` (fix)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `tests/evals/site-editor.eval.ts` - live deployed eval for SIT-02/03/04 (2 tests)
- `tests/evals/lib/session.ts` - added `siteAdmin` to `EVAL_USERS`, exported `EVAL_SITE_ORG_NAME`/`EVAL_SITE_SOP_TITLE`/`EVAL_SITE_DEPARTMENT`
- `scripts/eval-fixtures.mjs` - idempotently provisions the eval-site org, admin, department, fixture SOP
- `.planning/phases/51-site-model-machine-editor/51-VALIDATION.md` - all 16 task rows signed green, sign-off complete, `nyquist_compliant: true`
- `.planning/phases/51-site-model-machine-editor/51-EVAL.md` - eval report (auto-written by `scripts/run-evals.mjs`)

## Decisions Made

- The eval-site org's admin fixture and reset logic follow the plan's D-15 discretion note verbatim — no deviation from what was scoped.
- Kept the generous `CREATE_SLOW`/`test.setTimeout` margins even after finding the real root cause (see Known Issue below) as reasonable headroom, rather than tightening them back down, since the final passing run still completed in well under a minute.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `shot()`'s `waitForLoadState('networkidle')` had no bounded timeout**
- **Found during:** Task 2, first live eval run — the test hung for the full 300s test timeout and died inside the helper copied verbatim from `sop-surface.eval.ts`.
- **Issue:** `page.waitForLoadState('networkidle')` has no timeout of its own by default; it silently consumes the entire remaining test budget on any page that never truly reaches network-idle, and the `.catch(() => {})` swallows the eventual "context closed" error rather than a clean timeout.
- **Fix:** Added an explicit `{ timeout: 5_000 }` to the call in `site-editor.eval.ts`'s copy of `shot()` (not touched in `sop-surface.eval.ts`, which hasn't hit this in practice).
- **Files modified:** `tests/evals/site-editor.eval.ts`
- **Verification:** eval progressed past the empty-state screenshot on the next run.
- **Committed in:** `1c415d7`

**2. [Rule 1 - Bug] `site-machine-sops-toggle` was queried as a descendant of the row button, but it is a sibling**
- **Found during:** Task 2, subsequent live eval runs — every attempt (across three iterations of raising the timeout from 300s to 1,500,000ms) hung at the exact same `pressRow.getByTestId('site-machine-sops-toggle').click()` line, always consuming the entire test budget regardless of how large it was made.
- **Issue:** In `SiteWorkspace.tsx`, `site-machine-sops-toggle` is a sibling `<button>` of the `site-machine-row` button inside the same card `<div>`, not a descendant of it. `pressRow.getByTestId(...)` therefore always resolved to zero elements, and Playwright's `.click()` silently polls (rather than failing fast) until the outer test timeout kills it. This was misdiagnosed for several iterations as production save latency (raising `test.setTimeout` from 300s → 480s → 900s → 1,500,000ms, none of which helped, since the click was never going to resolve regardless of budget) before a diagnostic script with click-by-click state checks (see below) isolated the real cause.
- **Fix:** Scoped through the parent card via `pressRow.locator('..').getByTestId('site-machine-sops-toggle')`.
- **Files modified:** `tests/evals/site-editor.eval.ts`
- **Verification:** the very next run passed 12/12 in 41.7s (down from 25+ minute timeouts), proving the underlying app flow was correct all along and the earlier failures were purely a test-script bug.
- **Committed in:** `1c415d7`

**Diagnostic method:** a throwaway `scripts/_scratch_debug_draw.mts` (deleted before commit, never part of any commit) used `playwright-core`'s raw `chromium.launch()` API to sign in as the eval-site-admin fixture, upload the fixture scene, and click each polygon corner one at a time with `machine-row` count logging after each click plus a 5s post-close wait — this is what revealed the close/create step was actually succeeding (just slowly on some runs) and pointed at the final toggle-click as the true hang point, rather than an unbounded vertex-click race as first suspected.

### Known Issue (not fixed — flagged for follow-up, out of scope for this eval-authoring plan)

Machine-create/rename/department/link save round-trips on production occasionally took well over the standard 25s window during debugging (one run needed ~15 real minutes across the whole flow before the locator bug was found and fixed). The final passing run completed the identical flow in well under a minute, so this could be Railway/Supabase cold-start variance rather than a systemic regression — but `tests/evals/site-editor.eval.ts` still carries generous `CREATE_SLOW = 60s` waits and a `test.setTimeout(600_000)` (10 min) as headroom in case the variance recurs. No server-action code was touched to investigate or fix this; if it recurs on a future eval run, the fastest way to isolate whether it's target latency vs. a script bug is the click-by-click diagnostic pattern described above (log a locator count after every discrete action rather than only at the final assertion).

## Screenshots Read (orchestrator visual review)

- `site-empty.png` — clean empty state, "Upload an image" panel only (no "Generate from a description" panel, confirming `GEMINI_API_KEY` is not set on Railway — recorded in `51-VALIDATION.md`'s Manual-Only section), no visual defects.
- `site-editor.png` — both machine polygons rendered with distinct tinted fills over the scene, right panel shows "Machines · 2" with EVAL Press (Forming, blue dot, 1 SOP, expanded SOP list with Unlink + link-search input) and EVAL Oven (No department, 0 SOPs, collapsed); nothing clipped at 1440px, all text legible and coloured (not white-on-nothing).
- `builder-machines.png` — Tools-menu modal grouped by department (Forming / No department), checkbox states correct, "Saved ✓" visible, no visual defects.

## Self-Check: PASSED

- FOUND: `tests/evals/site-editor.eval.ts`
- FOUND: `tests/evals/lib/session.ts` (modified, `siteAdmin` present)
- FOUND: `scripts/eval-fixtures.mjs` (modified, `SOPstart Eval Site` present)
- FOUND: `.planning/phases/51-site-model-machine-editor/51-EVAL.md`
- FOUND commit `cf9d1e1` in `git log`
- FOUND commit `1c415d7` in `git log`
- Deployed eval: 12/12 passed at commit `1c415d7` (`.planning/phases/51-site-model-machine-editor/51-EVAL.md`)
