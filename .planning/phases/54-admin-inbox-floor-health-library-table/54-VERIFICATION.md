---
phase: 54-admin-inbox-floor-health-library-table
verified: 2026-09-29T05:40:00Z
status: passed
score: 4/4 roadmap success criteria verified; 4/4 ADM requirements verified
overrides_applied: 0
---

# Phase 54: Admin — Inbox, Floor Health, Library Table Verification Report

**Phase Goal:** The admin's home is the work, not the list. An inbox that drains, the same floor lit red and amber where the library is sick, and the library as a plain table with a checks row. Everything the Phase 41 scope column and lenses did is either here or deleted.
**Verified:** 2026-09-29
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Roadmap Success Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | `/governance` real route, inbox of one-action rows, counted chips, all-clear state | ✓ VERIFIED | `src/app/(protected)/governance/page.tsx` gated by `requireAdminContext()` (redirect on error), server-derives `deriveInbox()` from `listGovernanceQueue`+`listAdminSopRows`+`listSiteHealthForOrg`. `GovernanceInbox.tsx` renders counted chips (`INBOX_CHIPS`/`inboxCounts`) and the "CLEAR / Nothing needs attention" all-clear state verbatim from the sketch copy. `GovernanceQueueRow` reused for governance-sourced rows (see #3). `tests/phase54/governance-inbox.spec.ts` (35 tests) green; live-ran `deletion-sweep.spec.ts` and `governance-fold.spec.ts` — both green (see below). |
| 2 | Scene beside inbox, red/amber pins by health, pin opens panel with owner+revision, Open/Edit | ✓ VERIFIED | `AdminFloorHealth.tsx` renders `PlantStage` (lazy, `next/dynamic({ssr:false})`) fed by `machineHealth()` (pure, `src/lib/sop/admin-health.ts:23-40`, worst-of unowned→overdue→ok, reading the SAME `governance` rows the inbox uses so floor/inbox can't disagree) beside `GovernanceInbox` in `page.tsx`'s two-column grid. Clicking a pin opens `AdminMachinePanel` with `owner {label} · review due {date}` per SOP row and `Open`/`Edit` links (`AdminMachinePanel.tsx:91-110`). No-site fallback card ("Draw your site" → `/admin/site`) confirmed at `AdminFloorHealth.tsx:74-86`. |
| 3 | Admin `/sops` plain table (SOP·Machine·Status·Owner·Checks·Review) + chips; Miller/lens/scope-column files deleted, sweep fails on any reference | ✓ VERIFIED | `AdminLibraryTable.tsx:268-278` column headers exactly SOP/Machine/Status/Owner/Checks/Review; five 18px check circles (`CHECK_ORDER` = owner·review·approved·assigned·converted) via `deriveChecks()`/`tableStatus()` in `src/lib/sop/admin-health.ts` (single classifier, not re-derived — confirmed no duplicate logic). Where/Status/Owner/Checks chips present (`data-testid="lib-chip-where/status/owner/checks"`). All 7 files confirmed absent via `git ls-files`: `AdminSopSurface.tsx`, `lenses/AdminAttentionLens.tsx`, `lenses/AdminStatusLens.tsx`, `MillerPrimitives.tsx`, `SopWorkerBrowser.tsx`, `admin/SopMillerBrowser.tsx`, `sops-nav-types.ts`. `AdminAccessLens.tsx` survives and is imported (lazy) in `AdminLibraryTable.tsx:45-48`. **Ran `tests/phase54/deletion-sweep.spec.ts` live: 5/5 passed** (file-absence, dead-name sweep across src/ and tests/, dead-param sweep, bundle-marker repoint). **Ran `tests/lint/no-static-admin-lens-import.spec.ts` live: 5/5 passed.** |
| 4 | Header→`/governance`, journeys.ts 0-not-mapped, CAPABILITY-MATRIX updated, sop-surface eval rewritten + passes deployed | ✓ VERIFIED | `TopHeader.tsx:146` — `{ label: 'Governance', href: '/governance' }`. `journeys.ts` carries governance-queue and admin-library journeys (lines 313-326, 592-609+). **Ran `tests/phase30/governance-fold.spec.ts` live: 7/7 passed**, including "every App Router page route is mapped by a journeys.ts step" (0 not-mapped). `CAPABILITY-MATRIX.md:46,66` documents the Governance queue capability and the Phase 41/54 route-split note. `tests/evals/sop-surface.eval.ts` rewritten (confirmed via 54-06-SUMMARY + deletion-sweep now scanning `tests/evals`); `54-EVAL.md` records **26 passed / 0 failed / 0 skipped** against `https://sopstart.com` at commit `76fa362`, which is a confirmed git ancestor of HEAD (`git merge-base --is-ancestor 76fa362 HEAD` via 1b01599 chain). |

**Score:** 4/4 roadmap criteria verified

### Requirements Coverage (ADM-01..04)

| Requirement | Description | Status | Evidence |
|---|---|---|---|
| ADM-01 | `/governance` own route, one-action inbox rows, counted chips, all-clear goal state | ✓ SATISFIED | Same as SC #1 above. |
| ADM-02 | Scene beside inbox repainted red/amber by health, pin opens panel w/ owner+revision | ✓ SATISFIED | Same as SC #2 above. |
| ADM-03 | `/sops` plain table + checks row + chips; Miller/scope-column/lenses deleted not hidden | ✓ SATISFIED | Same as SC #3 above. |
| ADM-04 | Header/journeys/evals/matrix reflect new surfaces; repo sweep proves no dead hrefs | ✓ SATISFIED | Same as SC #4 above. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `GovernanceInbox` | `GovernanceQueueRow` | governance-sourced items render through the untouched component | ✓ WIRED | `GovernanceInbox.tsx:76-84`. Diffed `GovernanceQueueRow.tsx` against commit `1c08896`: the four-branch action gate (approve-me → unowned → stale-role → confirm-current, calling `approveStep`/`OwnerPicker`/assign-link/`confirmSopCurrent`) is byte-identical; only display props (title/meta/age/severity) and markup were added, matching D-03's "add optional display props here instead" instruction. |
| `/sops/page.tsx` | `AdminLibraryTable` | ONE `next/dynamic({ssr:false})` gated on `useIsAdmin() && viewport==='desktop'` | ✓ WIRED | `page.tsx:45-48,271-273`. Grep confirms exactly one `next/dynamic` call for `AdminLibraryTable` in the file; `no-static-admin-lens-import.spec.ts` (live-run, passed) asserts `AdminLibraryTable`'s static-import allow-list is empty (only reachable via dynamic). |
| `AdminLibraryTable` | `resolveLibraryNav` | URL params → `LibraryNav` / `'governance'` sentinel | ✓ WIRED | `AdminLibraryTable.tsx:92-100` — `useEffect` resolves on mount/back-forward, `router.replace('/governance')` on the `'governance'` sentinel; `?view=access` opens `AdminAccessLens` (line 155-157); status/owner/departments/collection deep links flow into the `nav` state and the row filter (`admin-rows.ts:160-179`). |
| `WorkerSimpleList` | `selfAddSop`/`selfRemoveSop`/`requestRemoveAssignment` | `onAdd`/`onRemove` props | ✓ WIRED | `page.tsx:334-359,401-414` — `handleAdd`/`handleRemove` call the real server actions and invalidate the relevant queries; passed as `onAdd={handleAdd}` / `onRemove={handleRemove}`. Confirmed live by `library-table.spec.ts` "WorkerSimpleList wires onAdd/onRemove to the real callbacks". |
| `BuilderCategoryButton` | `setSopCategory` | real server action | ✓ WIRED | `BuilderCategoryButton.tsx:52` calls `setSopCategory(sopId, next)` then `router.refresh()`. |
| `/admin/governance` | `/governance` | redirect shim | ✓ WIRED | `admin/governance/page.tsx` — guard first (`getSessionContext`, role check), then `redirect('/governance')`. |
| `/admin/sops` | `/sops` (or `/governance` for `view=attention`) | redirect shim | ✓ WIRED | `admin/sops/page.tsx:38` — `if (params.view === 'attention') redirect('/governance')`, else maps legacy params onto `/sops`. |
| `/sops?view=attention` | `/governance` | `resolveLibraryNav` sentinel | ✓ WIRED | `admin-rows.ts:161` — `if (params.get('view') === 'attention') return 'governance'`, consumed by `AdminLibraryTable`'s effect (`router.replace('/governance')`). |

### Anti-Patterns Found

None. Swept all phase-54-authored/modified files (`inbox.ts`, `admin-health.ts`, `AdminFloorHealth.tsx`, `AdminMachinePanel.tsx`, `AdminLibraryTable.tsx`, `admin-rows.ts`, `WorkerSimpleList.tsx`, `governance/page.tsx`, `sops/page.tsx`, `BuilderCategoryButton.tsx`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER`, stub returns, `: any` casts, and `test.fixme`/`test.skip` in `tests/phase54/` — zero hits (the one `placeholder=` match is a legitimate HTML input attribute). No hardcoded department lists/colours in the new floor-health code — department colour comes from `zoneColour()` (imported from `src/lib/site/scene.ts`), not a literal map.

### Live Gate Results (run by verifier, not taken from SUMMARY claims)

| Gate | Command | Result |
|---|---|---|
| Deletion sweep | `npx playwright test --project=phase54 tests/phase54/deletion-sweep.spec.ts` | 5/5 passed |
| Admin-lens static-import guard | `npx playwright test --project=phase15-stubs tests/lint/no-static-admin-lens-import.spec.ts` | 5/5 passed |
| Full phase54 project | `npx playwright test --project=phase54` | 124/124 passed |
| Pathways / governance-fold | `npx playwright test --project=phase30 tests/phase30/governance-fold.spec.ts` | 7/7 passed (incl. 0 not-mapped) |
| Typecheck | `npx tsc --noEmit` | clean, 0 errors |
| Bundle baseline unchanged | `git diff --quiet 736f44a HEAD -- .bundle-baseline.json` | quiet (no diff) — 736f44a confirmed ancestor of HEAD |
| Deployed eval commit ancestry | `git merge-base --is-ancestor 1b01599 HEAD` | confirmed ancestor |
| 7 deleted files absent | `git ls-files \| grep -i <name>` ×7 | all 7 return nothing (absent) |
| `AdminAccessLens.tsx` survives | `git ls-files \| grep AdminAccessLens` | present |

### Human Verification Required

None. All must-haves resolved to VERIFIED via source inspection, git history diffing (to prove "verbatim" claims rather than trust the SUMMARY's wording), and live-executed automated gates.

### Gaps Summary

No gaps. All 4 roadmap success criteria and all 4 ADM requirements verified against the codebase, not against SUMMARY.md narrative. The one claim requiring extra scrutiny — "GovernanceQueueRow's approve/owner/stale/confirm branches preserved verbatim" — was independently confirmed by diffing the component against its pre-phase-54 commit rather than accepting the SUMMARY's assertion; the action-gate logic is unchanged, only display props and markup were added.

---

_Verified: 2026-09-29_
_Verifier: Claude (gsd-verifier)_
