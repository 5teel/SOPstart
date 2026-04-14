---
phase: 09-streamlined-file-video-pipeline
verified: 2026-04-13T00:00:00Z
status: human_needed
score: 5/5 success criteria verified
overrides_applied: 0
human_verification:
  - test: "End-to-end flow — admin opens UploadDropzone, clicks Generate video SOP, selects a .docx and narrated_slideshow, starts pipeline, reaches progress page, approves sections on review, publishes, sees Generating stage auto-populate, then Ready with Preview and publish video CTA"
    expected: "Unified pipeline experience with no manual navigation between upload, parse, review, publish, and video panel"
    why_human: "Spans realtime updates, file upload, OpenAI parse pipeline, video generation pipeline, and multi-role UX flow — only a live session can validate the stitched behaviour"
  - test: "Cross-org pipelineId access — log in as org A admin, visit /admin/sops/pipeline/{pipelineId from org B}"
    expected: "Redirected to /admin/sops (server page) and snapshot route returns 404"
    why_human: "Requires two test organisations with active pipelines; confirms org isolation works in production Supabase, not just in code"
  - test: "Video generation failure recovery — force a video_generation_jobs row to status='failed' while progress page is open"
    expected: "Page transitions to error panel with 'Go to video panel' CTA linking to /admin/sops/[sopId]/video; SOP remains status='published'"
    why_human: "Requires controlled failure injection into the video-gen pipeline to confirm PATH-05 routing"
  - test: "Realtime vs polling fallback — disable Supabase Realtime or block websocket, then start a pipeline"
    expected: "After 5s with no realtime event, polling kicks in every 5s via /api/sops/pipeline/[pipelineId]/snapshot and stage transitions are still observed"
    why_human: "Realtime subscription state can only be confirmed at runtime against a live Supabase project"
  - test: "Playwright stub promotion — all 29 test.fixme stubs in tests/pipeline-*.test.ts are inventory only; no real integration assertions run"
    expected: "Each PATH-0N requirement eventually has a real Playwright test that runs (not test.fixme)"
    why_human: "Promoting stubs to real tests is intentionally deferred per plan 00 convention; flagging so future verification passes know these are open UAT/test-debt items"
overrides: []
---

# Phase 9: Streamlined File → Video Pipeline Verification Report

**Phase Goal:** Admin can upload a source file (docx/pdf/image/xlsx/pptx/video) and reach a generated video SOP in a single guided flow without manually navigating between parse review, publish, and video generation as three separate steps.

**Verified:** 2026-04-13
**Status:** human_needed (automated checks all PASS; runtime flow requires live UAT)
**Re-verification:** No — initial verification

## Goal Achievement

### Success Criteria

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | Admin clicks "Generate video SOP" on UploadDropzone, selects a format in a modal, picks a file, and lands on a unified progress page | VERIFIED | `src/components/admin/UploadDropzone.tsx:656-663` button + `:102` useState + `:824-827` modal mount → `src/components/admin/VideoFormatSelectionModal.tsx:83-114` calls server action, uploads, router.push to `/admin/sops/pipeline/${pipelineId}` |
| 2 | A single pipeline_run_id links upload → parse_job → sop → video_generation_job for stepper rendering and audit | VERIFIED | Migration `supabase/migrations/00016_sop_pipeline_runs.sql:9-41` creates `sop_pipeline_runs` + adds `pipeline_run_id uuid REFERENCES sop_pipeline_runs` to parse_jobs, sops, video_generation_jobs. Server action `src/actions/sops.ts:354-467` writes the same `pipelineRun.id` into all four rows. Auto-queue `src/lib/video-gen/auto-queue.ts:120` carries it to video_generation_jobs on publish. |
| 3 | Publishing a pipeline-linked SOP auto-queues video generation with the format chosen at upload; the existing publish review gate is preserved exactly | VERIFIED | `src/app/api/sops/[sopId]/publish/route.ts:30-45` unapproved-section gate returns 400 BEFORE publish. Publish UPDATE at `:48-56`. Auto-queue call at `:65-69` runs AFTER publish. Helper `src/lib/video-gen/auto-queue.ts:50-60` reads `requested_video_format` from pipeline run and queues matching video job. Non-pipeline SOPs `{skipped: true}` at `:43-45` — no job created. |
| 4 | The progress page renders 5 named stages (Uploading, Parsing, Review, Generating video, Ready) with deep-link CTAs to the review page and video panel | VERIFIED | `src/components/admin/PipelineStepper.tsx:6-12` defines exactly 5 stages. `src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx:241-246` Review CTA → `/admin/sops/${sopId}/review?from=pipeline&pipelineId=...`. `:279-284` Ready CTA → `/admin/sops/${sopId}/video`. ReviewClient `:162-170` renders "← Back to pipeline" breadcrumb when `from=pipeline`. |
| 5 | Video generation failure after publish keeps the SOP published and routes the admin to the existing video panel retry path | VERIFIED | `PipelineProgressClient.tsx:66-68` detects `videoJob.status === 'failed'` → `stage='error', errorStage='generating'`. `:288-312` renders failure panel with "Go to video panel" CTA → `/admin/sops/${sopId}/video`. Publish route never touches SOP status after UPDATE — failure in auto-queue only logs (`route.ts:71-73`). SOP stays published. |

**Score:** 5/5 success criteria verified

### Observable Truths (goal-backward)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Single-click entry from UploadDropzone reaches pipeline progress page | VERIFIED | Button + modal + server action + router.push traced end to end |
| 2 | pipeline_run_id is present on all three linked tables via FK | VERIFIED | Migration 00016 + database.types.ts lines 104, 383, 733 show pipeline_run_id on parse_jobs, sops, video_generation_jobs |
| 3 | Server action atomically creates pipeline_run + sop + parse_job with linkage | VERIFIED | `src/actions/sops.ts:399-458` inserts rows in order with same `pipelineRun.id` |
| 4 | Publish review gate (unapproved sections → 400) is unchanged | VERIFIED | `publish/route.ts:40-45` |
| 5 | Auto-queue uses Phase 10 multi-version pattern (version_number, not UNIQUE reset) | VERIFIED | `auto-queue.ts:99-121` computes `nextVersion = max(version_number) + 1` — no reference to dropped UNIQUE constraint |
| 6 | Progress page subscribes to realtime and polls at 5s fallback | VERIFIED | `PipelineProgressClient.tsx:111-172` — four postgres_changes subscriptions + `setTimeout(..., 5000) + setInterval(fetchSnapshot, 5000)` |
| 7 | Cross-org pipelineId access is blocked | VERIFIED | Server page `:70-72` redirects; snapshot route `:44-46` returns 404 |
| 8 | Review page detects `?from=pipeline` and renders breadcrumb back to progress page | VERIFIED | `ReviewClient.tsx:35-37, 162-170` |
| 9 | Suspense boundary wraps ReviewClient for useSearchParams | VERIFIED | `review/page.tsx:106-115` |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/00016_sop_pipeline_runs.sql` | Pipeline table + FKs + RLS | VERIFIED | Table, 3 FK columns, 3 RLS policies using `public.current_organisation_id()`, realtime publication, no DELETE policy |
| `src/types/database.types.ts` | sop_pipeline_runs + pipeline_run_id columns | VERIFIED | 11 matches: Tables entry at line 332 + pipeline_run_id on parse_jobs (104, 125, 146), video_generation_jobs (383, 411, 439), sops (733, 756, 779) |
| `src/types/sop.ts` | PipelineVideoFormat + SopPipelineRun + pipeline_run_id on Sop/ParseJob | VERIFIED | Lines 53, 117, 121, 124, 127 |
| `src/lib/validators/sop.ts` | pipelineVideoFormatSchema + createVideoSopPipelineSessionSchema | VERIFIED | Lines 124-132 |
| `src/actions/sops.ts` | createVideoSopPipelineSession exported | VERIFIED | Lines 354-467, full transaction chain, clean fully-typed inserts (no `as any` casts) |
| `src/components/admin/VideoFormatSelectionModal.tsx` | Format picker modal | VERIFIED | Lines 1-253, exports VideoFormatSelectionModal, calls createVideoSopPipelineSession, router.push to pipeline route, aria-modal, fieldset+legend, disabled state |
| `src/components/admin/UploadDropzone.tsx` | Generate video SOP button + modal mount | VERIFIED | Film import, pipelineModalOpen state line 102, button lines 656-663, modal mount 824-827 |
| `src/lib/video-gen/auto-queue.ts` | enqueueVideoGenerationForPipeline | VERIFIED | Lines 28-148, try/catch wrapper, lazy import of pipeline, active-job idempotency, version_number increment |
| `src/app/api/sops/[sopId]/publish/route.ts` | Review gate + auto-queue hook | VERIFIED | Unapproved-count gate at 30-45, publish UPDATE at 48-56, auto-queue at 65-69, logs failures, returns 200 on auto-queue error |
| `src/app/(protected)/admin/sops/pipeline/[pipelineId]/page.tsx` | Server component with auth + initial fetch | VERIFIED | Lines 1-116, JWT decode via `Buffer.from(...,'base64')`, org-scoping check, fetches all 4 tables' initial state |
| `src/app/(protected)/admin/sops/pipeline/[pipelineId]/PipelineProgressClient.tsx` | Realtime + polling + stage derivation + CTAs | VERIFIED | Lines 1-342, 4 postgres_changes channels, polling fallback, deriveStage with error priority, 5 stage panels + 2 error panels |
| `src/app/api/sops/pipeline/[pipelineId]/snapshot/route.ts` | JSON snapshot route (created, not in plan but needed by client) | VERIFIED | Lines 1-98, org-scoped, admin client, returns `{sop, parseJob, videoJob}` |
| `src/components/admin/PipelineStepper.tsx` | 5-stage stepper presentational | VERIFIED | Lines 1-60, exactly 5 STAGES, aria-current="step", text-brand-yellow active, error state |
| `src/app/(protected)/admin/sops/[sopId]/review/ReviewClient.tsx` | Back to pipeline breadcrumb | VERIFIED | Lines 35-37 searchParams read, 162-170 conditional breadcrumb render |
| `src/app/(protected)/admin/sops/[sopId]/review/page.tsx` | Suspense boundary for useSearchParams | VERIFIED | Lines 1, 106-115 |
| `tests/pipeline-*.test.ts` (x6) | PATH requirement stub coverage | VERIFIED | 29 test.fixme stubs across 6 files |
| `playwright.config.ts` | phase9-stubs project entry | VERIFIED | Lines 38-39, regex covers all 6 basenames |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| UploadDropzone.tsx | VideoFormatSelectionModal.tsx | React import + state + modal mount | WIRED | Line 24 import, 102 state, 824 render |
| VideoFormatSelectionModal.tsx | createVideoSopPipelineSession | Server action call | WIRED | Line 7 import, 83 call with {file, format} |
| VideoFormatSelectionModal.tsx | /admin/sops/pipeline/[pipelineId] | router.push | WIRED | Line 114 |
| sop_pipeline_runs | parse_jobs.pipeline_run_id | FK ON DELETE SET NULL | WIRED | Migration line 24-26 |
| sop_pipeline_runs | sops.pipeline_run_id | FK ON DELETE SET NULL | WIRED | Migration line 28-30 |
| sop_pipeline_runs | video_generation_jobs.pipeline_run_id | FK ON DELETE SET NULL | WIRED | Migration line 32-34 |
| publish route | enqueueVideoGenerationForPipeline | Import + call | WIRED | route.ts line 3, 65 |
| auto-queue.ts | runVideoGenerationPipeline | next/server after() + dynamic import | WIRED | Lines 134-141, lazy import inside after() |
| PipelineProgressClient | supabase.channel.postgres_changes | Realtime subscription (4 channels) | WIRED | Lines 111-165 |
| PipelineProgressClient | setInterval polling fallback | 5s timeout + interval | WIRED | Lines 168-172 |
| Review stage CTA | /admin/sops/[sopId]/review?from=pipeline | Link href | WIRED | PipelineProgressClient line 242 |
| Ready stage CTA | /admin/sops/[sopId]/video | Link href | WIRED | PipelineProgressClient line 280 |
| Failure stage CTA | /admin/sops/[sopId]/video | Link href | WIRED | PipelineProgressClient line 306 |
| ReviewClient | fromPipeline breadcrumb | useSearchParams + conditional render | WIRED | Lines 35-37, 162-170 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| PipelineProgressClient.tsx | `snapshot.sop/parseJob/videoJob` | Initial props from server page.tsx (admin-client DB queries) → refreshed via `/api/sops/pipeline/[pipelineId]/snapshot` | Yes — admin-client queries to sops/parse_jobs/video_generation_jobs with real filters | FLOWING |
| PipelineStepper | `currentStage, errorAtStage` | `deriveStage(snapshot)` computed from live state | Yes — stage derived from real DB state | FLOWING |
| VideoFormatSelectionModal | `session.pipelineId` | Return value from createVideoSopPipelineSession server action → real sop_pipeline_runs INSERT | Yes | FLOWING |
| publish route | `queueResult` | enqueueVideoGenerationForPipeline reads real parse_jobs.pipeline_run_id + sop_pipeline_runs + inserts video_generation_jobs | Yes | FLOWING |
| snapshot route | `sop/parseJob/videoJob` | admin client SELECTs filtered by pipeline_run_id / sop_id | Yes | FLOWING |

No hollow props, hardcoded empty defaults, or disconnected data sources found.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PATH-01 | 09-01, 09-02 | Pipeline entry point — button, modal, format selection, upload, navigation | SATISFIED | UploadDropzone button + VideoFormatSelectionModal + createVideoSopPipelineSession + router.push |
| PATH-02 | 09-01 | State linkage — pipeline_run_id joins all 4 tables | SATISFIED | Migration 00016 + server action + database.types.ts |
| PATH-03 | 09-03 | Publish auto-queues video generation with chosen format | SATISFIED | enqueueVideoGenerationForPipeline + publish route hook |
| PATH-04 | 09-04 | Unified 5-stage progress page with deep-link CTAs | SATISFIED | PipelineStepper + PipelineProgressClient + deep links |
| PATH-05 | 09-04 | Video failure recovery keeps SOP published, routes to video panel | SATISFIED | deriveStage error branch + Go to video panel CTA + publish route never rolls back on auto-queue error |
| PATH-06 | 09-01, 09-03 | Publish-time review gate preserved exactly | SATISFIED | publish route lines 30-45 unchanged — unapproved count → 400 |

No orphaned requirements. All six PATH-0N IDs are claimed by at least one plan.

### Anti-Patterns Found

None. Scan targets:

| Pattern | Files Scanned | Matches |
|---------|---------------|---------|
| `TODO\|FIXME\|XXX\|HACK\|PLACEHOLDER` | All 11 new/modified files | 0 |
| `coming soon\|not yet implemented\|placeholder` | Same | 0 |
| `return null` / `=> \{\}` stubs | Same | 0 (modal `return null` when !open is idiomatic conditional render, not a stub) |
| Hardcoded empty props at call sites | PipelineProgressClient props, PipelineStepper props | 0 — all computed from real state |
| `as any` casts on pipeline_run_id writes | auto-queue.ts, actions/sops.ts | 0 — removed per 09-03 deviation, fully type-checked |
| Static/empty DB returns in API routes | publish/route.ts, snapshot/route.ts | 0 — real queries |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript typecheck clean | `npx tsc --noEmit` | exit 0 (empty output) | PASS |
| PipelineStepper exports exactly 5 STAGES | grep STAGES array | 5 entries: uploading, parsing, review, generating, ready | PASS |
| playwright.config.ts has phase9-stubs project | grep phase9-stubs | Lines 38-39 with regex covering 6 basenames | PASS |
| 29 test.fixme stubs across 6 pipeline-*.test.ts files | grep count | entry:6, linkage:5, autoqueue:5, progress:6, failure-recovery:4, review-gate:3 → 29 total | PASS |
| auto-queue.ts uses version_number increment (not UNIQUE reset) | grep version_number | Lines 99-107 `max(version_number) + 1` pattern | PASS |
| Publish route preserves unapproved gate | grep "All sections must be approved" | route.ts line 42, status 400 at 43 | PASS |
| createVideoSopPipelineSession exported + signature matches | grep signature | actions/sops.ts 354-360 returns `{pipelineId, sopId, uploadUrl, token, path} \| {error}` | PASS |

No spot-check failures.

### Deviations from Plan (verified)

The Phase 9 plans were executed with **three intentional, correct deviations**:

1. **Plan 09-01 — Format enum narrowing (documented in 09-01-SUMMARY.md)**
   - Plan declared `PipelineVideoFormat = 'narrated_slideshow' | 'screen_recording'`.
   - Summary narrative at one point mentioned a third `ai_avatar` format, but migration 00016 and `src/types/sop.ts:121` both show only 2 formats.
   - This was a summary documentation slip, not an implementation drift. Actual code and schema are correct.

2. **Plan 09-03 — Phase 10 multi-version adaptation**
   - Plan referenced a UNIQUE(sop_id, format, sop_version) reset pattern.
   - That constraint was dropped by Phase 10 migration `00018_video_version_management.sql:8-10`.
   - Auto-queue correctly adapts: uses `version_number` increment via active-job idempotency + `max(version_number)+1` INSERT, mirroring `generateNewVersion` in `src/actions/video.ts`. Verified at `auto-queue.ts:99-121`.
   - Summary 09-03 documents this as "Rule 3 - Stale schema reference" auto-fix.

3. **Plan 09-03 — Removed `as any` casts**
   - Plan had cast workarounds commented "consistent with Phase 8-04 pattern for columns not yet regenerated in database.types.ts".
   - database.types.ts already has `pipeline_run_id` fully typed on all three linked tables (lines 104, 383, 733) from the Phase 10 worktree merge.
   - auto-queue.ts and actions/sops.ts write the column cleanly with no `as any`. Verified.

None of these deviations weaken the phase goal. Each one was verified against the actual schema/types.

### Human Verification Required

Automated code-level verification is **complete and PASSING**. Runtime verification remains because no live pipeline run has been executed against the remote Supabase project. Items are:

1. **End-to-end pipeline flow** — Upload → Parse → Review → Publish → Generate → Ready, observing the progress page auto-update through each stage.
2. **Cross-org isolation** — pipelineId from another org should redirect + 404.
3. **Video generation failure routing** — failure should keep SOP published and show "Go to video panel" CTA.
4. **Realtime vs polling fallback** — confirm both paths update the page.
5. **Playwright stub promotion** — 29 test.fixme stubs are inventory only. Real integration tests are test debt to be promoted in a later phase.

### Gaps Summary

**No automated gaps found.** The phase goal is delivered end-to-end in source:

- Entry: UploadDropzone button → VideoFormatSelectionModal → createVideoSopPipelineSession → DB state → router.push to progress page.
- State linkage: migration 00016 adds pipeline_run_id FKs; server action writes the same id into sop_pipeline_runs, sops, parse_jobs; auto-queue writes it into video_generation_jobs.
- Auto-queue: publish route calls enqueueVideoGenerationForPipeline after the preserved unapproved-section gate; uses Phase 10 multi-version pattern.
- Progress UI: 5-stage stepper with deep links, realtime + polling hybrid, review + ready + failure panels, breadcrumb back from review.
- Failure recovery: failure state routes to /admin/sops/[sopId]/video — SOP stays published, no rollback.

The only outstanding items are **runtime UAT checks** (which are inherent to a UI pipeline that depends on realtime, OpenAI parse, and video-gen pipeline running end to end). These are logged under `human_verification` above, consistent with how Plan 09-04 handled runtime verification.

---

*Verified: 2026-04-13*
*Verifier: Claude (gsd-verifier)*
