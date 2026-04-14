---
phase: 09-streamlined-file-video-pipeline
reviewed: 2026-04-13T00:00:00Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - supabase/migrations/00016_sop_pipeline_runs.sql
  - src/types/database.types.ts
  - src/types/sop.ts
  - src/lib/validators/sop.ts
  - src/actions/sops.ts
  - src/components/admin/VideoFormatSelectionModal.tsx
  - src/components/admin/UploadDropzone.tsx
  - src/lib/video-gen/auto-queue.ts
  - src/app/api/sops/[sopId]/publish/route.ts
  - src/components/admin/PipelineStepper.tsx
  - src/app/(protected)/admin/sops/pipeline/[pipelineId]/page.tsx
  - src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx
  - src/app/api/sops/pipeline/[pipelineId]/snapshot/route.ts
  - src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx
  - src/app/(protected)/admin/sops/[sopId]/review/page.tsx
findings:
  blocker: 0
  high: 0
  medium: 4
  low: 5
  info: 3
  total: 12
status: issues
---

# Phase 9: Code Review Report

**Reviewed:** 2026-04-13
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues (no blockers, all medium/low/info)

## Summary

Phase 9 ships the streamlined file → video pipeline: a new `sop_pipeline_runs` table with RLS, a pipeline session server action, a format-selection modal, a unified progress page (realtime + polling fallback), and publish-route auto-queue. Overall quality is good — no blockers, no secrets, no SQL injection, no auth bypasses. Multi-tenant isolation is correct and the D-02 publish gate is preserved exactly.

Key positives:
- Migration 00016 uses `public.current_organisation_id()` consistently for SELECT/INSERT/UPDATE RLS, with no DELETE policy (append-only audit trail).
- `createVideoSopPipelineSession` auth + role check mirrors `createUploadSession` exactly; admin client is only used after organisation + role are verified.
- Publish route's unapproved-section gate is byte-identical to the pre-Phase-9 implementation — auto-queue is wired AFTER the successful publish, wrapped in a helper that never throws (outer try/catch), and errors are logged without rolling back the publish.
- `after()` is invoked inside a request handler (publish route → auto-queue), which is the correct Next 16 usage. Dynamic import of `@/lib/video-gen/pipeline` keeps the publish bundle small.
- `PipelineProgressClient` correctly cleans up realtime channel + interval + timeout on unmount.
- JWT decoding uses `Buffer.from(..., 'base64').toString('utf-8')` in server components (correct for Node runtime), and `atob` in server actions (also correct — both work on Node 20).
- Snapshot API re-verifies `organisation_id` match against the JWT before returning data — admin client is safe.
- `ReviewPage` correctly wraps `ReviewClient` in `<Suspense>` now that the client uses `useSearchParams` (required for Next 16 static rendering).

Issues found are all non-blocking: a few UX/robustness gaps (empty-state in generating stage, polling fallback that never re-negotiates to realtime, HEIC files in the pipeline modal bypassing the conversion path used elsewhere), one redundancy issue (parse_job lookup by sop_id instead of by pipeline_run_id), and some duplicated validation constants.

## Medium

### MR-01: Pipeline modal accepts HEIC/HEIF but has no client-side conversion

**File:** `src/components/admin/VideoFormatSelectionModal.tsx:10`
**Issue:** The file picker sets `ACCEPT = '.docx,.pdf,.xlsx,.pptx,.txt,image/jpeg,image/png,image/heic,image/heif'` and passes the raw file straight to `createVideoSopPipelineSession` + `uploadToSignedUrl`. `UploadDropzone.tsx:147-164` dynamically imports `heic2any` and converts HEIC → JPEG before upload because the downstream parser cannot handle HEIC bytes. HEIC files uploaded via the pipeline modal will fail at parse time and show up as a `parsing` error on the pipeline page instead of being rejected up front.
**Fix:** Either drop `image/heic,image/heif` from `ACCEPT` and reject with an error toast ("iPhone photos: upload via the main file picker so we can convert them"), or mirror the `heic2any` conversion logic from `UploadDropzone.validateAndAddFiles` before uploading. The conversion branch should be lifted into a shared helper (`src/lib/parsers/heic-convert.ts`) so both modals share it.

### MR-02: Snapshot/server page parse_job lookup isn't scoped by pipeline_run_id

**Files:**
- `src/app/(protected)/admin/sops/pipeline/[pipelineId]/page.tsx:86-93`
- `src/app/api/sops/pipeline/[pipelineId]/snapshot/route.ts:70-77`

**Issue:** Both the server component and the snapshot route query `parse_jobs` with `.eq('sop_id', sop.id).order('created_at', { ascending: false }).limit(1)` to find the "current" parse job. If a user later retries parsing for the same SOP (e.g. after a failure) from outside the pipeline flow, the latest parse_job may have `pipeline_run_id = NULL`, and the pipeline page will show a stale/unrelated status. The query should also filter by `pipeline_run_id` to guarantee we get the parse_job linked to this pipeline.
**Fix:**
```ts
const parseJobResult = await admin
  .from('parse_jobs')
  .select('id, status, current_stage, error_message')
  .eq('sop_id', sop.id)
  .eq('pipeline_run_id', pipelineId) // <-- scope to this pipeline
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
```
Apply identically in both files.

### MR-03: Polling fallback is one-shot — never re-enables if realtime silently drops

**File:** `src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx:94-182`
**Issue:** The logic is "wait 5s, if `receivedRealtimeRef.current === false` start polling every 5s." Once polling starts, it never stops. Once any realtime event fires, polling never starts (good). But the inverse is brittle: if the Supabase websocket is established but an event is missed or the connection drops silently after the first event, we'll stop polling and stop getting updates. There's also no error handler on `.subscribe()` to detect `CHANNEL_ERROR` / `TIMED_OUT` states and fall back to polling.
**Fix:** Two small improvements:
1. Pass a callback to `.subscribe((status) => { ... })` and start polling immediately on `CHANNEL_ERROR` or `TIMED_OUT`.
2. Instead of `receivedRealtimeRef`, track "last update timestamp" and start polling whenever the latest update is older than 15s. This also protects against missed events after initial connect.

Not a blocker — worst case the user refreshes the page.

### MR-04: `generating` stage renders nothing when videoJob hasn't been inserted yet

**File:** `src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx:85, 250-263`
**Issue:** `deriveStage` returns `generating` as the fallback when sop is published and videoJob isn't `ready`. But the `generating` JSX block is gated on `snapshot.videoJob && ...`. During the short window between publish completing and the auto-queue `INSERT` landing (publish route → `enqueueVideoGenerationForPipeline` → admin insert → realtime event), `videoJob` is null and the page shows only the stepper with no status card. On slow networks this is a "looks broken" state.
**Fix:** Add a fallback card for `stage === 'generating' && !snapshot.videoJob`:
```tsx
{stage === 'generating' && !snapshot.videoJob && (
  <div className="bg-steel-800 border border-steel-700 rounded-xl p-5 flex items-center gap-3">
    <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
    <p className="text-sm text-steel-100">Queuing video generation…</p>
  </div>
)}
```

## Low

### LR-01: Duplicated validation constants between modal and validator

**File:** `src/components/admin/VideoFormatSelectionModal.tsx:11-12`
**Issue:** `BLOCKED_EXTENSIONS` and `MAX_FILE_SIZE` (50MB) are duplicated locally even though `isBlockedMacroFile` and `MAX_FILE_SIZE` already live in `src/lib/validators/sop.ts`. If the list grows or the limit changes, three places must update in sync (validator, UploadDropzone, VideoFormatSelectionModal). The modal can import `isBlockedMacroFile` and a new exported `MAX_FILE_SIZE_BYTES` constant.
**Fix:** Export `MAX_FILE_SIZE` (rename to `MAX_FILE_SIZE_BYTES` for clarity) from `src/lib/validators/sop.ts` and reuse `isBlockedMacroFile(file.name)` in the modal rather than re-implementing the extension check.

### LR-02: Fire-and-forget parse fetch has no user-visible error handling

**File:** `src/components/admin/VideoFormatSelectionModal.tsx:108-114`
**Issue:** `fetch('/api/sops/parse', ...).catch(console.error)` then immediately `router.push(...)`. If the parse API returns a 500, the pipeline page will sit in `uploading`/`parsing` forever (actually, it'll show `parsing` because sop.status is still `parsing` or `uploading`). This is consistent with `UploadDropzone` behavior and the progress page will eventually surface a parse-failure error message via realtime, but only if the parse_job row itself gets marked `failed`. If the parse route never reaches the job-update code, the user sees an indefinite spinner.
**Fix:** Either (a) await the fetch and only navigate on success/202, or (b) add a client-side timeout in `PipelineProgressClient` that shows a warning after N seconds without stage progression. Option (a) is the simpler fix.

### LR-03: `after()` errors are only logged — no persistence to pipeline_run row

**File:** `src/lib/video-gen/auto-queue.ts:134-141`
**Issue:** If the dynamic import of `@/lib/video-gen/pipeline` fails, or `runVideoGenerationPipeline(jobId)` throws before updating the `video_generation_jobs` row, the `after()` callback only `console.error`s. The `video_generation_jobs` row stays at `queued`, the `sop_pipeline_runs.status` stays `active`, and the progress page shows "Generating video / Stage: queued" forever. RLS-blocked logs are invisible to the user.
**Fix:** Wrap the `after()` body in a try/catch that, on failure, updates `video_generation_jobs` to `status='failed'` and sets `error_message` so the progress page surfaces the failure via its existing `errorStage === 'generating'` branch:
```ts
after(async () => {
  try {
    const { runVideoGenerationPipeline } = await import('@/lib/video-gen/pipeline')
    await runVideoGenerationPipeline(jobId)
  } catch (err) {
    console.error(`[auto-queue] pipeline error for job ${jobId}:`, err)
    const admin = createAdminClient()
    await admin.from('video_generation_jobs')
      .update({ status: 'failed', error_message: err instanceof Error ? err.message : 'Pipeline failed to start' })
      .eq('id', jobId)
  }
})
```

### LR-04: Magic "5000" timing literals without named constant

**File:** `src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx:168, 170`
**Issue:** Two uses of `5000` (start-polling delay and poll interval). Minor readability issue — extract as `const POLL_INTERVAL_MS = 5000` and `const REALTIME_GRACE_MS = 5000`.
**Fix:** Add named constants at the top of the file.

### LR-05: `deleteSop` (pre-existing, touched-adjacent) does not cascade-delete pipeline_run rows

**File:** `src/actions/sops.ts:342-348`
**Issue:** Not introduced by Phase 9, but worth flagging now that `sop_pipeline_runs` exists: `deleteSop` deletes `sop_sections`, `parse_jobs`, `sop_assignments`, `video_generation_jobs`, `worker_notifications`, and finally `sops`. The FK from `sops.pipeline_run_id` to `sop_pipeline_runs` is `ON DELETE SET NULL`, so the pipeline run row is orphaned (never deleted) after deleting a sop. This is consistent with "append-only audit trail" but should be documented. Over time this will accumulate stranded `sop_pipeline_runs` rows with `status='active'`.
**Fix (optional):** Either add a nightly job that reconciles `sop_pipeline_runs` (marks orphans `cancelled`) or, if audit trail isn't required, add `ON DELETE CASCADE` or a manual delete in `deleteSop`. Out of Phase 9 scope but track in deferred items.

## Info

### IN-01: `fromPipeline && pipelineId` guard is redundant in ReviewClient

**File:** `src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx:35-36, 163`
**Issue:** `fromPipeline` is derived from `searchParams?.get('from') === 'pipeline'`, so it's already tight. The extra `&& pipelineId` check is defensive but also the breadcrumb href would be `/admin/sops/pipeline/` (empty segment) if pipelineId were missing, which would still route (to a 404 page). Guard is correct; just noting intent.
**Fix:** None needed — current behavior is safe. Consider inline comment explaining both params must be present.

### IN-02: Pipeline modal submits with stale React state after router.push

**File:** `src/components/admin/VideoFormatSelectionModal.tsx:114`
**Issue:** After `router.push(...)` the modal is unmounted on route change, but `submitting` stays `true` until then. If navigation is blocked (e.g. by some future `beforeunload` handler), the modal stays stuck. Current code never calls `setSubmitting(false)` on the success path — harmless today.
**Fix:** None required. If the app later adds navigation guards, revisit.

### IN-03: `PipelineStepper.currentIndex` returns -1 for unknown stage values

**File:** `src/components/admin/PipelineStepper.tsx:20-23`
**Issue:** If a caller passes an unknown `currentStage` (e.g. a new stage key added elsewhere without updating `STAGES`), `findIndex` returns `-1`, which makes every stage show as `isComplete=false` and `isActive=false`. The component silently renders a "never started" stepper. Low risk given the type system enforces `PipelineStageState`, but a runtime assertion or default-to-first-stage would be more forgiving.
**Fix:** `const currentIndex = Math.max(0, ...)` as a safety net, or add a `// istanbul ignore next` + console.warn branch.

---

## Scope Notes

- Reviewed commits `ba71f91..HEAD` on master — all 14 Phase 9 commits (09-01 through 09-04 including merges).
- Migration 00016 verified against existing RLS helper pattern (`public.current_organisation_id()` from migration 00015).
- Publish gate byte-diffed against pre-Phase-9 implementation (`git show d392dd3:...`) — D-02 section approval check is preserved exactly; auto-queue runs strictly after the successful publish update.
- No blockers, no high-severity findings, no secrets, no SQL injection, no auth bypasses.

_Reviewed: 2026-04-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
