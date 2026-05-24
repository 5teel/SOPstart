---
phase: 21-safety-critical-parsing
plan: 00
subsystem: testing
tags: [stubs, playwright, scp, wave-0]
dependency_graph:
  requires: []
  provides:
    - "tests/integration/scp-source-viewer.test.ts (SCP-VIEWER-01..05)"
    - "tests/integration/scp-ai-reviewer.test.ts (SCP-AI-01..08)"
    - "tests/integration/scp-verify-checklist.test.ts (SCP-VERIFY-01..06)"
    - "tests/integration/scp-parse-pipeline.test.ts (SCP-PARSE-01..04)"
    - "playwright.config.ts: phase21-stubs project"
  affects:
    - "Waves 1-4 verification surface (executors flip test.fixme to live)"
tech-stack:
  added: []
  patterns:
    - "test.fixme stubs with SCP-XX title prefix (mirrors phase15-stubs convention)"
    - "Each stub body contains Acceptance comment + at least one expect() for harness wiring"
key-files:
  created:
    - "tests/integration/scp-source-viewer.test.ts"
    - "tests/integration/scp-ai-reviewer.test.ts"
    - "tests/integration/scp-verify-checklist.test.ts"
    - "tests/integration/scp-parse-pipeline.test.ts"
  modified:
    - "playwright.config.ts"
decisions:
  - "Adopted the existing phase{N}-stubs project convention in playwright.config.ts (phase21-stubs regex matches all four scp-*.test.ts files)"
  - "Each stub body uses `expect(page).toBeDefined()` (or equivalent skeleton assertion) so the harness wires up the moment fixme is dropped — Wave 1-4 executors only need to swap the assertion body, not rebuild the test fixture"
metrics:
  duration_minutes: 8
  completed_date: 2026-05-25
  task_count: 2
  file_count: 5
  commit_count: 2
---

# Phase 21 Plan 00: Test Stubs Summary

Landed 23 `test.fixme` Playwright stubs across 4 spec files (one per SCP requirement family) plus a `phase21-stubs` project in `playwright.config.ts`, locking the Phase 21 verification contract before any production code ships in Waves 1-4.

## Final Stub Count

| Family | File | Stubs | min_lines | actual_lines |
|--------|------|-------|-----------|--------------|
| VIEWER | `tests/integration/scp-source-viewer.test.ts` | 5 (SCP-VIEWER-01..05) | 50 | 88 |
| AI | `tests/integration/scp-ai-reviewer.test.ts` | 8 (SCP-AI-01..08) | 80 | 125 |
| VERIFY | `tests/integration/scp-verify-checklist.test.ts` | 6 (SCP-VERIFY-01..06) | 60 | 118 |
| PARSE | `tests/integration/scp-parse-pipeline.test.ts` | 4 (SCP-PARSE-01..04) | 40 | 81 |
| **Total** | **4 files** | **23 stubs** | — | **412 lines** |

23 of 23 SCP requirements covered: 1:1 stub → requirement mapping via the `SCP-XX:` title prefix.

## Verification Output

```
$ npx playwright test --list 2>&1 | grep -c "SCP-"
23

$ npx playwright test --grep "SCP-" --project=phase21-stubs
… 23 skipped (0 failed, 0 passed)
```

`npx playwright test --list` for the four files returns exactly 23 lines matching `SCP-(VIEWER|AI|VERIFY|PARSE)-` — matches the required count exactly.

## Commits

| Hash | Message | Files |
|------|---------|-------|
| `79d931c` | `test(phase-21-00): add SCP-VIEWER and SCP-PARSE stubs` | scp-source-viewer.test.ts, scp-parse-pipeline.test.ts, playwright.config.ts |
| `eb556a8` | `test(phase-21-00): add SCP-AI and SCP-VERIFY stubs` | scp-ai-reviewer.test.ts, scp-verify-checklist.test.ts, scp-source-viewer.test.ts (lint fix) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unused `page` parameter in SCP-VIEWER-02 and SCP-VIEWER-04 stubs**
- **Found during:** Task 2 lint pass
- **Issue:** Both stubs destructured `{ page }` for the test signature but the body used a derived constant (`clickToOverlayBudgetMs` / `closeButtons`) only, triggering `@typescript-eslint/no-unused-vars` warnings.
- **Fix:** Added `expect(page).toBeDefined()` as a secondary assertion in each body so the destructured parameter is consumed.
- **Files modified:** `tests/integration/scp-source-viewer.test.ts`
- **Commit:** `eb556a8` (rolled into the Task 2 commit alongside the AI + VERIFY adds)

### Architectural / Decision Changes

None — plan executed per the locked contract in 21-CONTEXT.md. All decisions D-21-01 through D-21-13 honoured without re-litigation.

## Decisions Made

- **Used `phase21-stubs` project name** matching the existing `phase{N}-stubs` Playwright project convention (`phase11-stubs`, `phase15-stubs`, etc.) so CI selectors keep working without per-phase special-casing.
- **D-21-07 enforcement encoded in code at SCP-VERIFY-05**: the stub body literally contains `expect(await page.locator('button:has-text("Approve all")').count()).toBe(0)` so when Wave 4 flips this fixme, any future re-introduction of bulk-verify UI causes a hard CI failure. This is the load-bearing assertion of the whole phase.
- **Test bodies pre-wired with skeleton assertions** — every stub has at least one `expect()` call so the Wave 1-4 executor only needs to swap the assertion body, not rebuild the test fixture from scratch.

## Threat Model Compliance

| Threat ID | Mitigation |
|-----------|------------|
| T-21-00-01 (Tampering: fixme removed before feature ships) | All 23 stubs use `test.fixme` (not `test.skip`); CI grep `grep -r "test.fixme" tests/integration/scp-` returns 23 |
| T-21-00-02 (Repudiation: stub doesn't map to requirement) | Every stub title starts with `SCP-XX:` ID prefix; 23 stubs ↔ 23 requirements 1:1 |

## Self-Check: PASSED

- [x] `tests/integration/scp-source-viewer.test.ts` exists (88 lines)
- [x] `tests/integration/scp-ai-reviewer.test.ts` exists (125 lines)
- [x] `tests/integration/scp-verify-checklist.test.ts` exists (118 lines)
- [x] `tests/integration/scp-parse-pipeline.test.ts` exists (81 lines)
- [x] `playwright.config.ts` contains `phase21-stubs` project entry
- [x] `playwright test --list` returns 23 SCP-prefixed tests
- [x] `playwright test --grep "SCP-"` returns 23 skipped, 0 failed
- [x] ESLint clean on all four new files
- [x] Commit `79d931c` exists (Task 1: VIEWER + PARSE)
- [x] Commit `eb556a8` exists (Task 2: AI + VERIFY + lint fix)
