# Phase 8: Video SOP Generation - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Generate narrated slideshow and screen-recording-style video versions of published SOPs using TTS (gpt-4o-mini-tts) + cloud video rendering (Shotstack). Workers watch generated videos with chapter navigation from within the SOP view. Video viewing tracked as completion events. Full AI video (avatar) deferred — validate demand with the two standard formats first.

</domain>

<decisions>
## Implementation Decisions

### Video Format Scope
- **D-01:** Build narrated slideshow + screen-recording-style only. Full AI video (avatar/animations — VGEN-03) deferred to a future phase. Validate demand with the two standard formats first.
- **D-02:** Narrated slideshow uses one slide per SOP section (not per step). Hazards slide, PPE slide, Steps slide (sub-bullets for each step), Emergency slide. Keeps videos concise (5-15 slides).
- **D-03:** Screen-recording-style video scrolls through the SOP content with TTS narration synced to the scroll position. Same section-level pacing as slideshow.

### Worker Video Player UX
- **D-04:** "Video" tab on the SOP detail page, alongside existing section tabs (Hazards, PPE, Steps, etc.). Workers see it only when a generated video exists for that SOP.
- **D-05:** Inline video player within the tab area with native full-screen option. Chapter list below the player showing SOP sections with timestamps. Click a chapter to jump. Playback speed control (0.5x, 1x, 1.5x, 2x).

### TTS & Pronunciation
- **D-06:** Optional admin preview before publishing — admin can preview but isn't required to. Publish button available immediately after generation completes. Admin can re-generate if pronunciation is bad.
- **D-07:** Global NZ industrial vocabulary only (same list from Phase 6). No per-org pronunciation dictionary in Phase 8. Re-generate is the fallback for bad pronunciation.
- **D-08:** TTS via gpt-4o-mini-tts (already in OpenAI SDK). Split by section — one TTS call per section, stitch in video composition. Avoids pauses/stutters on long SOPs.

### Storage & Retention
- **D-09:** Keep generated videos indefinitely. No auto-delete TTL. Storage grows but videos are permanent assets for the org.
- **D-10:** "Video is outdated" warning when SOP updated_at > video generated_at. Amber badge on both admin and worker views: "Video is outdated — re-generate recommended." Admin can re-generate; workers still see the old video.
- **D-11:** Generated video URLs excluded from service worker caching (INFRA-03). Videos stream from Supabase Storage, never cached on device.

### Video Generation Pipeline
- **D-12:** Shotstack API for video rendering — cloud-based, no binary dependencies, no Remotion licensing concerns. JSON timeline API for compositing slides + audio.
- **D-13:** video_generation_jobs table (same FSM pattern as parse_jobs). Stages: analyzing → generating slides → adding narration → rendering → ready.
- **D-14:** Idempotency — if a job already exists for the current SOP version + format, return existing job ID instead of creating a duplicate.

### Completion Tracking
- **D-15:** Worker video viewing creates a completion record of type 'video_view' in the existing sop_completions table. Records the video generation job ID and SOP version. Same audit trail as text walkthrough completions.

### Claude's Discretion
- Shotstack timeline JSON structure and composition details
- Video rendering resolution and format (720p/1080p, MP4)
- Slide design (background color, font size, layout within Shotstack)
- Chapter marker extraction from SOP section boundaries
- How to detect "video fully watched" for completion tracking (percentage threshold or end reached)
- TTS voice selection (gpt-4o-mini-tts voice parameter)
- Admin re-generate workflow details

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Vision, core value, constraints
- `.planning/REQUIREMENTS.md` — VGEN-01 through VGEN-09, INFRA-03 are this phase's requirements
- `.planning/ROADMAP.md` — Phase 8 details, success criteria

### Research (v2.0)
- `.planning/research/STACK.md` — Shotstack over Remotion rationale, gpt-4o-mini-tts recommendation, ElevenLabs comparison
- `.planning/research/ARCHITECTURE.md` — video_generation_jobs table schema, TTS per-section split, Shotstack integration pattern, render pipeline flow
- `.planning/research/PITFALLS.md` — Storage costs, TTS pronunciation, service worker caching exclusion
- `.planning/research/SUMMARY.md` — Consolidated recommendations

### Prior Phase Context
- `.planning/phases/06-video-transcription-upload-and-url/06-CONTEXT.md` — Adversarial verification, named stages pattern, NZ vocabulary list
- `.planning/phases/04-completion-and-sign-off/` — Completion tracking patterns (sop_completions, append-only audit trail)

### Existing Code (extend these)
- `src/types/sop.ts` — Add VideoGenerationJob types, video completion types
- `src/stores/completionStore.ts` — Extend for video viewing completions
- `src/components/sop/SopSectionTabs.tsx` — Add Video tab
- `src/app/(protected)/sops/[sopId]/page.tsx` — SOP detail page (add video tab content)
- `src/components/admin/` — Add video generation trigger UI on admin SOP management
- `src/app/sw.ts` — Service worker (add video URL exclusion)
- `src/lib/offline/db.ts` — Dexie schema (ensure video URLs not synced)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ParseJobStatus.tsx` — Named stage stepper pattern, reuse for video generation stages
- `sop_completions` table + `completionStore.ts` — Append-only completion tracking, extend with video_view type
- `SopSectionTabs.tsx` — Tabbed SOP navigation, add Video tab
- Supabase Realtime subscriptions — Same pattern for video_generation_jobs status updates

### Established Patterns
- Async job table with FSM status (queued → processing → completed/failed)
- Named stage progress with Supabase Realtime updates
- Append-only completion records (COMP-07)
- Service worker exclusion of specific URL patterns in sw.ts

### Integration Points
- New table: `video_generation_jobs` (migration)
- New API route: `/api/sops/generate-video` (trigger generation)
- New modules: `src/lib/video-gen/tts.ts`, `src/lib/video-gen/render-slides.ts`, `src/lib/video-gen/render-scroll.ts`
- New component: Video player with chapters for worker SOP view
- New admin UI: Generate video button + format selector on published SOPs
- Extend: `sop_completions` for video_view type, sw.ts for cache exclusion

</code_context>

<specifics>
## Specific Ideas

- **Shotstack JSON timeline** — each section becomes a clip with TTS audio track and a visual slide (text overlay on dark background). Section titles as chapter markers in the output.
- **One slide per section** keeps the narrated slideshow concise and matches the SOP's natural structure. Steps are sub-bullets on the Steps slide, not individual slides.
- **"Video is outdated"** uses a simple timestamp comparison — no content diffing needed. If admin edits anything, the flag appears.
- **Video tab** only appears when a generated video exists — no empty tab for SOPs without videos.
- **Completion tracking** on video view uses the same sop_completions table — keeps the audit trail unified. No separate video analytics table.

</specifics>

<deferred>
## Deferred Ideas

- **Full AI video (avatar/animations)** — VGEN-03. Highest cost format. Validate demand with narrated slideshow + screen-recording first. Add as Phase 8.1 or future milestone.
- **Per-org pronunciation dictionary** — SSML phoneme tags for custom terms. Wait for real-world usage to reveal which terms need it.
- **Auto-regenerate on SOP update** — Automatically re-render videos when source SOP changes. Complex (cost implications, queueing). Manual re-generate is sufficient for now.
- **Video retention TTL** — If storage costs become an issue at scale, add configurable TTL per org. Not needed at launch.
- **Mandatory admin preview** — Require admin to watch the video before publishing. Deferred in favor of optional preview — admin judgment trusted.

</deferred>

---

*Phase: 08-video-sop-generation*
*Context gathered: 2026-04-04*
