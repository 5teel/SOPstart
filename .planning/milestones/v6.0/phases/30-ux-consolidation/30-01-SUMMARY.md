---
phase: 30-ux-consolidation
plan: 01
subsystem: testing
tags: [playwright, nyquist-harness, source-contract, dead-code, bundle-baseline]
requires: []
provides:
  - phase30 Playwright project (broad tests/phase30/** testMatch — single registration point for the phase)
  - 8 source-contract spec stubs, one per UX requirement (UX-01..UX-08), all fixme except the live BuilderWithSourceViewer-deletion assertion
  - phase21-stubs fully green (was 4 failed / 22 passed on master)
  - Phase-30 regression baseline (full suite 39 failed / 798 passed / 230 skipped, all pre-existing)
  - worker /sops/[sopId] First Load JS pre-merge baseline (1057 KB)
affects:
  - 30-02..30-08 (every later plan gates against --project=phase30 and flips its own spec live)
tech-stack:
  added: []
  patterns:
    - "Wave-0 fixme stubs with real path constants so later plans flip fixme→live without rewriting reads"
    - "Repoint-with-the-move: spec path constants updated in the same commit as the file deletion (29-01 precedent)"
key-files:
  created:
    - tests/phase30/role-homes.spec.ts
    - tests/phase30/admin-nav.spec.ts
    - tests/phase30/governance-fold.spec.ts
    - tests/phase30/create-entry.spec.ts
    - tests/phase30/tab-merge.spec.ts
    - tests/phase30/list-rows.spec.ts
    - tests/phase30/plain-language.spec.ts
    - tests/phase30/dead-weight.spec.ts
  modified:
    - playwright.config.ts (phase30 project)
    - tests/integration/scp-source-viewer.test.ts (repointed to BuilderStageShell / EditableDocument / selection-bridge)
    - tests/integration/scp-parse-pipeline.test.ts (repointed to BuilderStageShell + ReviewStation + bundle-gate scan)
    - tests/integration/scp-verify-checklist.test.ts (SCP-VERIFY-02 gate reads → publish-core.ts)
    - src/components/admin/verify-checklist/__tests__/publish-gate.integration.test.ts (BUILDER path + route assertions → BuilderStageShell / publish-core)
    - scripts/check-bundle-size.ts (stale filename in D-21-09 comment + fail message)
    - 9 src files — comment references to the deleted file cleaned
  deleted:
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderWithSourceViewer.tsx (legacy, zero real importers since Phase 26)
decisions:
  - "phase30 stubs are test.fixme with REAL path constants — suite green now, each later plan flips its own spec live (BuilderWithSourceViewer deletion assertion flipped live in this plan since the deletion happened here)"
  - "SCP-PARSE-03 no longer asserts a dynamic( token: the live chain statically imports SourceViewerPane inside the admin-only ReviewStation; D-21-09 is enforced structurally by check-bundle-size.ts pdfjs/mammoth marker scan over the WORKER chunk set — the spec now asserts that enforcement"
  - "Requirements UX-05/UX-08 NOT marked complete in REQUIREMENTS.md — this plan only records the UX-05 baseline and performs one UX-08 deletion; the owning plans complete them"
metrics:
  duration: ~45m
  completed: 2026-07-12
---

# Phase 30 Plan 01: Wave-0 Test Harness + scp Cleanup Summary

**One-liner:** phase30 Nyquist harness (8 fixme source-contract stubs, one broad project) + legacy BuilderWithSourceViewer deleted with all scp specs repointed to BuilderStageShell/publish-core, clearing 4 stale phase21-stubs failures; regression baselines recorded (bundle 1057 KB, full suite 39F/798P/230S).

## What was built

### Task 1 — phase30 harness (commit `bb0de41`)
- ONE `phase30` project in `playwright.config.ts` (broad `tests/phase30/**` testMatch, mirrors phase28/29).
- 8 stubs, one per requirement: role-homes (UX-01), admin-nav (UX-02), governance-fold (UX-03), create-entry (UX-04), tab-merge (UX-05), list-rows (UX-06), plain-language (UX-07), dead-weight (UX-08). Each states the eventual contract from 30-RESEARCH § Test Map with real `path.join(ROOT,…)` constants, wrapped in `test.fixme`.
- Verified: `--list --project=phase30` discovers 36 tests in 8 files; run exits 0.

### Task 2 — deletion + repoints (commit `b284086`)
- Confirmed zero real imports (`import.*BuilderWithSourceViewer` in src == 0, comment hits only), then deleted the file.
- Repointed every spec read:
  - SCP-VIEWER-01: existsSync list + page.tsx assertion → `BuilderStageShell` (key_link satisfied: page.tsx contains `BuilderStageShell`).
  - SCP-VIEWER-03: reverse channel → `EditableDocument.tsx` (`registerBlockClickHandler`) + `selection-bridge.ts` (`resolveComponentIdFromSource`, `data-block-id`) — the Phase 26 bespoke-canvas wiring.
  - SCP-VIEWER-05 / SCP-PARSE-03: CONV-12 `showPane`/`ai_prompt` → `BuilderStageShell.tsx` (verified per token: lines 101/104); `SourceViewerPane` mount → `ReviewStation.tsx`.
  - SCP-PARSE-02: page mounts `BuilderStageShell`.
  - SCP-VERIFY-02 + src-side publish-gate.integration.test.ts: gate reads → `src/lib/governance/publish-core.ts` (Phase 29 `f150f4b` factored `assertPublishGates`/`performPublish` out of the route; route asserted to delegate via `performPublish(`).
- Cleaned ALL src comment references (11 files) → `grep -rn "BuilderWithSourceViewer" src` == 0. `tests/builder/builder-review-flow.spec.ts` negative assertion left intact (tests/ dir, stays valid).
- `scripts/check-bundle-size.ts` D-21-09 comment + fail message updated to name the real chain (BuilderStageShell → ReviewStation).
- Flipped the dead-weight.spec.ts deletion assertion live.

## Verification results

| Gate | Result |
|------|--------|
| `npx playwright test --list --project=phase30` | 36 tests / 8 files discovered |
| `npx playwright test --project=phase30` | exit 0 (1 passed, 35 fixme-skipped) |
| `npx playwright test --project=phase21-stubs` | fully green — 26 passed, 0 failed (master baseline: 4 failed / 22 passed) |
| `npx tsc --noEmit` | clean |
| `npm run build` + postbuild bundle gate | clean — 1057 KB, Δ 0 KB; pdfjs/mammoth/konva isolation all OK (proves the source viewer still mounts via the shell chain — T-30-01-02 closed) |
| `grep -rn "BuilderWithSourceViewer" src` | 0 hits |

## Baselines recorded (for 30-08 final gate)

### Bundle baseline (UX-05 pre-merge reference)
- **Worker `/sops/[sopId]/page` First Load JS = 1057 KB** (`.bundle-baseline.json`, captured 2026-07-06, 19 chunks; previousBaseline 1054). Not hand-edited. Post-merge comparison: tab merge should REDUCE this; re-capture via `scripts/capture-bundle-baseline.ts`.

### Full-suite regression BASELINE (`npm run test` after the scp fix)
**39 failed / 798 passed / 230 skipped (1.1m).** All 39 are PRE-EXISTING (none touch files changed by this plan; publish-route class predates via Phase 29 `f150f4b`). 30-08's gate = "no NEW failures" vs this list:

| Project | Failures | Files |
|---------|----------|-------|
| phase3-stubs | 3 | desktop-walkthrough-layout (SB-LINE-01), sb-ux-walkthrough ×2 |
| phase11-stubs | 13 | sb-auth-builder ×3, sb-builder-infrastructure ×1, sb-layout-editor ×8, sb-section-schema ×1 |
| phase12.5-stubs | 12 | sb-ux-blocks ×4, sb-ux-blueprint ×4, sb-ux-voice ×2, sb-ux-walkthrough ×2 |
| phase15-stubs | 4 | sub-trade-assignment ×2, desktop-walkthrough-layout ×1, voice-grounding-scope ×1 |
| phase20-parsers | 1 | parser-creates-junctions (createBlock signature) |
| phase21-unit | 2 | parser-creates-junctions (dup registration), block-content-extended (19 members) |
| phase21.5-stubs | 1 | builder-review-flow R10 (publish route gate string — Phase 29 refactor fallout) |
| phase26 | 3 | reorder (dnd-kit scan), spine-regression (publish route gate string — same Phase 29 class), verify-gate (live-DB harness, 409 "SOP is not a draft") |

Most are runtime/browser or live-DB dependent (long-standing, cf. STATE "Phase 23 pre-existing failures are not regressions"). The two publish-route-string failures (builder-review-flow R10, spine-regression) are the SAME cheap publish-core repoint class fixed here for scp specs — logged in deferred-items.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Pre-existing failure count was 4, not 2 — fixed all 4**
- **Found during:** Task 2 baseline run (plan/research only ran scp-source-viewer.test.ts in isolation; `--project=phase21-stubs` covers 4 files)
- **Issue:** SCP-PARSE-02 (page asserts deleted shell) and SCP-VERIFY-02 (publish route no longer contains the gate strings — Phase 29 moved them to publish-core.ts) were also failing on master
- **Fix:** Repointed both; `tests/integration/scp-verify-checklist.test.ts` edited though not in the plan's files list (required by the "phase21-stubs exits 0" acceptance criterion)
- **Commit:** `b284086`

**2. [Rule 2 - Missing critical] 11 src files comment-referenced the deleted file, not 2**
- **Found during:** Task 2 grep sweep
- **Issue:** Plan listed 2 stale comment refs; must_haves requires `grep src` == 0. Reality: BuilderStageShell (7 refs), PublishStage (2), SourceViewerPane (2), types.ts, source-viewer/index.ts, ai-reviewer/index.ts, useReviewerFlags.ts, BuilderClient.tsx, useSelectionSync.tsx, plus src-side publish-gate.integration.test.ts which READ the deleted file via readFileSync
- **Fix:** Cleaned all comments; repointed publish-gate.integration.test.ts (unregistered — no project regex covers src/components — but now truthful if ever registered)
- **Commit:** `b284086`

**3. [Rule 1 - Bug] RESEARCH A2 partially wrong: no `dynamic(` token exists in the live source-viewer chain**
- **Found during:** Task 2 per-token grep (T-30-01-01 mitigation)
- **Issue:** The only `dynamic(` import of SourceViewerPane was in the file being deleted; ReviewStation imports it STATICALLY (admin-route-only, so D-21-09 unharmed)
- **Fix:** SCP-PARSE-03 rewritten to assert the real structure (shell provider + ReviewStation mount) plus the actual D-21-09 enforcement mechanism (check-bundle-size.ts pdfjs/mammoth worker-chunk marker scan)
- **Commit:** `b284086`

## Deferred Issues

Logged in `.planning/phases/30-ux-consolidation/deferred-items.md`:
- `tests/builder/builder-review-flow.spec.ts` R10 + `tests/phase26/spine-regression.spec.ts` publish-route assertions — same publish-core repoint class (~4 lines each); pre-existing, out of this plan's scope.
- `VerifyChecklistGate.tsx` now has NO live mount (its only mounter was the deleted legacy shell; state pre-dates this plan — Phase 26 moved verification into ReviewStation). Still exported + unit-tested. Candidate for the UX-08 dead-weight sweep plan.
- 37 other pre-existing full-suite failures (runtime/browser/live-DB dependent) — see baseline table.

## Known Stubs

The 35 `test.fixme` entries across tests/phase30/*.spec.ts are the DELIBERATE Wave-0 harness design (plan objective): each later plan flips its own requirement's spec live. No production-code stubs were introduced.

## Requirements note

`requirements: [UX-05, UX-08]` NOT marked complete in REQUIREMENTS.md: this plan only records the UX-05 bundle baseline (tab merge unshipped) and performs one UX-08 deletion (ModelTab, walkthrough route, WalkthroughTab shim, bell, dashboard all remain for later plans). Marking now would corrupt traceability; the owning plans mark them.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes (test scaffold + dead-code deletion only, per plan threat model).

## Commits

| Commit | Description |
|--------|-------------|
| `bb0de41` | test(30-01): register phase30 project + 8 UX-requirement spec stubs |
| `b284086` | fix(30-01): delete BuilderWithSourceViewer, repoint scp specs, clear 4 stale failures |

## Self-Check: PASSED

All 8 spec files + SUMMARY + deferred-items exist on disk; commits `bb0de41` and `b284086` in git log; BuilderWithSourceViewer.tsx confirmed deleted; phase21-stubs + phase30 + tsc + `npm run build` (bundle gate Δ 0 KB) all green.
