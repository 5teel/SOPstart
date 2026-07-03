---
phase: 26-sop-builder-redesign
plan: 12
subsystem: admin-builder
tags: [bespoke-editor, selection-sync, ai-overlays, verify-gate, behavioural-parity, R8, P12, P13, P9, P8, D-01]
requires:
  - editable-document
  - block-edit-shell
  - useSelectionSync
  - reviewer-flags-panel
  - verify-checklist-gate
provides:
  - selection-bridge
  - canvas-source-selection-sync
  - bespoke-ai-flag-overlays
  - orphan-image-chip
  - per-block-verify-chip
affects:
  - src/components/admin/builder-v2/BlockEditShell.tsx
  - src/components/admin/builder-v2/EditableDocument.tsx
tech-stack:
  added: []
  patterns:
    - "Re-wire, don't rebuild — useSelectionSync / ReviewerFlagsPanel / PuckItemBadgeOverlay / verifyBlock reused AS-IS; only the caller moved off Puck's componentOverlay to BlockEditShell (P12/P13/P8)"
    - "selection-bridge.ts: pure selectBlock / resolveRegion / resolveComponentIdFromSource helpers extracted so BOTH selection directions are behaviourally testable (spy on setActiveProvenance), not a grep (CLAUDE.md 2026-06-05)"
    - "Behavioural publish-gate proof invokes the REAL route handler with a mocked Supabase builder (Module._load intercept) — the server 400 path runs, not a source-contract regex"
    - "One flags panel expanded at a time = single openFlagsFor state lifted to EditableDocument (structural guarantee, UI-SPEC §Review Overlays)"
key-files:
  created:
    - src/components/admin/builder-v2/selection-bridge.ts
    - scripts/selection-sync-check.tsx
    - scripts/ai-overlay-check.tsx
    - scripts/verify-gate-check.tsx
    - tests/phase26/selection-sync.spec.ts
    - tests/phase26/ai-overlay.spec.ts
    - tests/phase26/verify-gate.spec.ts
  modified:
    - src/components/admin/builder-v2/BlockEditShell.tsx
    - src/components/admin/builder-v2/EditableDocument.tsx
decisions:
  - "The canvas host is EditableDocument (not BuilderClient) — 26-04 split the Puck-era BuilderClient into a thin shell + EditableDocument. The plan's BuilderClient line refs are Puck-era; the junction fetch / reverse-handler / reviewer-flags / verify wiring all landed in EditableDocument (the live canvas inside the SourceViewerSelectionProvider). BuilderClient needed no change."
  - "BlockEditShell owns the forward selection FIRE (calls useSelectionSync().setActiveProvenance) so the must-have artifact 'BlockEditShell contains setActiveProvenance' holds AND the fire is one focus handler; region resolution (junctionMap → block_provenance) stays in EditableDocument."
  - "Verify chip does NOT import the server actions into BlockEditShell — the shell is presentational (onToggleVerify callback); EditableDocument owns verifyBlock/unverifyBlock so the shell stays clean for the render harnesses."
  - "selectable = junctionMap.size > 0 (convert SOPs have junction rows) gates ALL of selection-sync / overlays / verify chip — non-convert SOPs show none (UI-SPEC body:not(.convert) rule)."
metrics:
  duration: ~75m
  completed: 2026-07-03
  tasks: 3
  files_changed: 9
---

# Phase 26 Plan 12: Re-earn Puck's componentOverlay bindings on the bespoke canvas Summary

Re-wired the three UI bindings Puck's `componentOverlay` gave for free (D-01 full-bespoke) plus the per-block verify UI, all keyed off the same `componentIdToJunction` map, each proven with a **behavioural** parity test (CLAUDE.md 2026-06-05 — presence tests are exactly the blind spot that shipped dead features before). `useSelectionSync`, `ReviewerFlagsPanel`, `PuckItemBadgeOverlay`, `verifyBlock`/`unverifyBlock`, and the server publish route are all reused UNCHANGED — only their caller moved off Puck to `BlockEditShell` / `EditableDocument`. `layout_data` / junction / `block_provenance` FROZEN.

## What was built

### Task 1 — P12 selection-sync re-wire (canvas ↔ source, behavioural) (`c6cd390`)
- `selection-bridge.ts` (pure, testable): `selectBlock` (the exact fn the shell's focus handler runs — fires `setActiveProvenance(region, junctionId)`; inline block clears to `null,null`), `resolveComponentIdFromSource` (reverse: source junction id → canvas componentId, repointing `[data-puck-item-id]` → `[data-block-id]`), `resolveRegion` (junction → `block_provenance`), `focusCanvasBlock` (DOM shim).
- `BlockEditShell` fires selection on focus/click when `selectable`; renders `data-block-id` + focusable `tabIndex`. `EditableDocument` fetches junction rows (`listSectionBlocksWithUpdates`), builds `componentIdToJunction`, and registers the source→canvas reverse handler. Non-convert SOPs (empty junction map) stay inert.
- `selection-sync.spec` + `scripts/selection-sync-check.tsx`: both directions behavioural — forward fire (spy asserts region+junctionId, inline-clear), forward region resolve, reverse id→componentId, shell focusable w/ `data-block-id`; non-convert inert. `useSelectionSync.tsx` git-diff empty.

### Task 2 — P13 AI-flag overlays + P9 orphan chip (reused components) (`1f56bf0`)
- `BlockEditShell`: `⚑` header flag-count badge (`--ai` purple) that toggles the inline reused `ReviewerFlagsPanel` (keyed by junctionId); the reused 13-04 `PuckItemBadgeOverlay` wraps the body for the "update ▸" badge; the dashed "Reference images" chip on `HeadingBlock`s whose `text` starts `Unanchored figures…`. Badges sit inside the block header (never floating).
- `EditableDocument`: `useReviewerFlags(sopId)` counts open flags per junctionId; `openFlagsFor` single-state guarantees ONE panel expanded at a time (UI-SPEC).
- `ai-overlay.spec` + `scripts/ai-overlay-check.tsx`: seeds the reviewer-flags query and renders through a real `QueryClientProvider` — asserts the REAL `ReviewerFlagsPanel` flag row renders on the flagged block, none on a clean block, and the chip appears only on the orphan heading.

### Task 3 — P8 per-block verify chip + real-route publish-gate regression (`038d0ac`)
- `BlockEditShell`: single-block `✦ tap to verify` → `✓ verified` chip (green `--accent-ok`); NO bulk-verify affordance (R8 guard stays green). `EditableDocument` writes through the EXISTING `verifyBlock`/`unverifyBlock` actions, then refreshes junctions + invalidates the shared `['verify-checklist', sopId]` query so the publish gate re-reads.
- `verify-gate.spec` + `scripts/verify-gate-check.tsx`: invokes the **REAL** `POST /api/sops/[sopId]/publish` handler (Supabase builder + auto-queue mocked via `Module._load`): unverified → 400 `unverified_blocks {count}`; all-verified → 200 `success`; unapproved-section → 400 (proves the gate isn't a blanket pass). Publish route file UNCHANGED.

## Deviations from Plan

### Adjustments (Rule 3 — blocking / stale plan refs)

**1. [Rule 3] Canvas host is EditableDocument, not BuilderClient (stale Puck-era line refs)**
- **Found during:** Task 1. The plan's `<read_first>` cites `BuilderClient.tsx` L203/L251–313 (`componentIdToJunction`, selection wiring, `[data-puck-item-id]`). Plan 26-04 removed ALL of that when it swapped `<Puck>` for `<EditableDocument>`; those lines no longer exist.
- **Fix:** rebuilt the junction map + selection/overlay/verify wiring in `EditableDocument` (the live canvas, inside `SourceViewerSelectionProvider`) + `BlockEditShell`. `BuilderClient` needed no change.
- **Files:** `EditableDocument.tsx`, `BlockEditShell.tsx`. **Commits:** all three.

No auto-fixed bugs; no architectural (Rule 4) changes. Frozen contract untouched.

## Frozen-contract / journeys note
No `layout_data`, junction, or `block_provenance` shape changed. No user-facing route added/removed/rerouted — this is internal wiring on the existing `/admin/sops/builder/[sopId]` Build stage — so `src/lib/journeys/journeys.ts` needs no update (same as 26-03/26-04). Publish route (`/api/sops/[sopId]/publish`) git-diff empty. `useSelectionSync.tsx` git-diff empty.

## Known Stubs
None. All three bindings are behaviourally wired and proven; no hardcoded empty data flows to the overlays (reviewer flags + junction rows are server-fetched; verify writes hit the real action).

## Threat Flags
None new. Register mitigations satisfied: T-26-12-01 (server publish route 400 authoritative + UNCHANGED — P8 KEEP), T-26-12-02 (no-bulk-verify lint guard re-run green — R8), T-26-12-03 (reviewer flags keyed off org-scoped junction rows, overlay read-only).

## Verification
- `npx playwright test --project=phase26` → **85 passed** (selection-sync 1, ai-overlay 1, verify-gate 1 + prior 82).
- `npx tsx scripts/{selection-sync,ai-overlay,verify-gate}-check.tsx` → all OK.
- `npx playwright test -g "no-bulk-verify"` → 2 passed (R8 guard green).
- `git diff` on `src/app/api/sops/[sopId]/publish/route.ts` and `useSelectionSync.tsx` → empty (server gate + context UNCHANGED).
- `npx tsc --noEmit` → clean.
- `npm run build` → green; postbuild bundle gate **1054 KB, Δ 0 KB, isolation OK** — admin-only builder-v2 overlay/verify imports did NOT leak into the worker `/sops/[sopId]` bundle.

## Self-Check: PASSED
- FOUND: src/components/admin/builder-v2/selection-bridge.ts
- FOUND: scripts/selection-sync-check.tsx
- FOUND: scripts/ai-overlay-check.tsx
- FOUND: scripts/verify-gate-check.tsx
- FOUND: tests/phase26/selection-sync.spec.ts
- FOUND: tests/phase26/ai-overlay.spec.ts
- FOUND: tests/phase26/verify-gate.spec.ts
- FOUND commit: c6cd390 (Task 1 — P12 selection-sync)
- FOUND commit: 1f56bf0 (Task 2 — P13 overlays + P9 chip)
- FOUND commit: 038d0ac (Task 3 — P8 verify + gate regression)
