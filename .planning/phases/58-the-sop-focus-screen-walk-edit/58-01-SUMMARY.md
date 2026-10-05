---
phase: 58-the-sop-focus-screen-walk-edit
plan: 01
subsystem: testing
tags: [playwright, nyquist, repoint-inventory, design-tokens, tailwind-v4]
requires: []
provides:
  - "phase58 Playwright project (broad tests/phase58 testMatch)"
  - "repoint inventory (RETIRED / INVENTORY / LIVE_PLANS) and retirement sweep stubs"
  - "12 fixme requirement specs, one per owning plan group"
  - "--text-step design token (28px / 1.25) with lint pin"
affects: [58-02, 58-03, 58-04, 58-05, 58-06, 58-07, 58-08, 58-09, 58-10, 58-11, 58-12, 58-13, 58-14, 58-15, 58-16, 58-18]
tech-stack:
  added: []
  patterns: ["Phase 57 repoint-inventory idiom, now also walking test files beside source under src/"]
key-files:
  created:
    - tests/phase58/repoint-inventory.spec.ts
    - tests/phase58/retirement-sweep.spec.ts
    - tests/phase58/frame-structure.spec.ts
    - tests/phase58/edit-rail.spec.ts
    - tests/phase58/legacy-redirects.spec.ts
    - tests/phase58/walk-actions.spec.ts
    - tests/phase58/walk-no-leak.spec.ts
    - tests/phase58/parse-pipelines.spec.ts
    - tests/phase58/publish-gate.spec.ts
    - tests/phase58/reviewer-steps.spec.ts
    - tests/phase58/edit-actions.spec.ts
    - tests/phase58/fork-draft.spec.ts
    - tests/phase58/cutover-converter-retired.spec.ts
    - tests/phase58/capability-matrix.spec.ts
  modified:
    - playwright.config.ts
    - src/styles/blueprint-theme.css
    - tests/lint/design-tokens.spec.ts
key-decisions:
  - "Row owner is not token owner: a retired token is checked against LIVE_PLANS by the plan that retires it, so a file with a 58-11 token must be clean when 58-11 goes live even if its row says 58-15 (notes name the earlier edit)"
  - "Retired-token set extended beyond the plan text with builder-v2, 'Edit in builder' (58-11) and the converter --apply spawn form (58-14) so research-named specs that quote none of the listed names are still caught"
  - "Retirement-sweep helpers (read, stripComments, walkSrc) are exported for the owning plans to reuse"
requirements-completed: []
duration: ~25 min
completed: 2026-10-05
---

# Phase 58 Plan 01: Wave 0 harness Summary

**phase58 Playwright project, a 82-row repoint inventory with owning plans, 12 fixme requirement specs, and the `--text-step` 28 px token pinned in the design-tokens lint.**

Requirements FOC-01..04, WRK-03, WRK-04, SOP-04 are only stubbed here (named fixme tests); they are not proven, so they are not marked complete.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | `1374849f` | phase58 project, repoint inventory, retirement sweep |
| 2 | `c476d896` | 12 requirement stubs |
| 3 | `0bb0f60b` | `--text-step` token + lint pin |

## `--list` output (registered files)

capability-matrix, cutover-converter-retired, edit-actions, edit-rail, fork-draft, frame-structure, legacy-redirects, parse-pipelines, publish-gate, repoint-inventory, reviewer-steps, retirement-sweep, walk-actions, walk-no-leak (all `tests/phase58/*.spec.ts`).

`npx playwright test --project=phase58`: 5 passed (inventory Tests A-D plus regex check), 53 skipped (fixme). `npx playwright test --project=phase15-stubs design-tokens no-undefined-css-tokens`: 9 passed. `npx tsc --noEmit`: clean.

## RETIRED tokens

- **58-11:** `tab=walk`, `tab=read`, `Edit in builder`
- **58-14:** builder URL template form, versions URL template form, converter spawned with `--apply`
- **58-16:** ReadTab, SopTabNav, WorkerPreviewToggle, MobileWalkthrough, DesktopWalkthrough, ImmersiveStepCard, WalkthroughSwitcher, ViewModeToggle, SafetyAcknowledgement, StepProgress, scopeSopToJob, procedureSections, useSopDetail, completionStore, BuilderClient, BuilderStageShell, BuilderStageStepper, ReviewStation, OrientationStrip, NavRow, SectionListSidebar, BuilderTreeRail, PublishStage, BlockEditShell, EditableDocument, selection-bridge, SectionEditor, verify-checklist, useBuilderAutosave, parsedSopToPerSectionLayoutData, verifyBlock, stepAckTrace, builder-v2, builder directory and versions page paths (slash and path.join spellings)

## INVENTORY (file, disposition, owner)

| File | Disposition | Owner | Note |
|---|---|---|---|
| `tests/phase26/spine-regression.spec.ts` | repoint | 58-05 | gate literals move to the re-keyed gate |
| `tests/phase29/phase-gate.spec.ts` | repoint | 58-05 | 58-16 edits the versions-page part |
| `tests/phase29/publish-core-extraction.spec.ts` | repoint | 58-05 |  |
| `tests/phase29/publish-chain-gate.spec.ts` | repoint | 58-05 |  |
| `tests/phase56/publish-gate-pin.spec.ts` | repoint | 58-05 | hash re-pinned with the decision recorded (D-16) |
| `tests/integration/scp-parse-pipeline.test.ts` | delete | 58-07 |  |
| `src/lib/parsers/__tests__/parser-creates-junctions.test.ts` | delete | 58-07 |  |
| `tests/phase52/plant-panel.spec.ts` | repoint | 58-10 | 58-11 edits the tab literal |
| `tests/phase52/plant-now-card.spec.ts` | repoint | 58-10 | 58-11 edits the tab literal |
| `tests/phase54/admin-machine-panel.spec.ts` | repoint | 58-10 | 58-14 edits the builder href |
| `tests/phase57/machine-body.spec.ts` | repoint | 58-10 | 58-11 tab literal, 58-14 builder href |
| `tests/evals/one-screen.eval.ts` | repoint | 58-10 | worker half; 58-11 tab literal, 58-14 builder href |
| `tests/evals/cut-features.eval.ts` | repoint | 58-11 | 58-14 edits the builder/versions probes |
| `tests/evals/sop-ledger.eval.ts` | repoint | 58-11 | 58-14 edits the builder href |
| `tests/evals/sop-detail.eval.ts` | delete | 58-11 | replaced by tests/evals/sop-focus.eval.ts |
| `tests/phase51/builder-machines-row.spec.ts` | repoint | 58-12 |  |
| `tests/phase56/standards-actions.spec.ts` | repoint | 58-12 |  |
| `tests/phase56/placement.spec.ts` | repoint | 58-12 |  |
| `tests/phase41/bundle-gate.spec.ts` | repoint | 58-13 | baseline moves DOWN by hand with history |
| `tests/evals/governance.eval.ts` | repoint | 58-14 |  |
| `tests/evals/site-editor.eval.ts` | repoint | 58-14 |  |
| `tests/phase56/convert-apply.spec.ts` | repoint | 58-14 | converter refuses --apply |
| `tests/sb-auth-builder.test.ts` | repoint | 58-15 | auth halves survive |
| `tests/sb-builder-infrastructure.test.ts` | repoint | 58-15 |  |
| `tests/sb-ux-walkthrough.test.ts` | repoint | 58-15 |  |
| `tests/sb-ux-blueprint.test.ts` | repoint | 58-15 |  |
| `tests/phase28/library-and-worker.spec.ts` | repoint | 58-15 |  |
| `tests/phase30/dead-weight.spec.ts` | repoint | 58-15 |  |
| `tests/phase30/governance-fold.spec.ts` | repoint | 58-15 | 58-14 edits the builder href first |
| `tests/phase32/wire-up-mode.spec.ts` | repoint | 58-15 | builder halves go, survivors stay |
| `tests/phase35/no-competency-gate.spec.ts` | repoint | 58-15 |  |
| `tests/phase36/no-refresher-gate.spec.ts` | repoint | 58-15 |  |
| `tests/phase37/no-competency-gate-worker.spec.ts` | repoint | 58-15 |  |
| `tests/phase40/dup04-page-shell.spec.ts` | repoint | 58-15 |  |
| `tests/phase40/spine-freeze.spec.ts` | repoint | 58-15 |  |
| `tests/phase40/parse-status-no-navigate-after-unmount.spec.ts` | repoint | 58-15 |  |
| `tests/phase41/nav-and-shim.spec.ts` | repoint | 58-15 | 58-11 edits the admin-link literal first |
| `tests/phase41/reference-sweep.spec.ts` | repoint | 58-15 |  |
| `tests/phase43/route-truth.spec.ts` | repoint | 58-15 |  |
| `tests/phase43/dead-controls.spec.ts` | repoint | 58-15 |  |
| `tests/phase46/sop-edit-guard-wiring.spec.ts` | repoint | 58-15 |  |
| `tests/phase53/login-next-redirect.spec.ts` | repoint | 58-15 | 58-11 edits the tab literal first |
| `tests/phase54/governance-inbox.spec.ts` | repoint | 58-15 |  |
| `tests/phase54/inbox-reuses-governance-gating.spec.ts` | repoint | 58-15 |  |
| `tests/phase54/library-table.spec.ts` | repoint | 58-15 |  |
| `tests/phase55/worker-path-contract.spec.ts` | repoint | 58-15 |  |
| `tests/phase56/decision-writers-sweep.spec.ts` | repoint | 58-15 |  |
| `tests/phase57/place.spec.ts` | repoint | 58-15 | 58-11 makes placeForPath null on /sops/* |
| `tests/lint/no-bulk-verify-ui.spec.ts` | repoint | 58-15 | allow-list stays |
| `tests/lint/no-dead-internal-hrefs.spec.ts` | repoint | 58-15 |  |
| `tests/phase55/deletion-sweep.spec.ts` | repoint | 58-16 | dropped-features list + LIVE_FEATURES |
| `tests/builder/builder-edit-stage.spec.ts` | delete | 58-16 |  |
| `tests/builder/builder-review-flow.spec.ts` | delete | 58-16 | 58-05 moves the gate halves to phase58 first |
| `tests/sb-layout-editor.test.ts` | delete | 58-16 |  |
| `tests/sb-section-schema.test.ts` | delete | 58-16 |  |
| `tests/integration/desktop-walkthrough-layout.spec.ts` | delete | 58-16 |  |
| `tests/integration/sequential-ack.spec.ts` | delete | 58-16 |  |
| `tests/integration/walkthrough-store-ack.spec.ts` | delete | 58-16 |  |
| `tests/integration/scp-source-viewer.test.ts` | delete | 58-16 |  |
| `tests/integration/scp-verify-checklist.test.ts` | delete | 58-16 |  |
| `tests/lint/no-static-desktop-import.spec.ts` | delete | 58-16 |  |
| `tests/phase22/visual-layer.spec.ts` | delete | 58-16 |  |
| `tests/phase23/version-supersede.spec.ts` | delete | 58-16 |  |
| `tests/phase26/ghosts.spec.ts` | delete | 58-16 |  |
| `tests/phase26/inserter.spec.ts` | delete | 58-16 |  |
| `tests/phase26/reorder.spec.ts` | delete | 58-16 |  |
| `tests/phase26/visual-block.spec.ts` | delete | 58-16 |  |
| `tests/phase26/field-map.spec.ts` | delete | 58-16 |  |
| `tests/phase26/field-inline-patterns.spec.ts` | delete | 58-16 |  |
| `tests/phase26/autosave-rewire.spec.ts` | delete | 58-16 |  |
| `tests/phase26/ai-overlay.spec.ts` | delete | 58-16 |  |
| `tests/phase26.5/agent-panel-readonly.spec.ts` | delete | 58-16 |  |
| `tests/phase29/publish-stage-approval.spec.ts` | delete | 58-16 |  |
| `tests/phase29/version-history-approvals.spec.ts` | delete | 58-16 |  |
| `tests/phase30/tab-merge.spec.ts` | delete | 58-16 |  |
| `tests/phase30/list-rows.spec.ts` | delete | 58-16 |  |
| `tests/phase30/plain-language.spec.ts` | delete | 58-16 |  |
| `tests/phase33/wayfinder-header.spec.ts` | delete | 58-16 |  |
| `tests/phase33/plain-language-access.spec.ts` | delete | 58-16 |  |
| `tests/phase36/version-breakdown-panel.spec.ts` | delete | 58-16 |  |
| `src/components/admin/verify-checklist/__tests__/VerifyChecklistGate.test.tsx` | delete | 58-16 |  |
| `src/components/admin/verify-checklist/__tests__/publish-gate.integration.test.ts` | delete | 58-16 | 58-05 moves the gate halves first |

## Deviations from Plan

**1. [Rule 2 - coverage] Extra retired tokens.** Added `builder-v2`, `Edit in builder` and the converter `--apply` spawn form to RETIRED so research-named specs that quote none of the plan's listed names (the phase26 builder-v2 specs, `sop-detail.eval.ts`, `convert-apply.spec.ts`) are caught by Test A and owned. The plan's "converter apply-scope message" has no literal in `convert-apply.spec.ts` (it asserts exit code 2), so the spawn form is the token.

**2. [Rule 2 - coverage] Walk includes src test files.** The inventory walk also scans `*.test.ts(x)` beside source under `src/` (as the plan's step 3 required), which surfaced the two `verify-checklist/__tests__` files and the parser junction test.

**3. Informational rows beyond token hits.** Rows for research-named files with no token today (publish-core-extraction, publish-chain-gate, publish-gate-pin, bundle-gate, parser-creates-junctions, version-supersede, field-inline-patterns, autosave-rewire, ai-overlay, sb-ux-blueprint, spine-freeze, parse-status-no-navigate-after-unmount, no-dead-internal-hrefs, walkthrough-store-ack, library-and-worker etc.) so their owners are on record. Task 1's commit message says 78 rows; the real count is 82.

Dispositions are first guesses from RESEARCH; owning plans may flip repoint to delete (or the reverse) in the same commit as the change. The `scripts/*-check.tsx` builder harnesses are not walked (not spec/test/eval files); 58-16 must delete them by hand.

## Known Stubs

All 12 requirement specs and the retirement-sweep cases are deliberate `test.fixme` stubs; each names the plan that turns it live.

## Threat Flags

None. Test harness and one CSS token only; no request path changes.

## Self-Check: PASSED

- All 14 `tests/phase58/*.spec.ts` files present and listed by `--list`
- Commits `1374849f`, `c476d896`, `0bb0f60b` exist
- `--text-step: 28px` present inside the `@theme {` block of `src/styles/blueprint-theme.css`
