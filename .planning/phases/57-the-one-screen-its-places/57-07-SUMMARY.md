---
phase: 57-the-one-screen-its-places
plan: 07
subsystem: access bridge / retirement
tags: [access-page, departments-retirement, site-retirement, redirects, dropped-list, capability-matrix, pathways]
requires: [57-06]
provides:
  - "/admin/access: admin-gated bridge mounting the unchanged wiring lens, ?sop= UUID-pinned"
  - "Office panel link room-office-access; builder wireUpHref -> /admin/access?sop=<id>"
  - "/admin/departments and /admin/site as fixed redirects to /?place=edit"
  - "dropped-list feature site-and-departments-pages (2 routes, 3 components)"
affects: [57-08, 57-09, 57-10]
key-files:
  created:
    - "src/app/(protected)/admin/access/page.tsx"
  modified:
    - src/components/sop/lenses/AdminAccessLens.tsx
    - src/components/admin/AdminLibraryTable.tsx
    - src/components/admin/wiring/WiringPatchBay.tsx
    - src/components/shell/AdminRoomBodies.tsx
    - "src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx"
    - "src/app/(protected)/admin/sops/builder/[sopId]/BuilderMachinesButton.tsx"
    - "src/app/(protected)/admin/settings/page.tsx"
    - next.config.ts
    - playwright.config.ts
    - scripts/dropped-features.json
    - src/lib/journeys/journeys.ts
    - src/lib/journeys/roles.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
  deleted:
    - "src/app/(protected)/admin/departments/page.tsx"
    - "src/app/(protected)/admin/site/page.tsx"
    - src/components/admin/departments/DepartmentGrid.tsx
    - src/components/admin/departments/DepartmentCard.tsx
    - src/components/admin/departments/DepartmentFormModal.tsx
    - tests/e2e/admin-departments.spec.ts
metrics:
  tasks: 3
  commits: 3
  completed: 2026-10-05
---

# Phase 57 Plan 07: Access bridge; departments and site pages retired into edit mode

Access wiring now lives at an admin-gated `/admin/access` page reached from the Office panel and the builder, and the departments and site pages are gone, redirecting to the site edit mode where the departments strip lives.

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | 02b4470 | `/admin/access` page, lens without its back button, builder/wiring/Office links, retirement-sweep access test |
| 2 | ebf64fd | route + component deletion, two redirects, link repoints, departments.spec retired-screen block, e2e spec deleted |
| 3 | f661cd5 | dropped-list feature, deletion-sweep FEATURES/LIVE_FEATURES, inventory flipped live, CAPABILITY-MATRIX |

## What changed

- **Access page**: `requireAdminContext()` runs before render (redirect `/login` or `/`), `sop` kept only if it matches the UUID regex, renders `AdminAccessLens` inside `AdminPageShell`. `listAdminAccessData` still self-guards. `placeForPath('/admin/access')` was already the Office, so Back to the site returns there.
- **AdminAccessLens** lost `onBack`. `AdminLibraryTable` (still alive until 57-09) now mounts it without the prop; `governance-fold`, `sop-drilldown` and `access-lens` source-contract specs repointed.
- **Links**: `wireUpHref` and the PublishStage comment point at the bridge; the wiring "Open" link now goes to `/?place=dept:<id>` for a focused department and renders nothing for a collection (library list retired, D-13); Office panel carries "Access - who sees which SOPs".
- **Redirects**: `/admin/departments` and `/admin/site` -> `/?place=edit`, `permanent: false`, fixed strings (T-57-30).
- **Repoints**: settings Departments card and the builder "Open the site map" link go to `/?place=edit`; `roles.ts` Departments row now names the site edit mode; journeys: Access step on `/admin/access`, site/departments/map-the-site steps on `/` (edit mode); `site-workspace-wiring` asserts AdminShell mounts `SiteWorkspace` and `listSiteForOrg` self-guards; `builder-machines-row`, `admin-nav`, `no-global-blocks-in-journeys`, `library-filter-deeplink`, `wire-up-mode` updated.
- **Per-person membership** untouched: `departments.spec` asserts `RoleAssignmentTable` still mounts `DepartmentPicker mode="member"` (D-09).
- **CAPABILITY-MATRIX**: both rows updated, labels kept.

## Verification

- `npx tsc --noEmit`: clean (after `npm run build` regenerated `.next/types`).
- `npm run build`: exit 0, `/admin/access` in the route list, postbuild gate OK. `/` 566 KB (baseline 792), `/sops` 811 KB (baseline 817), `/sops/[sopId]` 811 KB (baseline 817). `.bundle-baseline.json` untouched.
- Playwright, final run: phase57, phase55, phase51, phase30, phase32, phase41, phase15-stubs, phase25-integration together: 597 passed, 1 failed (`phase25-integration wizard-sop-dept.spec.ts:61`, known pre-existing). phase46 30 passed, phase33 and phase54 passed (earlier run), all after the relevant edits.
- Pathways coverage test (`shell-structure.spec.ts`) passes with `/admin/access` mapped.

## Residue grep

`grep -rn "/admin/departments\|/admin/site" src tests` (excluding `/api/admin/site`, tests/phase57, tests/evals) returns only: import paths for the surviving `components/admin/departments/{DChip,DepartmentPicker}` and `components/admin/site/*` directories, redirect-explaining prose in two journeys details, the `design-tokens` directory allowlist, and file-path constants in phase26/51/55 specs. Prose comments in `agent/page.tsx`, `SiteEmptyState.tsx` and `types/sop.ts` that named the old routes were reworded. `tests/evals/*` still name the old addresses and `/sops?view=access`: those are 57-10's.

## Deviations from Plan

**1. [Rule 3] `AdminLibraryTable` and three specs edited for the removed `onBack`**: the table still mounts the lens until 57-09, and `governance-fold`/`sop-drilldown` pin the exact JSX literal. Edited in the Task 1 commit.

**2. [Rule 1] Task 1 commit left a syntax error in `journeys.ts` line 378** (an unescaped apostrophe). Not caught because the Task 1 verify did not run tsc after the journeys edit. Fixed in the Task 2 commit (ebf64fd); tsc and build are clean from there.

**3. [Rule 3] `phase25-e2e` Playwright project removed**: its regex matched only the deleted `admin-departments` spec, and an empty project errors when run alone.

**4. [Rule 1] Extra stale references repointed**: `library-filter-deeplink` pinned the old `/sops?departments=` and `/sops?collection=` literals; `phase41/access-lens` pinned `onBack`; `admin-nav` listed the deleted departments page; `roles.ts` ACCESS_MATRIX named `/admin/departments`.

**5. Departments redirect test lives in `departments.spec.ts`** (plan also mentioned `retirement-sweep`); the sweep keeps the access test and the stale `fixme` stubs in both files for this plan were replaced.

## Known Stubs

None.

## Threat Flags

None. T-57-28 (server gate before render), T-57-29 (UUID check), T-57-30 (fixed redirect strings), T-57-31 (member picker spec) all mitigated as planned.

## Self-Check: PASSED

Access page exists; deleted routes and components absent; commits 02b4470, ebf64fd, f661cd5 present. STATE.md and ROADMAP.md not modified; nothing pushed.
