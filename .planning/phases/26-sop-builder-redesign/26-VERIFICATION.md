---
phase: 26-sop-builder-redesign
verified: 2026-07-03T00:00:00Z
status: passed
score: 8/8 requirements verified (R1–R8) + Preservation Checklist P1–P18 dispositioned
verdict: PASS-WITH-NOTES
re_verification:
  previous_status: none
  note: initial goal-backward verification
human_verification:  # expected, pre-recorded UAT residuals — NOT blockers
  - test: "p26-annotation-editor-feel — on-device Konva draw/select/undo/palm-reject/re-open feel"
    expected: "Annotate a diagram on sopstart.com; stylus draws, transform handles work, undo/redo, non-destructive re-open"
    why_human: "Stylus/pointer behaviour needs a real device; unprovable headless (recorded in src/lib/uat/tests.ts, run after 26-13 deploy)"
  - test: "p26-edit-worker-parity — R2 visual parity, edit canvas vs worker read"
    expected: "Same SOP renders visually identical in edit canvas and worker view at 1366px"
    why_human: "Pixel-level visual equivalence needs a browser + human eye (recorded UAT item)"
  - test: "p26-baked-annotation-on-worker-read — annotate → publish → worker baked PNG"
    expected: "Worker read serves a flat baked PNG (zero Konva) for an annotated diagram"
    why_human: "End-to-end persist+bake+read across deploy needs a live environment"
notes:
  - "Obsolete Phase-11 Puck-contract specs (sb-builder-infrastructure/sb-layout-editor/sb-auth-builder/sb-section-schema) are pre-existing RED, assert the deleted puck-config/@puckeditor/core architecture, untouched by phase 26. Follow-up cleanup, NOT a Phase-26 regression (deferred-items.md)."
  - "26-13 known stub: diagram-item sopImageId not yet threaded onto hand-added diagram slots; 'Save & bake' disabled for unlinked slots. saveAnnotation/bakeAnnotation write path is fully real + org-safe. Tracked follow-up."
---

# Phase 26: SOP Builder Redesign — Verification Report

**Phase Goal:** One SOP surface (create/convert/edit) where the admin edits the exact document a worker reads (inline WYSIWYG, edit==worker render), inserts via a tiered context-aware menu with auto-dismissing smart ghosts, uses a unified Visual block (photo·diagram·video incl. absorbed Phase-17 Konva annotation), with agent-metadata contract hooks — all preserving the parse→layout_data→junction→provenance→AI-review→verify→publish spine unchanged, and Puck fully removed (D-01 full-bespoke, v5.0 opener).

**Verified:** 2026-07-03
**Status:** PASS-WITH-NOTES (all R1–R8 verified in code; expected human-UAT residuals + one obsolete-spec cleanup noted)
**Re-verification:** No — initial verification

## Verification Method

Verified against the actual codebase, not SUMMARY claims: ran `npx tsc --noEmit`, the full `phase26` Playwright suite, `npm run build` (prebuild contract-check + next build + postbuild bundle gate), `scripts/contract-check.ts`, and `git diff` of KEEP files against the true phase-start parent `44d3e34`.

## Goal Achievement — Requirements R1–R8

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| R1 | One surface, three on-ramps → one bespoke builder | ✓ VERIFIED | `BuilderClient.tsx` mounts `EditableDocument` (bespoke); Puck removed. Convert path produces identical `layout_data`/junctions (R6 golden green). `journeys.ts` updated: create/convert/edit converge on the one builder route. |
| R2 | Inline WYSIWYG: edit == worker render | ✓ VERIFIED | `LayoutRenderer.tsx` Puck-free, maps to `BLOCK_COMPONENTS` (the worker block components). `BlockEditShell` renders the SAME `BLOCK_COMPONENTS[type]` (no forked renderer). `render-parity.spec` (behavioural tsx/react-dom-server harness) proves all 18 types emit the registered component's markup. Pixel parity → human UAT `p26-edit-worker-parity`. |
| R3 | Tiered, context-aware inserter | ✓ VERIFIED | `inserter-model.ts` (pure LANE/SMART/GROUPS + keyboard/filter helpers) + `InserterMenu` + `ReuseTier` (wraps Phase-13 `BlockPicker`, dept-scope toggle). `inserter.spec` 8 passed: Hazards vs Steps "Fits here" differ, ↑↓/↵ keyboard nav, type-to-filter, dept-scoped reuse. |
| R4 | Smart-next auto-dismissing ghosts | ✓ VERIFIED | `useSmartGhosts.ts` pure state machine (computeGhosts/resolveGhostVisibility/ghostsGoneOnTyping) + `GhostRow`. `ghosts.spec` 9 tests: appear, self-suppress when redundant, one-live/dim, scroll-past-gone, typing-dismiss; accept→`insertBlock`→autosave. rAF/ref, no scroll re-render. |
| R5 | Unified Visual block (18th type) + Konva | ✓ VERIFIED | `VisualBlock.tsx` registered 3-place; `contract-check` = 18/18/18. Medium tags `visual:photo\|diagram\|video` on `/api/schema` (`introspection.ts:173`). Absorbed Phase 17: `annotation-tools.ts` (6 primitives, undo/redo, palm-reject), `AnnotationEditor`, `DiagramHotspotBlock`, `saveAnnotation`/`bakeAnnotation`, baked-PNG worker read. Konva absent from worker bundle (build gate). |
| R6 | Convert golden-path byte-equivalence | ✓ VERIFIED | `convert-golden-path.spec` deep-equals live capture vs pre-phase `convert-golden.json` (26-02 baseline). Converter `parsed-sop-to-layout-data.ts` git-**UNCHANGED** across phase → baseline is meaningful. Green. |
| R7 | Agent contract HOOKS ONLY (lossless props + medium tags) | ✓ VERIFIED | `content-ops` spread-merge preserves `junctionId`/`block_provenance`/unknown `__agent` keys — `props-roundtrip.spec` (5, behavioural). Medium tags surfaced on `/api/schema`. Memory/learning/review surfacing correctly SPLIT to 26.5 (D-02) — not built here (correct scope). |
| R8 | No regression (publish gate, junction stamping, no-bulk-verify, append-only) | ✓ VERIFIED | Publish route git-**UNCHANGED** + `verify-gate-check.tsx` invokes the REAL route: unverified→400 `unverified_blocks{count}`, all-verified→200. `no-bulk-verify` guard 2 passed. `spine-regression.spec` asserts append-only `.insert(` + provenance lossless. Worker bundle Δ0 KB. |

**Score:** 8/8 requirements verified.

## Preservation Checklist P1–P18

### KEEP items — git-diff UNCHANGED across phase (base `44d3e34`)

| P-item | File | Diff | Status |
|--------|------|------|--------|
| P1 | `extract-docx-structural.ts` | 0 | ✓ UNCHANGED |
| P2/P3 | `gpt-parser.ts` | 0 | ✓ UNCHANGED |
| P4/P9 | `parsed-sop-to-layout-data.ts` | 0 | ✓ UNCHANGED |
| P7 | `ai-reviewer/orchestrator.ts` | 0 | ✓ UNCHANGED |
| P8 (server gate) | `api/sops/[sopId]/publish/route.ts` | 0 | ✓ UNCHANGED |
| P12 (component) | `source-viewer/useSelectionSync.tsx` | 0 | ✓ UNCHANGED |
| — (verifier) | `verify-sop.ts` | 0 | ✓ UNCHANGED |
| P15 (registry) | `introspection.ts` | +16 −0 | ✓ ADDITIVE (VisualBlock entry; no existing shape mutated) |
| P5 (Zod) | `validators/blocks.ts` | +27 −0 | ✓ ADDITIVE (VisualBlock kind + bakedSrc/sopImageId; discriminated-union add, 0 deletions) |

### Non-KEEP items — behavioural parity tests (not source-contract), all in the green suite

| P-item | Disposition | Behavioural proof |
|--------|-------------|-------------------|
| P8 | RE-IMPLEMENT verify UI | `verify-gate.spec`/`verify-gate-check.tsx` — invokes the REAL publish handler (400/200) + per-block chip, no bulk-verify |
| P11 | RE-WIRE autosave | `autosave-rewire.spec` — edit→`draftLayouts` row (byte-identical to `useBuilderAutosave`)→reload renders edited text via worker `LayoutRenderer` |
| P12 | RE-WIRE selection-sync | `selection-sync.spec` — both directions: forward `setActiveProvenance(region, junctionId)` spy, reverse source→`[data-block-id]` |
| P13 | RE-IMPLEMENT overlays | `ai-overlay.spec` — real `ReviewerFlagsPanel` rendered via `QueryClientProvider`, flag row on flagged block only, orphan chip on orphan heading |
| P14 | RE-IMPLEMENT 18 field editors | `field-map`/`field-inline-patterns`/`field-panel-reachability` — 0 unreachable across all 18 blocks (43 fields), edits persist through Zod-validated lossless commit |
| P17 | RE-IMPLEMENT unknown-block guard | `render-parity.spec` — unknown type → `UnsupportedBlockPlaceholder` surfacing original type; `sanitize-layout.ts` |

## Frozen Contract

| Check | Result |
|-------|--------|
| `layout_data` / junctions / `block_provenance` shapes | Unchanged (additive-only for the new `visual` kind; 0 deletions in blocks.ts/introspection) |
| 3-place contract-check | ✓ 18/18/18 (BLOCK_COMPONENTS / BLOCK_REGISTRY / BlockContentSchema) |
| `puck-config.tsx` | ✓ DELETED |
| `@puckeditor/core` in `src/` | ✓ 0 imports |
| `@puckeditor/core` in `package.json` | ✓ 0 (uninstalled) |

## Bundle Isolation (postbuild gate)

| Check | Result |
|-------|--------|
| Worker `/sops/[sopId]/page` First Load JS | 1054 KB, **Δ 0 KB** (±2 tolerance) |
| Konva + react-konva in worker bundle | ✓ ABSENT (admin-only, dynamic ssr:false) |
| pdfjs + mammoth in worker bundle | ✓ ABSENT |
| Puck in worker read path | ✓ ABSENT by construction (LayoutRenderer no longer references Puck) |

## Behavioural Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript typecheck | `npx tsc --noEmit` | exit 0, clean | ✓ PASS |
| Full phase26 suite | `npx playwright test --project=phase26` | **102 passed** | ✓ PASS |
| 3-place contract | `npx tsx scripts/contract-check.ts` | 18/18/18 | ✓ PASS |
| Production build + bundle gate | `npm run build` | exit 0; Δ0; Konva/source-viewer isolation OK | ✓ PASS |
| No-bulk-verify guard (R8) | `npx playwright test -g "no-bulk-verify"` | 2 passed | ✓ PASS |
| P14 reachability | (in suite) | 0 unreachable across 18 blocks | ✓ PASS |

The `npm run build` pass is significant: it is the real gate for the `'use server'` async-only rule (CLAUDE.md 2026-06-27) that `annotations.ts` touches. Confirmed: `annotations.ts` starts `'use server'`; the pure `baked-path.ts` helper lives in `src/lib/builder/` (non-server). Build green ⇒ no sync value export in the server module.

## Anti-Patterns / Deferred

| Item | Severity | Notes |
|------|----------|-------|
| Obsolete Phase-11 Puck-contract specs (4 files) | ℹ️ Info | Pre-existing RED, assert deleted `puck-config`/`@puckeditor/core` (6 puck-config refs in sb-layout-editor). Untouched by phase 26 → not a Phase-26 regression. Follow-up cleanup per `deferred-items.md`. |
| 26-13 `sopImageId` not threaded to hand-added diagram slots | ⚠️ Warning | "Save & bake" disabled for unlinked diagram slots; pipeline-extracted diagrams work. Write path (`saveAnnotation`/`bakeAnnotation`) is fully real + org-scoped. Tracked follow-up, not blocking. |

## Human Verification Required (expected, pre-recorded UAT)

These were deliberately deferred as device/visual UAT items and recorded in `src/lib/uat/tests.ts`. They do not block the phase goal (all automated gates green):

1. **p26-annotation-editor-feel** — on-device Konva draw/select/undo/palm-reject/re-open feel (device-only; run on sopstart.com post-26-13 deploy).
2. **p26-edit-worker-parity** — R2 visual pixel parity, edit canvas vs worker read at 1366px.
3. **p26-baked-annotation-on-worker-read** — annotate → publish → worker serves baked PNG.

## Gaps Summary

No blocking gaps. All 8 locked requirements (R1–R8) are genuinely delivered in the codebase and proven by behavioural (not source-contract) tests. The full Preservation Checklist is dispositioned: every KEEP file is git-unchanged; every RE-WIRE/RE-IMPLEMENT item has a behavioural parity test in the green suite. The frozen contract (layout_data/junctions/block_provenance) is intact with additive-only Zod/registry changes for the 18th Visual block; contract-check is 18/18/18; Puck is fully removed with the worker bundle Δ0 and Konva/Puck-isolated. Residual items are the three expected human-UAT device/visual checks and one obsolete-spec cleanup — none of which contradict the phase goal.

**STATUS: PASS-WITH-NOTES — Phase 26 goal achieved. R1–R8 verified in code, all automated gates green (102 phase26 tests, tsc, build, contract 18/18/18, bundle Δ0, Puck removed). Notes: 3 expected device/visual human-UAT residuals + 1 obsolete Phase-11 spec cleanup follow-up.**

---

_Verified: 2026-07-03_
_Verifier: Claude (gsd-verifier) — goal-backward, codebase-evidence-based_
