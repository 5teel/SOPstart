---
phase: 14-ai-drafted-sops
plan: 01
subsystem: ai-prompt-entry
tags: [phase-14, ai-prompt, parse-jobs, parse-job-status, zod-validator, migration]
requires:
  - parse_jobs schema (00012)
  - blank-wizard auth-guard pattern (Phase 12)
provides:
  - parse_jobs.input_type = 'ai_prompt' DB slot
  - parse_jobs.prompt_text TEXT NULL audit column (D-04)
  - aiPromptSchema Zod validator (D-06)
  - InputType TS union extended with 'ai_prompt'
  - ParseJob.prompt_text optional field
  - STAGE_SETS map in ParseJobStatus (input_type-keyed stepper)
  - /admin/sops/new/ai entry-route surface
affects:
  - src/components/admin/ParseJobStatus.tsx (additive — video flows byte-identical)
tech-stack:
  added: []
  patterns:
    - "STAGE_SETS map keyed off parse_jobs.input_type (replaces hardcoded VIDEO_STAGES boolean branch)"
    - "Zod default() input/output type split handled via z.input<typeof schema> + 3-arg useForm generic"
key-files:
  created:
    - "supabase/migrations/00029_ai_prompt_input_type.sql"
    - "src/app/(protected)/admin/sops/new/ai/page.tsx"
    - "src/app/(protected)/admin/sops/new/ai/PromptClient.tsx"
  modified:
    - "src/types/database.types.ts"
    - "src/types/sop.ts"
    - "src/lib/validators/sop.ts"
    - "src/components/admin/ParseJobStatus.tsx"
decisions:
  - "Auth-guard donor pattern uses organisation_members.role (not JWT claims) — matched donor verbatim per guardrail #6"
  - "Backwards-compat: STAGE_SETS.video_file and .youtube_url both alias VIDEO_STAGES_ORIGINAL; zero Phase 6 drift"
  - "I-2 closed: BOTH SELECT projections (initial fetch + 5s polling) include input_type"
  - "Zod default(3) on detailLevel forces RHF generic to z.input<schema> with 3-arg useForm typing"
metrics:
  duration: "~25 minutes (5 commits)"
  completed: 2026-05-10
---

# Phase 14 Plan 01: AI-Prompt Entry Surface Summary

JWT-claim-based prompt entry route (`/admin/sops/new/ai`) wired to a Zod-validated form, a generalised input-type-keyed stepper in ParseJobStatus, and the additive Postgres schema (`parse_jobs.input_type` extended + `prompt_text` audit column) plus TS type plumbing required by 14-02. Migration 00029 is staged but **not yet pushed to live Supabase** — Simon must run `supabase db push` (Task 6 checkpoint) before 14-02 can execute.

## Outcome

The entry-point half of SB-AUTH-02 is in place. An admin or safety_manager landing on `/admin/sops/new/ai` sees a textarea + category select + 1-5 detail slider + Generate button. On submit the form POSTs to `/api/sops/ai-prompt` (404 expected until 14-02) and immediately renders `ParseJobStatus` for the new sopId, which now reads `STAGE_SETS[parse_jobs.input_type]` to render the AI 3-stage stepper (`prompting -> drafting -> verifying`) when input_type === 'ai_prompt', falling back to the unchanged 5-stage video set for Phase 6 flows. On completion the stepper invokes a new `onCompleted` prop that routes to `/admin/sops/[sopId]/review` (D-03).

## Files Changed

### Created

| File | Purpose |
|------|---------|
| `supabase/migrations/00029_ai_prompt_input_type.sql` | Idempotent CHECK extension to add 'ai_prompt' value + adds parse_jobs.prompt_text TEXT NULL with COMMENT |
| `src/app/(protected)/admin/sops/new/ai/page.tsx` | Server route component with admin/safety_manager guard via organisation_members table; fetches distinct categories |
| `src/app/(protected)/admin/sops/new/ai/PromptClient.tsx` | Client form: RHF + zodResolver(aiPromptSchema), submits to /api/sops/ai-prompt, renders ParseJobStatus on success |

### Modified

| File | Change |
|------|--------|
| `src/types/database.types.ts` | parse_jobs Row/Insert/Update gain `prompt_text: string \| null` (and `?: string \| null` for I/U). input_type already permissive (string \| null). |
| `src/types/sop.ts` | InputType union adds 'ai_prompt'; ParseJob interface adds `prompt_text?: string \| null` |
| `src/lib/validators/sop.ts` | Adds aiPromptSchema (min 20 / max 2000) + detailLevel int 1-5 default 3 + AiPromptInput type |
| `src/components/admin/ParseJobStatus.tsx` | New STAGE_SETS map keyed off input_type; both SELECT projections include input_type (I-2); new onCompleted prop; AI-prompt processing + completion render branches; Phase 6 video behaviour byte-identical |

## Task Status

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Migration 00029 — input_type CHECK + prompt_text column | DONE | 7cbcf5a |
| 2 | Extend types (database.types.ts + sop.ts) | DONE | d78d191 |
| 3 | aiPromptSchema validator | DONE | b9026af |
| 4 | ParseJobStatus generalisation (STAGE_SETS + I-2 SELECT projections) | DONE | 69f45d8 |
| 5 | /admin/sops/new/ai entry route + PromptClient form | DONE | 4108704 |
| 6 | **Schema push to Supabase (BLOCKING human-action checkpoint)** | **AWAITING SIMON** | — |

## Deviations from Plan

### [Rule 1 — Plan/donor mismatch] Auth-guard pattern uses organisation_members, not JWT claims
- **Found during:** Task 5
- **Issue:** Plan §Task 5 spec showed JWT-claim parsing (`atob(session.access_token.split('.')[1])`) but guardrail #6 said "the canonical auth-guard donor — copy the JWT claim parsing + role check verbatim"; the actual donor at `src/app/(protected)/admin/sops/new/blank/page.tsx` (lines 19-27) uses an `organisation_members.role` lookup, not JWT claims at all.
- **Resolution:** Followed guardrail #6 ("copy from the blank wizard verbatim") and the donor's actual code, not the plan's example. The guard is functionally equivalent (admin/safety_manager redirect to /dashboard) and matches the rest of the admin surface.
- **Files affected:** `src/app/(protected)/admin/sops/new/ai/page.tsx`
- **Commit:** 4108704

### [Rule 1 — Type-inference fix] Zod default() input/output split forced 3-arg useForm generic
- **Found during:** Task 5 tsc verification
- **Issue:** `z.number().int().min(1).max(5).default(3)` makes detailLevel optional in input but required in output; RHF's 1-arg `useForm<AiPromptInput>` couldn't reconcile this and tsc errored on `Resolver<...> not assignable` and `SubmitHandler<TFieldValues>` mismatch.
- **Resolution:** Switched to RHF's 3-arg generic `useForm<AiPromptFormInput, undefined, AiPromptInput>` with `AiPromptFormInput = z.input<typeof aiPromptSchema>`. onSubmit typed as `SubmitHandler<AiPromptInput>` so it receives the parsed (post-default) shape.
- **Files affected:** `src/app/(protected)/admin/sops/new/ai/PromptClient.tsx`
- **Commit:** 4108704

### [Rule 2 — Lint hygiene] `failedStageName` and `onRetry` referenced via `void`
- **Found during:** Task 4 refactor
- **Issue:** Existing ParseJobStatus.tsx already declared `failedStageName` and accepted an `onRetry` prop without consuming them in render branches. Refactor preserved both verbatim (per guardrail "zero Phase 6 regression"). To avoid no-unused-vars failures from a stricter lint pass, added `void failedStageName; void onRetry;` references.
- **Files affected:** `src/components/admin/ParseJobStatus.tsx`
- **Commit:** 69f45d8
- **Note:** Pre-existing dead code (these were already declared-but-not-read before this plan) — flagged for follow-up cleanup but out of scope.

## TASK 6 CHECKPOINT — AWAITING SIMON

**Type:** human-action (blocking)

Migration `supabase/migrations/00029_ai_prompt_input_type.sql` is committed locally but has NOT been applied to the live Supabase project (`gknxhqinzjvuupccyojv`). Without the push:
- 14-02's API route will fail with a CHECK violation when inserting `input_type='ai_prompt'`
- Any write to `parse_jobs.prompt_text` will fail with `column does not exist`

`database.types.ts` was extended manually so build/tsc passes locally — but the live DB is out of sync.

### What Simon Needs To Do

Run from project root in PowerShell:

```powershell
$env:SUPABASE_ACCESS_TOKEN='<your-token>'; npx supabase db push --include-all
```

### Then verify in the Supabase SQL editor:

```sql
select pg_get_constraintdef(oid) from pg_constraint
  where conname = 'parse_jobs_input_type_check';
-- expect: CHECK ((input_type = ANY (ARRAY['upload', 'scan', 'url', 'video_file', 'youtube_url', 'ai_prompt']::text[])))

select column_name from information_schema.columns
  where table_schema='public' and table_name='parse_jobs' and column_name='prompt_text';
-- expect: 1 row
```

### Resume signal

Type **"pushed"** once the CHECK includes `'ai_prompt'` and the `prompt_text` column exists. Type **"issue: [description]"** if push fails (rollback strategy: migration is purely additive — re-run is safe).

## Open Follow-Ups for 14-02

1. **`/api/sops/ai-prompt` route handler** — must re-validate via `aiPromptSchema` (defence-in-depth per T-14-01-01); insert parse_job row with `input_type: 'ai_prompt'`, `prompt_text: <validated body>`; advance `current_stage` through `prompting -> drafting -> verifying`.
2. **Verifier agent (D-02)** — wired into the `verifying` stage; same flag-emission pattern as the video pipeline.
3. **PromptClient `onCompleted`** path — already routes to `/admin/sops/[sopId]/review`; 14-02 must ensure parse_job.status flips to `'completed'` and the review page exists for the sop (it already does — Phase 1 surface).
4. **Pre-existing dead code cleanup** in ParseJobStatus.tsx (`failedStageName`, unused `onRetry`) — not blocking but worth a sweep.

## Self-Check: PASSED

- [x] supabase/migrations/00029_ai_prompt_input_type.sql exists (commit 7cbcf5a)
- [x] src/types/database.types.ts contains `prompt_text` (commit d78d191)
- [x] src/types/sop.ts contains `'ai_prompt'` + `prompt_text?: string | null` (commit d78d191)
- [x] src/lib/validators/sop.ts contains aiPromptSchema + AiPromptInput (commit b9026af)
- [x] src/components/admin/ParseJobStatus.tsx contains STAGE_SETS, ai_prompt, prompting, drafting, activeStageSet, /api/sops/ai-prompt; both SELECT projections include input_type (commit 69f45d8)
- [x] src/app/(protected)/admin/sops/new/ai/page.tsx + PromptClient.tsx exist (commit 4108704)
- [x] `npx tsc --noEmit` zero errors after every task
- [x] All 5 commits visible in `git log` on this worktree branch
