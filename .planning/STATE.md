---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: SOP Creation Pathways
status: Roadmap defined
stopped_at: Roadmap created — Phase 5 ready for planning
last_updated: "2026-03-29T00:00:00.000Z"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-23)

**Core value:** Workers can reliably follow any SOP on their phone, step-by-step, with the right safety information always visible — even offline.
**Current focus:** Milestone v2.0 — SOP Creation Pathways

## Current Position

Phase: 5 — Expanded File Intake (not started)
Plan: —
Status: Roadmap defined, ready for Phase 5 planning
Last activity: 2026-03-29 — v2.0 roadmap created (Phases 5–8)

Progress bar: `[                    ]` 0% (0/4 v2.0 phases)

## Performance Metrics

**Velocity:**

- Total plans completed (v2.0): 0
- Average duration: — (v1.0 avg ~7 plans/phase)
- Total execution time: —

**By Phase (v1.0 historical):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 01 P00 | 3 | 2 tasks | 6 files |
| Phase 01-foundation P01 | 21 | 2 tasks | 18 files |
| Phase 01-foundation P02 | 10m | 2 tasks | 16 files |
| Phase 01-foundation P03 | 5 | 2 tasks | 16 files |
| Phase 02-document-intake P00 | 2 | 1 tasks | 4 files |
| Phase 02-document-intake P01 | 6 | 2 tasks | 12 files |
| Phase 02-document-intake P02 | 3 | 2 tasks | 7 files |
| Phase 02-document-intake P03 | 7 | 2 tasks | 11 files |
| Phase 02-document-intake P02-03 | 120 | 3 tasks | 18 files |
| Phase 03-worker-experience P00 | 2 | 2 tasks | 7 files |
| Phase 03-worker-experience P01 | 7 | 2 tasks | 11 files |
| Phase 03-worker-experience P02 | 5 | 2 tasks | 7 files |
| Phase 03-worker-experience P03 | 5 | 2 tasks | 8 files |
| Phase 03-worker-experience P04 | 6 | 2 tasks | 6 files |
| Phase 03-worker-experience P05 | 12 | 2 tasks | 9 files |
| Phase 04-completion-and-sign-off P01 | 5 | 2 tasks | 9 files |
| Phase 04-completion-and-sign-off P02 | 261 | 2 tasks | 6 files |
| Phase 04-completion-and-sign-off P03 | 7 | 2 tasks | 11 files |

**v2.0 By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 05-expanded-file-intake | - | - | - |
| Phase 06-video-transcription-upload | - | - | - |
| Phase 07-video-transcription-recording | - | - | - |
| Phase 08-video-sop-generation | - | - | - |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Stack: Next.js 16 + Supabase + GPT-4o + Dexie.js + @serwist/next + TanStack Query (research-confirmed 2026-03-23)
- Multi-tenancy via Supabase RLS + JWT custom claims — must be in Phase 1 schema, not retrofittable
- Async parsing pipeline required — LLM parse takes 30-120s, HTTP timeouts at 30s
- Completion records are append-only (no UPDATE/DELETE) — legal defensibility requirement
- iOS Background Sync API unreliable — use online event + TanStack Query reconnect instead
- [Phase 01]: Playwright over Vitest for Phase 1: integration tests require real Supabase instance and browser, not unit mocks
- [Phase 01]: test.fixme for all stubs: tests are listed and skipped, producing a clear inventory without failing CI
- [Phase 01-foundation]: Next.js 16 uses proxy.ts (not middleware.ts) with proxy() export — middleware convention deprecated
- [Phase 01-foundation]: Windows requires explicit install of lightningcss-win32-x64-msvc and @tailwindcss/oxide-win32-x64-msvc for Tailwind v4 builds
- [Phase 01-foundation]: Supabase gen types: use 2>/dev/null redirect to prevent connection info polluting generated TypeScript file
- [Phase 01-foundation]: Server action redirect() throws in Next.js — catch blocks in form submit handlers must swallow all throws to allow redirect
- [Phase 01-foundation]: createServerClient from @supabase/ssr passes 3-generic SupabaseClient breaking Schema inference — fixed with explicit Promise<SupabaseClient<Database>> return type
- [Phase 01-foundation]: InviteAcceptForm requires Suspense boundary because useSearchParams() is async in Next.js App Router
- [Phase 01-foundation]: next build --webpack required: Next.js 16 Turbopack default conflicts with @serwist/next webpack plugin — build script updated
- [Phase 01-foundation]: SW disabled in development: disable: process.env.NODE_ENV === 'development' prevents aggressive caching during local dev
- [Phase 02-document-intake]: Added phase2-stubs Playwright project: new SOP test files not matched by existing integration/e2e project regex — required for test discovery
- [Phase 02-01]: Presigned URL upload: server action creates SOP record and signed URL atomically; client uploads directly to Storage bypassing Next.js 4MB body limit
- [Phase 02-01]: parse_jobs added to supabase_realtime publication at migration time to enable live status updates in admin UI
- [Phase 02-01]: Storage path structure: {org_id}/{sop_id}/original/{filename} enables org-scoped RLS without custom functions
- [Phase 02-document-intake]: [Phase 02-02]: openai SDK 6.x uses chat.completions.parse (not beta.chat) — beta namespace no longer contains chat in v6
- [Phase 02-document-intake]: [Phase 02-02]: tesseract.js ImageLike requires Buffer not Uint8Array — use Buffer.from(arrayBuffer)
- [Phase 02-document-intake]: [Phase 02-02]: PDF image extraction skipped for v1 — @napi-rs/canvas 50MB+ bundle risk on Vercel
- [Phase 02-document-intake]: Review page split into server component (page.tsx) + client component (ReviewClient.tsx): server fetches SOP/parse job/presigned URL, client manages approval state
- [Phase 02-document-intake]: Server-enforced publish gate: POST /publish counts unapproved sections server-side, returns 400 if any remain
- [Phase 02-document-intake]: Realtime + polling hybrid for parse status: subscribe to postgres_changes, start setInterval polling after 5s if no event fires
- [Phase 02-document-intake]: Parse triggered client-side: Next.js 16 aborts fire-and-forget fetch in server actions — call /api/sops/parse directly from client
- [Phase 02-document-intake]: mammoth requires Buffer.from() input: arrayBuffer option fails silently with 'Could not find file in options'
- [Phase 02-document-intake]: OpenAI structured outputs use .nullable() not .optional(): required by OpenAI structured output spec
- [Phase 03-worker-experience]: phase3-stubs Playwright project uses filename regex to match all 6 new test files, consistent with phase2-stubs approach
- [Phase 03-worker-experience]: experimental_createQueryPersister returns object; pass .persisterFn to useQuery persister option (not the whole object)
- [Phase 03-worker-experience]: Walkthrough store in-memory only: safety-critical D-02 requires re-acknowledgement per session, not persistence across restarts
- [Phase 03-worker-experience]: syncAssignedSops accepts SupabaseClient<any> to avoid Database generic type conflicts at call sites
- [Phase 03-worker-experience]: Zoom plugin imported via window-guard: Plugin type is void-returning, incompatible with next/dynamic; window check + async import loads it post-hydration
- [Phase 03-worker-experience]: Nested layout.tsx pattern: walkthrough/layout.tsx overrides parent BottomTabBar via Next.js nested layout resolution, no extra config needed
- [Phase 03-worker-experience]: CategoryBottomSheet exports two components (mobile sheet + desktop sidebar) used via responsive CSS, avoiding JS breakpoint detection
- [Phase 03-worker-experience]: SopSearchInput accepts pre-computed results prop to avoid duplicate TanStack Query subscriptions
- [Phase 03-worker-experience]: database.types.ts manually extended with sop_assignments table and assignment_type enum — type regeneration not available in this environment
- [Phase 03-worker-experience]: AdminContext typed as discriminated union for TypeScript narrowing of server action auth guard results
- [Phase 03-worker-experience]: database.types.ts manually extended with superseded_by, parent_sop_id on sops and worker_notifications table for 03-05
- [Phase 03-worker-experience]: NotificationBadge is self-contained: fetches own data via useNotifications hook, no props needed
- [Phase 04-completion-and-sign-off]: Append-only RLS on sop_completions: NO UPDATE/DELETE policies for authenticated role (COMP-07, D-15)
- [Phase 04-completion-and-sign-off]: Client UUID as sop_completions PK: idempotent retry via 23505 conflict handling (COMP-01)
- [Phase 04-completion-and-sign-off]: Second immutable record pattern: completion_sign_offs separate from sop_completions status update (D-17)
- [Phase 04-completion-and-sign-off]: completionStore separate from walkthroughStore: walkthrough remains memory-only per D-02 safety re-acknowledgement requirement
- [Phase 04-completion-and-sign-off]: useEffect+setState polling (2s) for Dexie photo queue — dexie-react-hooks not in package.json
- [Phase 04-completion-and-sign-off]: StepPhotoZone click handlers call e.stopPropagation() to prevent step toggle when tapping photo UI
- [Phase 04-completion-and-sign-off]: handleAddPhoto auto-starts completion record if none active before first photo capture
- [Phase 04-completion-and-sign-off]: Worker display names use abbreviated user_id (Worker {first-8-chars}) — no user_profiles table exists in the schema
- [Phase 04-completion-and-sign-off]: Supabase join select cast as unknown as RawRow[] — generated types don't infer relationship shapes from select strings
- [Phase 04-completion-and-sign-off]: Admin client used for presigned read URLs in server component — bypasses RLS consistently with upload pattern

### v2.0 Decisions (pending — to be filled during planning)

None yet.

### Pending Todos

- [ ] Confirm Vimeo URL scope for Phase 6 before planning begins (separate API token required; research flags this as product decision)
- [ ] Phase 6 planning: research TUS integration with current Supabase JS SDK version and confirm tus-js-client vs Uppy choice
- [ ] Phase 7 planning: verify current iOS Safari MediaRecorder support status (post-iOS 17.2) and design fallback UX
- [ ] Phase 8 planning: validate Shotstack pricing at expected SOP volume; confirm webhook vs polling pattern

### Blockers/Concerns

- Phase 2: Job queue implementation choice unresolved (Supabase Edge Function triggered by Storage events vs. BullMQ on Vercel) — decide at start of Phase 2 planning
- Phase 3: iOS Safari evicts PWA storage after ~7 days inactivity — surface explicit per-SOP download UI with readiness indicator
- Phase 4: Push notification delivery on iOS requires PWA installed to home screen and iOS 16.4+ — in-app polling fallback may be required
- Phase 5: Block .xlsm, .xlsb, .xltm, .pptm, .potm, .ppam uploads at validation — macro-enabled formats must be rejected before any parsing library is invoked (validate magic bytes server-side)
- Phase 6: YouTube/Vimeo URL pathway: never use yt-dlp or ytdl-core (ToS violation / DMCA liability); caption API only; add terms acknowledgement checkbox
- Phase 6: Factory-floor transcription accuracy 75-85% on NZ-accented audio — pass domain vocabulary prompt to transcription API; flag numerical values, chemical names, PPE specs for admin confirmation
- Phase 6: ffmpeg-static server-side bundling on Vercel is documented but described as bundle-sensitive — validate with a 20 MB file on Vercel preview before any other video work
- Phase 8: Generated video storage costs are unbounded without retention policies — source videos deleted 30 days post-transcription; generated videos have 90-day TTL; per-tenant quota visible in settings
- Phase 8: TTS mispronounces industrial terminology and NZ place names — build per-org pronunciation dictionary with SSML phoneme tags; mandatory admin audio preview before publish

## Session Continuity

Last session: 2026-03-29T00:00:00.000Z
Stopped at: v2.0 roadmap created — Phases 5–8 defined
Resume file: None
