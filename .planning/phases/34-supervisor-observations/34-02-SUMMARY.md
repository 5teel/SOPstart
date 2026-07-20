---
phase: 34-supervisor-observations
plan: 02
subsystem: data-layer
tags: [migration, rls, zod, observations]
requires: []
provides:
  - sop_observations table (files-only, not yet pushed)
  - organisations.observation_labels column (files-only, not yet pushed)
  - RecordObservationSchema / VerdictSchema Zod contracts
affects:
  - "34-03 (live migration push)"
  - "34-04 (recordObservation server action)"
  - "Phase 35 classifier (reads sop_observations)"
tech-stack:
  added: []
  patterns:
    - "Append-only audit table modeled on 00043 sop_review_events"
    - "RLS OR-branch self-read (observed_worker_id = auth.uid())"
key-files:
  created:
    - supabase/migrations/00052_supervisor_observations.sql
    - src/lib/validators/observations.ts
  modified: []
decisions: []
metrics:
  duration: "~15 min"
  completed: 2026-07-20
---

# Phase 34 Plan 02: Supervisor Observations Data Layer Summary

Append-only `sop_observations` table + `organisations.observation_labels` column + matching Zod validator, copy-adapted from migration 00043's `sop_review_events` shape and widened per D-01/D-02/D-04/D-10/D-11/D-12.

## What Was Built

**Task 1 — Migration `00052_supervisor_observations.sql`:**
- `public.sop_observations`: `id`, `organisation_id` (FK cascade), `sop_id` (FK cascade), `sop_version` (server-stamped), `observed_worker_id` (FK cascade), `observed_by` (FK set null), `verdict` (DB `check` constrained to `performed_to_sop` / `needs_support`), `note`, `completion_id` (optional FK to `sop_completions`), `created_at`.
- Indexes on `observed_worker_id`, `organisation_id`, `sop_id`.
- RLS enabled, exactly two policies:
  - `sop_observations_read_org` — org-scoped OR `observed_worker_id = auth.uid()` (OBS-02 worker self-read, no precedent in 00043).
  - `sop_observations_insert_recorder` — org-scoped, `current_user_role() in ('admin', 'safety_manager', 'supervisor')`, `observed_by = auth.uid()`.
  - No UPDATE, no DELETE policy (append-only, D-12) — verified by grep.
- `organisations.observation_labels jsonb` column added (D-02), commented as display-only; no new RLS (existing admin-update policy from 00001 gates writes).
- Does not redefine `current_organisation_id()` / `current_user_role()`.
- **Files only — not pushed live.** 34-03 owns the live `supabase db push`.

**Task 2 — `src/lib/validators/observations.ts`:**
- `VerdictSchema = z.enum(['performed_to_sop', 'needs_support'])` + `type Verdict`.
- `RecordObservationSchema` (`workerId`/`sopId` uuid, `verdict`, `note` optional max 2000 chars, `completionId` optional uuid) + `type RecordObservationInput`.
- File-header doc-comment names the table it feeds and cites migration 00052.

## Verification

- `grep -v '^--' ... | grep -Eic "for +update|for +delete"` → 0 (no update/delete policy) — PASS
- `npx tsc --noEmit` → clean, no errors in `src/lib/validators/observations.ts` — PASS
- Migration contains `create table if not exists public.sop_observations`, the verdict check, both named policies with exact clauses, and the `observation_labels` column addition — confirmed by direct read of the file after write.

## Deviations from Plan

None — plan executed exactly as written (files matched 34-PATTERNS.md's finalized DDL/schema verbatim).

## Known Stubs

None. This plan produces files-only artifacts (migration + validator) with no runtime wiring yet — 34-03 pushes the migration live, 34-04 wires the server action. This is the intended two-step sequencing per the plan's `[BLOCKING]` note, not a stub.

## Threat Flags

None beyond the plan's own `<threat_model>` — all four STRIDE entries (T-34-02-01..04) are addressed directly by the migration's RLS policies and DB check constraint as specified; T-34-02-SC (supply chain) is N/A, zero new packages.

## Self-Check: PASSED

- FOUND: supabase/migrations/00052_supervisor_observations.sql
- FOUND: src/lib/validators/observations.ts
- FOUND commit a5f294a (Task 1)
- FOUND commit c3301a2 (Task 2)
