---
phase: 32-visual-org-model-library-permissions
plan: 02
subsystem: database
tags: [postgres, supabase, rls, migration, security-definer]

# Dependency graph
requires:
  - phase: 25-department-first-class-entity
    provides: departments table + block_departments/sop_departments/member_departments junction pattern, current_user_department_ids()/sop_in_user_departments() SECURITY DEFINER template
provides:
  - "00046_org_model_schema.sql: areas, roles, collections org/dept-scoped entity tables + role_members, sop_collections, access_grants, sop_access_people junctions + departments.area_id + grant_subject_type enum + D-13 SECURITY DEFINER helper + additive sops_visible_by_person_grant RLS arm"
  - "00047_org_model_data.sql: day-one equivalence seed — collections from sops.category, sop_collections backfill, dept-level access_grants from sop_departments"
affects: [32-03, 32-04, 32-05, org-model, grants, library-permissions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "grant_subject_type polymorphic enum (org|area|department|role|person) on access_grants — single table, no per-level FK columns"
    - "access_grants uses org-scoped SELECT (organisation_id = current_organisation_id()), not using(true) — grants are more sensitive than a bare UUID-pair junction"
    - "sop_access_people materialized junction + sop_in_user_person_grants() SECURITY DEFINER helper, additive OR arm on sops — mirrors 00035 department pattern exactly for the person/role enforcement gap (D-13)"

key-files:
  created:
    - supabase/migrations/00046_org_model_schema.sql
    - supabase/migrations/00047_org_model_data.sql
  modified: []

key-decisions:
  - "D-13 enforcement implemented as a single narrow additive RLS arm (sop_access_people + sop_in_user_person_grants()) rather than touching sops_visible_by_department/sops_visible_by_sub_trade — those two policies remain byte-untouched per plan requirement"
  - "access_grants Step C seed derives organisation_id via departments join (d.organisation_id), not sd.department_id cast to uuid — corrects a bug present in 32-RESEARCH.md's code example, following the plan task's corrected version instead"

patterns-established:
  - "New org-model entity tables (areas/roles/collections) follow the departments_org_read/_admin_insert/_admin_update/_admin_delete four-policy shape verbatim"
  - "New junctions (role_members, sop_collections) follow using(true) SELECT + zero authenticated write policy; access_grants and sop_access_people deviate deliberately (org-scoped / self-scoped read) because they carry more sensitive disclosure than a bare UUID pair"

requirements-completed: [SC-1, SC-2, SC-6]

# Metrics
duration: 16min
completed: 2026-07-18
---

# Phase 32 Plan 02: Org Model Schema + Day-One Seed Migrations Summary

**Two migration files (files only, unpushed): 00046 adds 7 new org-model tables + `departments.area_id` + `grant_subject_type` enum + the D-13 SECURITY DEFINER person/role-grant RLS arm; 00047 seeds collections from `sops.category` and dept-level grants from existing `sop_departments` for day-one equivalence.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-07-18T17:00:00+10:00 (approx, first commit 17:15:42)
- **Completed:** 2026-07-18T17:16:43+10:00
- **Tasks:** 2
- **Files modified:** 2 (both new files)

## Accomplishments
- `00046_org_model_schema.sql` — `areas`, `roles`, `collections` org/dept-scoped entity tables (copying the Phase 25 `departments` four-policy shape); `role_members`, `sop_collections` junctions (`using(true)` SELECT, admin-client writes only); `access_grants` (org-scoped SELECT, polymorphic `subject_type` enum); `sop_access_people` materialized junction + `sop_in_user_person_grants()` SECURITY DEFINER helper + additive `sops_visible_by_person_grant` policy (D-13) — `sops_visible_by_department` and `sops_visible_by_sub_trade` left byte-untouched
- `00047_org_model_data.sql` — idempotent seed: one collection per distinct `sops.category` per org, `sop_collections` backfill, dept-level `access_grants` derived from existing `sop_departments` rows (D-03 day-one equivalence); writes zero rows to `sop_departments`/`sop_access_people`; ends with a `RAISE EXCEPTION` idempotent assertion mirroring the 00036 pattern

## Task Commits

Each task was committed atomically:

1. **Task 1: Write 00046 schema migration (tables, enum, D-13 RLS arm)** - `0322e67` (feat)
2. **Task 2: Write 00047 data seed migration (day-one equivalence D-03)** - `3079885` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `supabase/migrations/00046_org_model_schema.sql` - 7 new tables, `departments.area_id`, `grant_subject_type` enum, D-13 SECURITY DEFINER helper + additive RLS arm
- `supabase/migrations/00047_org_model_data.sql` - day-one equivalence seed (collections, sop_collections, dept-level access_grants)

## Decisions Made
- Followed the plan task's Step C SQL (join `departments` to derive `organisation_id`) rather than the buggy `sd.department_id::text::uuid` cast shown in 32-RESEARCH.md's code example — the plan task description was correct and authoritative here, RESEARCH.md's illustrative snippet was not.
- `access_grants` and `sop_access_people` deliberately do NOT use the `using(true)` junction pattern applied to `role_members`/`sop_collections` — `access_grants` carries an org-scoped SELECT (grants reveal who-sees-what) and `sop_access_people` carries a self/admin-scoped SELECT (mirrors `member_departments_self_read`), per the plan's explicit instructions and the threat register (T-32-02-03, T-32-02-04).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. No `supabase db push` was run per this plan's scope boundary (files only — 32-03's job).

## Next Phase Readiness

- Both migration files are written and unpushed, ready for 32-03 to run `supabase db push` and the day-one equivalence assertion script.
- `sop_departments` and `sop_access_people` are untouched by these files — worker-visible SOP access is unchanged until 32-03 pushes and 32-05 (or later) runs materialization.
- All acceptance criteria and grep gates from the plan verified passing before commit (enum exact 5 values, all 7 tables present, `area_id` FK, `collections` unique constraint, self-scoping helper, no policy modification/drop, no recursion-trap references, no writes to `sop_departments`/`sop_access_people`, no `sops.category` mutation, `RAISE EXCEPTION` assertion present).

---
*Phase: 32-visual-org-model-library-permissions*
*Completed: 2026-07-18*

## Self-Check: PASSED

- FOUND: supabase/migrations/00046_org_model_schema.sql
- FOUND: supabase/migrations/00047_org_model_data.sql
- FOUND: .planning/phases/32-visual-org-model-library-permissions/32-02-SUMMARY.md
- FOUND: 0322e67 (Task 1 commit)
- FOUND: 3079885 (Task 2 commit)
- FOUND: fed8aa2 (SUMMARY commit)
