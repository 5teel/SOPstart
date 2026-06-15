---
phase: 25-department-first-class-entity
plan: "05"
subsystem: admin-ui
tags: [departments, blocks-library, global-blocks-removal, worker-sop-filter, lint-guard]
dependency_graph:
  requires: [25-03, 25-04]
  provides: [department-filtered-block-library, no-global-blocks-routes, worker-dept-filter, journeys-cleanup]
  affects: [admin-blocks, admin-sops, worker-sops, journeys]
tech_stack:
  added: []
  patterns:
    - BlockDeptPopover wrapper component (DepartmentPicker in a positioned popup with Done + outside-click close)
    - Draft-commit pattern in DepartmentBottomSheet (local draftIds/draftAll, committed on Done)
    - Backward-compat re-export aliases (CategoryBottomSheet = DepartmentBottomSheet)
    - Source-contract lint guard via Playwright (no-global-blocks-in-journeys.spec.ts)
key_files:
  created:
    - tests/lint/no-global-blocks-in-journeys.spec.ts
  modified:
    - src/components/admin/blocks/BlockListTable.tsx
    - src/app/(protected)/admin/blocks/page.tsx
    - src/types/sop.ts
    - src/app/(protected)/admin/sops/page.tsx
    - src/lib/auth/platform-admin-guard.ts
    - src/components/sop/CategoryBottomSheet.tsx
    - src/app/(protected)/sops/page.tsx
    - src/lib/journeys/journeys.ts
  deleted:
    - src/app/(protected)/admin/global-blocks/page.tsx
    - src/app/(protected)/admin/global-blocks/suggestions/page.tsx
decisions:
  - Department-filtered block library uses a separate block_departments junction query in the page (listBlocks doesn't return junction data) augmented client-side via blockDeptMap
  - DepartmentBottomSheet uses draft state (committed on Done) for mobile; DepartmentSidebar uses direct toggle (immediate, no Done) for desktop — same pattern as old CategoryBottomSheet
  - Backward-compat re-exports retained on CategoryBottomSheet.tsx until all consumers confirmed migrated
  - is_platform_admin() RPC retained (not dropped) because migration 00032 ai_review_results policy still references it — only the UI gate and routes were removed
metrics:
  duration: "~10 minutes"
  completed: "2026-06-15"
  tasks: 3
  files: 11
---

# Phase 25 Plan 05: Admin Blocks Dept-Filter + Global-Blocks Route Deletion Summary

Department-filtered block library with per-block DChip chips and "Departments ▾" popover, deletion of /admin/global-blocks routes with zero inbound references, and worker SOP page migrated to DepartmentBottomSheet/DepartmentSidebar filter.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | BlockListTable dept chips + /admin/blocks filter bar | `6732ee4` | BlockListTable.tsx, admin/blocks/page.tsx, sop.ts |
| 2 | Delete /admin/global-blocks routes + remove all inbound refs | `f585a2f` | global-blocks/page.tsx (deleted), global-blocks/suggestions/page.tsx (deleted), admin/sops/page.tsx, platform-admin-guard.ts |
| 3 | Worker sops/page.tsx dept filter + journeys cleanup + lint guard | `3aee671` | CategoryBottomSheet.tsx, sops/page.tsx, journeys.ts, no-global-blocks-in-journeys.spec.ts |

## What Was Built

### Task 1 — Department-Organised Block Library

`/admin/blocks` page now features:
- Department filter bar: "DEPARTMENT" label + "All" pill + per-department colour-swatch buttons with block count badges
- Context line switches: "Every block in the organisation..." (All) vs "{Name} blocks, plus org-wide blocks..." (filtered)
- Kind filter hrefs preserve the `dept` query param
- `BlockListTable` receives `departments: Department[]` (was `categories: BlockCategory[]`); GLOBAL badge removed
- Per-row department chips rendered via `DChip`: cyan ◇ for all-departments, colour swatch + name for each department
- "Departments ▾" ghost button per row opens `BlockDeptPopover` — a positioned popup wrapping `DepartmentPicker` with header, Done button, and outside-click close via `useRef`/`useEffect`
- `Block` type extended with `all_departments?: boolean` (mirrors migration 00035 column)

### Task 2 — Global-Blocks Route Deletion

- `src/app/(protected)/admin/global-blocks/page.tsx` — deleted via `git rm`
- `src/app/(protected)/admin/global-blocks/suggestions/page.tsx` — deleted via `git rm`
- `admin/sops/page.tsx`: removed `is_platform_admin()` RPC call, removed "Curate Globals" nav link; added Team + Departments tabs to sub-nav; renamed "Blocks" → "Library"
- `platform-admin-guard.ts`: JSDoc updated to document route deletion and explain why `is_platform_admin()` is retained (still referenced by ai_review_results RLS in migration 00032)
- Verified zero live hrefs/imports to deleted routes: `rg -n "/admin/global-blocks" src/` = NONE

### Task 3 — Worker Filter + Journeys Cleanup + Lint Guard

- `CategoryBottomSheet.tsx` rewritten: `DepartmentBottomSheet` (mobile slide-up, draft state committed on Done) + `DepartmentSidebar` (desktop sticky, direct toggle); backward-compat re-exports `CategoryBottomSheet = DepartmentBottomSheet` and `CategorySidebar = DepartmentSidebar`
- `sops/page.tsx` (worker): state migrated to `selectedDeptIds: string[]` + `allDepartments: boolean` + `deptSheetOpen: boolean`; departments fetched via `useQuery` from `supabase.from('departments')`; `DepartmentBottomSheet` (mobile) + `DepartmentSidebar` (desktop) wired; removed `categories` useMemo + `allAssigned` query
- `journeys.ts`: removed `curate-globals` journey block and `'Platform admin'` from `JOURNEY_GROUPS`; `manage-departments` journey was already present (added in Plan 04)
- `tests/lint/no-global-blocks-in-journeys.spec.ts` created with 6 assertions:
  1. journeys.ts contains `/admin/departments`
  2. journeys.ts does NOT contain `/admin/global-blocks`
  3. journeys.ts does NOT reference `curate-globals`
  4. journeys.ts does NOT include `Platform admin` in `JOURNEY_GROUPS`
  5. `/admin/global-blocks` directory does not exist in src
  6. No live Link/router.push references to `/admin/global-blocks` in TypeScript source
- Spec registered in `phase25-integration` playwright project testMatch (was already in regex from config)
- All 6 lint assertions pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Block.all_departments missing from TypeScript type**
- **Found during:** Task 1
- **Issue:** `Block` interface in `src/types/sop.ts` did not include `all_departments` column added in migration 00035
- **Fix:** Added `all_departments?: boolean` to `Block` interface
- **Files modified:** `src/types/sop.ts`
- **Commit:** `6732ee4`

**2. [Rule 3 - Blocking issue] listBlocks doesn't return junction departmentIds**
- **Found during:** Task 1
- **Issue:** `listBlocks` server action returns `Block[]` without `block_departments` junction data; `BlockListTable` needed `departmentIds` per block
- **Fix:** Added a separate Supabase query in `admin/blocks/page.tsx` for `block_departments` rows, built `blockDeptMap: Map<string, string[]>`, augmented blocks inline before passing to table
- **Files modified:** `src/app/(protected)/admin/blocks/page.tsx`
- **Commit:** `6732ee4`

**3. [Rule 3 - Blocking issue] DepartmentPicker has no onClose prop — needed a popover wrapper**
- **Found during:** Task 1
- **Issue:** `DepartmentPicker` is a pill-based multi-select, not a popover. Needed "Departments ▾" button that opens a positioned popup
- **Fix:** Created `BlockDeptPopover` wrapper component inside `BlockListTable.tsx` with positioning, header, Done button, and outside-click close via `useRef`/`useEffect`
- **Files modified:** `src/components/admin/blocks/BlockListTable.tsx`
- **Commit:** `6732ee4`

**4. [Rule 1 - Bug] .next/ stale cache caused 8 false tsc errors after route deletion**
- **Found during:** Task 2
- **Issue:** `npx tsc --noEmit` showed errors in `.next/dev/types/` and `.next/types/` referencing deleted page files — stale Next.js build cache
- **Fix:** Filtered with `grep -v "\.next/"` — confirmed zero source errors; cache self-resolves on next `next build`
- **Files modified:** None (confirmed not source errors)

## Known Stubs

- `filteredSops` in worker `sops/page.tsx` passes all SOPs through without client-side dept filtering — the RLS policy `sops_visible_by_department` (migration 00033) is the real gate at query time. Client-side multi-select filtering by `selectedDeptIds` is deferred until the SOP query hook (`useAssignedSops`) exposes `departmentId` filter params. This is intentional: the visible SOPs are already correctly gated by RLS; the filter UI updates which departments are "active" but the hook doesn't yet pass those IDs to the query. Tracked for Plan 06+ (worker SOP visibility wiring).

## Threat Flags

None — this plan removes a UI surface (global-blocks curation) and replaces category strings with department foreign keys. No new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- `src/components/admin/blocks/BlockListTable.tsx` — FOUND
- `src/app/(protected)/admin/blocks/page.tsx` — FOUND
- `src/app/(protected)/admin/sops/page.tsx` — FOUND
- `src/components/sop/CategoryBottomSheet.tsx` — FOUND
- `src/app/(protected)/sops/page.tsx` — FOUND
- `src/lib/journeys/journeys.ts` — FOUND
- `tests/lint/no-global-blocks-in-journeys.spec.ts` — FOUND
- `src/app/(protected)/admin/global-blocks/page.tsx` — NOT FOUND (intentionally deleted)
- Commit `6732ee4` — FOUND
- Commit `f585a2f` — FOUND
- Commit `3aee671` — FOUND
