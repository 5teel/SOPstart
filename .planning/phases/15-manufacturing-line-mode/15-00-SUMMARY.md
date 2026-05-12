---
phase: 15-manufacturing-line-mode
plan: 00
subsystem: testing
tags: [playwright, bundle-isolation, ci-gate, scaffolding, nyquist]

# Dependency graph
requires:
  - phase: 12.5-blueprint-redesign
    provides: existing MobileWalkthrough as the byte-identical-regression baseline
  - phase: 14-ai-drafted-sops
    provides: Anthropic mock fixture shape (anthropic-mock.ts) — mirrored here for voice
provides:
  - Pre-Phase-15 First Load JS baseline (1088 KB) for /sops/[sopId]/page locked in git
  - Postbuild bundle-isolation CI gate (≤2 KB tolerance) wired into `npm run build`
  - 6 spec-file scaffolds (13 test.fixme blocks) covering SB-LINE-01..05 ready for Wave 1-4 executors
  - Live lint guard (2 passing tests) preventing static import of DesktopWalkthrough / WalkthroughVoiceModal
  - Canned Anthropic voice-Q&A mock + Visy ENF4-03-031 seed SQL
affects: [15-01, 15-02, 15-03, 15-04, 15-04-bundle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Webpack-mode bundle baseline: parse build-manifest.json + RSC client-reference-manifest to sum per-route client chunks (Next.js 16 webpack doesn't emit app-build-manifest.json)"
    - "Wave-0 carve-out gating: chunk-existence assertions silently no-op until matching chunk names appear in any manifest"
    - "Spec scaffold convention: test.fixme with TODO(wave-N) numbered steps inline — Wave executors flip to test() and fill in"

key-files:
  created:
    - scripts/capture-bundle-baseline.ts
    - scripts/check-bundle-size.ts
    - .bundle-baseline.json
    - tests/integration/desktop-walkthrough-layout.spec.ts
    - tests/integration/sequential-ack.spec.ts
    - tests/integration/voice-qa-happy-path.spec.ts
    - tests/integration/voice-grounding-scope.spec.ts
    - tests/integration/sub-trade-rls-backward-compat.spec.ts
    - tests/e2e/sub-trade-assignment.spec.ts
    - tests/fixtures/anthropic-voice-mock.ts
    - tests/fixtures/visy-enf4-03-031.sql
    - tests/lint/no-static-desktop-import.spec.ts
  modified:
    - package.json (added postbuild → tsx scripts/check-bundle-size.ts)
    - playwright.config.ts (testMatch accepts both *.test.ts and *.spec.ts; added phase15-stubs project)

key-decisions:
  - "Pre-Phase-15 First Load JS baseline = 1088 KB for /sops/[sopId]/page (18 chunks; webpack-mode artifact)"
  - "Next.js 16 webpack does NOT emit app-build-manifest.json — derived chunk list from RSC client-reference-manifest at .next/server/app/(protected)/sops/[sopId]/page_client-reference-manifest.js"
  - "playwright testMatch extended to ['**/*.test.ts', '**/*.spec.ts'] so Phase 15 spec files appear in --list (Rule 3 blocking fix)"
  - "Lint test runs LIVE (no test.fixme); regex-matches import-shape lines only, ignores JSX usage / comments / declarations"
  - "Visy SOP fixture uses fixed UUIDs with delete-then-insert prelude → idempotent re-run; org_id placeholder must be swapped before UAT"

patterns-established:
  - "RSC client-reference-manifest as bundle-size source-of-truth for webpack builds (works around missing app-build-manifest.json in Next.js 16 webpack mode)"
  - "Wave-N TODO comments inside test.fixme bodies as the hand-off contract between Wave 0 and the executor that fills the test in"

requirements-completed: [SB-LINE-06]

# Metrics
duration: ~25min
completed: 2026-05-13
---

# Phase 15 Plan 00: Wave 0 Scaffolding Summary

**Pre-Phase-15 bundle baseline (1088 KB) locked in git + postbuild CI gate + 13 spec scaffolds + live import-leak lint guard — every SB-LINE-01..06 has a failing scaffold or passing live test ready for Wave 1-4.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-12T14:00:00Z (approx)
- **Completed:** 2026-05-13T00:00:00Z (approx — date rolled mid-session)
- **Tasks:** 3
- **Files created:** 11
- **Files modified:** 2

## Accomplishments

- Captured `.bundle-baseline.json` = **1088 KB** for `/sops/[sopId]/page` against Phase-14-head before any Phase 15 source touched
- Wired postbuild bundle-isolation CI gate into `npm run build` (delta verified = 0 KB against same-build baseline)
- Scaffolded 6 Playwright spec files + 1 fixtures TS module + 1 SQL seed + 1 live lint guard covering every SB-LINE-XX requirement
- Added `phase15-stubs` Playwright project; all 15 tests discoverable via `npx playwright test --list`
- Live lint guard (`tests/lint/no-static-desktop-import.spec.ts`) executes and PASSES against Phase-14-head — regression-trap is armed for Wave 2

## Task Commits

1. **Task 1: Capture pre-Phase-15 First Load JS baseline** — `847dca0` (feat)
2. **Task 2: Bundle-isolation CI gate (check-bundle-size.ts + postbuild)** — `b40d3ae` (feat)
3. **Task 3: Scaffold spec files, fixtures, and lint guard** — `77d3481` (test)

## Files Created/Modified

### Scripts
- `scripts/capture-bundle-baseline.ts` — One-shot baseline capture; parses `.next/build-manifest.json` + RSC client-reference-manifest, sums chunk bytes, writes `.bundle-baseline.json`
- `scripts/check-bundle-size.ts` — Postbuild CI gate; ≤2 KB tolerance; Wave-0 carve-out auto-deactivates once DesktopWalkthrough/WalkthroughVoiceModal chunks appear in any manifest

### Bundle artifact
- `.bundle-baseline.json` — Locked baseline `{ routes: { "/sops/[sopId]/page": 1088 } }`, chunkCount 18

### Test scaffolds (Playwright spec files; all `test.fixme` unless noted)
- `tests/integration/desktop-walkthrough-layout.spec.ts` — SB-LINE-01: 2 test.fixme (desktop ≥24px, mobile non-regression)
- `tests/integration/sequential-ack.spec.ts` — SB-LINE-02: 2 test.fixme (sequential gate, forward-jump redirect)
- `tests/integration/voice-qa-happy-path.spec.ts` — SB-LINE-03: 3 test.fixme (mic→modal, citation chip scroll, ESC focus)
- `tests/integration/voice-grounding-scope.spec.ts` — SB-LINE-04: 2 test.fixme (cross-SOP "can't find", verifier badge)
- `tests/integration/sub-trade-rls-backward-compat.spec.ts` — SB-LINE-05 backward compat: 2 test.fixme (empty=all, fitter tag)
- `tests/e2e/sub-trade-assignment.spec.ts` — SB-LINE-05 admin flow: 2 test.fixme (team page, assign page)
- `tests/lint/no-static-desktop-import.spec.ts` — **LIVE (2 passing)**: guards SB-LINE-06 against static-import regression

### Fixtures
- `tests/fixtures/anthropic-voice-mock.ts` — `mockAnswerCall`, `mockVerifierCall`, `PPE_QUESTION_PRESET`, `ADVERSARIAL_QUESTION_PRESET` (cache-hit token shapes ready for SB-LINE-03 cache-correctness test)
- `tests/fixtures/visy-enf4-03-031.sql` — Idempotent seed: 1 SOP, 3 sections (Overview + Hazards "heat-resistant gloves" + Steps), 3 sop_steps

### Config
- `package.json` — Added `"postbuild": "tsx scripts/check-bundle-size.ts"` (between build and start, ahead of postinstall)
- `playwright.config.ts` — Extended testMatch to `['**/*.test.ts', '**/*.spec.ts']`; added `phase15-stubs` project matching the six SB-LINE spec files + lint guard

## Decisions Made

- **Webpack-mode manifest workaround:** Next.js 16 with `next build --webpack` does NOT emit `app-build-manifest.json` (Turbopack-only artifact). Derived the per-route client chunk list from `.next/server/app/(protected)/sops/[sopId]/page_client-reference-manifest.js` (RSC manifest) instead, plus shared shell chunks from `build-manifest.json`. Both scripts handle both manifest layouts so a future Turbopack switch is non-breaking.
- **Lint guard runs live:** The regex matches `import ... Symbol ... from '...'` AND `dynamic(() => import('...Symbol...'))` shapes only on lines that contain the symbol AND look like import sites; ignores JSX usage, comments, and declarations. Initial state: 0 violations (vacuously passes), arming the regression trap for Wave 2.
- **Wave-0 carve-out gating:** `check-bundle-size.ts` silently no-ops the DesktopWalkthrough/WalkthroughVoiceModal chunk-existence assertions when *neither* chunk name appears in any manifest AND delta ≤ 0 — auto-activates the moment Wave 2 ships the `next/dynamic` import. `// TODO(wave-4)` comment documents the tightening path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended Playwright testMatch to accept *.spec.ts files**
- **Found during:** Task 3 (test scaffolding)
- **Issue:** Plan explicitly specifies `.spec.ts` extension for all new files, but `playwright.config.ts` was previously `testMatch: '**/*.test.ts'` only. Without the fix, `npx playwright test --list` would not discover any of the 9 new files and the plan's acceptance criteria would fail.
- **Fix:** Updated testMatch to `['**/*.test.ts', '**/*.spec.ts']`; added `phase15-stubs` project regex matching the six Phase 15 spec basenames + lint guard.
- **Files modified:** `playwright.config.ts`
- **Verification:** `npx playwright test --list --project=phase15-stubs` shows all 15 tests across 7 files; `npx playwright test tests/lint/no-static-desktop-import.spec.ts --project=phase15-stubs` reports `2 passed`.
- **Committed in:** `77d3481` (Task 3 commit)

**2. [Rule 3 - Blocking] Switched bundle baseline source from `app-build-manifest.json` to RSC client-reference-manifest**
- **Found during:** Task 1 (baseline capture)
- **Issue:** Plan + 15-RESEARCH.md sample code read `.next/app-build-manifest.json`, but `next build --webpack` (this project's build mode) does NOT emit that file — only Turbopack does. Build succeeded, manifest absent, baseline capture would have failed.
- **Fix:** Read `.next/build-manifest.json` (shared shell chunks) plus `.next/server/app/(protected)/sops/[sopId]/page_client-reference-manifest.js` (per-route client chunks evaluated via `require()` and `globalThis.__RSC_MANIFEST`). Both `capture-bundle-baseline.ts` and `check-bundle-size.ts` fall through to the webpack path automatically; Turbopack path retained for forward-compat.
- **Files modified:** `scripts/capture-bundle-baseline.ts`, `scripts/check-bundle-size.ts`
- **Verification:** Baseline run printed `Baseline captured: /sops/[sopId]/page = 1088 KB (18 chunks)`; check script printed `Δ 0 KB ... ✓ Bundle isolation OK`.
- **Committed in:** `847dca0` (Task 1) and `b40d3ae` (Task 2)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — Blocking)
**Impact on plan:** Both auto-fixes were necessary to satisfy the plan's stated acceptance criteria. No scope creep — the deviations are environment-adaptation only (Next.js webpack vs Turbopack manifest shape; .spec.ts vs .test.ts conventions). The plan's literal `app-build-manifest.json` references should be updated in Wave 4 PLAN once authored, but the script abstractions handle the conditional internally.

## Wave-0 Carve-outs (for Wave 4 to remove)

- `scripts/check-bundle-size.ts` lines ~140-155: chunk-existence assertions guarded by `waveZeroCarveOut = !desktopChunkPresent && !voiceChunkPresent && deltaKB <= 0`. **Auto-deactivates** the moment Wave 2 emits the chunks. No env-var management needed unless Wave 4 wants to force-enforce earlier.
- `// TODO(wave-4)` comment in the same file documents the tightening path if hard-gate enforcement is preferred.

## Issues Encountered

- **Build-manifest shape mismatch (Next.js 16 webpack):** Documented above as Deviation #2. Resolved by reading the RSC client-reference-manifest instead.
- **Existing repo lint noise:** `npm run lint` reports 3070 pre-existing problems (mostly unused-import warnings in `tests/*.test.ts` and `transcripts/format-transcript.cjs`). All new Phase 15 Wave 0 files lint clean when scoped (`npx eslint <file>...` produces 0 errors/warnings). Out of scope for Wave 0 — logged for future cleanup pass.

## Next Phase Readiness

- **Baseline locked:** Wave 4 has a positive integer KB number (1088) to compare against.
- **Test scaffolds armed:** Each Wave 1-4 plan can reference a failing scaffold via `<verify><automated>npx playwright test tests/integration/<spec>.spec.ts --project=phase15-stubs</automated></verify>`.
- **Live regression trap:** Any future static import of DesktopWalkthrough/WalkthroughVoiceModal outside `WalkthroughSwitcher.tsx` will fail the lint suite.
- **Fixture ready:** Visy ENF4-03-031 seed SQL is idempotent and Hazards section contains the "heat-resistant gloves" phrase needed for SB-LINE-04 grounding.
- **No blockers** — Wave 1 (sub-trades schema + RLS) can start immediately.

## Self-Check: PASSED

Verified:
- `.bundle-baseline.json` exists with `routes['/sops/[sopId]/page'] = 1088` (positive integer)
- All 12 created files exist on disk
- Commits `847dca0`, `b40d3ae`, `77d3481` exist in git log
- `npx playwright test tests/lint/no-static-desktop-import.spec.ts --project=phase15-stubs` reports `2 passed`
- `npx playwright test --list --project=phase15-stubs` reports `Total: 15 tests in 7 files`
- `npx tsx scripts/check-bundle-size.ts` reports `Δ 0 KB ... ✓ Bundle isolation OK`

---
*Phase: 15-manufacturing-line-mode*
*Completed: 2026-05-13*
