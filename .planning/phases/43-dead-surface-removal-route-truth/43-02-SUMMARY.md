---
phase: 43-dead-surface-removal-route-truth
plan: 02

subsystem: content-library
tags: [security, server-actions, admin-ui, route-truth, playwright]

# Dependency graph
requires:
  - phase: 43-dead-surface-removal-route-truth
    plan: 01
    provides: no-dead-internal-hrefs.spec.ts reserved-segment fixme rule, new-block.spec.ts fixme scaffold, phase43 Playwright project
provides:
  - "src/lib/blocks/create-block-core.ts — CreateBlockInput, CreateBlockOwner, insertBlockWithVersion, createBlockAsService (plain module, no server-action endpoint)"
  - "src/lib/blocks/block-kinds.ts — BLOCK_KINDS, BlockKindSlug, seedBlockContent (shared by the library filter and the create form)"
  - "/admin/blocks/new — static route + NewBlockForm client component, submits through the existing createBlock() action"
  - "createBlock() hardened: always requireAdmin(), organisation taken only from the session; the old serviceRole wire override is gone"
affects: [43-03-scanner-wiring-dead-state, 43-04-route-shims, 43-05-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase 46 CR-01 split mirrored for blocks: insertBlockWithVersion(writer, owner, input) takes the auth decision away from the callee — the caller (server action after requireAdmin(), or createBlockAsService for the parser) supplies both the writer client and the owner"
    - "One kind vocabulary (BLOCK_KINDS in block-kinds.ts) feeds both the Content Library filter chips and the create form's radio group, so they cannot drift"

key-files:
  created:
    - src/lib/blocks/create-block-core.ts
    - src/lib/blocks/block-kinds.ts
    - "src/app/(protected)/admin/blocks/new/page.tsx"
    - "src/app/(protected)/admin/blocks/new/NewBlockForm.tsx"
  modified:
    - src/actions/blocks.ts
    - src/lib/parsers/parsed-sop-to-layout-data.ts
    - src/lib/parsers/__tests__/parser-creates-junctions.test.ts
    - tests/integration/scp-parse-pipeline.test.ts
    - "src/app/(protected)/admin/blocks/page.tsx"
    - src/lib/journeys/journeys.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/lint/no-dead-internal-hrefs.spec.ts
    - tests/phase43/new-block.spec.ts

key-decisions:
  - "D-03's 'reuse SectionKindPicker' literal instruction was NOT followed — SectionKindPicker returns a sectionKindId UUID and its vocabulary (hazards/steps/content/signoff) doesn't match the BlockContent discriminator kinds a block must carry. The form reuses the Content Library's own kind list instead, moved into block-kinds.ts so the filter and the form share one source (documented in the plan's own objective note)."
  - "D-03's org/global scope field follows SaveToLibraryModal as it exists today: Phase 25 retired global scope, so there is no scope control anywhere in the form; it always sends scope: 'org'."

requirements-completed: [DED-01]

duration: 55min
completed: 2026-09-30
---

# Phase 43 Plan 02: New Block Form + createBlock Hardening Summary

**Closed the wire-reachable trust override in `createBlock()` before importing it into a client component for the first time, then shipped `/admin/blocks/new` as a real, minimal create form — the Content Library's "New block" button no longer 404s.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-09-30
- **Tasks:** 2/2 completed
- **Files modified:** 13 (4 created, 9 modified)

## Accomplishments
- `createBlock()`'s insert body moved to `src/lib/blocks/create-block-core.ts` (`insertBlockWithVersion`); the action now always runs `requireAdmin()` and takes `organisationId` only from the session. The old `serviceRole: { organisationId, createdByUserId }` field — which let a caller skip the guard and name any org — is gone from the schema entirely.
- The parser's session-less write path is `createBlockAsService(input, owner)` in the same plain (non-`'use server'`) module, mirroring the Phase 46 CR-01 split already used for `addBlockToSectionAsService`. It has no server-action endpoint ID.
- `/admin/blocks/new` is now a real static route (wins over `[blockId]` at the routing layer) with a guard identical to its `[blockId]` sibling, rendering `NewBlockForm` — a client form (name, kind radios, text, category chips, tags) that submits through the existing `createBlock()` action and lands on `/admin/blocks/<new id>` in the editor. No new server action, no second validation path.
- `src/lib/blocks/block-kinds.ts` gives the Content Library's kind filter and the create form one shared `BLOCK_KINDS` list and a `seedBlockContent(kind, text)` helper whose output's `.kind` always equals the slug (required — `section-blocks-core.ts`'s snapshot check rejects a mismatch).
- `journeys.ts` maps the new route in the same commit; `/pathways` "All screens" stays at 0 not-mapped.
- The reserved-segment rule in `tests/lint/no-dead-internal-hrefs.spec.ts` is flipped live and green — `/admin/blocks/new` now resolves through its own static segment, not just through `[blockId]`'s dynamic fallback.

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove createBlock's wire-reachable trust override before any client imports it (T-43-01)** - `385cb24` (feat)
2. **Task 2: /admin/blocks/new — a real create form over createBlock(), mapped in journeys (D-03, D-07)** - `b404ae6` (feat)

_No plan-metadata commit issued yet — SUMMARY.md commit and STATE.md/ROADMAP.md updates follow this summary._

## Files Created/Modified
- `src/lib/blocks/create-block-core.ts` - `CreateBlockInput` (verbatim minus the serviceRole override), `CreateBlockOwner`, `insertBlockWithVersion(writer, owner, input)`, `createBlockAsService(input, owner)`
- `src/lib/blocks/block-kinds.ts` - `BLOCK_KINDS`, `BlockKindSlug`, `seedBlockContent(kind, text)`
- `src/actions/blocks.ts` - `createBlock()` now delegates to `insertBlockWithVersion` after `requireAdmin()`; local `CreateBlockInput` and `createAdminClient` import removed
- `src/lib/parsers/parsed-sop-to-layout-data.ts` - `materializeJunctionsForLayout` calls `createBlockAsService(input, owner)` instead of `createBlock({ ..., serviceRole })`
- `src/lib/parsers/__tests__/parser-creates-junctions.test.ts` - repointed "createBlock signature accepts serviceRole..." → asserts the wire-level override is gone and the parser writes through `createBlockAsService`
- `tests/integration/scp-parse-pipeline.test.ts` - SCP-PARSE-07 repointed to read `category` from the core module and assert `blocksAction` no longer contains `serviceRole`
- `src/app/(protected)/admin/blocks/page.tsx` - `KIND_FILTERS` now built from `BLOCK_KINDS`
- `src/app/(protected)/admin/blocks/new/page.tsx` - Guarded static route (`NewBlockPage`), copies the `[blockId]` page's guard + wrapper + back-link idiom
- `src/app/(protected)/admin/blocks/new/NewBlockForm.tsx` - Client create form over `createBlock()`
- `src/lib/journeys/journeys.ts` - `reusable-blocks` journey gains the `new` step at `/admin/blocks/new`
- `.planning/codebase/CAPABILITY-MATRIX.md` - "Manage blocks library" row: added `/admin/blocks/new` and the createBlock hardening note (Phase 43, T-43-01)
- `tests/lint/no-dead-internal-hrefs.spec.ts` - Reserved-segment test flipped `test.fixme` → `test`, green
- `tests/phase43/new-block.spec.ts` - All 5 scaffolded tests flipped live; added a 6th live test for `seedBlockContent`

## Decisions Made
- Followed 43-CONTEXT.md's D-03 with the deviation the plan's own objective pre-authorized: did not reuse `SectionKindPicker` (wrong vocabulary/return type for a block's `kind_slug`), reused the Content Library's own kind list instead via a new shared module.
- Followed the plan's exact API shapes (`insertBlockWithVersion(writer, owner, input)`, `createBlockAsService(input, owner)`) rather than approximating, since the plan's acceptance criteria pin exact grep counts and call-order assertions.

## Deviations from Plan

None — plan executed exactly as written. Both tasks' acceptance criteria were verified directly (grep counts, test pass counts, tsc/build clean, bundle baseline untouched) and matched on the first pass.

## Red-First Proof

**Task 1** — before any source change, flipping `new-block.spec.ts` test 1 live and running it:
```
Error: expect(actionsSrc).not.toContain('serviceRole')
  at tests\phase43\new-block.spec.ts:57:30
```
After the fix: 1 passed.

**Task 2** — before the route existed, flipping the reserved-segment guard live and running it:
```
Error: src\app\(protected)\admin\blocks\page.tsx:79  /admin/blocks/new
```
Exactly the reserved-segment bug 43-RESEARCH.md named. After the fix: dead-link guard 4 passed / 0 skipped.

## Verification Run (final)

- `npx playwright test --project=phase43 tests/phase43/new-block.spec.ts` → 6 passed
- `npx playwright test --project=phase15-stubs tests/lint/no-dead-internal-hrefs.spec.ts tests/lint/design-tokens.spec.ts tests/lint/no-undefined-css-tokens.spec.ts` → 13 passed
- `npx playwright test --project=phase30 tests/phase30/admin-nav.spec.ts` → 5 passed
- `npx playwright test parser-creates-junctions.test.ts scp-parse-pipeline.test.ts` → 30 passed
- `npx tsc --noEmit` → clean
- `npm run build` → clean; postbuild bundle gate: `/sops/[sopId]/page` = 1043 KB (baseline 1048 KB, Δ -5 KB), `/sops/page` = 935 KB (baseline 940 KB, Δ -5 KB), both within ±2 KB tolerance and net negative; `git diff --exit-code .bundle-baseline.json` exits 0 (untouched)
- `npx eslint` on every file this plan touched → 0 errors, 0 `no-unused-vars` (one pre-existing unrelated `unused eslint-disable directive` warning in `src/actions/blocks.ts`'s `updateBlock`, confirmed present before this plan's changes via `git stash`)

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- 43-03 can proceed independently (PhotoScanner wiring, WiringPatchBay lens removal, dead-state cleanup) — no shared files with this plan.
- 43-04 can proceed independently (shim deletion, next.config.ts redirects) — no shared files with this plan.
- The Content Library's primary CTA (DED-01 criterion 1) now opens a working surface; `createBlock()` has no wire-reachable bypass (T-43-01) — both ready for `tests/evals/dead-surface.eval.ts` test A once 43-05 pushes.
- No blockers.

---
*Phase: 43-dead-surface-removal-route-truth*
*Completed: 2026-09-30*

## Self-Check: PASSED

All 4 created files verified present on disk (`create-block-core.ts`, `block-kinds.ts`, `admin/blocks/new/page.tsx`, `admin/blocks/new/NewBlockForm.tsx`); both task commit hashes (`385cb24`, `b404ae6`) verified in `git log`.
