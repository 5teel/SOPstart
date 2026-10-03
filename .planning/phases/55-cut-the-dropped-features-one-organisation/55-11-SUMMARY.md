---
phase: 55-cut-the-dropped-features-one-organisation
plan: 11
subsystem: sop-authoring
tags: [deletion, content-library, builder, server-actions, sweep]
requires:
  - phase: 55-10
    provides: flow, annotation and version-compare removed; bundle 817 KB
provides:
  - content library pages, components, actions and Reuse tier deleted
  - builder editor without Reuse tier or update badge; wizard without library picker; header without Content link
  - library sweep live and mutation-proven
affects: [55-13, 55-14]
key-files:
  modified:
    - src/actions/sop-section-blocks.ts
    - src/components/admin/builder-v2/EditableDocument.tsx
    - src/components/admin/builder-v2/BlockEditShell.tsx
    - src/components/admin/builder-v2/inserter/InserterMenu.tsx
    - src/components/admin/builder-v2/inserter/inserter-model.ts
    - src/app/(protected)/admin/sops/new/blank/WizardClient.tsx
    - src/components/layout/TopHeader.tsx
    - src/types/sop.ts
    - src/lib/journeys/journeys.ts
    - src/lib/journeys/roles.ts
    - src/lib/uat/tests.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/phase55/deletion-sweep.spec.ts
  deleted:
    - src/app/(protected)/admin/blocks/ (3 pages + 2 client files)
    - src/components/admin/blocks/ (8 files)
    - src/actions/blocks.ts, src/lib/builder/match-blocks.ts(+test), src/lib/blocks/block-kinds.ts
    - ReuseTier.tsx, PuckItemBadgeOverlay.tsx, BlockOverflowMenu.tsx
    - tests/phase43/new-block.spec.ts, tests/sb-block-library.test.ts
decisions:
  - sop-section-blocks keeps a read-only listSectionBlocks (rows only); the builder junction map needs it
  - SopSectionBlockWithUpdate and the suggestion/category/update-decision types deleted; callers use SopSectionBlock
  - dead AddMenu loses its From library entry (component has no importers; left in place)
metrics:
  commits: 3 task commits
  completed: 2026-10-03
---

# Phase 55 Plan 11: Reusable-content library removed

**There is no library page, picker, Reuse tier or update badge any more; SOPs that already carry library-sourced content render it from their frozen snapshots, and the parser, verify chip and publish gate are untouched.**

## Tasks

| Task | Commit | Result |
|------|--------|--------|
| 1 Builder editor | 5b5ad3b | Reuse tier, update badge overlay, overflow menu deleted; inserter loses the Reuse row |
| 2 Pages, components, actions | 231cd85 | /admin/blocks, admin/blocks components, actions/blocks, match-blocks, block-kinds gone; wizard picker and junction actions gone; header Content link gone |
| 3 Specs, maps, sweep | 5446a54 | library sweep live; specs, journeys, roles, UAT, matrix repointed |

## Verification

- `npx tsc --noEmit` clean; `npm run build` clean (run after Task 2 and again after Task 3). Bundle `/sops/[sopId]` 817 KB, `/sops` 817 KB (baseline file untouched, 1048 / 940); all isolation checks OK.
- phase55 + phase26 + phase30 + phase40 + phase43 + phase46 + phase11-stubs + phase21-unit + phase21-stubs: 412 passed. Only failures were the 8 known `phase11-stubs` rows in 55-BASELINE-FAILURES.md plus two of mine, both fixed (below). phase46 live probes ran green (no OTP rate limit). Dead-href lint green. Publish gate specs (`unverified_blocks` / 400, verify-gate, spine-regression) green and not edited.

### Mutation proof

| Sweep | Planted | Result | Reverted |
|---|---|---|---|
| library | `{ href: "/admin/blocks" }` appended to TopHeader.tsx | RED (src/ has no reference, with the offending line) | GREEN |

### T-55-04 sweep (CLAUDE.md 2026-09-30)

`grep -rn serviceRole src/actions` returns nothing. Other `override`-named fields in `src/actions/*` are domain concepts (assessor override on completions/observations, all-departments pre-override in grants), none skips a guard. The surviving `sop-section-blocks.ts` exports are `listSectionBlocks` (RLS-scoped read), `verifyBlock` / `unverifyBlock` (still `requireAdmin()`, asserted by the phase46 guard-wiring spec, no `requireSopEditAccess`), and `getPublishGateStatus` (byte-identical). `parser-creates-junctions.test.ts` and the phase46 spec now assert the module carries no `serviceRole` or admin-client reference at all.

## Deviations from Plan

**1. [Rule 1 - Bug] `listSectionBlocks` kept.** The plan deletes it, but `EditableDocument` builds its junction map from it (selection sync, verify chip, reviewer-flag panel). Deleting `listSectionBlocksWithUpdates` and the fetch would have silently disabled those on every converted SOP. Replaced the call with the plain rows-only `listSectionBlocks`; the update-hydration half (latestVersion lookup) is gone. `SopSectionBlockWithUpdate` replaced by `SopSectionBlock` in `EditableDocument`, `BlockEditShell`, `selection-bridge`.

**2. [Rule 3 - Blocking] `sopCategory` prop removed from `EditableDocument`** (and its one caller `BuilderClient`); its only consumer was the Reuse tier.

**3. [Rule 1 - Bug] DAT-01 write census 40 to 39.** `acceptBlockUpdate` held the single `sops` status reset in this area; deleting it removed that write, and the now-stale `CATEGORY_EXEMPT` entry for `sop-section-blocks.ts` was removed. No surviving path lost `category_slug`. Dated comment added.

**4. [Rule 3 - Blocking] Stale references beyond the plan list.** Comments quoting deleted names reworded in `AddMenu`, `departments/page.tsx`, `InlineProposalDiff`, `section-blocks-core`, `create-block-core`, `parsed-sop-to-layout-data` (only the comment; the kept `addBlockToSection failed` log message is untouched), `puck-to-block-content`, `no-dead-internal-hrefs.spec`, `dat01-category-column.spec`, `sop-edit-owner-access.spec`. `AddMenu` (no importers) lost its "From library" row and `onOpenLibrary` prop. `tests/phase30/admin-nav.spec.ts` dropped Content and the `blocks` admin page. `types/sop.ts`: unused suggestion, category, update-decision types deleted.

**5.** `tests/integration/scp-parse-pipeline.test.ts` SCP-PARSE-07 (library listing filter) rewritten to assert the parser's `createBlockAsService` core instead of the deleted listing action. `tests/evals/dead-surface.eval.ts` lost test A and its now-unused console watcher.

## Kept (scope guard)

Tables `blocks` / `block_versions` / `sop_section_blocks`, migration 00068 `blocks_read_own_org`, `create-block-core.ts`, `section-blocks-core.ts`, `block_provenance`, `snapshot_content` reads in the verify checklist and renderer, `puck-to-block-content.ts` (ReviewStation uses it), publish gate and `assertPublishGates`. `puck-to-block-content.ts` still has a `blockContentToPuckProps` export whose original wizard caller is gone; ReviewStation keeps the module in use.

## Known Stubs

None.

## Threat Flags

None. T-55-04, T-55-11-01 (publish gate files untouched), T-55-11-02 (data and parser path untouched, survivor checks green) mitigated.

## Self-Check: PASSED

Commits 5b5ad3b, 231cd85, 5446a54 exist; deleted paths absent; `create-block-core.ts`, `section-blocks-core.ts` present; `verifyBlock`, `unverifyBlock`, `getPublishGateStatus` exported from `sop-section-blocks.ts`.
