---
phase: 26-sop-builder-redesign
plan: 14
subsystem: builder
tags: [R6, R8, D-01, puck-removal, golden-path, spine-regression, field-map, pathways, uat]
requires:
  - convert-golden-path-baseline
  - block-registry
  - field-map
  - content-ops-reducer
provides:
  - spine-regression
  - puck-free-end-state
  - puck-field-baseline
affects:
  - package.json
  - src/lib/builder/puck-config.tsx
  - src/lib/journeys/journeys.ts
  - src/lib/uat/tests.ts
tech-stack:
  added: []
  removed:
    - "@puckeditor/core (0.21.2) — full-bespoke end-state; render place is block-registry, fields bespoke"
  patterns:
    - "Frozen field-set baseline as a committed fixture (puck-field-baseline.json) once the source-of-truth file is deleted — parity test reads the snapshot, 0-unreachable preserved"
    - "Aggregated source-contract + behavioural regression sweep (spine-regression) as the R8 frozen-spine proof"
key-files:
  created:
    - tests/phase26/spine-regression.spec.ts
    - tests/phase26/fixtures/puck-field-baseline.json
  modified:
    - package.json
    - package-lock.json
    - src/app/(protected)/admin/sops/builder/[sopId]/page.tsx
    - src/hooks/useBuilderAutosave.ts
    - src/components/sop/LayoutRenderer.tsx
    - src/lib/builder/block-registry.tsx
    - src/lib/builder/sanitize-layout.ts
    - tests/phase26/field-map.spec.ts
    - tests/builder/builder-edit-stage.spec.ts
    - src/lib/journeys/journeys.ts
    - src/lib/uat/tests.ts
  deleted:
    - src/lib/builder/puck-config.tsx
decisions:
  - "convert-golden-path (26-02) needed NO change to become the R6 regression guard — the frozen D-01 contract is the deterministic converter, which is byte-unchanged; the spec already deep-equals the pre-phase fixture against post-bespoke code."
  - "Deleting puck-config.tsx breaks field-map.spec's live-source parity read — snapshot the exact per-block field sets into a committed puck-field-baseline.json (captured with the SAME indent parser the spec used) so the P14 0-unreachable guarantee holds against the frozen pre-removal contract."
  - "npm uninstall @puckeditor/core (not hand-edit) to keep package.json + package-lock.json + node_modules consistent in one shot."
  - "Obsolete Phase-11 Puck-contract specs (sb-builder-infrastructure, sb-layout-editor, sb-auth-builder, sb-section-schema) were ALREADY RED before this wave (earlier-wave render-swap + 21.5 route deletions) — OUT OF SCOPE per SCOPE BOUNDARY; logged to deferred-items.md. builder-edit-stage.spec.ts (which 26-14 directly breaks by deleting puck-config) WAS updated to the bespoke end-state."
metrics:
  duration: ~35m
  completed: 2026-07-03
  tasks: 3
  files_changed: 14
---

# Phase 26 Plan 26-14: Close Phase 26 — Frozen-Contract Proof + Puck Removal Summary

Closed Phase 26 (v5.0 opener, D-04): proved the FROZEN contract survived the full-bespoke swap (R6 byte-equivalence + R8 spine regression), removed `@puckeditor/core` entirely for the full-bespoke end-state (D-01), and kept the pathways/UAT maps honest. Worker bundle Δ 0 KB, build/tsc/phase26-suite all green with Puck absent.

## What was built

### Task 1 — R6 golden-path parity + R8 spine regression (`b387537`)
- **convert-golden-path.spec.ts** required NO change to become the R6 regression guard. The frozen D-01 contract IS the deterministic converter (`parsedSopToPerSectionLayoutData` + `puckPropsToBlockContent`), which is byte-unchanged by the bespoke swap; the 26-02 spec already re-runs `buildGoldenSnapshot()` against post-phase code and deep-equals the committed `convert-golden.json` (layout_data + junctions + provenance). Green ⇒ R6 proven.
- **spine-regression.spec.ts** (new) aggregates the four R8 invariants:
  - (a) publish route still emits `unverified_blocks` + `{ status: 400 }` (source tripwire);
  - (b) **behavioural** — a converted HazardCard round-tripped through the real `content-ops` reducers (`updateBlockProps` → `reorderBlocks` → `duplicateBlock`) keeps `props.junctionId` + `block_provenance` (deep-copied, not shared) — the R7/Pitfall-7 lossless proof, not a grep;
  - convert-time: every junction `buildGoldenSnapshot` emits is `pinned` / unverified / provenanced;
  - (c) no bulk-verify affordance anywhere in `src/` (D-21-07 lock re-asserted);
  - (d) worker completions written via `.insert(` (append-only).

### Task 2 — remove @puckeditor/core (`9866024`)
- Confirmed `grep -rn "@puckeditor/core" src` = **0** after dropping the last real consumers:
  - `page.tsx` — deleted the `import '@puckeditor/core/puck.css'` (Puck editor chrome gone; blocks are bespoke Tailwind);
  - `useBuilderAutosave.ts` — replaced `import type { Data } from '@puckeditor/core'` with a local `layout_data` type (`{ content, root, zones? }`);
  - scrubbed the 3 remaining `@puckeditor/core`-mentioning comments (LayoutRenderer, block-registry, sanitize-layout).
- **Deleted** `src/lib/builder/puck-config.tsx` (fully dead: no runtime importer — `sanitizeLayoutContent` relocated to `sanitize-layout.ts` in 26-03, render place is `block-registry` since 26-03, fields bespoke since 26-06/26-07).
- Removed `@puckeditor/core` from `package.json` + `package-lock.json` via `npm uninstall`.
- **field-map P14 parity preserved without the live source:** snapshotted the exact per-block field sets + component list into `tests/phase26/fixtures/puck-field-baseline.json` (captured with the SAME indent parser `field-map.spec` used against the live file), and repointed `field-map.spec.ts` to read the fixture. Parity + 0-unreachable (18 blocks, incl. bespoke VisualBlock) still green.
- Repointed `builder-edit-stage.spec.ts` E3/E4/E3-bespoke from Puck-config internals to the bespoke end-state (BLOCK_COMPONENTS render place + puck-config deleted; InlineText `contentEditable`; BuilderClient mounts EditableDocument and imports no Puck).
- **`npm run build` green:** prebuild contract-check 18/18/18 on block-registry, next build clean, postbuild worker bundle **1054 KB, Δ 0 KB**, source-viewer + Konva isolation OK.

### Task 3 — pathways + UAT maps (`0056247`)
- `journeys.ts`: enriched the `builder-review-publish` Build stage to describe the bespoke editor (edit==worker parity R2, inline add/edit/reorder/duplicate, P14 reachability, Konva annotate→baked-PNG) and note create/convert/edit converge on this one surface (Puck removed). No journey referenced Puck; the builder route is unchanged and covered ⇒ **0 not-mapped** for the phase's routes.
- `uat/tests.ts`: added two Phase-26 VALIDATION items — `p26-edit-worker-parity` (R2 visual parity, edit vs worker read) and `p26-baked-annotation-on-worker-read` (annotate→publish→worker baked-PNG) — alongside the existing `p26-annotation-editor-feel` device residual.

## Deviations from Plan

### Auto-fixed / adjustments (Rules 1–3)

**1. [Rule 3 — Blocking] Snapshot fixture for field-map parity after puck-config deletion**
- **Found during:** Task 2. `field-map.spec.ts` read `puck-config.tsx` live as ground truth; deleting the file throws.
- **Fix:** captured `tests/phase26/fixtures/puck-field-baseline.json` (17 Puck blocks + field sets) and repointed the spec. 0-unreachable / 18-block parity preserved against the frozen pre-removal contract.
- **Commit:** `9866024`.

**2. [Rule 3 — Blocking] Extra real consumers of @puckeditor/core not in the plan's file list**
- The plan's grep-zero precondition did not hold at wave start: `page.tsx` (CSS import) and `useBuilderAutosave.ts` (`Data` type) still imported Puck, plus 3 comments. Fixed all so `grep -rn "@puckeditor/core" src` = 0 before removing the dep.
- **Files:** `page.tsx`, `useBuilderAutosave.ts`, `LayoutRenderer.tsx`, `block-registry.tsx`, `sanitize-layout.ts`. **Commit:** `9866024`.

**3. [Rule 1 — Reconciliation] Updated builder-edit-stage.spec.ts (not in files_modified)**
- Deleting puck-config directly breaks its E3/E4 (they `readFileSync` puck-config). Repointed E3/E4/E3-one-list→E3-bespoke to the bespoke end-state. **Commit:** `9866024`.

### Out of scope (documented, NOT fixed)
- Pre-existing RED Phase-11 Puck-contract specs (`sb-builder-infrastructure`, `sb-layout-editor`, `sb-auth-builder`, `sb-section-schema`) — already failing before 26-14 from earlier-wave render-swap + 21.5 route deletions. Logged to `deferred-items.md` for a dedicated cleanup pass. 26-14 keeps the **phase26 suite + build + tsc** green (the phase's own gate), not the obsolete pre-phase contracts.

## Known Stubs
None introduced. (Carried phase residual: `p26-annotation-editor-feel` device-UX + the 26-13 `sopImageId`-for-hand-added-diagrams stub — both pre-existing, tracked in STATE/UAT.)

## TDD Gate Compliance
Task 1 is `tdd="true"`. `spine-regression` is a frozen-contract regression tripwire for behaviour that already holds; a test-first RED would be an import error, not a meaningful behavioural failure (same shape/precedent as 26-02/26-06). Committed as a single `test(26-14)` commit `b387537`. convert-golden-path was already green as the R6 guard.

## Threat Flags
None new. Register mitigations landed: T-26-14-01 (byte-equivalence golden-path vs pre-phase fixture — green), T-26-14-02 (spine-regression asserts the 400 publish gate + no-bulk-verify hold), T-26-14-03 (grep-zero guard before dep removal + real `npm run build` gate — worker bundle Δ0).

## Verification
- `npx playwright test --project=phase26 -g "convert-golden|spine-regression"` → 8 passed.
- `npx playwright test --project=phase26` → **102 passed** (field-map parity green off the fixture, Puck absent).
- `npx playwright test --project=phase21.6-stubs` → green (builder-edit-stage bespoke).
- `npx playwright test -g "no-bulk-verify"` → 2 passed.
- `grep -rn "@puckeditor/core" src` → 0; `grep -c "@puckeditor" package.json package-lock.json` → 0 / 0.
- `npx tsc --noEmit` → clean.
- `npm run build` → green; contract-check 18/18/18; worker `/sops/[sopId]` **1054 KB, Δ 0 KB**; source-viewer + Konva isolation OK.

## Self-Check: PASSED
- FOUND: tests/phase26/spine-regression.spec.ts
- FOUND: tests/phase26/fixtures/puck-field-baseline.json
- DELETED (confirmed absent): src/lib/builder/puck-config.tsx
- FOUND commit: b387537 (Task 1)
- FOUND commit: 9866024 (Task 2)
- FOUND commit: 0056247 (Task 3)
