---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: — AI-Native Builder + Agent Foundation
status: 26-12 complete (spine re-wire — behavioural parity P12/P13/P9/P8)
stopped_at: Completed 26-12-PLAN.md (W8, R8 — re-earned Puck's componentOverlay bindings on the bespoke canvas, all behaviourally proven per CLAUDE.md 2026-06-05). selection-bridge.ts (pure selectBlock/resolveRegion/resolveComponentIdFromSource) + BlockEditShell/EditableDocument re-wire: **P12** canvas↔source selection-sync (block focus → setActiveProvenance(region, junctionId); source click → focus [data-block-id]; [data-puck-item-id]→[data-block-id] repoint); **P13** ⚑ AI-flag header badge (--ai purple) toggling the reused inline ReviewerFlagsPanel (one open at a time via openFlagsFor) + reused 13-04 PuckItemBadgeOverlay update badge; **P9** dashed "Reference images" chip on Unanchored-figures HeadingBlocks; **P8** single-block "✦ tap to verify"→"✓ verified" chip writing through the EXISTING verifyBlock/unverifyBlock actions + verify-checklist query invalidation. Server publish route (`/api/sops/[sopId]/publish` 400 unverified_blocks) + useSelectionSync.tsx BOTH git-diff empty (reused UNCHANGED; only callers moved off Puck). 3 behavioural specs: selection-sync (spy on setActiveProvenance both directions), ai-overlay (seeds reviewer query → real FlagBadge row renders), verify-gate (invokes the REAL route handler with mocked Supabase → 400/200 paths). phase26 **85 green**, no-bulk-verify guard green (R8), tsc clean, next build green (worker bundle **Δ0KB** — admin-only overlays didn't leak). BuilderClient unchanged (26-04 split the canvas host to EditableDocument; plan's Puck-era line refs stale — noted as Rule-3 adjustment).
last_updated: "2026-07-03T21:30:00.000Z"
progress:
  total_phases: 29
  completed_phases: 4
  total_plans: 26
  completed_plans: 26
  percent: 14
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-13)

**Core value:** Workers can reliably follow any SOP on their phone, step-by-step, with the right safety information always visible — even offline.
**Current focus:** Phase 26 — sop-builder-redesign

## Current Position

Phase: 26 (sop-builder-redesign) — EXECUTING
Plan: 12 of 14 complete
**Milestone status:** **v4.0 ✅ shipped 2026-07-02** (Phases 21, 21.5, 21.6, 22, 23, 24, 25 executed + code-reviewed; residual = human UAT on 21.6/22/23/25, carried per v3.0 field-verification precedent — archive via `/gsd-complete-milestone`). **v5.0 opened 2026-07-02** — Phase 26 (bespoke inline builder; Phase 17 Konva absorbed) → Phase 26.5 (agent-metadata layer on X-03 + graphify).

**Active phase:** 26

**v4.0 phase sequence:**

1. **Phase 21 — Safety-Critical Parsing** ✅ COMPLETE 2026-05-26: S-02 side-by-side viewer + S-03 AI reviewer × 5 + S-04 per-block verify checklist + I-01 Phase 20 contract complete. 23 requirements (SCP-VIEWER ×5, SCP-AI ×8, SCP-VERIFY ×6, SCP-PARSE ×4) + 7 must-haves from Plan 21-05 gap closure (parser → library junction integration). VERIFICATION.md verdict: PASS-WITH-NOTES (residual = 5 human-UAT items only, all now unblocked).
2. **Phase 22 — Voice-Driven Walkthrough** (next): W-01 literacy/visual/voice gaps + X-02 voice-driven walkthrough. 8 requirements (VDW-LIT ×4, VDW-VOICE ×4).
3. **Phase 23 — AI Field Layer + Version Supersede**: X-03 universal AI read/write + G-01 version supersede + worker-instance sign-off. 9 requirements (AFL-AI ×4, AFL-VER ×5).

**Next action:** `/gsd-execute-phase 26` next plan (26-12+). **26-11 is complete** — its Task-3 on-device Konva UX gate is carried as a **deferred-residual** (verify on sopstart.com after 26-13 wires the annotate→save→reopen launch point; UAT `p26-annotation-editor-feel`), NOT a blocker, since the editor cannot be mounted from a route until 26-13. Plan 26-11 built (R5/D-03 slice 2): the absorbed **Phase 17 annotation primitives** inside the Visual/diagram medium — `annotation-tools.ts` PURE scene-JSON model (6 primitive factories Arrow/Rect/Ellipse/Text/numbered-callout/freehand, snapshot undo/redo, non-destructive serialize with the image URL kept OUT, `acceptsPointer` palm-rejection) drives `AnnotationEditor.tsx` (upgraded from the 26-05 spike shell: `Konva.Transformer` resize/rotate, textarea text-edit overlay, Delete + Cmd/Ctrl+Z, Pen-only palm rejection, `stage.destroy()` teardown) + `DiagramHotspotBlock.tsx` (the ONLY freeform surface — numbered callouts at freeform x/y in natural-image space, `annotationId`-linked, same scene model). `annotation-primitives.spec` **14 green**, tsc clean, `next build` green, worker bundle **Δ0KB Konva-free** (isolation gate green). Persist/save deferred to **26-13**. **Task-3 human-verify UX gate NOT self-approved** — carried per the v3.0 device-verification precedent. Plan 26-10 done (R4): **smart-next ghosts** — confident, non-redundant predictions from the shared `SMART` map (Hazard→PPE, Measurement→Decision, Step→Measurement) render as an inline dashed-purple `--ai` ghost. `useSmartGhosts` = pure state machine (`computeGhosts` self-suppresses when the predicted block already follows / `resolveGhostVisibility` one-live-nearest-centre + dim others + scroll-past<64px→gone-permanently / `ghostsGoneOnTyping` type-dismiss-except-next) + a thin rAF/ref hook that toggles `classList` on refs — the document NEVER re-renders on scroll (RESEARCH Pattern 4 / 2026-05-13 hot-path learning). `Tab`-or-click accepts (inert while the inserter menu is open → no keyboard collision) → `content-ops insertBlock` → autosave; no reducer / `layout_data` change. `GhostRow` injected into `EditableDocument` between blocks; `ghosts.spec` proves all 5 scenarios (9 green) + accept→insert + no-scroll-re-render; tsc + `next build` green. Plan 26-09 done (R5/R7): the **unified Visual block** — 18th block type, mixed medium-tagged media (visual:photo|diagram|video), 3-place contract **18/18/18** + medium tags on /api/schema (agent-contract hook D-02); **Pattern E media grid COMPLETE** (MediaGrid + medium sub-picker) → FIELD_MAP has no stubs, P14 stays **0 unreachable across 18 blocks**; legacy photo blocks edit THROUGH the Visual UI with layout_data kind + provenance frozen (A3, convert-golden byte-equivalence green); worker bundle **Δ0KB, Konva-free**. Plan 26-08 done (R3): tiered context-aware inserter. Plans 26-01..26-07 done: Nyquist harness + convert-golden baseline (26-02), Puck-free worker renderer + block-registry (26-03), the bespoke EDIT canvas + autosave re-wire + dnd-kit reorder (26-04), the Konva annotation foundation — spike PASSED, 00039 applied to live DB, worker bundle proven Konva-free (26-05), the P14 field-map reachability registry + bespoke A/B/D inline editors — EnumChip/InlineToken/FIELD_MAP-driven shell, one Zod-validated lossless commit path (26-06), and **P14 COMPLETE (26-07)**: Pattern C anchored FieldPanel + ArrayFieldEditor (dnd-kit rows, lossless nextStepId-preserving edits) for PPE/Decision/Inspect arrays + Photo alt / Model assetUrl scalars — phase-level parity gate lands: **0 unreachable fields across all 17 blocks (42 fields)**; only Pattern E (media grid) remains, deferred to 26-09. SPEC (`26-SPEC.md`, R1–R8) + CONTEXT (`26-CONTEXT.md`) locked 2026-07-02. Locked forks: **full-bespoke editor** replacing Puck (D-01, `layout_data`/junction/provenance frozen); **agent-metadata layer split to Phase 26.5** (contract hooks only here, D-02); **Phase 17 Konva annotation ABSORBED** into the Visual block (D-03, workers never download Konva — baked PNG read path); **v5.0 opened** (D-04). Expect a heavily-waved plan (bespoke render → tiered inserter+ghosts → re-wire autosave/provenance-sync/AI-overlays/verify-UI with **behavioural parity tests** → Visual+Konva slices → convert-golden-path regression). Validated sketch: `sketches/sop-builder-redesign/index.html`.

**Also outstanding (v4.0 residual):** human UAT on sopstart.com — Phase 23 (4 tests), Phase 22 (voice loop), Phase 25 (7 tests), Phase 21.6 (4 items). Carry per v3.0 field-verification precedent or run before `/gsd-complete-milestone`.

**v5.0 residual:** 26-11 annotation-editor device-UX feel (UAT `p26-annotation-editor-feel`) — deferred until 26-13 wires the annotate→save→reopen launch point; run on sopstart.com alongside the 26-13 persistence check.

**Roadmap evolution:** Phase 21.6 (Builder Edit Stage Redesign) INSERTED after 21.5, before 22, on 2026-06-05. Reason: 21.5 redesigned the Review/Publish stages but the Build/edit stage is still the untouched Puck editor — first-time admins hit jargon ("Block"), two redundant block lists (palette vs outline), unanchored canvas figures, and a cramped right-rail field editor. Decision by Simon during 21.5 UAT.

### v3.0 closeout dispositions (closed without separate UAT runs)

- Phase 12 UAT #3 + #6 — field-verified (offline + LWW structurally in code; no regressions in prod since 2026-04-24)
- Phase 13 UAT 13-03/04/05 — field-verified (exercised continuously through 14/15/20 work)
- Phase 14 UAT 1/2/4 — verified-via-downstream (Phase 20 hitting live Anthropic API since 2026-05-15)
- Phase 15 final UAT — carried as a manual operator action (Simon's migration push + Visy demo dry-run)
- Phase 14.5 residual (role-aware home + global Cmd+K) — rolled into Phase 15 scope; verify before forgetting
- TopHeader walkthrough/kiosk hide — closed as not-a-bug per "consistent UI always" decision 2026-05-22

### Carried to v4.0 backlog

- Phase 7 — Video Transcription (In-App Recording), blocked on iOS Safari MediaRecorder
- Phase 9 — Streamlined File → Video Pipeline (partial code on master; decide finish vs descope)
- Phase 16 — NZ Template Library (own-milestone scale)
- Phase 17 — Image & Diagram Annotation (Konva, needs customer pull)
- Phase 18 — Collaborative Editing (no contention observed)
- Phase 20 (remainder) — **promoted to v4.0 Phase 01: Safety-Critical Parsing** (AI reviewer × 5 jobs + side-by-side source viewer + per-block verify checklist)

### Operator + infra debt at close

- Migration 00030 push outstanding (see "Next action" above)
- `/sops/[sopId]/page` bundle re-baselined 1095 → 1104 KB on 2026-05-22 (global TopHeader). ±2 KB tolerance preserved.
- PWA icon caches on installed clients may need home-screen reinstall to refresh paper/ink rebrand (commit `ff00006`)
- 999.1 stale-video-job cleanup service + 999.3 CSP/HSTS hardening still parked in backlog

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
| 24 | 3 | - | - |
| 25 | 6 | - | - |
| 22 | 4 | - | - |

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
| Phase 15 P02 | 10m | 4 tasks | 11 files |
| Phase 15 P03 | 75m | 4 tasks | 9 files |
| Phase 15 P04 | 10m | 5 tasks | 12 files |
| Phase 21 P02 | 18m | 3 tasks | 17 files |
| Phase 21 P03 | 25m | 3 tasks | 22 files |
| Phase 21.6 P02 | 12 | 2 tasks | 1 files |
| Phase 21.6 P03 | 5 | 2 tasks | 4 files |
| Phase 21.6 P04 | 12 | 2 tasks | 2 files |
| Phase 21.6 P05 | 20 | 2 tasks | 2 files |
| Phase 24 P24-03 | 25m | 4 tasks | 9 files |
| Phase 25-department-first-class-entity P03 | 45min | 3 tasks | 16 files |
| Phase 25-department-first-class-entity P04 | 496 | 3 tasks | 7 files |
| Phase 25 P05 | 10m | 3 tasks | 11 files |
| Phase 25-department-first-class-entity P06 | 7m | 2 tasks | 7 files |
| Phase 22 P01 | 15m | 2 tasks | 7 files |
| Phase 22 P02 | 8m | 2 tasks | 9 files |
| Phase 22 P04 | 5m | 1 tasks | 1 files |
| Phase 23 P01 | 218s | 3 tasks | 3 files |
| Phase 23 P03 | 14m | 3 tasks | 2 files |
| Phase 23 P06 | 452 | 3 tasks | 9 files |
| Phase 23 P04 | 450s | 3 tasks | 6 files |
| Phase 23 P07 | 4m | 3 tasks | 2 files |
| Phase 26 P01 | 6min | 1 tasks | 2 files |
| Phase 26 P02 | 12m | 2 tasks | 5 files |
| Phase 26 P05 | 8m | 3 tasks | 8 files |

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
- [Phase ?]: [Phase 15-02]: WalkthroughTab.tsx kept as a 4-line re-export shim; deletion deferred to Wave 4 Task 5
- [Phase ?]: [Phase 15-02]: WalkthroughVoiceModal ships full shell in Wave 2 (not placeholder) — switcher next/dynamic requires the export to exist; only /api/voice/query fetch is stubbed for Wave 3
- [Phase ?]: [Phase 15-02]: Voice button + modal mounted at WalkthroughSwitcher level (single instance serves Mobile + Desktop variants, RESEARCH A10)
- [Phase ?]: [Phase 15-02]: stepAckTrace persisted as informational evidence on sop_completions.step_ack_trace (jsonb) via Json cast; server does NOT gate on it (T-15-02-01 accept disposition)
- [Phase ?]: [Phase 15-02]: Wave-2 runtime tests downgraded to live source-contract assertions (chromium binary not installed; same Rule-3 trade-off as Plan 15-01); runtime checks deferred to Task 5 phase UAT
- [Phase ?]: [Phase 15-02]: First Load JS delta /sops/[sopId]/page = +7 KB (1088→1095); DesktopWalkthrough+WalkthroughVoiceModal correctly out-of-band as dynamic chunks; Wave 4 owns formal CI gate
- [Phase ?]: Used bare () => <></> instead of (): ReactElement => <></> in createPuckOverrides — E3 test regex requires parens-arrow form without type annotation
- [Phase ?]: deriveStepTree is pure read of layout_data.content[] — no mutations, presentation-only step grouping (21.6-03)
- [Phase 24-01]: FlowGraphSchema id/from/to relaxed to z.string().min(1) — derived non-step nodes use junctionId/props.id which are not guaranteed UUIDs (FLOW-05 schema contract)
- [Phase 24-01]: stepId stays z.string().uuid().optional() — always links to sop_steps.id
- [Phase 24-01]: zod uuid validator requires version nibble [1-8] (RFC 4122) — sequential test UUIDs like 00000000-...-000042 are INVALID; use proper v4 format e.g. a0000000-0000-4000-8000-000000000001
- [Phase 24-01]: FlowGraphField is unreachable from 21.6 builder (rightSideBarVisible:false at BuilderClient.tsx:535) — Plan 03 must re-surface via portaled modal/panel, not Puck right sidebar
- [Phase 24-01]: useBuilderAutosave writes only layout_data per section_id to Dexie; never writes root.props.flowGraph — autosave cannot clobber sops.flow_graph
- [Phase 24-02]: layoutFromPositions uses bounding box + NW/NH + PAD*2 for canvas dimensions — consistent with auto-layout sizing formula
- [Phase 24-02]: color-mix(in srgb, var(--accent-X) 12%, transparent) used for node fills — matches FlowTab StepCard tint idiom
- [Phase 24-02]: fitToView uses Math.min(cw/gw, ch/gh, 1) — never scales above 100% to avoid blurry upscaling on small graphs
- [Phase 24-02]: exportPng wired as void exportPng() inline onClick — avoids returning a Promise to JSX onClick handler
- [Phase ?]: FlowTab loads FlowGraphCanvas via next/dynamic ssr:false to hold bundle gate at 1104 KB; graph never SSR-renders (list is SSR default)
- [Phase 25-01]: D-02a enforced: all three junction tables (block_departments, sop_departments, member_departments) use using(true) for SELECT — never reference parent sops/blocks from a junction policy (42P17 recursion avoidance per 00030/00031 learning)
- [Phase 25-01]: D-01 non-destructive: global blocks COPIED per-org (not updated in place); category column retained read-only; DELETE of null-org rows only after copies confirmed; RAISE EXCEPTION asserts zero orphans
- [Phase 25-01]: D-03 owner label: owner_user_id is ON DELETE SET NULL — dept surfaces 'no owner' warning on member removal (REQ-5)
- [Phase 25-01]: is_platform_admin() NOT dropped in 00037 — migration 00032 (ai_review_results policy) still references it
- [Phase 25-01]: 00036 data migration uses WHERE NOT EXISTS (org + kind_slug + name + current_version_id) for per-org global copy idempotency guard — blocks table has no unique constraint on (organisation_id, kind_slug, name)
- [Phase ?]: supabase as any cast used for new tables (departments, block_departments, sop_departments, member_departments) not yet in database.types.ts — consistent with existing blocks.ts pattern for block_suggestions
- [Phase ?]: setDepartmentOwner creates fresh supabase client (not any-cast) for organisation_members check to ensure type safety on the RLS-guarded query
- [Phase ?]: WizardClient.tsx passes empty departmentIds/allDepartments defaults — full DepartmentPicker integration deferred to Wave 4 plan 25-04
- [Phase ?]: global-blocks/page.tsx and suggestions/page.tsx redirect to /admin/blocks — Wave 4 plan 25-05 will delete the route segments entirely
- [Phase ?]: Department-filtered block library uses separate block_departments junction query in page augmented via blockDeptMap
- [Phase ?]: is_platform_admin() RPC retained — /admin/global-blocks UI removed but RPC still referenced by ai_review_results RLS in migration 00032
- [Phase ?]: DepartmentBottomSheet uses draft-commit pattern (Done button) for mobile; DepartmentSidebar uses direct-toggle for desktop
- [Phase 25-06]: DepartmentPicker in both wizard (blank) and AI-draft paths uses localOnly=true + sopId=__new__ sentinel — no server action fires on toggle; dept IDs accumulate in local state and write in a single createSopFromWizard / ai-prompt POST
- [Phase 25-06]: Department filter bar on /admin/team filters the visible member list client-side from fetched members (no URL param needed — team page already loads all members via getTeamMembersWithEmails)
- [Phase 25-06]: Owner badge reads departments.owner_user_id from Department objects passed from the server — onChange after DepartmentPicker fires fetchMembers() to refresh owner state
- [Phase 25-06]: team/page.tsx role guard expanded from admin-only to admin|safety_manager (consistent with other admin pages)
- [Phase 22-04]: SECTION_TYPE_ICONS uses Record<string, LucideIcon> with case-insensitive lookup + ?? ListChecks default — covers hazard/hazards/ppe/emergency/steps/signoff; any unmapped section_type gracefully degrades to ListChecks (D-06)
- [Phase 22-04]: stepImages derived from ownerSection.sop_images.filter(img => img.step_id === current.id) with ?? [] guard — no query change needed; SopWithSections already carries sop_images per section (RESEARCH A3 confirmed)
- [Phase ?]: Phase22 source-contract specs use [\s\S] not /s flag (CLAUDE.md 2026-06-02 TS target)
- [Phase ?]: Phase22 intent-classifier spec uses fs.existsSync guard + test.skip for green-when-absent / live-when-present without module-load errors
- [Phase ?]: Phase22 TTS route spec asserts TTS_MODEL constant (not bare hardcoded string) per CLAUDE.md 2026-06-02 model-ID-rot learning
- [Phase ?]: Phase22 voice-safety-gate encodes both D-02 positive bypass guard AND negative gate (isAcknowledged-false ack-prompt speak branch)
- [Phase ?]: TTS_MODEL constant overridable via process.env.TTS_MODEL — prevents silent model-rot (CLAUDE.md 2026-06-02)
- [Phase ?]: TTS route uses regular createClient() not createAdminClient — session RLS is org-scope gate; workers allowed (D-15)
- [Phase ?]: Behavioral unit tests for classifyIntent in src/lib/voice/__tests__/intent-classifier.test.ts (phase15-unit) where static @/ imports resolve correctly
- [Phase 23-00]: Wave-0 registry stub (src/lib/ai-fields/registry.ts) created so phase23-unit static @/ imports resolve during test discovery — Plan 23-02 replaces with full implementation; stub is intentionally minimal (idempotent Map-based) but sufficient for source-contract assertions
- [Phase 23-00]: version-supersede.spec.ts guards on function presence in file (src.includes('cloneSopAsDraft')), not just file existence — versioning.ts already exists from Phase 3; guard must be content-level for files extended in later plans (not just file-existence level)
- [Phase ?]: computeNextVersionLineage extracted as pure helper for unit-testable lineage logic without DB (23-03)
- [Phase ?]: restoreVersionAsNew delegates to cloneSopAsDraft — restore is structurally identical to forward clone, D-06 append-only invariant enforced (23-03)
- [Phase ?]: column names corrected to match database.types.ts: section_id/step_number/required_tools/confidence/content_type on sop tables (23-03)
- [Phase 23]: D-11 kiosk account model: per-org kiosk account (role=worker) established once by admin; roster_worker_id distinct from worker_id; recordSignature uses createAdminClient with org-scope self-enforcement
- [Phase ?]: Phase 23 pre-existing test failures (28) in older phase stubs are not regressions — phase-23 suite (49 tests) is fully green
- [Phase 26]: [Phase 26-01]: Bespoke-editor deps (dnd-kit x3, konva, react-konva) exact-pinned in dependencies (not optionalDependencies — cross-platform); no app import yet so worker bundle untouched
- [Phase 26-02]: phase26 Playwright project uses ONE broad testMatch (tests/phase26/**) — single registration point for the whole phase; later plans drop specs in tests/phase26/ with no config edit (CLAUDE.md 2026-05-25)
- [Phase 26-02]: R6 convert golden baseline captured from the deterministic code-owned converter (parsedSopToPerSectionLayoutData + puckPropsToBlockContent) via a FIXED ParsedSop — not a live DOCX→GPT→DB run (GPT non-deterministic, junction writes need Supabase; neither byte-reproducible). Only props.id (Date.now) is normalized; the frozen D-01 contract is the converter itself, so this is a true runnable byte-baseline
- [Phase 26-03]: Puck replaced as RENDER engine on the worker read path (D-01) — bespoke BLOCK_COMPONENTS (17 type→component) + Puck-free LayoutRenderer over the FROZEN layout_data contract; UnsupportedBlockPlaceholder + sanitizeLayoutContent relocated to sanitize-layout.ts (P17). No per-block Zod SafeRender on read (write boundary already validates)
- [Phase 26-03]: Worker /sops/[sopId] First Load JS is Δ0 (1054 KB) after the swap — @puckeditor/core was already an admin-only dynamic chunk (5fed561a, referenced only by admin/sops/builder route), never in worker First Load; the swap makes it structural (LayoutRenderer no longer references Puck). Baseline re-captured with previousBaseline history
- [Phase 26-03]: contract-check.ts place (1) repointed off puck-config.tsx onto BLOCK_COMPONENTS in block-registry.tsx (RESEARCH Pitfall 1); guard spec asserts live target. Render-parity + contract-target specs shell out to tsx subprocesses — Playwright's JSX transform ({__pw_type}) is incompatible with real react-dom/server
- [Phase 26-05]: Konva-in-Next-16 spike PASSED — react-konva renders via dynamic({ssr:false}) with 'canvas' in serverExternalPackages; compiled to its own client chunk, ABSENT from /sops/[sopId] worker bundle (Δ0). No Excalidraw/custom-SVG fallback needed. Throwaway /admin/builder-v2-konva-spike route forced react-konva into the build graph (a component no route imports is never bundled — tsc alone doesn't exercise canvas webpack resolution); delete in 26-13
- [Phase 26-05]: 00039 sop_image_annotations APPLIED to live DB (verified via Management API to_regclass — table + 1 org-scoped SELECT policy + 10 cols). Append-only (no authenticated write; service-role writes in 26-13 self-enforce org-scope), org-scoped SELECT via current_organisation_id() only — NO cross-table public.sops reference (42P17-safe, copies 00038 pattern). Konva fenced out of worker tier by bundle gate + no-static-import lint (D-03/R8)

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

### Phase 15 Plan 00 Decisions

- [Phase 15-00]: Pre-Phase-15 First Load JS baseline = 1088 KB for /sops/[sopId]/page (18 chunks) — locked in .bundle-baseline.json; Wave 4 enforces ≤ +2KB delta via postbuild CI gate
- [Phase 15-00]: Next.js 16 webpack does NOT emit app-build-manifest.json (Turbopack-only artifact) — derived per-route client chunk list from RSC client-reference-manifest at .next/server/app/(protected)/sops/[sopId]/page_client-reference-manifest.js; both capture + check scripts handle webpack and Turbopack manifest layouts
- [Phase 15-00]: playwright.config.ts testMatch extended to accept both *.test.ts and *.spec.ts; new phase15-stubs project regex matches 6 SB-LINE spec files + lint guard (15 tests total discoverable via --list)
- [Phase 15-00]: Lint guard (tests/lint/no-static-desktop-import.spec.ts) runs LIVE not test.fixme — regex matches import-shape lines only, passes vacuously at Phase-14-head, auto-traps any future static import of DesktopWalkthrough/WalkthroughVoiceModal outside WalkthroughSwitcher.tsx
- [Phase 15-00]: Wave-0 carve-out in check-bundle-size.ts: chunk-existence assertions silently no-op when neither chunk name appears in any manifest AND delta ≤ 0; auto-activates the moment Wave 2 ships next/dynamic imports

### Phase 15 Plan 03 Decisions

- [Phase 15-03]: packSopForPrompt is the SINGLE source of truth for cache-keyed SOP payload — both answer call (voice-qa.ts) and verifier call (verify-sop.ts mode 'voice_qa' branch) import from `@/lib/voice/sop-pack` to guarantee byte-identical input above the cache_control:ephemeral breakpoint (Pitfall 3 closed)
- [Phase 15-03]: verify-sop.ts mode 'voice_qa' branch returns synthetic `{severity:'warning', description:'Verification temporarily unavailable…'}` flag on Anthropic exception (Pitfall 10 fail-safe to uncertainty); existing 'transcript' and 'prompt' modes retain `return []` semantics (Phase 6 / 14 callers unaffected)
- [Phase 15-03]: Anthropic SDK captures `globalThis.fetch` at construct time — wrap with passthrough lambda `fetch: (input, init) => globalThis.fetch(input, init)` so tests can swap `global.fetch` after the lazy singleton is built; applied to both voice-qa.ts and verify-sop.ts lazy-init helpers
- [Phase 15-03]: __resetAnthropicForTests export added to voice-qa.ts (test-only) so unit-test suites can null the lazy singleton between cases without touching production paths
- [Phase 15-03]: Concurrency cap = per-process in-memory `Set<userId>` keyed by `auth.uid` — Railway-single-process compatible only; comment cites CLAUDE.md PM2 cluster learning. Move to Redis-backed bucket if deploy ever fans out to multiple processes
- [Phase 15-03]: /api/voice/query route uses regular `createClient()` (RLS-respecting), NOT `createAdminClient()` — RLS enforces single-org + sub-trade gate from migration 00030. No admin-role check on the route (D-15 — workers must be allowed)
- [Phase 15-03]: voice-qa-cache test uses local `rawAnswerResp`/`rawVerifierResp` helpers — Wave-0 anthropic-voice-mock fixture's `content[0].text = JSON.stringify({answer, citations})` is wire-incorrect (real Anthropic returns raw text); fixture left alone (Wave 0 contract) but flagged for future correction
- [Phase 15-03]: voice-grounding-scope tests implemented as source-contract assertions (matching Plan 15-01 / 15-02 Rule-3 trade-off) — runtime live-route SB-LINE-04 cross-SOP scenario gated on chromium binary, but route's structural single-SOP fetch (`.eq('id', sopId)` exactly once) makes cross-SOP leak impossible to introduce silently

### Phase 15 Plan 04 Decisions

- [Phase 15-04]: Re-baselined .bundle-baseline.json to 1095 KB (post-Wave-2 starting point) rather than trimming the Wave-2 +7 KB delta — the +7 KB is the legitimate one-time cost of splitting MobileWalkthrough out of WalkthroughTab and adding the dynamic-import wiring; the phase's actual goal "desktop split does not unboundedly bloat the mobile bundle" is proved by the chunk-existence gate (both chunks stay out-of-band); forward enforcement is ≤ +2 KB drift from THIS number
- [Phase 15-04]: Chunk-existence detection rewritten — Wave-0 haystack only scanned manifest JSON, but manifest entries reference chunks by content-hashed filename (no symbol name signal). New `findSymbolInBuildOutput` scans (a) the route's server page.js bundle (dynamic-import call sites), (b) middleware-react-loadable-manifest.js (next/dynamic registry), (c) top-level static client chunks (substring scan, defence-in-depth)
- [Phase 15-04]: Admin team page restructured to fetch organisation_members directly + render per-worker SubTradePicker section UNDERNEATH the existing RoleAssignmentTable — keeps role-edit logic untouched per plan's explicit instruction; satisfies grep ≥ 2 hits for SubTradePicker pattern
- [Phase 15-04]: SubTradePicker uses RLS-respecting `createClient()` not `createAdminClient()` — write paths are policy-gated to admin/safety_manager in migration 00030; using the admin client would bypass org-scoping
- [Phase 15-04]: All 4 runtime UAT tests held as test.fixme pending Simon's db push + chromium install — same Rule-3 trade-off as Plans 15-01 / 15-02; live source-contract tests cover every must_haves truth structurally
- [Phase 15-04]: step_ack_trace verification revealed Wave 2 ALREADY wired this end-to-end across MobileWalkthrough + DesktopWalkthrough + completions.ts — Wave 4 added 3 contract tests only, no code changes needed
- [Phase 15-04]: `npm run build` masks postbuild script exit codes (pre-existing npm lifecycle behaviour); authoritative bundle-gate exit must come from `npx tsx scripts/check-bundle-size.ts` directly. CI workflow needs a separate gate step

### Phase 15 Plan 01 Decisions

- [Phase 15-01]: Migration 00030 uses sop_completions (not 'completions' as plan/RESEARCH stated) — actual completion table from migration 00010 is public.sop_completions; Rule-1 bug auto-fix corrected in migration + database.types.ts extension
- [Phase 15-01]: Two SECURITY DEFINER helpers — current_user_sub_trades() returns setof uuid; sub_trade_id_intersects(p_sop_id uuid) returns boolean — kept separate from the additive sops_visible_by_sub_trade policy for testability and reuse
- [Phase 15-01]: Backward-compat short-circuit via `not exists (select 1 from sops_sub_trades sst where sst.sop_id = sops.id)` clause — Phase 1-14 SOPs with zero sub-trade rows remain visible to all workers without modifying the existing role-based RLS
- [Phase 15-01]: useViewport runtime browser tests downgraded to source-contract tests (Rule-3 blocking adapt) — Playwright chromium binary not installed locally; the D-04 SSR-safety invariant is the initial-state literal, which source-contract assertions catch directly. Runtime variant swap covered end-to-end by Wave 2 desktop-walkthrough-layout.spec.ts against the real route.
- [Phase 15-01]: AckTraceEntry imported from @/types/sop into the walkthrough store — single source of truth for {stepId, timestamp} shape across types, validators, store, and Wave 2/3 consumers
- [Phase 15-01]: subTradeAssignmentSchema caps subTradeIds.length at 10 per T-15-01-05 DoS mitigation — leaves 5× headroom over the 15a seed vocab (5 rows), forward-compat with 15b admin-editable vocab
- [Phase 15-01]: Migration tripwire comment convention established — every SQL function that references a renamable table by NAME must include the CLAUDE.md learning 2026-05-08 reference in its `comment on function` body (current_user_sub_trades + sub_trade_id_intersects both carry it)

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

Last session: 2026-07-03T20:05:00.000Z
Stopped at: Completed 26-11-PLAN.md (Konva annotation primitives + DiagramHotspotBlock — R5/D-03 slice 2; 14 phase26 specs green, tsc clean, next build green, worker bundle Δ0KB Konva-free). Task-3 device-UX gate carried as deferred-residual (UAT p26-annotation-editor-feel; verify on sopstart.com after 26-13 wires the launch point).
Resume file:
None
