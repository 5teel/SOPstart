---
phase: 41-one-sop-surface
plan: 07
subsystem: ui
tags: [nextjs, redirect-shim, nav, uat, pathways, source-contract-tests]

# Dependency graph
requires:
  - phase: 41-one-sop-surface
    plan: 06
    provides: "/admin/sops as a guard-first redirect shim to /sops (all seven legacy query params preserved), TopHeader's single SOPs entry + Governance deep-link, roleHome('admin') -> /sops, journeys.ts mapping the merged surface + one shim step"
provides:
  - "Zero in-app code paths route through the /admin/sops shim — every internal revalidatePath/router.push/redirect/href that used to target the list route now targets /sops directly (including the shim's own builder/pipeline/qr/video sub-route back-links and not-found redirects, discovered via the plan's own sweep gate, not enumerated in the plan text)"
  - "WiringPatchBay/SelectionStrip 'Open in library' deep-link and copy repointed to /sops?departments=/?collection= and 'Open in the SOP list ->' (SUR-06)"
  - "roles.ts: admin.landsOn -> SOP list (/sops); ACCESS_MATRIX's stale 'Manage SOPs' row replaced with an annotated 'SOP list — admin lenses' row on the same /sops route (two access levels, one URL, documented as deliberate); 'Block library' renamed to 'Content' to match TopHeader's already-renamed nav label"
  - "uat/tests.ts: 18 hrefs + destination labels repointed off /admin/sops(?view=access); stale click-path prose fixed (dead 'Manage SOPs' nav mention, stale 'Open in library' button quote, historical /admin/sops redirect description); new plain-language p41-merged-sop-surface UAT entry added"
  - "tests/phase41/reference-sweep.spec.ts live (no fixme): pins the /admin/sops permitted-reference count, proves the four live sub-routes survived, and enforces SUR-06 (no 'Library' in a label/route/href position in TopHeader/roles.ts/uat/tests.ts) — mutation-proven in three directions"
affects: [41-08-spec-repoint]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reference-sweep count-pinning: comment-stripped, per-line exact-match walk of src/ with a hardcoded EXPECTED_PERMITTED_COUNT so a new reference to a to-be-removed route must be a reviewed decision, not silent drift (CLAUDE.md 2026-08-04)"
    - "Label/href-scoped word ban: SUR-06's 'no Library as a destination name' guard matches only `label:`/`route:`/`href:` key-value string literals, not free prose in summary/background/tryIt/can/cannot fields — avoids false positives on an unrelated, correctly-named feature (Content library at /admin/blocks)"

key-files:
  created: []
  modified:
    - src/actions/ai-fields.ts
    - src/components/admin/ParseJobStatus.tsx
    - src/components/admin/UploadDropzone.tsx
    - src/components/admin/wiring/WiringPatchBay.tsx
    - src/components/admin/wiring/SelectionStrip.tsx
    - src/app/(protected)/admin/sops/[sopId]/qr/page.tsx
    - src/app/(protected)/admin/sops/[sopId]/video/page.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx
    - src/app/(protected)/admin/sops/builder/[sopId]/page.tsx
    - src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx
    - src/app/(protected)/admin/sops/pipeline/[pipelineId]/page.tsx
    - src/lib/journeys/roles.ts
    - src/lib/uat/tests.ts
    - tests/phase41/reference-sweep.spec.ts
    - tests/sb-builder-infrastructure.test.ts
    - tests/phase33/wayfinder-header.spec.ts

key-decisions:
  - "The plan's Task 1 file list (4 files) undercounted the actual in-app /admin/sops references against the plan's own acceptance-gate grep command. Repointed 6 additional sites (BuilderStageShell wayfinder/delete/wire-up links, builder/[sopId] and pipeline/[pipelineId] not-found redirects, PipelineProgressClient back link, qr page back link, video page not-found redirect) so the plan's own stated acceptance command actually passes. Rule 1/3 (bug/blocking fix), not scope creep — every site was a genuine in-app navigation target the plan's must_haves explicitly rules out."
  - "roles.ts's ACCESS_MATRIX 'Block library' surface label renamed to 'Content' to match TopHeader.tsx's already-completed 2026-07-30 rename (Blocks/Library -> Content). Needed so the SUR-06 sweep (which the plan requires flipping live in Task 3) doesn't have to carve out an exception for a stale label describing a real, unrelated destination — the fix aligns roles.ts with a rename that already shipped, not new scope."
  - "Reference-sweep count-based assertions strip full-line comments before matching (per the plan's explicit closing instruction), and the permitted-reference count is tallied per matching LINE (2), not per regex match occurrence (3, since journeys.ts:569 carries two occurrences of the pattern on one line) — a defensible, simpler counting rule documented inline in the test."
  - "tests/phase32/library-filter-deeplink.spec.ts went from 1 named-red test to all 3 tests in the file failing, because the plan's required WiringPatchBay/SelectionStrip href+copy change (Task 1) breaks two more assertions in that same legacy file. Covered by the plan's own Task 1 acceptance criterion ('npx playwright test --project=phase32 -g \"Open in library\"' — if red, confirm on the 41-06 handover list and leave it): all 3 tests in this file match that exact -g filter, so this is the plan's anticipated, not incidental, outcome. Left for 41-08 per the plan."

requirements-completed: [SUR-01, SUR-03, SUR-04, SUR-06]

# Metrics
duration: 38min
completed: 2026-09-13
---

# Phase 41 Plan 07: Reference Sweep Summary

**Swept every remaining internal `/admin/sops` reference (10 files, 4 more than the plan named) onto `/sops`, repointed the roles/access map and UAT hub off the old admin library naming, and flipped the count-pinned, mutation-proven reference-sweep guard live.**

## Performance

- **Duration:** ~38 min
- **Started:** 2026-09-13T02:20:00Z (approx, immediately after 41-06)
- **Completed:** 2026-09-13T02:58:00Z (approx)
- **Tasks:** 3
- **Files modified:** 16 across 3 task commits

## Accomplishments

- **Task 1** — Repointed the plan's 4 named sites (`ai-fields.ts` revalidatePath x2, `ParseJobStatus.tsx` router.push, `UploadDropzone.tsx` router.push, `WiringPatchBay.tsx` Open-in-library hrefs) plus 6 additional sites the plan's own acceptance-gate grep command required but didn't enumerate: `BuilderStageShell.tsx`'s wayfinder back-link, delete-redirect, and publish-status "Choose who sees it" wire-up href; `builder/[sopId]/page.tsx` and `pipeline/[pipelineId]/page.tsx`'s not-found redirects; `PipelineProgressClient.tsx`'s back link; `[sopId]/qr/page.tsx`'s back link; `[sopId]/video/page.tsx`'s not-found redirect. Also changed `SelectionStrip.tsx`'s visible "Open in library" copy to "Open in the SOP list" (SUR-06). Verified with the plan's own sweep command (`grep -rn "/admin/sops" src/ | grep -v "/admin/sops/"`) returning only comment mentions plus the shim + journeys.ts.
- **Task 2** — `roles.ts`: `admin.landsOn` -> `{ label: 'SOP list', route: '/sops' }`; `ACCESS_MATRIX`'s `Manage SOPs` row replaced with an annotated `SOP list — admin lenses` -> `/sops?view=attention` row, documenting the deliberate duplicate-route pattern; `Block library` surface renamed to `Content` to match TopHeader's already-shipped rename. `uat/tests.ts`: 18 hrefs repointed off `/admin/sops`(`?view=access`), `SOP management`/`SOP library` destination labels renamed to `SOPs`-prefixed labels, three stale prose fixes (dead "Manage SOPs" nav mention in a tryIt step, a quoted button label that Task 1 changed, a historical redirect description), and a new `p41-merged-sop-surface` UAT entry added covering the merge itself in plain click-path language.
- **Task 3** — Rewrote `tests/phase41/reference-sweep.spec.ts` live: comment-stripped exact-match sweep asserting only the shim + `journeys.ts` carry `/admin/sops` references, a pinned count (2) on those permitted references, positive proof that all four live sub-routes (`UploadDropzone.tsx`, `sops/[sopId]/page.tsx`, `SopMillerBrowser.tsx` builder links; `TopHeader.tsx`'s `/admin/sops/new`) survived, and a SUR-06 assertion that "Library" never sits in a `label:`/`route:`/`href:` position in `TopHeader.tsx`/`roles.ts`/`uat/tests.ts`. Ran and reverted all three plan-specified mutation-proofs (stray `router.push('/admin/sops')` re-added, a sub-route reference deleted, a `Library` nav label added) — each tripped the correct assertion and message, then reverted cleanly (`git status --short` empty afterward each time).

## Task Commits

Each task was committed atomically:

1. **Task 1: Repoint every code reference to the /admin/sops list route** - `79116db` (feat)
2. **Task 2: Update the roles/access map and the UAT feedback hub** - `a91b860` (feat)
3. **Task 3: Flip the reference-sweep guard live** - `db1f1b4` (test)

## Files Created/Modified

- `src/actions/ai-fields.ts` - two `revalidatePath('/admin/sops')` -> `/sops`; builder-scoped revalidations untouched
- `src/components/admin/ParseJobStatus.tsx` - post-delete `router.push` -> `/sops`
- `src/components/admin/UploadDropzone.tsx` - "Review drafts" CTA -> `/sops?status=draft`
- `src/components/admin/wiring/WiringPatchBay.tsx` - Open-in-library hrefs -> `/sops?departments=`/`?collection=`
- `src/components/admin/wiring/SelectionStrip.tsx` - "Open in library" -> "Open in the SOP list" visible copy
- `src/app/(protected)/admin/sops/[sopId]/qr/page.tsx`, `.../[sopId]/video/page.tsx`, `.../builder/[sopId]/page.tsx`, `.../builder/[sopId]/BuilderStageShell.tsx`, `.../pipeline/[pipelineId]/page.tsx`, `.../pipeline/[pipelineId]/PipelineProgressClient.tsx` - Rule 1/3 fix: 6 additional back-links/not-found-redirects/wire-up hrefs repointed to `/sops`, discovered via the plan's own sweep command
- `src/lib/journeys/roles.ts` - `admin.landsOn`, `ACCESS_MATRIX` row replacement + annotation, `Block library` -> `Content`
- `src/lib/uat/tests.ts` - 18 hrefs/labels repointed, 3 stale-prose fixes, 1 new UAT entry
- `tests/phase41/reference-sweep.spec.ts` - flipped live, mutation-proven in 3 directions
- `tests/sb-builder-infrastructure.test.ts`, `tests/phase33/wayfinder-header.spec.ts` - Rule 1 fix: source-contract guards pinning the exact `/admin/sops` string this plan necessarily changed, repointed to `/sops` in the same commit as the sweep flip

## Decisions Made

See frontmatter `key-decisions`. Headline: the plan's enumerated Task 1 file list was incomplete against the plan's own stated acceptance-gate command — fixed via the gate itself rather than treating the gate as aspirational, since leaving any of those 6 sites unrepointed would have meant an in-app click still paying the shim's redirect hop (exactly what SUR-03/SUR-04 forbid).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 - Incomplete plan file list] Task 1's enumerated files didn't cover the plan's own acceptance-gate sweep**
- **Found during:** Task 1, running the plan's own verification command (`grep -rn "/admin/sops" src/ | grep -v "/admin/sops/"`)
- **Issue:** The command surfaced 6 in-app navigation targets outside the plan's 4 named files: `BuilderStageShell.tsx` (wayfinder back link, delete-redirect, wire-up href), `builder/[sopId]/page.tsx` and `pipeline/[pipelineId]/page.tsx` (not-found redirects), `PipelineProgressClient.tsx` (back link), `qr/page.tsx` (back link), `video/page.tsx` (not-found redirect) — all genuine `/admin/sops` list-route targets the plan's must_haves explicitly forbids.
- **Fix:** Repointed all 6 to `/sops`, verified with the same sweep command down to only comment mentions + the shim + journeys.ts.
- **Files modified:** see Files Created/Modified above.
- **Verification:** `npx tsc --noEmit`, `npm run build` (bundle gate unchanged, both routes +1KB within tolerance), the plan's own grep command.
- **Committed in:** `79116db` (Task 1 commit)

**2. [Rule 1 - Stale label] `roles.ts`'s ACCESS_MATRIX "Block library" surface label was out of sync with TopHeader's already-shipped rename**
- **Found during:** Task 2, preparing the SUR-06 word-ban that Task 3 flips live
- **Issue:** `TopHeader.tsx` already renamed its Content/Blocks nav item away from "Library" (2026-07-30 per CLAUDE.md), but `roles.ts`'s `ACCESS_MATRIX` still called the same destination "Block library" — a stale label that would otherwise force an exception into the new SUR-06 sweep for an unrelated, still-valid feature.
- **Fix:** Renamed the surface label to `Content`, matching the live nav label. Route (`/admin/blocks`) untouched.
- **Files modified:** `src/lib/journeys/roles.ts`
- **Verification:** `npx tsc --noEmit`; grep confirms zero "Library" matches in label/route/href position in the file.
- **Committed in:** `a91b860` (Task 2 commit)

**3. [Rule 1 - Stale guards caused by this plan's required change] Two source-contract tests pinned the exact `/admin/sops` string this plan's Task 1 necessarily changed**
- **Found during:** Task 3, full-suite verification after Task 1/2
- **Issue:** `tests/sb-builder-infrastructure.test.ts`'s `SB-INFRA-00` test asserted `builder/[sopId]/page.tsx` contains `redirect('/admin/sops')` (its not-found redirect, repointed in Task 1's deviation #1); `tests/phase33/wayfinder-header.spec.ts` asserted the wayfinder back link's href is literally `/admin/sops`. Both went stale-red as a direct, unavoidable consequence of a change the plan requires, not something these tests were already failing for.
- **Fix:** Repointed both assertions to `/sops`.
- **Files modified:** `tests/sb-builder-infrastructure.test.ts`, `tests/phase33/wayfinder-header.spec.ts`
- **Verification:** Both tests pass in isolation; full `--project=phase28 --project=phase29 --project=phase30 --project=phase32 --project=phase33 --project=phase41 --project=phase15-stubs --project=phase11-stubs` run afterward shows no OTHER new red beyond the plan's named/expected set.
- **Committed in:** `db1f1b4` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 incomplete-plan-list fix touching 6 files, 1 stale-label fix, 1 stale-guard repoint touching 2 test files).
**Impact on plan:** All three were required to satisfy the plan's own stated acceptance criteria and must_haves — no scope creep beyond what SUR-01/03/04/06 already demand.

## Specs left red for 41-08 (confirmed against 41-06-SUMMARY's named list, no new unaccounted red)

Full run: `--project=phase28 --project=phase29 --project=phase30 --project=phase32 --project=phase33 --project=phase41 --project=phase15-stubs --project=phase11-stubs` → 445 passed, 31 failed, 45 skipped.

- `tests/phase28/governance-queue.spec.ts` (4 tests) — named on 41-06's list, unchanged
- `tests/phase28/library-and-worker.spec.ts` (6 tests) — named, unchanged
- `tests/phase29/queue-approve-action.spec.ts` (1 test) — named, unchanged
- `tests/phase30/list-rows.spec.ts` (3 tests) — named, unchanged
- `tests/phase32/library-filter-deeplink.spec.ts` (now **3** tests, was named as 1) — the extra 2 are a direct, anticipated consequence of this plan's required `WiringPatchBay`/`SelectionStrip` change; all 3 match the plan's own `-g "Open in library"` acceptance filter (see key-decisions)
- `tests/phase32/wire-up-mode.spec.ts` (1 test) — named, unchanged
- `tests/phase33/sop-drilldown.spec.ts` (1 test) — named, unchanged
- `tests/sb-auth-builder.test.ts` (2 tests, `phase11-stubs`) — named, unchanged

### Pre-existing / unrelated (confirmed, not caused by this plan)

- `tests/sb-layout-editor.test.ts` (7 tests) and `tests/sb-section-schema.test.ts` (1 test), both `phase11-stubs` — confirmed rot from the Phase 26 Puck removal (`ENOENT: src/lib/builder/puck-config.tsx`, deleted 2026-07-03); part of the "~26 legacy phase3-stubs/phase11-stubs/phase12.5-stubs failures" bucket 41-06-SUMMARY already documented as pre-existing. Not touched — out of scope for a reference-sweep plan.

## Bundle deltas (both gated routes, unchanged from 41-06's baseline)

- `/sops/[sopId]/page` = 1049 KB (baseline 1048 KB, Δ +1 KB, tolerance ±2 KB) — PASS
- `/sops/page` = 941 KB (baseline 940 KB, Δ +1 KB, tolerance ±2 KB) — PASS

## Issues Encountered

None beyond the three deviations above, all resolved in the same task's commit.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Zero in-app code paths route through the `/admin/sops` shim; it now serves only external bookmarks and its own documented sub-routes.
- 41-08 (spec repoint) has an exact, confirmed list of legacy specs to repoint: the 8 files named in 41-06-SUMMARY (now with `library-filter-deeplink.spec.ts` at 3 tests instead of 1, per the anticipated Task 1 consequence documented above).
- No blockers.

---
*Phase: 41-one-sop-surface*
*Completed: 2026-09-13*

## Self-Check: PASSED

All 16 modified files confirmed present on disk; all 3 task commit hashes (`79116db`, `a91b860`, `db1f1b4`) confirmed in `git log --oneline --all`.
