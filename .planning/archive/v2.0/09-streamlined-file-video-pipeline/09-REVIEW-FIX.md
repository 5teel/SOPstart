---
phase: 09-streamlined-file-video-pipeline
fixed_at: 2026-04-14T00:00:00Z
review_path: .planning/phases/09-streamlined-file-video-pipeline/09-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 9: Code Review Fix Report

**Fixed at:** 2026-04-14
**Source review:** `.planning/phases/09-streamlined-file-video-pipeline/09-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (all 4 medium; low/info deferred per fix_scope=critical_warning convention)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### MR-01: Pipeline modal accepts HEIC/HEIF but has no client-side conversion

**Files modified:** `src/components/admin/VideoFormatSelectionModal.tsx`
**Commit:** `cf0ab30`
**Applied fix:** Added inline HEIC/HEIF -> JPEG conversion in `handleFileChange` using the same
`heic2any` dynamic-import pattern as `UploadDropzone.validateAndAddFiles`. When an iPhone
photo is selected in the pipeline modal, it is now converted to JPEG client-side (quality
0.92) and the converted `File` is stored in state for upload. On conversion failure the
user sees an error toast asking for JPEG/PNG. `ACCEPT` is unchanged so users can still pick
HEIC from the picker. Did not extract a shared helper (review suggested but out of scope for
a small fix) — the duplication is 15 lines and both call sites are already inline.

### MR-02: Snapshot/server page parse_job lookup isn't scoped by pipeline_run_id

**Files modified:**
- `src/app/(protected)/admin/sops/pipeline/[pipelineId]/page.tsx`
- `src/app/api/sops/pipeline/[pipelineId]/snapshot/route.ts`

**Commit:** `5e7e2d5`
**Applied fix:** Added `.eq('pipeline_run_id', pipelineId)` to both `parse_jobs` queries so
retry parse jobs on the same SOP outside the pipeline flow don't pollute the progress page.
The filter is applied identically in both files (server component + snapshot API). Migration
00016 already adds `parse_jobs.pipeline_run_id` with an index, so this is free on the query
planner. Existing `sop_id` filter is preserved for defense-in-depth.

### MR-03: Polling fallback is one-shot — never re-enables if realtime silently drops

**Files modified:** `src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx`
**Commit:** `585358e`
**Applied fix:** Three improvements:
1. Replaced `receivedRealtimeRef` boolean with `lastUpdateRef` timestamp, updated on every
   realtime event and every successful `fetchSnapshot`.
2. Added a `.subscribe((status) => ...)` callback that starts polling immediately on
   `CHANNEL_ERROR`, `TIMED_OUT`, or `CLOSED` channel states.
3. Added a `staleWatchdog` interval that fires every `REALTIME_STALE_MS` (15s) and starts
   polling if `lastUpdateRef` is older than 15s — catches silent drops after initial connect.
4. Extracted magic numbers into named constants at module scope:
   `POLL_INTERVAL_MS = 5000`, `REALTIME_GRACE_MS = 5000`, `REALTIME_STALE_MS = 15000`.
5. `startPolling()` is idempotent via `pollingRef.current` guard so multiple callers
   (subscribe callback, grace timeout, watchdog) don't create duplicate intervals.

Cleanup on unmount now clears: `startPollingTimeout`, `staleWatchdog`, `pollingRef`
interval, and the realtime channel. This preserves the existing cleanup semantics the
user flagged to protect.

### MR-04: `generating` stage renders nothing when videoJob hasn't been inserted yet

**Files modified:** `src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx`
**Commit:** `177e56e`
**Applied fix:** Added a fallback status card for `stage === 'generating' && !snapshot.videoJob`
that renders a spinner + "Queuing video generation…" message. Covers the window between
publish completing and the auto-queue INSERT landing / realtime event firing. Uses the
same styling as the existing generating card for visual continuity.

---

## Notes

- Fix scope: `critical_warning`. In this codebase's convention this means blocker + high +
  medium (severity CR/WR/MR). No blockers, no highs — only the 4 medium findings were in
  scope. Low (LR-01..LR-05) and Info (IN-01..IN-03) findings deferred.
- Full `npx tsc --noEmit -p tsconfig.json` run after each fix returned clean (exit 0). No
  pre-existing errors introduced.
- No source files left dirty; each fix was committed atomically with `fix(09): MR-XX ...`
  conventional messages.
- D-02 publish gate was not touched — publish route was not modified by any Phase 9 fix.
- Realtime/polling cleanup logic (`clearInterval`, `supabase.removeChannel`) was preserved
  and extended (new `staleWatchdog` is now also cleared on unmount).

---

_Fixed: 2026-04-14_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
