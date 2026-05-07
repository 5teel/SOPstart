---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Closeout
status: in-progress
stopped_at: Phase 13 verifier PASSED (5/5 success criteria plumbing-complete, 6/6 SB-BLOCK requirements have backing code, summit→platform rename consistent across schema + code); awaiting batched browser UAT (13-03 + 13-04 + 13-05) as carried human-verification items
last_updated: "2026-05-07T08:00:00.000Z"
last_activity: 2026-05-07 -- Phase 13 cleanup + verification: (1) commit e093d45 renamed summit_admins→platform_admins (migration 00026, RPC, 5 RLS policies, summit-admin-guard.ts→platform-admin-guard.ts, requireSummitAdmin→requirePlatformAdmin, /admin/global-blocks UI strings) — Potenco-owned, unrelated to Summit Insights; (2) commit 9d723a4 added migration 00027 idempotent seed of initial platform admin (simonscott86@gmail.com); (3) gsd-verifier produced 13-VERIFICATION.md — status human_needed (plumbing complete, browser UAT batchable)
progress:
  total_phases: 21
  completed_phases: 12
  total_plans: 26
  completed_plans: 26
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-13)

**Core value:** Workers can reliably follow any SOP on their phone, step-by-step, with the right safety information always visible — even offline.
**Current focus:** Phase 13 verifier PASSED — awaiting batched browser UAT (13-03 + 13-04 + 13-05) before transitioning to next phase

## Current Position

Phase: 13 (reusable-block-library) — VERIFIED COMPLETE (UAT pending as carried human-verification)
Plan: 5 of 5 implementation complete (13-01 schema + CRUD; 13-02 NZ global seed; 13-03 wizard picker + builder save-to-library + 00024 atomic junction reorder RPC; 13-04 follow-latest tracking with 00025 trigger + RPCs + UpdateAvailableBadge + diff modal; 13-05 platform super-admin curation UI — /admin/global-blocks gated route + suggestions queue with Promote/Reject); summit→platform rename applied via 00026 + code; 00027 seeds initial platform admin; 13-VERIFICATION.md written; 13-03 + 13-04 + 13-05 browser UAT pending Simon's manual verification (batchable)
Status: SB-BLOCK-01..06 all closed; verifier PASSED — 5/5 plumbing-complete, 6/6 requirements backed by code, no anti-patterns or stubs detected
Last activity: 2026-05-07 -- Phase 13 verified + summit→platform rename + initial platform admin seed migration; 2 cleanup commits (e093d45, 9d723a4) on top of the 5 plan-execution waves

Progress bar: `[████████████████████]` 100% (phases 11+12 complete; phase 13 implementation 5/5 done — UAT remaining)

Phase 12 commits on master:

- 1eeca15 merge(12-01) builder shell foundation
- 895ecc7 merge(12-02) 7 SOP blocks + Puck config
- 53303e9 merge(12-04) Dexie autosave + reorder + preview toggle
- 944de00 merge(12-03) blank-page wizard + AUTHORED IN BUILDER + D-08 purge
- 1612925 docs(phase-12) verification FLAG → later promoted after UAT

Carried human-verification items (non-blocking for Phase 13):

- UAT #3: airplane-mode edit → OFFLINE · QUEUED → reconnect → SAVED
- UAT #6: cross-admin LWW "Updated by another admin" toast

Both wired structurally; need live two-session / offline-toggle scenario to exercise.

## v2.0 Archive

Archived phases: `.planning/archive/v2.0/` (10 phases + 999.1 backlog)
Milestone record: `.planning/MILESTONES.md` § v2.0
Known debt: Phase 7 UAT run, Phase 9 live UAT (`human_needed`), LR-03 async error surfacing, Phase 999.1 stale cleanup service.

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
| 10 | 4 | - | - |
| 11 | 4 | - | - |

**v2.0 By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| Phase 05-expanded-file-intake | - | - | - |
| Phase 06-video-transcription-upload | - | - | - |
| Phase 07-video-transcription-recording | - | - | - |
| Phase 08-video-sop-generation | 1m | 1 task | 8 files |
| Phase 08-video-sop-generation P02 | 6m | 2 tasks | 5 files |

*Updated after each plan completion*
| Phase 05-expanded-file-intake P01 | 7m | 2 tasks | 13 files |
| Phase 05-expanded-file-intake P03 | 2 | 2 tasks | 5 files |
| Phase 06 P02 | 471 | 2 tasks | 9 files |
| Phase 06 P04 | 3m | 2 tasks | 6 files |
| Phase 08 P04 | 10m | 2 tasks | 5 files |
| Phase 09-streamlined-file-video-pipeline P00 | 2m | 2 tasks | 7 files |

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
- [Phase 05-expanded-file-intake]: officeparser + sharp marked as serverExternalPackages — ESM-only file-type dep and native binary require runtime loading, not webpack bundling
- [Phase 05-expanded-file-intake]: GPT-4o vision replaces Tesseract as primary image OCR — better accuracy for SOP documents with minimal config
- [Phase 05-expanded-file-intake]: getSourceFileType throws on unknown MIME types instead of catch-all image return — prevents silent wrong routing (Research Pitfall 8)
- [Phase 05-expanded-file-intake]: idb-keyval for scanner session: already installed as offline dep; lighter than adding new Dexie table
- [Phase 05-expanded-file-intake]: Laplacian downsample to 512px max: balances accuracy vs sub-300ms quality check target
- [Phase 05-expanded-file-intake]: thumbnailUrl excluded from IndexedDB: object URLs invalid after tab unload; rebuilt from blob on restore
- [Phase 06]: Lazy Anthropic client init in verify-sop.ts — same pattern as gpt-parser.ts lazy OpenAI, prevents build failure without ANTHROPIC_API_KEY
- [Phase 06]: database.types.ts manually extended with parse_jobs video columns — type regeneration not available in worktree environment (consistent with Phase 3/4 pattern)
- [Phase 06]: Json cast (as unknown as Json) for storing typed arrays in Supabase JSONB columns — Supabase types require Json, typed arrays lack index signatures
- [Phase 06]: verifyTranscriptVsSop non-blocking: returns empty array on error per D-04 — verification is additive, not a gate that blocks SOP creation
- [Phase 06]: YouTube IFrame API loaded lazily via onLoad on iframe element to avoid loading for non-YouTube SOPs
- [Phase 06]: Publish gate computed as single derived boolean combining allApproved, unresolvedCriticalFlags, hasMissingSectionFlags+acknowledged
- [Phase 08-02]: buildScrollEdit uses per-section Shotstack audio clips (not stitched MP3) — naive Buffer.concat of MP3 files produces invalid output
- [Phase 08-02]: pipeline.ts fetches all SOP steps in one batched query grouped by section_id — avoids N+1 per section
- [Phase 08-02]: recordVideoView uses submitted_at not completed_at — matches actual sop_completions table schema (completed_at does not exist)
- [Phase 08-02]: regenerateVideo calls runVideoGenerationPipeline directly (not via fetch) to avoid unnecessary HTTP round-trip
- [Phase 08]: useNetworkStore used directly in useVideoGeneration — useOnlineStatus hook only registers listeners, returns void; useNetworkStore(s => s.isOnline) is the correct pattern for reading online state
- [Phase 09-streamlined-file-video-pipeline]: phase9-stubs Playwright project uses filename regex matching all 6 pipeline-*.test.ts files, consistent with phase2/6/8-stubs convention

### v2.0 Decisions (pending — to be filled during planning)

None yet.

### Phase 13 Plan 01 Decisions

- [Phase 13-01]: Encoded Summit super-admin role as separate `summit_admins` table (D-Global-01) — mirrors organisation_members role pattern; avoids modifying auth.users or JWT claims
- [Phase 13-01]: Seeded `block_categories` with full 34-tag controlled vocab (24 hazard + 10 area) from 13-CORPUS-ANALYSIS § 6 (D-Tax-02)
- [Phase 13-01]: Single `sops.category_tag` column (not array) per D-Tax-03 — admin picks one primary category at SOP creation
- [Phase 13-01]: ListBlocksOptions surface declared FINAL in 13-01 (`includeContent`, `globalOnly`, `includeGlobal`, `kindSlug`, `categoryTag`, `includeArchived`) — downstream plans MUST consume as-is, no late additions
- [Phase 13-01]: Postgres CHECK on `category_tags` array entries deferred to application-layer Zod (CHECK cannot subquery against block_categories)
- [Phase 13-01]: Defence-in-depth super-admin guard: `is_summit_admin()` SECURITY DEFINER helper used in RLS policies AND server-action `requireSummitAdmin()` (T-13-01-01)
- [Phase 13-01]: `BlockContentSchema.parse()` invoked at all 3 content-write sites including `promoteSuggestion` snapshot path (T-13-01-03)

### Phase 13 Plan 02 Decisions

- [Phase 13-02]: JSON source-of-truth at `seed-source/global-blocks.json` — generator script (`generate-migration.mjs`) emits 00023 SQL deterministically; Summit re-seeds edit JSON and regenerate
- [Phase 13-02]: Severity heuristic per cluster: `critical` (crush-entrapment, electrocution, fire-explosion, chemical-exposure, pressurised-fluid), `warning` (burns-hot, cuts-lacerations, manual-handling-strain, moving-machinery, glass-breakage, falling-objects, forklift-vehicle, flying-debris), `notice` (slips-trips, pinch-points, spill-environmental, dust-airborne, noise)
- [Phase 13-02]: Idempotency guard (`if exists … return`) inside DO block backs up Supabase migration-tracking layer for direct SQL editor re-execution
- [Phase 13-02]: Encoding-corrupted corpus phrasings (e.g. `personγçös eyesight…`) substituted with canonical NZ-industry language per plan instruction; remaining 56 hazard phrasings taken verbatim from CORPUS-ANALYSIS § 2

### Phase 13 Plan 03 Decisions

- [Phase 13-03]: Migration renamed 00023.5 → 00024 — Supabase CLI v2.83 rejects fractional integer migration filenames; clean integer-prefix consistent with 00019..00023 history
- [Phase 13-03]: addBlockToSection does NOT mutate layout_data — it returns the junction id; caller (wizard / picker) stamps props.junctionId onto matching Puck items via existing updateSectionLayout flow (per 13-04 prereq)
- [Phase 13-03]: Soft prefix scoring formula: +50 base + (10 × prefix-token-length) bonus rewards longer matched prefixes, then plus +20 hazard cluster + +10 global-bias + +1 per usage hint
- [Phase 13-03]: Library 'Pick from library' affordance only on hazards/ppe/steps/emergency kinds (LIBRARY_SUPPORTED_SLUG_TO_KIND map) — signoff intentionally inline-only per Phase 12 D-Save scope
- [Phase 13-03]: Wizard post-create junction attachment is best-effort non-blocking (T-13-03-04 acceptance) — partial picker failures route admin to builder with console.warn; admin can manually pick missing blocks via builder ⋯ menu
- [Phase 13-03]: createPuckOverrides factory + retained backward-compat puckOverrides export — original simple data-testid wrapper preserved for non-savable types (TextBlock/HeadingBlock/PhotoBlock/CalloutBlock/ModelBlock/UnsupportedBlockPlaceholder) keeping Phase 12 Playwright selectors stable

### Phase 13 Plan 04 Decisions

- [Phase 13-04]: Migration filename bumped from planned 00024 to 00025 — slot 00024 was already consumed by 13-03's reorder RPC migration (live in production); functionally identical to plan spec
- [Phase 13-04]: Accept publish-gate flip lives in the server action (acceptBlockUpdate), not the SECURITY DEFINER RPC — keeps the RPC narrowly scoped to junction-row writes; failed status flip is non-fatal because the snapshot already advanced
- [Phase 13-04]: Used Puck componentOverlay (not componentItem) for canvas-side badge — componentItem fires only for the palette/drawer; canvas items receive componentOverlay with componentId (= layout entry props.id). 13-03's three-dot save-to-library overlay on componentItem stays untouched
- [Phase 13-04]: componentId→junction lookup derived in BuilderClient by walking layout_data and matching props.junctionId entries against the junctionMap — junction rows know block_id but not the matching Puck componentId; the linkage lives in layout_data.props.junctionId stamped during 13-03's wizard handleSubmitFinal
- [Phase 13-04]: diffBlockContent emits ALL fields (not just changed ones) so the modal can render full block side-by-side; per-field oldValue !== newValue is the changed signal, top-level changed is the OR across fields plus kindChanged
- [Phase 13-04]: Decline records sop_block_update_decisions row with the SPECIFIC declined version_id — trigger filter makes that exact version idempotent for the badge, but a SUBSEQUENT version (v+2) will re-fire the badge by design (each new version deserves a fresh review opportunity)
- [Phase 13-04]: Task 6 schema push auto-completed — SUPABASE_ACCESS_TOKEN already in .env.local from 13-01..13-03 means automating the push was correct (executor prompt: complete every automatable task; only stop for genuine eyes-on gates)

### Phase 13 Plan 05 Decisions

- [Phase 13-05]: Create-new-global path implemented as a Link to /admin/blocks/new?scope=global (deferred entry point) — Phase 13 v1 also supports editing existing globals as the create path; SaveToLibraryModal forcedScope extension explicitly skipped per plan's "only add this if cheap" guidance
- [Phase 13-05]: requireSummitAdmin server-side guard uses (supabase as any).rpc('is_summit_admin') cast — matches existing src/actions/blocks.ts requireSummitAdmin pattern, single source-of-truth for the "who is a Summit super-admin" policy via the SECURITY DEFINER RPC from 00022
- [Phase 13-05]: BlockListTable from 13-01 reused verbatim for /admin/global-blocks landing — single rendering surface for org-scope (/admin/blocks) and global-scope (/admin/global-blocks) lists
- [Phase 13-05]: SuggestionReviewRow snapshot preview reuses BlockPickerPreview's switch shape (HazardCardBlock / PPECardBlock / StepBlock / curated emergency + measurement); non-curated kinds fall through to compact JSON dump labelled with kind — kept self-contained for now; promote to shared <BlockContentPreview> if a third surface needs it

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

Last session: 2026-05-07T06:30:00Z
Stopped at: Completed Phase 13 plan 05 (`13-05-PLAN.md`). Summit super-admin curation UI shipped — `/admin/global-blocks` (gated by requireSummitAdmin) lists globals via BlockListTable + nav to suggestions queue; `/admin/global-blocks/suggestions` exposes pending block_suggestions rows with Promote/Reject decision form. No schema changes (consumes 13-01's pre-declared server-action surface verbatim). 3 task commits on master (5ea8575, 5a57687, 1d2bef7). Phase 13 implementation 5/5 complete; batched browser UAT (13-03 + 13-04 + 13-05) remains pending Simon's verification. Pre-existing 13-01 manual SQL seed (insert into summit_admins ...) still required before super-admin routes are accessible. Next: phase verification + Phase 13 transition.
Resume file: None
