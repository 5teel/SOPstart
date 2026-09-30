---
phase: 43-dead-surface-removal-route-truth
verified: 2026-09-30T00:00:00Z
status: passed
score: 8/8 must-haves verified
overrides_applied: 0
---

# Phase 43: Dead-Surface Removal & Route Truth Verification Report

**Phase Goal:** No CTA to a route that does not exist, no coming-soon controls, no orphaned shims or dead state, docs and `journeys.ts` matching the real route tree.
**Verified:** 2026-09-30
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every internal href resolves to a route that exists (repo-wide sweep, not spot checks); Blocks-library primary CTA opens a working surface | ✓ VERIFIED | `tests/lint/no-dead-internal-hrefs.spec.ts` run live: 4/4 passed (`npx playwright test tests/lint/no-dead-internal-hrefs.spec.ts --project=phase15-stubs` → 4 passed, includes the reserved-segment rule and the non-vacuous self-check). `/admin/blocks/new` confirmed as a real static route file on disk (`src/app/(protected)/admin/blocks/new/page.tsx`, `NewBlockForm.tsx`), wired to the existing `createBlock()` action, mapped in `journeys.ts:551`. Deployed eval test A (create + archive) passed 29/29 second run. |
| 2 | No enabled control leads to a "coming soon" dead end — Scan-document drives the shipped `PhotoScanner`, no other placeholder modal ships behind an enabled control | ✓ VERIFIED | `grep` confirms `UploadDropzone.tsx` imports and conditionally mounts `<PhotoScanner>` on `scannerOpen`, routes submitted files through the same `validateAndAddFiles` picked-file path used elsewhere in the file. `WiringPatchBay.tsx` has zero remaining references to `LENS_OPTIONS`/`matrix`/`illuminate`/`ViewToggle`/"coming soon" — the lens toggle and its placeholder branch are fully deleted, not merely hidden. `tests/phase43/dead-controls.spec.ts` (5/5) and the repo-wide "no comment-stripped src/ file ships a coming-soon placeholder" sweep both pass live. Deployed eval tests B and C passed. |
| 3 | Orphaned redirect shims and dead state (set-never-called setters, computed-never-rendered memos) are gone; clean `npm run build` + lint with no unused-symbol carve-outs | ✓ VERIFIED | `src/app/(protected)/admin/governance/page.tsx` and `src/app/(protected)/admin/sops/page.tsx` confirmed absent from disk (`ls` → No such file). `next.config.ts` carries two new static redirects (`/admin/governance` → `/governance`, `/admin/sops` → `/sops`) alongside the pre-existing review redirect. `grep -rn "'/admin/governance'" src/` returns nothing — no lingering references. `sopCategoryOptions`/`categories` prop confirmed absent from `WizardClient.tsx`; `selectedForCompare` confirmed absent from `versions/page.tsx`. `npx tsc --noEmit` clean. `npx eslint` on all phase-touched files: 0 `no-unused-vars` problems (one confirmed pre-existing unrelated `unused-eslint-disable-directive` warning in `blocks.ts`, out of scope per D-02). `grep -rn "eslint-disable.*no-unused-vars" src/` → 0 matches, confirming the "no carve-out" pin holds. |
| 4 | `/pathways` "All screens" shows 0 not-mapped for every route this milestone touched; `ARCHITECTURE.md` no longer references deleted routes | ✓ VERIFIED | `journeys.ts` maps `/admin/blocks/new` (line 551) and no longer maps either deleted shim route; `grep` confirms `ARCHITECTURE.md` carries no stale `/admin/sops/[sopId]/review` or "admins land on /dashboard" lines. `tests/phase43/route-truth.spec.ts` test "journeys maps no deleted page" passes live (part of the 16/16 phase43 project run). Deployed eval test E ("pathways map reports zero unmapped screens") passed on the second (green) run. |

**Score:** 4/4 roadmap success criteria verified. All 8 PLAN-frontmatter must-have truths across the 5 plans additionally checked directly against source (see Required Artifacts / Key Link Verification below) — all verified, none trusted from SUMMARY narrative alone.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/lint/no-dead-internal-hrefs.spec.ts` | Repo-wide dead-href/route/redirect sweep, mutation-proven, registered in phase15-stubs | ✓ VERIFIED | Ran live: 4 passed. Registered and discoverable (`--list` confirmed by plan; re-ran directly and it executes under `--project=phase15-stubs`). |
| `tests/phase43/new-block.spec.ts`, `dead-controls.spec.ts`, `route-truth.spec.ts` | Live source-contract specs for D-01..D-06 | ✓ VERIFIED | Ran live under `--project=phase43`: 16/16 passed, 0 skipped, 0 fixme remaining. |
| `tests/evals/dead-surface.eval.ts` | Deployed eval proving A/B/C/D1/D2 in production | ✓ VERIFIED | `43-EVAL.md` records 29/29 passed on the second (green) production run after the RLS fix; all 7 required screenshots exist on disk under `.planning/evals/latest/` (`new-block-form.png`, `new-block-created.png`, `scan-document.png`, `access-wiring-only.png`, `admin-library.png`, `admin-governance.png`, `worker-sops.png`) and were confirmed present by direct `ls`. |
| `src/lib/blocks/create-block-core.ts` | Plain module (no `'use server'`), `insertBlockWithVersion`, `createBlockAsService`, no wire-reachable trust override | ✓ VERIFIED | File header confirms "deliberately NOT 'use server'". `createBlock()` in `src/actions/blocks.ts` confirmed to always call `requireAdmin()` and take `organisationId` only from session context (`ctx.organisationId`). `createBlockAsService` importers grepped: only `src/lib/parsers/parsed-sop-to-layout-data.ts` (a server-side parser module, no `'use client'`), confirming it is not client-reachable. |
| `next.config.ts` | Two static redirects for the deleted shims | ✓ VERIFIED | `grep` confirms both `source: '/admin/governance'` → `/governance` and `source: '/admin/sops'` → `/sops` entries present. |
| `supabase/migrations/00068_blocks_read_own_org.sql` | RLS fix discovered mid-eval | ✓ VERIFIED | File present, org-scoped SELECT policy on `public.blocks`, matches the root-cause narrative in `43-EVAL.md`/`43-VALIDATION.md`. Applied live per plan 05 (confirmed by the eval's second-run 29/29 pass, which required the session-client `.select()` after insert to succeed). |
| `CAPABILITY-MATRIX.md` | Updated for the blocks-library CTA + shim deletion | ✓ VERIFIED | `grep` confirms the "Manage blocks library" row now lists `/admin/blocks/new` and the `createBlock()` hardening note; the Phase 41/54 note records the Phase 43 shim deletion and self-guarding destinations. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `NewBlockForm.tsx` | `src/actions/blocks.ts createBlock` | server action call | ✓ WIRED | Confirmed by `tests/phase43/new-block.spec.ts` live pass + direct grep of the form component's submit path. |
| `createBlock()` | `insertBlockWithVersion` | called after `requireAdmin()` | ✓ WIRED | Confirmed directly: `ctx = await requireAdmin()` precedes the insert call in `blocks.ts`. |
| `parsed-sop-to-layout-data.ts` | `createBlockAsService` | import from plain core module | ✓ WIRED | Confirmed by direct grep — single importer, server-side only. |
| `next.config.ts redirects()` | `/governance` page | 307 to a page that runs `requireAdminContext()` | ✓ WIRED | Confirmed: shim page deleted, redirect present, destination page self-guards (per CAPABILITY-MATRIX note and prior-phase code, unchanged by this phase). |
| `UploadDropzone.tsx` | `PhotoScanner.tsx` | conditional mount on `scannerOpen`, `onSubmit` → `validateAndAddFiles` | ✓ WIRED | Confirmed directly by grep: import present, conditional render on `scannerOpen`, `onSubmit` callback calls `validateAndAddFiles(files)`. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DED-01 | 43-01, 43-02, 43-04, 43-05 | No CTA points at a route that does not exist | ✓ SATISFIED | Dead-href sweep green; `/admin/blocks/new` real and working; shims deleted with redirects. |
| DED-02 | 43-01, 43-03, 43-05 | No non-functional affordance ships as an enabled control | ✓ SATISFIED | PhotoScanner wired; WiringPatchBay lens options removed; no placeholder text found in any phase-touched file. |
| DED-03 | 43-01, 43-03, 43-04, 43-05 | Orphaned shims and dead state removed | ✓ SATISFIED | Shim pages deleted; `sopCategoryOptions`/`selectedForCompare` confirmed absent. |
| DED-04 | 43-01, 43-04, 43-05 | Docs and `journeys.ts` match the real route tree; `/pathways` 0 not-mapped | ✓ SATISFIED | ARCHITECTURE.md/CAPABILITY-MATRIX.md fixed; journeys.ts updated; deployed eval test E green. |

All four requirement IDs from REQUIREMENTS.md (DED-01..04) are declared in at least one plan's frontmatter; no orphaned requirements found for this phase.

### Anti-Patterns Found

None. Grepped all phase-touched files for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER|coming soon|not yet implemented` (case-insensitive) — only matches were legitimate HTML `placeholder=` input attributes, not stub markers. `grep -rn "eslint-disable.*no-unused-vars" src/` → 0 matches, confirming the D-02 "no carve-out" pin.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| tsc typecheck clean | `npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| phase43 source-contract specs | `npx playwright test --project=phase43 --reporter=line` | 16 passed | ✓ PASS |
| dead-href lint guard | `npx playwright test tests/lint/no-dead-internal-hrefs.spec.ts --project=phase15-stubs --reporter=line` | 4 passed | ✓ PASS |
| repointed phase41/phase54 specs | `npx playwright test tests/phase41/merged-surface.spec.ts tests/phase41/nav-and-shim.spec.ts tests/phase41/reference-sweep.spec.ts tests/phase41/spec-repoint-inventory.spec.ts tests/phase54/deletion-sweep.spec.ts --reporter=line` | 31 passed | ✓ PASS |
| eslint on all phase-touched source files | `npx eslint <11 files>` | 0 errors, 1 pre-existing unrelated warning | ✓ PASS |

### Probe Execution

Not applicable — this is not a migration/CLI probe-based phase; no `scripts/*/tests/probe-*.sh` declared or discovered for this phase.

### Deployed Eval (project UAT artefact per CLAUDE.md)

`43-EVAL.md` records two production runs. First run (commit `2e4a373`): 28/29, test A failed on a genuine pre-existing RLS gap in `public.blocks` (migration 00037 had dropped the only SELECT policy without a replacement). Root-caused live against the DB, fixed with migration `00068_blocks_read_own_org.sql`, re-verified against the live DB before committing. Second run (commit `1ae05cd`, current HEAD `0533515` is one commit later — a docs-only completion commit): 29/29 passed, 0 failed, 2 unrelated self-skips (no-site fixture arms for phases 52/53, unrelated to phase 43). All 7 required screenshots (`new-block-form`, `new-block-created`, `scan-document`, `access-wiring-only`, `admin-library`, `admin-governance`, `worker-sops`) confirmed present on disk under `.planning/evals/latest/` and were read/judged per the `43-EVAL.md` table — no CSS-token or sizing defects recorded.

### Human Verification Required

None. Per CLAUDE.md's "Deployed-site evals (replaces human-verify checkpoints)" convention, this project does not use manual click-path UAT — the deployed eval (`43-EVAL.md`) is the UAT artefact, and it passed 29/29 with all screenshots read. The one item flagged as manual-only in `43-VALIDATION.md` ("scanner captures from a real camera") was already an outstanding Phase 53 item, not new to Phase 43, and is explicitly out of scope for this phase's eval (which only asserts the scanner UI opens).

### Gaps Summary

No gaps found. All four ROADMAP success criteria and all requirement IDs (DED-01..04) verified directly against the codebase — shim files confirmed deleted from disk, redirects confirmed present in `next.config.ts`, dead state confirmed absent via grep, PhotoScanner wiring and WiringPatchBay lens removal confirmed by direct source inspection, `createBlock()` hardening and `createBlockAsService` server-only scope confirmed by grep, the RLS migration confirmed present and consistent with the eval's documented root-cause, and all automated gates (tsc, phase43 project, dead-href lint guard, repointed phase41/phase54 specs, eslint) re-run live in this verification pass rather than trusted from SUMMARY claims. The deployed eval — the project's designated UAT artefact — passed 29/29 with all required screenshots present and read.

---

*Verified: 2026-09-30*
*Verifier: Claude (gsd-verifier)*
