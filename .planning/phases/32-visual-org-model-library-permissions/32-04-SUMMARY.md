---
phase: 32-visual-org-model-library-permissions
plan: 04
subsystem: api
tags: [server-actions, typescript, rls, org-model, permissions]

# Dependency graph
requires:
  - phase: 32-03
    provides: "migrations 00046/00047 live on the production Supabase DB (areas, roles, role_members, collections, sop_collections, access_grants, sop_access_people, departments.area_id, D-13 RLS arm)"
provides:
  - "src/types/org-model.ts — Area/DeptRole/OrgTree/EffectiveAccess types (DeptRole, never bare Role)"
  - "src/lib/org-model/resolve-access.ts — pure resolveEffectiveAccess(), the single 5-level union resolver every Phase 32 view will call"
  - "src/actions/org-model.ts — listOrgTree() + createArea/updateArea/archiveArea + createRole/updateRole/archiveRole + assignRoleMembers + setDepartmentArea"
affects: [32-05, org-model, grants, library-permissions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "phase32-unit Playwright project (testDir: src/lib/org-model/__tests__) — mirrors phase23-unit/phase27-unit/phase28-unit for static @/ import resolution"
    - "areas/roles org-scoped entity tables have no soft-delete column (unlike departments' archived flag) — archiveArea/archiveRole are real DELETEs against the 00046 admin_delete RLS policy, relying on ON DELETE SET NULL (departments.area_id) / ON DELETE CASCADE (role_members) for cleanup"

key-files:
  created:
    - src/types/org-model.ts
    - src/lib/org-model/resolve-access.ts
    - src/lib/org-model/__tests__/resolve-access.test.ts
    - src/actions/org-model.ts
  modified:
    - playwright.config.ts

key-decisions:
  - "archiveArea/archiveRole are real deletes, not archived-flag toggles — the areas/roles migration (00046) gave them an admin_delete RLS policy and no archived column, unlike departments (REQ-6 flag-only). Confirmed against the live schema before implementing."
  - "AREA_COLOURS duplicated locally in org-model.ts (identical 8-hex vocab to departments.ts DEPT_COLOURS) rather than exporting/importing across files — departments.ts is outside this plan's files_modified scope; same duplication precedent as 30-08's FLAG_STYLE consts."

patterns-established:
  - "resolveEffectiveAccess(chain, grantsByUnit) is the ONE pure resolver — every future view (chart badges, wiring trace, blast-radius, library-filter counts) must call it, never recompute inheritance per-view (RESEARCH Pattern 2)"

requirements-completed: [SC-1, SC-2]

# Metrics
duration: 20min
completed: 2026-07-18
---

# Phase 32 Plan 04: Org-Model Data Layer (Resolver + Types + Actions) Summary

**Pure 5-level `resolveEffectiveAccess()` union resolver (org→area→department→role→person, direct/inherited/personal vocabulary) plus `org-model.ts` server actions (areas/roles/role_members CRUD + `listOrgTree`) — the backend tier every Phase 32 view (chart, wiring, matrix, blast-radius) will consume through one shared function.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-18T07:34:00Z (approx)
- **Completed:** 2026-07-18T07:54:50Z
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments
- `src/types/org-model.ts` — `SubjectType`, `Area`, `DeptRole` (never a bare `Role`), `OrgPerson`, `OrgTree`/`OrgTreeArea`/`OrgTreeDepartment`/`OrgTreeRole`, `AccessGrant`, `ChainLink`, `EffectiveAccess`
- `src/lib/org-model/resolve-access.ts` — pure `resolveEffectiveAccess(chain, grantsByUnit)`, no I/O, translating the permission-wiring-views.md inheritance-resolution JS block to 5 levels with a `personal` bucket for person-level grants
- Real behavioral unit test (`src/lib/org-model/__tests__/resolve-access.test.ts`, 6 tests) proving all 5 `<behavior>` cases from the plan, including the Priya personal-grant scenario, direct-beats-inherited, and nearest-ancestor-wins tie-breaking — registered under a new `phase32-unit` Playwright project so it actually executes (CLAUDE.md 2026-05-25 unregistered-spec learning)
- `src/actions/org-model.ts` — `listOrgTree()` (areas → departments → roles → people with computed vacancies), `createArea`/`updateArea`/`archiveArea`, `createRole`/`updateRole`/`archiveRole`, `assignRoleMembers()` (replace-semantics via `createAdminClient()`, org self-enforced), `setDepartmentArea()`

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure 5-level resolver + org-model types** - `8c865c6` (feat)
2. **Task 2: org-model.ts server actions (areas/roles/role_members CRUD + listOrgTree)** - `f283880` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `src/types/org-model.ts` - Area/DeptRole/OrgTree/AccessGrant/ChainLink/EffectiveAccess types
- `src/lib/org-model/resolve-access.ts` - pure `resolveEffectiveAccess()` 5-level union resolver
- `src/lib/org-model/__tests__/resolve-access.test.ts` - 6-test behavioral proof of the resolver
- `src/actions/org-model.ts` - areas/roles/role_members CRUD + `listOrgTree` reader
- `playwright.config.ts` - added `phase32-unit` project (testDir `src/lib/org-model/__tests__`)

## Decisions Made
- `archiveArea`/`archiveRole` perform real `DELETE`s (not archived-flag updates) — the live 00046 schema gives `areas`/`roles` an `admin_delete` RLS policy and no `archived` column, unlike `departments` (Phase 25 REQ-6 flag-only). `departments.area_id` is `ON DELETE SET NULL` and `role_members.role_id` is `ON DELETE CASCADE`, so deletion cleans up cleanly with no orphans.
- Duplicated the 8-hex `AREA_COLOURS` vocab locally in `org-model.ts` rather than exporting `DEPT_COLOURS` from `departments.ts` — that file is outside this plan's `files_modified` scope; matches the existing 30-08 precedent of duplicating small shared consts locally when the source file belongs to a different plan's ownership boundary.

## Deviations from Plan

None - plan executed exactly as written. `phase32-unit` Playwright project registration was implied by the plan's own acceptance criterion ("Unit test... passes") and the project's own CLAUDE.md 2026-05-25/2026-04-24 learnings (unregistered specs never run; dynamic `@/` imports fail outside a `testDir`-scoped project) — treated as part of delivering a passing test, not a separate deviation.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `resolveEffectiveAccess()`, `OrgTree`/`EffectiveAccess` types, and `listOrgTree()`/areas/roles CRUD are ready for 32-05's `grants.ts` (`createGrant`/`revokeGrant`/`materializeSopAccess`) and the chart/wiring UI plans to consume.
- `assignRoleMembers` and `setDepartmentArea` give the UI everything needed to wire people into roles and departments into areas without touching `member_departments` or `organisation_members.role`.
- `tests/phase32/grants-org-isolation.spec.ts` and `tests/phase32/person-grant-rls.spec.ts` remain `test.fixme` Wave-0 stubs by design — they flip to real live-Supabase runtime tests in 32-05 (`src/actions/grants.ts`), not this plan.
- `npx tsc --noEmit` clean; `npm run build` clean; bundle gate at 1057 KB (baseline 1056 KB, Δ +1 KB, within ±2 KB tolerance) — this plan touches no client bundle, the delta is noise from the existing baseline.

---
*Phase: 32-visual-org-model-library-permissions*
*Completed: 2026-07-18*

## Self-Check: PASSED

- FOUND: src/types/org-model.ts
- FOUND: src/lib/org-model/resolve-access.ts
- FOUND: src/lib/org-model/__tests__/resolve-access.test.ts
- FOUND: src/actions/org-model.ts
- FOUND: 8c865c6 (Task 1 commit)
- FOUND: f283880 (Task 2 commit)
