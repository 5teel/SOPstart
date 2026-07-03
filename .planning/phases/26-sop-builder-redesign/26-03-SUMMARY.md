---
phase: 26-sop-builder-redesign
plan: 03
subsystem: worker-render
tags: [renderer-swap, puck-removal, block-registry, R2, R6, bundle-isolation, contract-gate]
requires:
  - phase26-playwright-project
  - convert-golden-path-baseline
provides:
  - block-registry
  - sanitize-layout
  - puck-free-layout-renderer
  - contract-check-on-registry
  - puck-free-bundle-baseline
affects:
  - src/components/sop/LayoutRenderer.tsx
  - scripts/contract-check.ts
  - .bundle-baseline.json
tech-stack:
  added: []
  patterns:
    - "layout_data is Puck-agnostic JSON → replacing Puck as the RENDER engine is a type→component switch (BLOCK_COMPONENTS), not a rewrite"
    - "Behavioural render-parity via a standalone tsx harness (react-dom/server) shelled out from Playwright — dodges Playwright's JSX transform ({__pw_type}) that breaks real react-dom"
    - "Prebuild 3-place contract gate reads the bespoke registry; a source-level guard spec asserts the target path is live (Pitfall 1)"
key-files:
  created:
    - src/lib/builder/block-registry.tsx
    - src/lib/builder/sanitize-layout.ts
    - scripts/render-parity-check.tsx
    - tests/phase26/block-registry.spec.ts
    - tests/phase26/render-parity.spec.ts
    - tests/phase26/contract-check-target.spec.ts
  modified:
    - src/components/sop/LayoutRenderer.tsx
    - scripts/contract-check.ts
    - scripts/capture-bundle-baseline.ts
    - .bundle-baseline.json
decisions:
  - "LayoutRenderer maps each sanitized item directly to BLOCK_COMPONENTS[type] spreading stripMeta(props) — no per-block Zod SafeRender on the read path (the write boundary blocks.ts *ContentSchema already validates; stored golden layout_data confirms clean prop shapes incl. PPE items as string[]). Structural guards kept: version gate, LayoutDataSchema.safeParse, sanitize→placeholder, warn-once."
  - "UnsupportedBlockPlaceholder lives in sanitize-layout.ts (not BLOCK_COMPONENTS). BLOCK_COMPONENTS = 17 real components; the sanitize-rewritten placeholder is rendered via LayoutRenderer's `!Block` fallback branch, surfacing the original type from props.type."
  - "sanitize-layout.ts stays a .ts file per the plan artifact contract — UnsupportedBlockPlaceholder built with createElement, not JSX."
  - "Render-parity is proven in a tsx subprocess (scripts/render-parity-check.tsx) because Playwright's test transform rewrites project JSX to {__pw_type} descriptors that real react-dom/server cannot render; a CSS/asset Module-extension stub lets Node import the block barrel (react-lightbox pulls a .css)."
metrics:
  duration: ~45m
  completed: 2026-07-03
---

# Phase 26 Plan 03: Puck-free Worker Renderer + Registry Summary

Replaced Puck as the RENDER engine on the worker read path (D-01): a bespoke 17-entry `BLOCK_COMPONENTS` registry + a `type→component` `LayoutRenderer` that renders the identical `src/components/sop/blocks/*` components the worker saw under Puck's `<Render>`, over the FROZEN `layout_data` contract. Closed both W0 contract gaps — repointed the prebuild 3-place gate onto the new registry (RESEARCH Pitfall 1) and re-captured the worker bundle baseline Puck-free.

## What was built

### Task 1 — block-registry + sanitize-layout (`1e93468`)
- `src/lib/builder/block-registry.tsx`: `BLOCK_COMPONENTS` (17 type→component, distilled from `puck-config.tsx` L216–795, DROPS Puck `fields`/`render`), `BLOCK_DEFAULTS`, and `stripMeta(props)` (drops `id`/`junctionId`/`block_provenance`). No `@puckeditor/core` import.
- `src/lib/builder/sanitize-layout.ts`: relocated `UnsupportedBlockPlaceholder` + `sanitizeLayoutContent` (P17), known-type membership now via `BLOCK_COMPONENTS`. Placeholder built with `createElement` so the module stays `.ts`.
- `tests/phase26/block-registry.spec.ts`: registry cardinality (17, placeholder separate), unknown→placeholder rewrite (original type preserved), stripMeta semantics.

### Task 2 — Puck-free LayoutRenderer + render-parity (`cf7c557`)
- Rewrote `src/components/sop/LayoutRenderer.tsx`: dropped `import { Render } from '@puckeditor/core'` and `<Render config={puckConfig} …/>`. Kept the version-support gate, `LayoutDataSchema.safeParse`, warn-once flags, and the `sanitizeLayoutContent` call. Maps each sanitized item to `BLOCK_COMPONENTS[type]` spreading `stripMeta(props)`, keyed by `props.id`; unknown/placeholder → `UnsupportedBlockPlaceholder` surfacing the original type. `'use client'`, hydration-safe.
- `scripts/render-parity-check.tsx` + `tests/phase26/render-parity.spec.ts`: for all 17 block types, the markup `LayoutRenderer` emits CONTAINS the component's direct `react-dom/server` render (R2 "same components" proof), plus unknown→placeholder (P17) and version/parse fallbacks. The spec shells out to the tsx harness because Playwright's JSX transform is incompatible with real `react-dom/server`.

### Task 3 — contract-check repoint + bundle re-capture (`8e3a58a`)
- `scripts/contract-check.ts`: place (1) now reads `BLOCK_COMPONENTS` in `block-registry.tsx` (`extractRegistryComponentKeys`); `main()` guarded to run only when executed directly. Exits 0 with 17/17/17.
- `tests/phase26/contract-check-target.spec.ts`: source-level guard that the gate targets the live registry (not `puck-config`) + behavioural run asserting exit 0 with the 17-block set (a stale target yields 0 keys → fail).
- `scripts/capture-bundle-baseline.ts`: now carries the prior floor into `previousBaseline`. Re-captured `.bundle-baseline.json`.

## Deviations from Plan

### 1. [Interpretation] Worker bundle Δ = 0, not a decrease
The plan expected a bundle DECREASE after removing Puck from the worker path. Empirically the `/sops/[sopId]/page` First Load JS is unchanged at **1054 KB (Δ 0)**. Investigation: `@puckeditor/core` lives in a single static chunk (`5fed561a…`) referenced ONLY by the admin builder route (`admin/sops/builder/[sopId]`) — it was already code-split OUT of the worker First Load. The renderer swap makes that structural: `LayoutRenderer` no longer statically references Puck at all, so the worker read path is now Puck-free by construction (not just by Next's code-splitting luck). Baseline re-captured at the same 1054 floor; `npm run build` prebuild+postbuild both green. No regression.

### 2. [Rule 2 — resilience preserved, not per-block Zod] Read-path guard
The old worker render ran a per-block `SafeRender` (Zod parse → empty-state). The plan's LayoutRenderer design maps props directly. Kept the STRUCTURAL guards (version gate + `LayoutDataSchema.safeParse` + `sanitizeLayoutContent`→placeholder + warn-once), which satisfy threat T-26-03-01; dropped only the per-block Zod empty-state because the write boundary (`blocks.ts *ContentSchema`) already validates block props and the golden `layout_data` confirms clean shapes (e.g. PPE `items` stored as `string[]`, not the Puck array-field `{item}[]`). Documented as a deliberate design choice, not an omission.

### 3. [Tooling] Render-parity + contract-target run as tsx subprocesses
Playwright's test transform rewrites project JSX to `{__pw_type}` descriptors that real `react-dom/server` cannot render, and it cannot import the ESM `contract-check.ts` (`import.meta.url`). Both behavioural specs therefore shell out (`execFileSync('npx tsx …')`) — the assertion is on the subprocess exit code + stdout. The harness installs a Module-extension stub for `.css`/asset imports so Node can load the block barrel (react-lightbox pulls a `.css`).

## Frozen-contract / journeys note
No `layout_data`, junction, or `block_provenance` shape changed (R6 golden-path spec from 26-02 still green). No user-facing route or flow was added/removed/rerouted (internal render-engine swap on the existing `/sops/[sopId]` read path) — `journeys.ts` needs no update. `@puckeditor/core` and `puck-config.tsx` kept intact (admin path + later waves reference Puck until 26-14).

## Known Stubs
None. All specs run live (no `test.fixme`) and pass green.

## Threat Flags
None — no new network endpoint, auth path, file access, or schema surface. Threat register mitigations all landed: T-26-03-01 (placeholder guard preserved), T-26-03-02 (contract-check repoint + guard spec), T-26-03-03 (baseline re-captured, postbuild gate green).

## Verification
- `npx playwright test --project=phase26` → 10 passed (block-registry 4, render-parity 1, contract-check-target 2, convert-golden 3).
- `npx tsx scripts/render-parity-check.tsx` → RENDER-PARITY OK (17 types).
- `npx tsx scripts/contract-check.ts` → OK, 17/17/17.
- `npm run build` → green (prebuild contract-check on the registry + `next build` + postbuild bundle gate 1054 KB Δ0, isolation OK).
- `npx tsc --noEmit` → clean.
- `grep @puckeditor/core src/components/sop/LayoutRenderer.tsx` → only a comment; no import.

## Self-Check: PASSED
- FOUND: src/lib/builder/block-registry.tsx
- FOUND: src/lib/builder/sanitize-layout.ts
- FOUND: src/components/sop/LayoutRenderer.tsx (Puck-free)
- FOUND: scripts/contract-check.ts (reads block-registry)
- FOUND: scripts/render-parity-check.tsx
- FOUND: .bundle-baseline.json (re-captured)
- FOUND: tests/phase26/block-registry.spec.ts
- FOUND: tests/phase26/render-parity.spec.ts
- FOUND: tests/phase26/contract-check-target.spec.ts
- FOUND commit: 1e93468 (Task 1)
- FOUND commit: cf7c557 (Task 2)
- FOUND commit: 8e3a58a (Task 3)
