---
phase: 56-a-simpler-sop-the-decision-ledger
plan: 03
subsystem: database
tags: [migration, rls, append-only-ledger, standards, placement, capability-matrix]
requires: [56-01]
provides:
  - supabase/migrations/00069_sop_kinds_placement_standards.sql (sops.placement + sync trigger, sop_focus_steps, sop_conversion_runs, standards, standard_attachments, six-name seed)
  - supabase/migrations/00070_decisions_ledger.sql (decisions, immutability triggers, revokes, RPC lockdown, seven-source backfill)
  - src/types/database.types.ts (five tables + sops.placement)
  - tests/phase56/schema-shape.spec.ts (16 source-level shape assertions)
  - CAPABILITY-MATRIX rows for standards, generated steps, conversion reports, ledger
affects: [56-04, 56-05, 56-06, 56-07, 56-09]
tech-stack:
  added: []
  patterns:
    - "One FK column per attachment level instead of a polymorphic target id, so deletes cascade and no label is orphaned"
    - "Immutability in the database: row trigger + statement trigger (TRUNCATE) set to always fire, plus revoked privileges for every app role"
    - "Backfill guarded by a no-live-rows check, with per-source count assertions in the same DO block"
key-files:
  created:
    - supabase/migrations/00069_sop_kinds_placement_standards.sql
    - supabase/migrations/00070_decisions_ledger.sql
    - tests/phase56/schema-shape.spec.ts
  modified:
    - src/types/database.types.ts
    - .planning/codebase/CAPABILITY-MATRIX.md
key-decisions:
  - "decisions has no authenticated INSERT policy: only the server writer (service role) inserts, so no org member can forge an entry through PostgREST"
  - "Attachments use one FK column per level (sop, section, focus step) with num_nonnulls = 1"
  - "Self-added assignments are not backfilled, matching the live path where selfAddSop is allowlisted"
requirements-completed: [SOP-01, SOP-02, SOP-03, DEC-01, DEC-03, DEC-04]
duration: 30min
completed: 2026-10-04
---

# Phase 56 Plan 03: Migrations 00069 and 00070 Summary

**Two idempotent migrations (written, not applied): placement + generated-step + standards tables with org-scoped RLS, and an append-only decisions ledger that refuses UPDATE, DELETE and TRUNCATE for every role including the service role, backfilled from seven source tables with asserted counts.**

## Task commits

1. Task 1, migration 00069: `83e0f1f`
2. Task 2, migration 00070 + shape spec + types + capability matrix: `91055da`

## What is in the migrations

- **00069:** `sops.placement` (named check, backfilled from `sop_machines`), invoker function `sync_sop_placement()` + trigger `sop_machines_sync_placement` (after insert or delete), `sop_focus_steps` (1 SELECT policy inheriting sops visibility), `sop_conversion_runs` (1 admin SELECT policy), `standards` (2 policies, unique `(org, lower(btrim(name)))`), `standard_attachments` (3 policies, composite FK to standards, `num_nonnulls = 1`, insert policy proves the target is in the caller's org), seed of the six names for every organisation. 7 policies, all double-quoted, every WITH CHECK restates the org predicate. The old step and section tables are not altered.
- **00070:** `decisions` (no FK except `supersedes_decision_id`; `decisions_agent_named` and `decisions_person_has_id` checks; four indexes incl. unique legacy key), one SELECT policy (admin / safety_manager), `decisions_refuse_change()` + `decisions_no_update_delete` + `decisions_no_truncate`, both set to always fire, revokes (anon all; authenticated insert/update/delete/truncate; service_role update/delete/truncate), EXECUTE revoked from public/anon/authenticated on `accept_block_update` and `decline_block_update`, seven-source backfill inside a guarded DO block with a count assertion per source.

## Column names versus RESEARCH

Every source column named in the plan matched the source migrations (00007, 00010, 00025, 00038, 00043, 00045, 00052) plus `is_assessor_override` / `override_reason` on `sop_observations` and `completion_sign_offs` (added in 00056). `sop_assignments.assignment_type` and `role` are enums, so the backfill casts them to text. No difference from RESEARCH.

## Verification

- `npx playwright test --project=phase56 --project=phase15-stubs`: 122 passed, 22 skipped (the skips are the fixme wiring tests from 56-01, unchanged).
- schema-shape: 16/16. `rls-org-scope` 3/3 with both migrations present. `capability-matrix-doc` passes. `npx tsc --noEmit` clean.
- Acceptance greps: 7 policies in 00069, 1 in 00070; 0 hits for alter of sop_steps / sop_sections; 2 `enable always trigger`; 0 cascade / set-null in 00070; two `from public, anon, authenticated` lines.
- Nothing was applied to any database; 56-04 applies and probes.

## Deviations from Plan

**1. Commit split.** The shape spec, types and matrix cover both tasks and are interdependent (the spec reads both files), so they went in the Task 2 commit; Task 1's commit holds 00069 only. The capability-matrix rows for 00069 therefore land one commit after the policies, not in the same commit. No functional effect.

Otherwise: plan executed as written.

## Known limits (carried to 56-04)

- The decisions triggers are proven only at source level here; the in-database refusal probe (real row id, not a zero-row UPDATE) and the placement-flip probe on a machine delete cascade are 56-04.
- `errcode '23001'` is untested against the live database (RESEARCH A4); the probe should key on the message text `append-only`.
- The table owner can still switch a trigger off deliberately; documented in the migration header and the matrix row.

## Self-Check: PASSED
