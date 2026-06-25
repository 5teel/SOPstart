---
phase: 23-ai-field-layer-version-supersede
plan: 01
subsystem: database
tags: [migration, schema, rls, supabase, types]
dependency_graph:
  requires: ["23-00"]
  provides: ["sop_completion_signatures table", "ai_field_proposals table", "sop_completions.roster_worker_id column"]
  affects: ["23-04", "23-05", "23-06"]
tech_stack:
  added: []
  patterns: ["to_regclass Management API verification", "Supabase db push non-interactive"]
key_files:
  created:
    - supabase/migrations/00038_phase23_schema.sql
    - scripts/apply-phase23-migration.mjs
  modified:
    - src/types/database.types.ts
decisions:
  - "RLS SELECT policies use current_organisation_id() directly — no cross-table join to sops/sop_completions (42P17 avoidance per CLAUDE.md 2026-05-13)"
  - "No authenticated INSERT/UPDATE/DELETE on sop_completion_signatures or ai_field_proposals — writes via createAdminClient() in server actions (CLAUDE.md 2026-06-15)"
  - "roster_worker_id is nullable (no NOT NULL) — back-compat with all pre-Phase-23 completion rows"
  - "Post-push verification via Supabase Management API raw SQL (to_regclass + information_schema) — NOT PostgREST REST client which returns PGRST205 stale-cache false-miss (CLAUDE.md 2026-06-15)"
  - "NOTIFY pgrst, 'reload schema' issued via Management API immediately after push"
metrics:
  duration: "218 seconds"
  completed: "2026-06-25T13:37:50Z"
  tasks_completed: 3
  files_changed: 3
---

# Phase 23 Plan 01: Schema Foundation (migration 00038) Summary

Migration 00038 adds roster_worker_id FK, sop_completion_signatures append-only table, and ai_field_proposals approval-queue table — all with recursion-safe org-scoped RLS and no authenticated write policies — live on the DB as of 2026-06-25T13:37:50Z.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Write migration 00038 (roster column + signatures + ai_field_proposals) | `5f19c59` | supabase/migrations/00038_phase23_schema.sql |
| 2 | Extend database.types.ts for new table + column | `c2157b8` | src/types/database.types.ts |
| 3 | [BLOCKING] Apply migration 00038 to live DB + to_regclass verification | `7bdf250` | scripts/apply-phase23-migration.mjs |

## What Was Built

**Migration 00038** adds three schema objects:

1. **`sop_completions.roster_worker_id`** — nullable `uuid REFERENCES auth.users(id)` column. Distinct from `worker_id` (the kiosk account uid used for RLS). NULL for all pre-Phase-23 rows — back-compat with no row migration required. Index `idx_completions_roster_worker` added.

2. **`sop_completion_signatures`** — append-only sign-off chain table (AFL-VER-05). Columns: id, organisation_id, completion_id, role CHECK('worker','supervisor'), roster_user_id, signed_at. RLS SELECT via `current_organisation_id()` directly. No authenticated write policy — writes via `createAdminClient()` in the `recordSignature` server action (Plan 23-06).

3. **`ai_field_proposals`** — AI field write approval queue (X-03). Columns: id, organisation_id, field_id, field_label, context jsonb, current_value jsonb, proposed_value jsonb, status CHECK('pending','applied','rejected'), sop_version int, created_at. Index `idx_ai_field_proposals_org_status` on (organisation_id, status). RLS SELECT via `current_organisation_id()` directly. No authenticated write policy — writes via `createAdminClient()` in `applyAiWrite`/`acceptProposal`/`rejectProposal` server actions (Plan 23-04).

**Live DB verification (all PASS):**
- `to_regclass('public.sop_completion_signatures')` = `sop_completion_signatures` (non-null)
- `to_regclass('public.ai_field_proposals')` = `ai_field_proposals` (non-null)
- `sop_completions.roster_worker_id` in information_schema.columns: data_type=uuid, is_nullable=YES
- `SELECT on public.sops`: no 42P17 RLS recursion
- `roster_worker_id` is_nullable = YES (back-compat confirmed)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan is schema-only. No UI or server action stubs were introduced.

## Threat Flags

No new threat surface beyond what the plan's threat model covers. The Management API POST (`/v1/projects/{ref}/database/query`) is used only for post-push verification — `SUPABASE_ACCESS_TOKEN` is read from `.env.local` (not hardcoded), and the script is a local dev tool only.

## Self-Check

### Files Exist
- `supabase/migrations/00038_phase23_schema.sql` — FOUND (created in this plan)
- `src/types/database.types.ts` — modified (roster_worker_id + 2 new table blocks)
- `scripts/apply-phase23-migration.mjs` — FOUND (created in this plan)

### Commits Exist
- `5f19c59` — FOUND
- `c2157b8` — FOUND
- `7bdf250` — FOUND

### Live DB Verified
- Migration 00038 applied via `supabase db push` (PASS)
- All 5 to_regclass / information_schema assertions PASS
- No 42P17 recursion on sops SELECT (PASS)
- tsc --noEmit clean after database.types.ts extension (PASS)

## Self-Check: PASSED
