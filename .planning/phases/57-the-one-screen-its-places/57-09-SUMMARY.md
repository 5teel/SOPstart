---
phase: 57-the-one-screen-its-places
plan: 09
subsystem: retirement
tags: [library-table-removed, dropped-list, retirement-sweep, uat-links, capability-matrix]
requires: [57-08]
provides:
  - "AdminLibraryTable and its library-only helpers deleted, no guard reads them"
  - "dropped-list feature list-page (9 files + symbol scan), live in the phase55 sweep"
  - "retire list sweep fully live: no quoted bare list address in src outside the proxy, no access-view address in src"
affects: [57-10]
key-files:
  deleted:
    - src/components/admin/AdminLibraryTable.tsx
    - tests/phase54/library-table-checks.spec.ts
  modified:
    - src/lib/sop-list/admin-rows.ts
    - src/lib/sop/admin-health.ts
    - src/lib/uat/tests.ts
    - scripts/dropped-features.json
    - .planning/codebase/CAPABILITY-MATRIX.md
    - tests/phase57/retirement-sweep.spec.ts
    - tests/phase57/repoint-inventory.spec.ts
    - tests/phase55/deletion-sweep.spec.ts
metrics:
  tasks: 2
  commits: 2
  completed: 2026-10-05
---

# Phase 57 Plan 09: Retire the admin library table

The admin library table and every helper that existed only for it are gone, the guards that read them are repointed to where the behaviour now lives, and the list page's removal is on the dropped list with a live sweep.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 1793a8b1 | Table + helpers deleted; ~15 specs repointed or trimmed; matrix row; inventory flipped live |
| 2 | 214a9755 | Dropped-list feature `list-page`; retirement sweep finished; UAT prose and links; comment sweep |

## What was removed

- `AdminLibraryTable.tsx`.
- `admin-rows.ts`: `LibraryNav`, `DEFAULT_LIBRARY_NAV`, `resolveLibraryNav`, `libraryNavToUrl`. `MillerSop` keeps all seven Phase 54 check inputs (`site-health-action` untouched and green); `STATUS_TABS`, `stripExtension`, etc. stay (used by `admin-sop-list.ts` and the inbox).
- `admin-health.ts`: `CheckKey`, `CheckState`, `CHECK_ORDER`, `CheckInput`, `isReviewStale`, `deriveChecks`, `TableStatus`, `tableStatus`. `machineHealth`, `machinesWithoutSops`, `adminSopBadge`, `machinePanelSops`, `noticeboardSops`, `healthPinCount` stay (the one screen reads them).

## Assertions moved out of deleted or trimmed specs

`tests/phase54/library-table-checks.spec.ts` was deleted whole: every export it tested (`deriveChecks`, `tableStatus`, `CHECK_ORDER`) is gone, so nothing moved (the seven check-input fields are still pinned by `site-health-action.spec.ts`).

| Source | Assertion | Now lives in |
|---|---|---|
| library-table.spec (resolver + wiring describes) | `?view=attention` goes to `/governance` | `library-and-worker.spec` + `retirement-sweep` (proxy) |
| library-table.spec | AdminAccessLens pinned by `?sop=` | `sop-drilldown.spec` + `retirement-sweep` (`/admin/access` page, UUID check) |
| governance-fold | Access lens reachable | asserts `/admin/access` page gate + `<AdminAccessLens pinnedSopId={pinnedSopId} />` |
| nav-and-shim, reference-sweep | SUR-04 one list-to-builder chain | Workshop (`AdminRoomBodies`) links `/admin/sops/builder/`; worker shell does not |
| admin-nav | attention deep link maps to governance | asserts the proxy block, not the deleted resolver |
| list-rows | row query data (flag label, owner label, `noAudienceCount`, all_departments rule) | kept against `admin-sop-list.ts`; table-render assertions dropped |
| library-filter-deeplink | server filter by `?departments=` / `?collection=` | kept; table chip + resolver precedence tests dropped |
| phase54 deletion-sweep | attention comparison permitted homes | now proxy only (count 2 -> 1) |

library-table.spec keeps only its surviving affordances (`WorkerScope`, `BuilderCategoryButton`, `BuilderStageShell`).

## Dropped list

Feature `list-page` (phase 57), file entries: `sops/page.tsx`, `sops/loading.tsx`, `PlantHome`, `PlantAskBar`, `WorkerSimpleList`, `CategoryBottomSheet`, `SopLibraryCard`, `AdminLibraryTable`, `AdminFloorHealth`; plus one symbol scan on those names and `libraryNavToUrl|resolveLibraryNav|deriveChecks`. No symbol for the bare list address (the redirect specs quote it); the phase57 retirement sweep owns that check. Added to FEATURES and LIVE_FEATURES in the phase55 sweep; no test-scan exclusion was needed.

## Verification

- `npx tsc --noEmit`: clean.
- `npm run build`: exit 0; gate `/sops/[sopId]/page` 795 KB (baseline 795, delta 0), `/page` 831 KB (baseline 831, delta 0). `.bundle-baseline.json` untouched.
- Playwright, one combined run after the last edit: phase57, 55, 54, 28, 30, 32, 33, 41, 46, 15-stubs, 673 tests, 657 passed, 0 failed, rest skipped. No rate-limit failures this run.
- Acceptance greps: no `libraryNavToUrl|resolveLibraryNav|deriveChecks|AdminLibraryTable` in src/tests outside phase57 and `uat/tests.ts` except one comment in `tests/evals/sop-surface.eval.ts` (57-10 deletes that eval); no `'/sops'` / `/sops?` left in src outside `middleware.ts`.

## Deviations from Plan

**1. [Rule 3] Task 2's access-view test repoints and the `'57-09'` LIVE_PLANS flip landed in the Task 1 commit.** Inventory Test B requires the deleted spec to be gone once 57-09 is live and Test C requires `sops?view=access` gone from tests; doing them together kept the Task 1 commit green. Task 2 holds the dropped list, sweep and UAT work.

**2. [Rule 3] Extra spec edits outside `files_modified`.** `tests/phase54/library-table.spec.ts`, `tests/phase30/list-rows.spec.ts`, `tests/phase30/admin-nav.spec.ts`, `tests/phase32/library-filter-deeplink.spec.ts` and `tests/phase32/wire-up-mode.spec.ts` all read the table or the old access address (all inventory rows or token hits). Kept their surviving halves, per the 57-08 decision.

**3. Comment rewording in three src files** (`admin-access-view.ts`, `admin-sop-list.ts`, `BuilderCategoryButton.tsx`) that quoted the bare list address, so the plan's acceptance grep returns nothing.

**4. UAT:** the `library-table` test is archived (its page no longer exists) instead of rewritten. Ids stable.

## Known Stubs

None.

## Threat Flags

None. No new routes, gates or queries; T-57-03 and T-57-36 mitigated by the live inventory and retirement sweep; T-57-40 unchanged (`/admin/access` re-checks `requireAdminContext()`).

## Notes for the orchestrator

- `tests/evals/sop-surface.eval.ts` still has a comment naming the table and, with `plant-home.eval.ts`, `dead-surface.eval.ts` (`/sops?view=access`) belongs to 57-10.
- REQUIREMENTS.md, STATE.md, ROADMAP.md not touched; nothing pushed (plan verification says push after the last commit; left to the orchestrator per instructions).

## Self-Check: PASSED

AdminLibraryTable and library-table-checks absent; commits 1793a8b1 and 214a9755 exist; SUMMARY present.
