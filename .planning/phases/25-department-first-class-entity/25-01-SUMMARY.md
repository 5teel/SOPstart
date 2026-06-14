---
phase: 25-department-first-class-entity
plan: "01"
subsystem: database
tags:
  - migration
  - rls
  - departments
  - schema
  - typescript-types
dependency_graph:
  requires:
    - "supabase/migrations/00019_section_kinds_and_blocks.sql — blocks table"
    - "supabase/migrations/00022_block_library_phase13.sql — block_suggestions (dropped)"
    - "supabase/migrations/00030_sub_trades.sql — RLS pattern analog"
    - "supabase/migrations/00031_fix_sops_sub_trades_rls_recursion.sql — junction using(true) fix"
  provides:
    - "public.departments table + 3 junctions + 2 SECURITY DEFINER helpers"
    - "sops_visible_by_department additive SELECT policy"
    - "blocks.all_departments / sops.all_departments columns"
    - "Department / DepartmentWithCounts / MemberDepartment TypeScript types"
  affects:
    - "supabase/migrations/ (migration chain 00035–00037)"
    - "src/types/sop.ts (type surface for all downstream plans)"
tech_stack:
  added:
    - "public.departments (PostgreSQL table)"
    - "public.block_departments (junction)"
    - "public.sop_departments (junction)"
    - "public.member_departments (junction)"
    - "current_user_department_ids() SECURITY DEFINER function"
    - "sop_in_user_departments(uuid) SECURITY DEFINER function"
  patterns:
    - "using(true) on junction SELECT policies (D-02a recursion avoidance)"
    - "SECURITY DEFINER helper + additive permissive SELECT policy (00030/00031 pattern)"
    - "PL/pgSQL FOR org IN SELECT ... LOOP for per-org data migration"
key_files:
  created:
    - supabase/migrations/00035_departments_schema.sql
    - supabase/migrations/00036_departments_data.sql
    - supabase/migrations/00037_departments_rls_cleanup.sql
  modified:
    - src/types/sop.ts
decisions:
  - "D-02a enforced: all three junction tables use using(true) for SELECT — never reference parent sops/blocks table from a junction policy (42P17 recursion avoidance)"
  - "D-01 non-destructive: global blocks are COPIED per-org (not updated in place); category column retained read-only; DELETE of null-org rows only after copies confirmed"
  - "D-03 owner label: owner_user_id is ON DELETE SET NULL — dept surfaces 'no owner' warning on member removal (REQ-5)"
  - "D-04 parity: all_departments boolean added to BOTH blocks and sops"
  - "is_platform_admin() NOT dropped in 00037 — migration 00032 (ai_review_results policy) still references it"
  - "sops_visible_by_department is a new additive permissive SELECT policy; does NOT touch existing sops_visible_by_sub_trade"
metrics:
  duration: "~4 minutes"
  completed: "2026-06-15"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 1
---

# Phase 25 Plan 01: Schema Migration, Data Migration, Cleanup + TypeScript Types Summary

**One-liner:** Three sequential Postgres migrations establishing the `departments` first-class entity (table + 3 junctions + SECURITY DEFINER helpers + additive SOP visibility policy + global-block-to-org-scoped data conversion) plus `Department`/`DepartmentWithCounts`/`MemberDepartment` TypeScript types — the dependency spine for all subsequent Phase 25 plans.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Schema migration 00035 | `782ca10` | `supabase/migrations/00035_departments_schema.sql` |
| 2 | Data migration 00036 | `da622fd` | `supabase/migrations/00036_departments_data.sql` |
| 3 | Cleanup 00037 + TypeScript types | `ed1dce2` | `supabase/migrations/00037_departments_rls_cleanup.sql`, `src/types/sop.ts` |

## What Was Built

### Migration 00035 — Schema (Task 1)
- `public.departments` table: org-scoped via `organisation_id = current_organisation_id()` RLS, `owner_user_id` with `ON DELETE SET NULL` (REQ-5/D-03), `unique (organisation_id, code)`.
- Three junction tables `block_departments`, `sop_departments`, `member_departments` — all with composite PKs and RLS enabled.
- **Recursion-safe SELECT policies:** `block_departments` and `sop_departments` use `using(true)`. `member_departments` uses self-read + org-admin pattern (mirrors 00031 fix pattern).
- SECURITY DEFINER helpers: `current_user_department_ids()` (setof uuid from member_departments) and `sop_in_user_departments(uuid)` (boolean, checks sop_departments ∩ member's dept ids).
- `all_departments boolean not null default false` added to both `public.blocks` and `public.sops` (D-04 parity).
- `sops_visible_by_department` additive permissive SELECT policy: `sops.all_departments = true OR not exists sop_departments row OR sop_in_user_departments()` — third OR arm composing with existing base policy and `sops_visible_by_sub_trade`.

### Migration 00036 — Data Migration (Task 2)
- PL/pgSQL `DO $$` block loops over all `public.organisations`.
- For each org: inserts `General` (code `GEN`) department first (Pitfall 5 ordering), then `sop_departments` rows for all org-owned SOPs, then `block_departments` rows for all org-owned blocks.
- Copies each global block (`organisation_id IS NULL`) per-org with `all_departments = true` and all existing fields (kind_slug, name, category, category_tags, free_text_tags, created_by, current_version_id). Uses `WHERE NOT EXISTS` guard for idempotency.
- After the loop: `DELETE FROM public.blocks WHERE organisation_id IS NULL`.
- Fail-fast assertion: `RAISE EXCEPTION` if any null-org blocks remain.
- Zero-org path: RAISE NOTICE no-op (CI safety).

### Migration 00037 — Cleanup (Task 3)
- Drops `blocks_read_global_plus_org` (00019 null-org read arm — dead after 00036).
- Drops `blocks_summit_admin_global_write`, `blocks_summit_admin_global_update`, `block_versions_summit_admin_global_insert` (00022 global write paths — dead after 00036).
- Drops `block_suggestions_read`, `block_suggestions_insert`, `block_suggestions_update_summit_only` policies.
- Drops `public.block_suggestions` table CASCADE.
- `is_platform_admin()` NOT dropped — migration 00032 (ai_review_results policy) still references it.

### TypeScript Types (Task 3)
Added to `src/types/sop.ts`:
- `Department` — full column set including `icon: string | null`, `owner_user_id: string | null`, `archived: boolean`
- `DepartmentWithCounts extends Department` — adds `people_count`, `sop_count`, `block_count: number`
- `MemberDepartment` — `member_id`, `department_id`, `assigned_at`, `assigned_by: string | null`

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**Minor elaboration (not a deviation):** The 00036 data migration uses a `WHERE NOT EXISTS (org + kind_slug + name + current_version_id)` idempotency guard instead of a bare `ON CONFLICT DO NOTHING`, because the `blocks` table has no unique constraint on `(organisation_id, kind_slug, name)`. The plan's acceptance criteria call for idempotency; this guard satisfies that requirement without the recursion that would occur with a plain `INSERT ... ON CONFLICT`.

## Verification Results

All Task 1–3 automated verification checks passed:

```
00035: OK
00036: OK
00037+types: OK
ALL CHECKS PASSED
```

- `npx tsc --noEmit`: no errors (zero lines from `src/types/sop.ts`)
- Recursion guard: no junction SELECT policy references `from public.sops` or `from public.blocks`
- No in-place `UPDATE public.blocks SET organisation_id` (per-org copy pattern confirmed)
- No `DROP COLUMN ... category` (D-01 non-destructive confirmed)
- `drop table if exists public.block_suggestions` present in 00037

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries beyond those in the plan's threat model (T-25-01 through T-25-05). All mitigations applied by construction:

- T-25-01: `departments_org_read` uses `current_organisation_id()` — cross-tenant isolation.
- T-25-02: Junction policies use `using(true)`, `sop_in_user_departments()` SECURITY DEFINER — recursion-safe by construction.
- T-25-03: `departments_admin_insert` WITH CHECK pins `organisation_id = current_organisation_id()`.
- T-25-04: Copy-before-delete + `RAISE EXCEPTION` assertion guard. `category` retained.
- T-25-05: `owner_user_id` has no associated policy — purely a label column.

## Known Stubs

None. This plan creates migration files and TypeScript types only — no UI or data-wiring stubs.

## Blocking Note

These migrations are WRITTEN but NOT APPLIED to the database. Plan 02 applies them via `supabase db push` and runs the post-apply acceptance invariants (zero null-org blocks, cross-tenant isolation proof, no 42P17 under `SELECT * FROM sops LIMIT 1`). Do not treat this plan as "live" until Plan 02 completes.

## Self-Check: PASSED

- `supabase/migrations/00035_departments_schema.sql` — exists
- `supabase/migrations/00036_departments_data.sql` — exists
- `supabase/migrations/00037_departments_rls_cleanup.sql` — exists
- `src/types/sop.ts` — modified, exports Department/DepartmentWithCounts/MemberDepartment
- Commit `782ca10` — verified in git log
- Commit `da622fd` — verified in git log
- Commit `ed1dce2` — verified in git log
