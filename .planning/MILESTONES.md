# Milestones

Record of shipped SafeStart milestones. Each entry links to the archived planning
artifacts and captures the outcome without rehashing every decision — those live
in the per-phase SUMMARY.md files under `.planning/archive/{version}/`.

## v2.0 — SOP Creation Pathways

**Shipped:** 2026-04-13
**Archive:** `.planning/archive/v2.0/`

### Goal

Three new ways to create and consume SOPs — from video transcription, from expanded
file types (photos, Excel, PowerPoint), and as generated video content with AI
narration.

### Phases shipped

| # | Phase | Completed |
|---|-------|-----------|
| 1 | Foundation — multi-tenant auth, RBAC, PWA shell | 2026-03-23 |
| 2 | Document Intake — AI parse pipeline, admin review, publish | 2026-03-24 |
| 3 | Worker Experience — walkthrough, offline, library, assignment | 2026-03-25 |
| 4 | Completion and Sign-off — photo evidence, supervisor review | 2026-03-26 |
| 5 | Expanded File Intake — TUS uploads, photo OCR, xlsx/pptx/txt | 2026-04-03 |
| 6 | Video Transcription (Upload and URL) — MP4/MOV + YouTube → SOP | 2026-04-03 |
| 7 | Video Transcription (In-App Recording) — MediaRecorder + iOS fallback | 2026-04-04 |
| 8 | Video SOP Generation — narrated slideshow, screen-recording, AI video | 2026-04-04 |
| 9 | Streamlined File → Video Pipeline — one-click upload-to-video flow | 2026-04-13 |
| 10 | Video Version Management — multiple video versions per SOP | 2026-04-13 |

### Headline decisions locked in

- **Stack:** Next.js 16 + Supabase + GPT-4o + Dexie + @serwist/next + TanStack Query
- **Multi-tenancy:** Supabase RLS + JWT custom claims (not retrofittable — hardwired from Phase 1)
- **Completion records:** append-only (no UPDATE/DELETE) for legal defensibility
- **Async parsing:** all LLM work routed via `parse_jobs` + realtime + polling hybrid
- **Publish gate:** server-enforced unapproved-section check preserved byte-identically through all pipeline changes
- **Pipeline linkage (D-06):** `sop_pipeline_runs.id` threads upload → parse → sop → video for single-flow audit
- **Multi-version videos:** version_number incrementing, partial unique index for "one active per SOP"
- **Vimeo URL pathway:** deferred (API scope not confirmed); never use yt-dlp/ytdl-core for YouTube (ToS)

### Known debt carried into v3.0

- Phase 7 in-app recording has no formal UAT verification run (all stubs still `test.fixme`)
- Phase 9 verification status is `human_needed` — live UAT against remote Supabase pending
- LR-03 from Phase 9 code review: `after()` async errors do not surface to `video_generation_jobs` — worth promoting if user-facing pipeline failure visibility becomes a concern
- Phase 999.1 backlog parking lot: stale video job cleanup service still unscheduled
- Factory-floor NZ-accented transcription accuracy (75-85%) still flagged as a concern for specific terminology

### What v2.0 enables for v3.0

The pipeline infrastructure (`sop_pipeline_runs`, publish auto-queue, version management)
is reusable for authored-from-scratch SOPs that want to be rendered as video. The
`sop_sections` + `sop_steps` schema is the foundation the v3.0 builder will extend.
