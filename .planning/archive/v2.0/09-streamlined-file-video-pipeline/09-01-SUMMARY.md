---
phase: 09-streamlined-file-video-pipeline
plan: "01"
subsystem: foundation
tags: [supabase-migration, rls, server-action, pipeline-linkage, d-06]
dependency_graph:
  requires: [phase9-stubs-playwright-project]
  provides:
    - sop_pipeline_runs-table
    - pipeline_run_id-FK-parse_jobs
    - pipeline_run_id-FK-sops
    - pipeline_run_id-FK-video_generation_jobs
    - createVideoSopPipelineSession-action
    - PipelineVideoFormat-type
    - SopPipelineRun-type
  affects:
    - src/types/database.types.ts
    - src/types/sop.ts
    - src/lib/validators/sop.ts
    - src/actions/sops.ts
tech_stack:
  added: []
  patterns:
    - partial unique index on pipeline_run_id
    - current_organisation_id() RLS helper
    - admin client signed upload URL with atomic multi-insert
key_files:
  created:
    - supabase/migrations/00016_sop_pipeline_runs.sql
  modified:
    - src/types/database.types.ts
    - src/types/sop.ts
    - src/lib/validators/sop.ts
    - src/actions/sops.ts
decisions:
  - "Migration 00016 landed before Phase 10 migrations 00017/00018 in commit order but applied after on remote — numbering preserved as-committed since migrations are additive and non-conflicting"
  - "pipeline_run_id columns are nullable FK with ON DELETE SET NULL — non-pipeline SOPs (manual upload path) remain unaffected, pipeline rows can be safely archived without cascading"
  - "createVideoSopPipelineSession uses admin client for atomic INSERT chain (sop_pipeline_runs → sops → parse_jobs) bypassing RLS consistently with existing upload pattern (02-01)"
  - "getSourceFileType throw-catch pattern preserved from 05-01 — prevents silent wrong routing for unknown MIME types"
  - "Macro-file block preserved from 05-01 at the pipeline entry to reject .xlsm/.xlsb/.xltm/.pptm/.potm/.ppam before any parsing work"
metrics:
  completed: "2026-04-13"
  tasks_completed: 5
  files_created: 1
  files_modified: 4
commits:
  - ba71f91 — feat(09-01): migration 00016 — sop_pipeline_runs table + FK columns + RLS
  - f2be61b — feat(09-01): extend types and validators for sop_pipeline_runs (D-06)
  - 439196f — feat(09-01): createVideoSopPipelineSession server action
requirements: [PATH-01, PATH-02, PATH-06]
---

# 09-01: Pipeline Foundation — sop_pipeline_runs + D-06 Linkage

## What was built

Migration 00016 creates `public.sop_pipeline_runs` (id, organisation_id, created_by,
status, requested_video_format, plus audit timestamps) and adds a
nullable `pipeline_run_id uuid` FK column to each of `parse_jobs`, `sops`, and
`video_generation_jobs` with `ON DELETE SET NULL`. RLS is enforced via
`public.current_organisation_id()` across SELECT/INSERT/UPDATE (no DELETE policy —
pipeline runs are archived, not deleted). The table is added to the
`supabase_realtime` publication so the Phase 9 progress page can subscribe to
`postgres_changes`.

TypeScript types were extended: `database.types.ts` now includes the
`sop_pipeline_runs` Row/Insert/Update shape and the three `pipeline_run_id` columns.
`src/types/sop.ts` exports `PipelineVideoFormat` (`narrated_slideshow |
screen_recording`), `PipelineRunStatus`, and the `SopPipelineRun` interface. `src/lib/validators/sop.ts` exports `pipelineVideoFormatSchema` and
`createVideoSopPipelineSessionSchema` for the entry UI.

The new server action `createVideoSopPipelineSession` in `src/actions/sops.ts`
atomically creates the pipeline run row, the draft SOP (with pipeline_run_id set),
a signed upload URL in the `sop-source` bucket, updates the SOP row with the final
`source_file_path`, and inserts the corresponding `parse_jobs` record. Returns
`{pipelineId, sopId, uploadUrl, token, path}` or `{error}`. Preserves the macro-file
block and `getSourceFileType` throw-catch semantics from Plan 05-01.

## Why it matters

D-06 (unified pipeline state) is now actionable: every downstream plan in Phase 9
(09-02 entry UI, 09-03 publish auto-queue, 09-04 progress page) can query a single
`pipeline_id` and join across the three linked tables without reconstructing state
from SOP metadata. The partial unique index guarantees one active pipeline row per
SOP while still allowing historical rows for audit and replay.

## Migration delivery

Migration 00016 applied via `supabase db push` (operator: user, 2026-04-13).
Phase 10 migrations 00017 (multi_org_membership) and 00018 (video_version_management)
were already present on the remote at that point and are additive — no conflict with
00016. Dashboard verified: table exists with expected columns, FKs on the three linked
tables present, three RLS policies in place using `current_organisation_id()`,
`sop_pipeline_runs` appears in the realtime publication.

## Follow-ups

- 09-02 will call `createVideoSopPipelineSession` from the VideoFormatSelectionModal
- 09-03 will use `parse_jobs.pipeline_run_id` to detect pipeline-linked SOPs and auto-queue video generation on publish
- 09-04 will subscribe to `sop_pipeline_runs` realtime + join against parse_jobs/sops/video_generation_jobs for the 5-stage stepper

## Self-Check: PASS

- [x] Migration file on disk and matches plan SQL
- [x] TypeScript typecheck clean (`npx tsc --noEmit`)
- [x] Server action exported and validated
- [x] RLS policies isolate by organisation
- [x] pipeline_run_id FK columns present on all three linked tables
- [x] `supabase db push` applied by operator
- [x] Three code commits present on master
