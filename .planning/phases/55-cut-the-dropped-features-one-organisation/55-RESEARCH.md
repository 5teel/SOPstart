# Phase 55: Cut the Dropped Features & One Organisation - Research

**Researched:** 2026-10-03
**Domain:** Next.js 16 App Router + Supabase deletion/rewire phase (no new capability, no new packages, no migration)
**Confidence:** HIGH for the inventory (every list below was derived from an import-graph walk of `src/` plus targeted greps of `src/`, `tests/`, `scripts/`, config; not from filenames). MEDIUM for service-worker retirement behaviour (community sources, consistent) and for the Supabase signup toggle (see Assumptions).

Provenance tags used: `[VERIFIED: codebase]` = read/grepped in this session; `[CITED: url]`; `[ASSUMED]` = judgement or training knowledge, needs confirmation. Anything marked `VERIFY:` was not provable by static reading.

## Summary

Phase 55 deletes about **132 `src/` files (~18,400 lines) plus ~60 spec files**, removes 8 npm packages, retires the Serwist service worker, and re-points the worker path (pins, Now card, walk, photo, completion) from the Dexie cache to direct server/Supabase reads and writes. It adds **no migration** (sign-up creates the org in a server action only; the JWT hook in `00017_multi_org_membership.sql` already tolerates absence of `active_org_id`), so no `[BLOCKING] supabase db push` task is needed. [VERIFIED: codebase - grep of `supabase/migrations` for auth triggers / org inserts returned nothing; org creation exists only in `src/actions/auth.ts:signUpOrganisation`]

The phase's real difficulty is not the deletions, it is **fifteen shared modules where a dropped feature and a kept feature meet** (listed in "Surgical edits" below): `WalkthroughSwitcher`/`MobileWalkthrough`/`ImmersiveStepCard`/`DesktopWalkthrough` (voice bridge + Dexie + photo queue), `sops/page.tsx` (sync, offline label, phone home), `UploadDropzone` (YouTube / photo-scan / video-generation entries live in the same component as the kept upload + record-video entries), `publish-core.ts` (calls the video auto-queue), `BuilderClient` + `useBuilderAutosave` (the admin builder's autosave is **Dexie-backed** and must be rewired, not just deleted), `lib/agent-layer/synthesis.ts` (imports `lib/voice/sop-pack.ts`), `MediaGrid` (annotate modal), `EditableDocument`/`BlockEditShell` (library Reuse tier + update badge), `WizardClient` (BlockPicker), `scripts/check-bundle-size.ts` (three marker groups + the voice chunk assertion), and the AI-model registry that feeds the admin AI-settings page.

Three scope traps the planner must not walk into: (1) the **video on-ramp stays** - ROADMAP Phase 61 lists "record a video" as one of four ways to start a SOP and Phase 58 opens "a SOP still being read from a document or a video", so `transcribe`, `VideoRecorder`, `VideoPreviewPanel`, TUS upload, `@ffmpeg/*`, `ffmpeg-static` and `DEEPGRAM_API_KEY` (batch STT) all STAY; only video *generation* (Shotstack, narrated slideshow, video versions, pipeline progress page) goes. (2) `--accent-voice` is a **colour token** used by the safety gate, "photo required" UI, pills and the login button - it is not voice and must not be deleted or grepped as "voice". (3) `contract-check.ts` (prebuild) requires every block type to exist in the registry, introspection and Zod union; VoiceNoteBlock / VisualBlock(diagram) must therefore stay as inert renderers until Phase 56 converts content.

**Primary recommendation:** Run it as seven sequential waves on the main tree (not worktrees): Wave 0 dropped-list + guard scaffold -> Wave 1 additive worker-path rewire (build stays green) -> Wave 2 delete offline/PWA -> Wave 3 delete voice, phone/QR, shared-device -> Wave 4 delete authoring features -> Wave 5 ORG-01 -> Wave 6 maps/docs/tests/bundle-gate -> Wave 7 push + deployed eval + baseline decision. Rewire first, delete second; never delete a module before its last importer is edited.

## User Constraints

No `55-CONTEXT.md` exists (phase directory was empty). Constraints below are taken verbatim in intent from REQUIREMENTS.md (v11.0), ROADMAP.md Phase 55 and `.claude/skills/sketch-findings-SOPstart/references/one-screen-site.md`; treat as locked.

### Locked
- Deleted: offline use, voice of any kind (Q&A, read-aloud, voice-driven walkthrough, voice drafting), phone and QR plates, shared-device login, video generation, flow diagram, image annotation, YouTube and photo-scan on-ramps, reusable-content library pages, version compare/restore. "Dead code is removed, not hidden behind a flag."
- Deleted means routes, components, API endpoints, packages and scheduled jobs. **No database table or customer row is dropped.** No migration.
- Sign-up stops creating organisations; no organisation switch; people join by invitation; an uninvited person is told to ask their admin.
- The worker path keeps working, now reading/writing straight to the server.
- Bundle script: voice-chunk assertion removed; baseline moves **down only**, recorded as a decision, **never re-captured to hide growth**.
- Starts the dropped list (every deleted route, package, job) that Phase 62 turns into a build guard.
- Standing: `journeys.ts` and CAPABILITY-MATRIX change in the same commit as the route/gate; a deployed eval ships (`npm run eval -- --phase 55`) and screenshots are read; plain words (no "block" in UI copy); RLS untouched; publish gate and tick-each-step never weakened; `'use server'` files export only async functions; a phase is not verified until a real `npm run build` runs clean.
- Kept (do not touch): the four on-ramps (document, AI typed brief, record video, blank), AI check + verify-before-publish, versions (new version), approval chains, owners/review dates, access wiring, assignments, training matrix, observations, my record, team/roles, the map editor (Konva `SiteEditor`).

### Claude's discretion (researched, recommendation given)
Everything in "Decisions to lock" below.

### Deferred (out of scope - ignore)
Phone layout, regenerated artwork, dropping tables, read-only SOP view, objectives with targets, Next 16.3 upgrade, the `check-bundle-size.ts` `%5BsopId%5D` blind spot (do not fix, do not worsen), refresher cadence / CSV export / departments screen / org-chart (CUT-03, Phase 62).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CUT-01 | None of the dropped worker features can be reached or is shipped: offline, voice, phone scan + QR plates, shared-device login | Sections 1.1-1.4 (inventories), 2 (surgical edits), 3 (worker rewire), 5 (bundle gate), SW kill-switch pattern |
| CUT-02 | None of the dropped authoring features can be reached: video generation, flow diagram, annotation, YouTube + photo-scan on-ramps, library pages, version compare/restore | Sections 1.5-1.11, 2 |
| ORG-01 | One organisation: no sign-up-creates-org, no switch, join by invitation | Section 4; no migration needed |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Worker assigned-SOP list, pins, Now card data | Browser (React Query over Supabase client, RLS-scoped) | API (`getUserSopAssignments` server action) | Reads already exist as client Supabase queries in `useWorkerSops`; deleting the Dexie mirror removes a tier, not adds one |
| SOP detail for walk | Browser (`useSopDetail` Supabase fallback branch) | Database (RLS `org_members_can_view_sops`) | The Dexie branch was a cache of this same query |
| Completion submit | API (`submitCompletion` server action, admin client, idempotent on client UUID) | Browser (builds payload) | Unchanged contract; only the caller changes |
| Photo capture/upload | Browser (compress + PUT) | API (`getPhotoUploadUrl` mints signed upload URL) | Replaces queue-and-flush with direct upload; same two server calls |
| Builder autosave | Browser (debounce) | API (`updateSectionLayout`, LWW check) | Dexie "dirty row" layer removed; debounce then call the action |
| Sign-up / org creation removal | API (delete `signUpOrganisation`) | Frontend Server (`/sign-up` becomes static page) | Org creation lived only in the action |
| Service-worker retirement | CDN/Static (`public/sw.js` kill-switch) | Browser (SW `activate` unregisters) | An already-installed SW is only removable by serving a replacement script |
| Dropped-list guard | Build (tsx script / Playwright source-contract) | - | Phase 62 wires the same data into `prebuild` |

## Decisions to lock (recommended defaults - confirm before execution)

| # | Decision | Recommendation | Confidence |
|---|----------|----------------|------------|
| D1 | Video scope | KEEP the video-to-SOP on-ramp (record/upload video -> transcribe -> parse). DELETE only video generation + its pipeline UI. Source: ROADMAP Phase 58/61, REQUIREMENTS WRK-01/WRK-03, MANIFEST 2026-10-02 "four on-ramps (document, AI typed, record video, blank)". The brief's list "upload TUS ... transcript routes" under video generation conflicts with this and is overridden. | HIGH [VERIFIED: ROADMAP.md] |
| D2 | `cloneSopAsDraft` | KEEP. It is the versions page "Edit into new version" button, the only way to start version N+1 without re-uploading a file; SOP-04 (Phase 58) and criterion 3 ("publishing a new version still works") depend on it. DELETE `restoreVersionAsNew` (thin wrapper), `getSopVersionForDiff`, `SopVersionPayload`, the diff page and the Compare/Restore buttons. KEEP `version-lineage.ts` and `diff-block-content.ts` (the latter is also used by `InlineProposalDiff`). The brief lists `cloneSopAsDraft` in the drop list; flag this to the user. | MEDIUM [VERIFIED: codebase for usage; ASSUMED for intent] |
| D3 | Join by invite code | KEEP `/join`, `joinWithInviteCode`, invite-code card on the team page. An admin-issued code is an invitation; removing it touches `RoleAssignmentTable`, `OrgColumnsBoard`, team page, all re-homed in Phase 59. Replace login-page "Register a new organisation" copy only. | MEDIUM [ASSUMED] |
| D4 | `/sign-up` route | KEEP the route as a static "SOPstart is by invitation - ask your admin" page (no form, no action) so existing links do not 404 before Phase 62 redirects. | HIGH |
| D5 | PWA manifest | KEEP `src/app/manifest.ts` (harmless; no in-app prompt). Delete `InstallPrompt` component only. | MEDIUM [ASSUMED] |
| D6 | Image files in document upload | KEEP image MIME types in `file-intake.ts` (JPEG/PNG/WebP/HEIC via picker). Delete only the camera "Take a photo" button, "Scan document" (`PhotoScanner`) and "Generate video SOP". `tesseract.js` and `heic2any` STAY (`/api/sops/parse` OCR fallback for scanned PDFs; HEIC conversion). | MEDIUM [VERIFIED: ocr-fallback is called at parse/route.ts:172] |
| D7 | In-progress walkthrough durability | Zustand in-memory only (completionStore loses its Dexie writes). Already true for the safety-critical `walkthrough` store (D-02: re-ack each session); the Dexie `restoreFromDexie` restored step timestamps but not `walkthrough.completedSteps`, so resume was already half-working. | HIGH [VERIFIED: stores/walkthrough.ts is memory-only] |
| D8 | Stale client state on devices | `public/sw.js` becomes a committed self-destroying kill-switch that unregisters and clears Cache Storage. Do NOT delete IndexedDB (`SopAssistantDB`, `tanstack-query`) - could hold an unsynced completion or photo; leave as harmless residue, sweep in Phase 62. | MEDIUM [ASSUMED] |
| D9 | Supabase public signup | Add a checkpoint task: disable "Allow new users to sign up" on the Supabase project (invites via `inviteUserByEmail` still work). Without it, `POST /auth/v1/signup` with the publishable key still creates auth users (they land on `/pending`, no data access, but ORG-01 says "no way to sign up"). | MEDIUM [ASSUMED - confirm setting name `disable_signup` via Management API before scripting] |
| D10 | AI model registry | Remove registry + options + label entries `voice-qa`, `sop-ask`, `voice-draft`, `stt-stream`, `tts-voice`, `tts-video` (the admin AI-settings page renders every key). KEEP `stt-batch`, `ocr-fallback`, `vision-image-describe`, parse/draft-verify/synthesis/embed. Org override rows stay in DB. | HIGH [VERIFIED: ai-settings/page.tsx iterates AI_MODELS] |

## Standard Stack

No package is added. Package Legitimacy Audit: **not applicable (nothing installed)**; slopcheck not run.

### Remove (`npm uninstall`)
| Package | Importers (all inside the delete set) | Verified |
|---------|---------------------------------------|----------|
| `dexie` | `src/lib/offline/db.ts` | [VERIFIED: grep] |
| `idb-keyval` | `lib/offline/query-persister.ts`, `components/admin/PhotoScanner.tsx` | [VERIFIED: grep] |
| `serwist` | `src/app/sw.ts` | [VERIFIED: grep] |
| `@serwist/next` | `src/app/sw.ts`, `next.config.ts` | [VERIFIED: grep] |
| `@tanstack/query-persist-client-core` | `lib/offline/query-persister.ts` | [VERIFIED: grep] |
| `jsqr` | `components/sop/plant/ScanSheet.tsx` (+ `tests/phase53/scan-sheet.spec.ts`) | [VERIFIED: grep] |
| `qrcode` | `admin/site/plate/[machineId]/page.tsx`, `admin/sops/[sopId]/qr/page.tsx` (+ specs) | [VERIFIED: grep] |
| `@types/qrcode` (dev) | none | [VERIFIED: grep] |

### Keep (looked removable, are not)
| Package | Why it stays |
|---------|--------------|
| `konva`, `react-konva` | `components/admin/site/SiteEditor.tsx` (map editor, kept). Only the annotation importers go. |
| `tesseract.js` | `lib/parsers/ocr-fallback.ts` called from `/api/sops/parse` (scanned PDFs). Only `page-order-detect.ts` (PhotoScanner) goes. |
| `@ffmpeg/core|ffmpeg|util`, `ffmpeg-static`, `scripts/copy-ffmpeg.js` postinstall | video on-ramp (`extract-video-audio.ts`, `/api/sops/transcribe`) |
| `tus-js-client` | `lib/upload/tus-upload.ts` used by UploadDropzone, VideoPreviewPanel, start-video-sop-upload |
| `openai` | `lib/parsers/extract-image.ts` (vision) after `voice/tts` and `video-gen/tts` go |
| `heic2any`, `sharp`, `voyageai`, `yet-another-react-lightbox`, `@dnd-kit/*`, `mammoth`, `unpdf`, `officeparser`, `jszip`, `@xmldom/xmldom` | kept features |

### Env vars (Railway variables, operational follow-up, not code)
Retire: `SHOTSTACK_API_KEY`, `SHOTSTACK_API_URL`, `SHOTSTACK_CALLBACK_SECRET`, `VOICE_QA_MODEL`, `VOICE_DRAFT_MODEL`, `SOP_ASK_MODEL`, `TTS_MODEL`, `VIDEO_TTS_MODEL`, `STT_STREAM_MODEL`. KEEP `DEEPGRAM_API_KEY` (batch transcription), `OPENAI_API_KEY`, `CRON_SECRET`. Update `.env.local.example` (Shotstack block, "Required for voice capture" comment on Deepgram, `NEXT_PUBLIC_MODEL_BLOCK_ENABLED` unrelated).

### Scheduled jobs
No cron/scheduler config exists in the repo (`railway.json` has only build/start; no `.github`, no `vercel.json`). [VERIFIED: codebase] Dropped "jobs" are therefore: the Shotstack completion webhook route + its middleware exemption, and `POST /api/sops/recover-renders` (manual). The one real scheduled job, `/api/agent-layer/synthesis-sweep` (CRON_SECRET), is a kept feature (agent layer). VERIFY: in the Railway dashboard confirm no cron service is calling `recover-renders` or any deleted route.

## Architecture Patterns

### Recommended wave order (strictly sequential, main tree - CLAUDE.md worktree learnings)
```
W0  dropped list + guard scaffold   scripts/dropped-features.json, tests/phase55/deletion-sweep.spec.ts (fixme-gated, final shape), playwright 'phase55' project, eval fixture extension
W1  worker-path rewire (additive)   new photo upload hook + compress move + completionStore in-memory + useSopDetail/useWorkerSops/NowCard/useBuilderAutosave rewired; build + existing evals stay green with Dexie still present
W2  delete offline + PWA            layout banners, sops/page sync, lib/offline, hooks/stores, sw.ts, next.config, packages, kill-switch sw.js
W3  delete voice, phone/QR, roster  + surgical edits in walkthrough/plant/blocks/AI registry
W4  delete authoring features       video gen + pipeline, flow, annotation, YouTube/photo-scan, library, version diff/restore
W5  ORG-01                          sign-up page, login copy, OrgSwitcher, landing page, auth actions
W6  maps, docs, tests, gate         journeys, roles, uat, capability matrix, bundle script, playwright config, spec triage, dropped list finalised
W7  push, build, eval --phase 55, baseline decision, screenshots read
```
Why W1 before W2: `lib/offline/db.ts` is imported by 15 live files (list in 3.1). Deleting first breaks the build for the whole phase. W1 must leave `lib/offline` importable but unused by the worker path; W2 then deletes with zero remaining importers (`npx tsc --noEmit` proves it).

### Method to keep the sweep honest
Derive "surviving importers of a delete set" mechanically (a ~40-line Node script walking `src/**/*.ts(x)`, resolving `@/` and relative specifiers) rather than by filename; run it at the start of each deleting wave and again after. This is how the list in Section 2 was produced, and it found items grep-by-name misses (publish-core -> video auto-queue; synthesis -> voice sop-pack). It cannot see string hrefs, config, journeys or docs - Section 9 covers those with grep.

### Anti-patterns
- Deleting a spec to make a wave green without checking whether it guards something that STAYS (e.g. `konva-worker-isolation.spec.ts` must keep guarding konva off the worker bundle; only its AnnotationEditor assertions go).
- Writing the forbidden literal in a comment, a fixture string or the guard's own data (CLAUDE.md 2026-09-28: guards grep comments). The new sweep must strip comments, exclude itself, and describe patterns in words.
- Re-capturing the bundle baseline mid-phase (CLAUDE.md 2026-09-13).
- Navigating from a mount effect while server actions are in flight (CLAUDE.md 2026-09-29, Next 16.2.1 action-queue orphan) - the rewire adds mount-time server calls; keep reads as client Supabase queries, no `router.replace` in effects.

## 1. Deletion inventory per dropped feature

Counts: delete set 114 files by feature + 18 further files that become orphaned or are already dead, total 132 files / ~18.4k lines. Paths relative to `src/` unless stated. "S" = surgical edit (see Section 2).

### 1.1 Offline (CUT-01)
- Routes/assets: `app/sw.ts`, `app/~offline/page.tsx`. `public/sw.js` is a gitignored build artifact (`.gitignore:54-56`) - see kill-switch.
- Lib: `lib/offline/{db,sync-engine,query-persister,voice-queue,draftLayouts-purge}.ts`. **MOVE (not delete)** `lib/offline/photo-compress.ts` -> `lib/photo/compress.ts` (generic canvas compressor, no imports; needed by the new direct upload).
- Hooks/stores: `hooks/{useSopSync,usePhotoQueue,useDraftLayoutSync,useOnlineStatus}.ts`, `stores/network.ts`. `hooks/useAssignedSops.ts` is deleted too (see 3.2). `stores/completionStore.ts` is EDITED not deleted (S).
- Components: `components/layout/{InstallPrompt,OnlineStatusBanner}.tsx`.
- Already-dead code that carries `QueuedPhoto`/`CachedSop` types (no live importer chain): `components/sop/WalkthroughList.tsx` -> `StepItem.tsx` -> `StepPhotoZone.tsx` -> `PhotoThumbnail.tsx`. [VERIFIED: import graph, `WalkthroughList` has zero importers] Delete all four. (`SopSectionTabs`, `StepProgress`, `SectionContent` are also importer-less; optional bonus, not needed.)
- Config: `next.config.ts` (drop `withSerwistInit`, export `nextConfig` plain; keep the `nextDynamic` cacheGroup and the redirects), `package.json` (+ lockfile), `.gitignore` lines 54-56.
- Providers: `components/providers/QueryProvider.tsx` default `networkMode: 'offlineFirst'` removed; same option removed in `hooks/useCompletions.ts` (3 places), `components/sop/plant/NowCard.tsx:45`, `app/(protected)/sops/page.tsx:197` (the whole `lastSyncMeta` query goes).
- User-visible strings to delete: "No internet - your work is saved on this device" (banner), "Offline copy - ..." / "Not saved for offline yet" (`sops/page.tsx:199-203,241`), "You are offline" page, the `{queueCount} queued` chip and "photos still uploading" `window.confirm` in `MobileWalkthrough`.
- Packages: dexie, idb-keyval (also via PhotoScanner), serwist, @serwist/next, @tanstack/query-persist-client-core.
- Specs: `tests/offline-sync.test.ts`, `tests/offline-indicator.test.ts` (sole file of the `e2e` project - delete project), repoint `tests/phase26/autosave-rewire.spec.ts`, `tests/phase52/plant-pins-no-storage.spec.ts`, `tests/phase41/merged-surface.spec.ts`, `tests/phase30/plain-language.spec.ts`; VERIFY `tests/sb-builder-infrastructure.test.ts`, `tests/sb-layout-editor.test.ts`, `tests/phase46/sop-edit-guard-wiring.spec.ts`.
- journeys: journey `offline-use`; UAT: none specific.

### 1.2 Voice (CUT-01)
- Lib: `lib/voice/*` (deepgram-stream, extract-keyterms, intent-classifier, media-recorder, tts-constants, voice-qa, sop-pack + 4 `__tests__`) - EXCEPT `sop-pack.ts` which is imported by `lib/agent-layer/synthesis.ts:30`: MOVE to `lib/agent-layer/sop-pack.ts` (S, keep its byte-identity comment/test). `lib/validators/{voice-query,voice-tts}.ts`.
- Components: `components/sop/voice/{ReadAloudButton,useTtsPlayback,WalkthroughVoiceButton,WalkthroughVoiceModal}`, `components/sop/VoiceCaptureControl.tsx`, `hooks/useDeepgramWebSocket.ts`.
- API: `app/api/voice/{query,token,tts}/route.ts`, `app/api/sops/voice-draft/route.ts`, `app/api/sops/[sopId]/ask/route.ts` (zero callers - already dead; it is the text half of Q&A).
- Actions: `actions/voice-notes.ts` (`saveVoiceNote`; callers are VoiceNoteBlock/MeasurementBlock only).
- Admin: `admin/sops/new/ai/VoiceDraftClient.tsx`; `AiDraftFork.tsx` is S (becomes: render `PromptClient` directly; delete the type/voice fork modal and `?mode=` handling; keep `PICKER_ROUTE` back link).
- S: `WalkthroughSwitcher`, `MobileWalkthrough` (drop `forwardRef`, `MobileWalkthroughHandle`, `onVoiceStateChange`, `useImperativeHandle`), `ImmersiveStepCard` + `DesktopWalkthrough` (`ReadAloudButton`), `PlantAskBar` (mic, `WalkthroughVoiceModal`, `voiceSopId` prop) + `PlantHome` (`voiceSopId` derivation and unused `plantRelState` import), `MeasurementBlock` + `VoiceNoteBlock` (strip capture control and `saveVoiceNote`; keep schemas, props and a static render), `lib/parsers/verify-sop.ts` (`voice_qa` mode, `VOICE_QA_VERIFY_*`), `lib/ai/{registry,model-options}.ts` (D10), builder inserter (`inserter-model.ts:40` 'Data capture' list and `builder/AddMenu.tsx:70` entry for VoiceNoteBlock - new voice notes can no longer be added), `types/sop.ts` (`VoiceQueryResponse` and neighbours), `lib/agent-layer/signals.ts` (optional: leave `readVoiceSignals` reading `sop_voice_qa_log`; rows stay, signal is simply empty).
- KEEP: block type VoiceNoteBlock in `block-registry.tsx`, `introspection.ts`, `validators/blocks.ts` (`VoiceNoteBlockContentSchema`), `puck-to-block-content.ts`, `parsed-sop-to-layout-data.ts:412,582,712` - required by `scripts/contract-check.ts` and by old layout_data; `--accent-voice` token; `voiceEnabled` prop in MeasurementBlock schema (data); `sop_voice_notes`, `sop_voice_qa_log`, bucket `sop-voice-notes` rows; `lib/parsers/transcribe-audio.ts` + `stt-batch` + `DEEPGRAM_API_KEY`.
- Specs: delete `src/lib/voice/__tests__/*` (move sop-pack test), `tests/phase22/{intent-classifier,stt-keyterms,tts-route,voice-modal,voice-safety-gate}.spec.ts`, `tests/integration/{voice-qa-happy-path,voice-grounding-scope}.spec.ts`, `tests/phase26.5/voice-qa-persistence.spec.ts`, `tests/sb-ux-voice.test.ts`, `tests/fixtures/anthropic-voice-mock.ts`; repoint `tests/phase52/plant-ask-bar.spec.ts` (keep the search assertions, delete the mic/modal ones), `tests/lint/no-static-desktop-import.spec.ts` (delete the WalkthroughVoiceModal test + PlantAskBar allowance), `tests/integration/desktop-walkthrough-layout.spec.ts`, `tests/phase26.5/signal-readers.spec.ts`, `src/lib/ai-fields/__tests__/registry.test.ts`, `tests/e2e/sub-trade-assignment.spec.ts` (VERIFY why it matches 'voice-qa').
- Playwright projects: `phase15-unit` (testDir `src/lib/voice/__tests__`) deleted; remove `voice-qa-happy-path|voice-grounding-scope` from the `phase15-stubs` regex; `phase12.5-stubs` regex loses `voice`.
- journeys: `create-with-voice` + `fork` step; UAT: none. `lib/journeys/journeys.ts:160` phone-home text mentions the mic.

### 1.3 Phone scan + QR plates (CUT-01)
- Routes: `app/(protected)/m/[code]/page.tsx`, `admin/site/plate/[machineId]/{page,PrintButton}.tsx`, `admin/sops/[sopId]/qr/{page,PrintButton}.tsx`.
- Components: `components/sop/plant/{PhoneHome,ScanSheet,MachineListSheet,MachineView}.tsx`; `lib/site/qr-decode.ts`.
- S: `app/(protected)/sops/page.tsx` (`wantsPhone`, `phoneSite`, lazy `PhoneHome`, `phone` prop at 296-401, toolbar condition `!phoneSite`), `components/admin/site/SiteWorkspace.tsx:342` ("Print plate" link + its `site-machine-print-plate` testid), `BuilderStageShell.tsx:98` (QR menu item), `NowCard.tsx` (the `inline` phone variant and `Read` link branch can go; optional), `hooks/useWorkerSops.ts` comment.
- KEEP: `site_machines.code` column (NOT NULL unique, check constraint) and `newMachineCode()` generation in `actions/site.ts:354` - the code is now inert data; `lib/auth/next-redirect.ts` + `?next=` login round-trip (generic, `tests/phase53/login-next-redirect.spec.ts` stays); `useViewport` (still selects walkthrough variant and plant home).
- Packages: jsqr, qrcode, @types/qrcode.
- Specs: delete all of `tests/phase53/*` except `login-next-redirect.spec.ts`; delete the `phase53` regex comment block lines about deleted files; delete `tests/evals/phone-home.eval.ts`; repoint `tests/phase52/plant-render-seam.spec.ts` (mentions MachineView), `tests/phase41/merged-surface.spec.ts`, `tests/phase30/list-rows.spec.ts` (VERIFY), `tests/lint/design-tokens.spec.ts` (allowlist entry for the qr page - VERIFY it does not assert allowlist entries exist).
- journeys: `machine-qr`, steps `machine`/`phone`/`scan` in `find-follow-sop`, `plate` step (journeys.ts:656). CAPABILITY-MATRIX row "Print a machine plate (QR)".

### 1.4 Shared-device login (CUT-01)
- Delete: `app/(auth)/login/roster/page.tsx`, `app/api/roster/route.ts`, `components/auth/RosterSelector.tsx`.
- S: `activity/[completionId]/CompletionDetailClient.tsx:13-14,147` (drop `ROSTER_STORAGE_KEY`/sessionStorage read; supervisor counter-sign uses the signed-in user id), `actions/completions.ts:35-52,69` (drop `rosterWorkerId` handling; insert `roster_worker_id` omitted), `lib/validators/completions.ts:62` (`rosterWorkerId`); KEEP `recordSignature` and `rosterUserId` in `RecordSignatureSchema` (counter-sign still works; DB column `roster_user_id`/`roster_worker_id` stay).
- Specs: delete `tests/phase23/completion-roster.spec.ts`. journeys: `roster-login`; UAT: `p23-roster-login` (tests.ts:388-410). `lib/journeys/roles.ts` unaffected.

### 1.5 Video generation + its pipeline (CUT-02)
- API: `app/api/sops/generate-video/{route,callback/route,finalize/route}.ts`, `app/api/sops/recover-renders/route.ts`, `app/api/videos/[jobId]/stream/route.ts`, `app/api/sops/pipeline/[pipelineId]/snapshot/route.ts`.
- Routes: `admin/sops/[sopId]/video/page.tsx`, `admin/sops/pipeline/[pipelineId]/{page,PipelineProgressClient}.tsx`.
- Lib/actions/hooks: `lib/video-gen/*` (9 files + `__tests__/finalize-job.test.ts`), `actions/video.ts`, `hooks/useVideoGeneration.ts`.
- Components: `components/admin/Video{AdminPreview,FormatSelectionModal,GeneratePanel,GenerationStatus,JobIndicator,OutdatedBanner,VersionList,VersionRow}.tsx`, `components/sop/VideoTabPanel.tsx`.
- S: `lib/governance/publish-core.ts:3,238-247` (remove `enqueueVideoGenerationForPipeline` call; the returned `pipelineAutoQueued` field and its consumers in `api/sops/[sopId]/publish/route.ts` - the publish gate and everything else untouched), `actions/sops.ts:379-515` (`createVideoSopPipelineSession`, plus `createVideoSopPipelineSessionSchema` in `lib/validators/sop.ts`), `components/admin/UploadDropzone.tsx` ("Generate video SOP" button ~570-577, `VideoFormatSelectionModal` import + render ~741), `components/admin/ParseJobStatus.tsx` (pipeline mode: `pipelineId` props, `fetchPipelineSnapshot`, realtime channel on `sop_pipeline_runs`/`video_generation_jobs`, `derivePipelineStage`, `'video_generation'` active set) and `lib/admin/job-stages.ts` (pipeline snapshot + stage derivation), `AdminPageShell.tsx` comments, builder menu item at `BuilderStageShell.tsx:97` (`Make a training video`), `admin/sops/[sopId]/assign/page.tsx:232` and `versions/page.tsx:354` (links to `/video`), `lib/supabase/middleware.ts:41` (`isShotstackCallback`), `tests/phase40/dup03/dup04/parse-status-*` (pipeline props - VERIFY each), `lib/ai/registry.ts` `tts-video`.
- KEEP (video on-ramp): `VideoRecorder`, `VideoPreviewPanel`, `VideoReviewPanel` (also renders existing YouTube-sourced SOPs in the source viewer), `source-viewer/VideoSourcePreview`, `TusUploadProgress`, `lib/upload/{tus-upload,start-video-sop-upload,file-intake}.ts`, `lib/parsers/{extract-video-audio,transcribe-audio}.ts`, `api/sops/transcribe`, `createVideoUploadSession` in `actions/sops.ts`.
- DB rows stay: `video_generation_jobs`, `sop_pipeline_runs`, `parse_jobs.pipeline_run_id`, bucket `sop-generated-videos`.
- Specs: delete `tests/{video-gen-slideshow,video-gen-scroll,video-chapters,video-admin-preview,video-player,video-completion,sw-video-exclusion,video-version-management,pipeline-entry,pipeline-linkage,pipeline-autoqueue,pipeline-progress,pipeline-failure-recovery,pipeline-review-gate}.test.ts`; `src/lib/video-gen/__tests__` and project `video-gen-unit`; projects `phase8-stubs`, `phase9-stubs`, `phase10-stubs`; `phase6-stubs` keeps `video-upload|transcript-review|publish-gate|safety-warning|stage-progress` (VERIFY they still pass) and loses `youtube-*`. Repoint `tests/phase26/verify-gate.spec.ts` (mentions auto-queue), `tests/sb-builder-infrastructure.test.ts`, `tests/phase40/dup01-file-intake.spec.ts` (VideoFormatSelectionModal), `tests/phase30/list-rows.spec.ts` (VideoJobIndicator).
- journeys: `generate-video`, `pipe` step in `create-from-document` (journeys.ts:366). Capability matrix row "Create SOP" text lists "AI-voice/wizard/video" - edit.

### 1.6 Flow diagram (CUT-02)
- Delete: `components/sop/flow/FlowGraphCanvas.tsx` (+ `__tests__/flow-graph-canvas.spec.ts`), `components/sop/tabs/FlowTab.tsx`, `lib/sop/flow-graph.ts` (+ `__tests__/flow-graph-derivation.test.ts`), `lib/validators/flow-graph.ts` (+ `__tests__/flow-graph-schema.spec.ts`), `actions/flow-graph.ts`, `lib/builder/flow-graph-field.tsx`, `admin/sops/builder/[sopId]/{BuilderFlowButton,BuilderFlowEditButton}.tsx`.
- S: `components/sop/tabs/index.ts` (barrel export), `app/(protected)/sops/[sopId]/page.tsx` (`FlowTab` import, `hideFlow`, `active === 'flow'`), `components/sop/SopTabNav.tsx` (`SOP_TABS`, `TAB_DEFS`, `hideFlow` prop; add `flow: 'read'` to `LEGACY_TAB_MAP` so old `?tab=flow` links land on Read), `BuilderStageShell.tsx:41-42,144-145`.
- KEEP: `sops.flow_graph` column and `types/sop.ts:73` optional field (data); `ArrayFieldEditor` comment mentions `nextStepId` (Decision block data, keep).
- Specs: delete the four flow specs above, `tests/lint/no-preview-pill.spec.ts` (subject is the flow components) and drop `phase24-stubs`/`phase24-unit` projects; repoint `tests/phase33/wayfinder-header.spec.ts`, `tests/phase51/builder-machines-row.spec.ts` (mention BuilderFlowButton as the shell-copy source), `tests/phase26.5/agent-dashboard.spec.ts`, `tests/lint/design-tokens.spec.ts` allowlist, `tests/evals/sop-detail.eval.ts:90-95` (test "admin keeps the preview toggle and the Flow tab" -> assert admin has NO Flow tab).
- journeys: Flow steps in `find-follow-sop`.

### 1.7 Image annotation (CUT-02)
- Delete: `components/admin/builder-v2/visual/{AnnotationEditor,AnnotationEditorLoader,DiagramAnnotateModal,DiagramHotspotBlock,annotation-tools,bake-on-publish}.ts(x)`, `actions/annotations.ts`, `lib/builder/baked-path.ts`. (`bake-on-publish` has no importer today - already dead.)
- S: `visual/MediaGrid.tsx` (annotate button at ~123, `annotatingIndex`, `applyAnnotation`, `DiagramAnnotateModal` render ~193-198). KEEP `VisualBlock.tsx` and `media-adapter.ts` including `bakedSrc` + `annotationId` fields - existing SOPs with baked PNGs must still display (criterion 5). DB: `sop_image_annotations` rows + baked storage objects stay.
- Konva stays (SiteEditor). `next.config.ts` comment on `canvas` external still valid.
- Specs: delete `tests/phase26/{annotation-primitives,bake-on-publish}.spec.ts`, `tests/sb-image-annotation.test.ts`; repoint `tests/phase26/konva-worker-isolation.spec.ts` (keep konva-off-worker assertions, remove AnnotationEditor/Loader assertions at lines ~5,18,119-135), `tests/lint/design-tokens.spec.ts:34`, `tests/sb-layout-editor.test.ts`.
- uat: `p26-annotation-editor-feel`, `p26-baked-annotation-on-worker-read` (tests.ts:465, 519; `p26-edit-worker-parity` VERIFY).

### 1.8 YouTube on-ramp (CUT-02)
- Delete: `app/api/sops/youtube/route.ts`, `lib/parsers/fetch-youtube-transcript.ts`.
- S: `UploadDropzone.tsx` (mode `'youtube'`, state at 80-83, handler ~163-215, tab at 394-402, panel 418-451, `termsChecked` if only YouTube uses it - VERIFY). `lib/ai/...` none. KEEP `youtube` as a `source_type` value and `VideoReviewPanel`'s embed for existing rows.
- Specs: delete `tests/{youtube-url,youtube-no-captions}.test.ts`; repoint `tests/integration/scp-ai-reviewer.test.ts` (reads youtube route), `tests/phase40/{dat01-category-column,route-auth-org-scope}.spec.ts` (list the route among category/guard-covered routes).

### 1.9 Photo-scan on-ramp (CUT-02)
- Delete: `components/admin/PhotoScanner.tsx`, `components/admin/ImageQualityOverlay.tsx`, `lib/image/{quality-checks,page-order-detect}.ts` (orphaned by PhotoScanner).
- S: `UploadDropzone.tsx` ("Take a photo" ~541-549, "Scan document" ~553, `scannerOpen`, `PhotoScanner` render 709-720).
- Specs: `tests/phase43/dead-controls.spec.ts` (PhotoScanner), `tests/evals/dead-surface.eval.ts` test B (delete). `tesseract.js` stays (D6).

### 1.10 Reusable-content library (CUT-02)
- Routes: `app/(protected)/admin/blocks/{page.tsx,new/{page,NewBlockForm}.tsx,[blockId]/{page,BlockEditorClient}.tsx}`; header link `components/layout/TopHeader.tsx:148` ("Content"); `lib/journeys/roles.ts:185` surface row.
- Components: `components/admin/blocks/*` (8 files), `components/admin/builder-v2/inserter/ReuseTier.tsx`, `components/sop/blocks/BlockOverflowMenu.tsx` (already importer-less; carries `SaveToLibraryModal`), `lib/builder/match-blocks.ts` (+ `match-blocks.test.ts`), `lib/blocks/block-kinds.ts` (orphaned).
- Actions: delete `actions/blocks.ts` entirely - every export is used only by the library pages/pickers [VERIFIED: caller map]. In `actions/sop-section-blocks.ts` delete `addBlockToSection` (callers: WizardClient, ReuseTier only), `setPinMode`, `acceptBlockUpdate`, `declineBlockUpdate`, `listSectionBlocksWithUpdates`, and the zero-caller `removeBlockFromSection`/`listSectionBlocks`/`reorderSectionBlocks`; drop the `getBlock` import (line 35). KEEP `verifyBlock`, `unverifyBlock`, `getPublishGateStatus` (verify-checklist + publish gate).
- KEEP (data plumbing): `lib/blocks/create-block-core.ts`, `lib/builder/section-blocks-core.ts` (parser creates block rows + junctions on every parse; verify checklist reads `sop_section_blocks`), tables `blocks`, `block_versions`, `sop_section_blocks` and their `snapshot_content` - "SOPs that used library content still show it" (Phase 56 SOP-02).
- S: `EditableDocument.tsx:50,354,538` (Reuse tier state + render, `listSectionBlocksWithUpdates` fetch), `BlockEditShell.tsx:12,392` (`PuckItemBadgeOverlay` -> delete the file `components/sop/blocks/PuckItemBadgeOverlay.tsx` and its call), `InserterMenu.tsx` (`onOpenReuse` row hidden-if-omitted - simply stop passing it; delete the prop if unused), `builder-v2/inserter/inserter-model.ts:44` comment, `WizardClient.tsx` (BlockPicker import/overlay/`pickerTarget`/`addBlockToSection` loop ~138-240, 528-545; wizard stays as "start blank" until Phase 61), `types/sop.ts:364` (update-available types - consumers go; delete if unused), `actions/sop-section-blocks.ts` header comments.
- Specs: delete `tests/phase43/new-block.spec.ts`, `tests/sb-block-library.test.ts` (VERIFY), `src/lib/builder/match-blocks.test.ts`; repoint `tests/phase26/inserter.spec.ts` (BlockPicker), `tests/phase40/dat01-category-column.spec.ts`, `src/lib/parsers/__tests__/parser-creates-junctions.test.ts` (asserts parser does not import `@/actions/blocks` - still true; check the `createBlock` string assertions), `tests/integration/scp-parse-pipeline.test.ts`, `tests/phase30/admin-nav.spec.ts` (header links list), `tests/lint/no-dead-internal-hrefs.spec.ts` (fixme test about `/admin/blocks/new` reserved segment - delete), `tests/phase46/capability-matrix-doc.spec.ts:92` (asserts 'Manage blocks library' present - repoint to absent), `tests/evals/dead-surface.eval.ts` test A. Playwright: `phase11-stubs` regex still lists `sb-block-library`.
- journeys: `reusable-blocks` journey (journeys.ts:543-560), `blocks` step at 328. CAPABILITY-MATRIX row "Manage blocks library".

### 1.11 Version compare / restore (CUT-02)
- Delete: `app/(protected)/admin/sops/[sopId]/versions/diff/page.tsx`; in `actions/versioning.ts` delete `restoreVersionAsNew`, `getSopVersionForDiff`, `SopVersionPayload` (the rest stays; D2).
- S: `versions/page.tsx` (imports, restore state `restoringVersionId`/`showRestoreConfirmFor`, Compare link at 543, the `/video` link at 354, `restoreVersionAsNew` handler ~324). KEEP "Edit into new version" (`cloneSopAsDraft`), Upload new version, refresher control (CUT-03/Phase 62), approval history, per-version breakdown.
- Specs: repoint `src/lib/builder/__tests__/clone-restore.test.ts` (delete the `restoreVersionAsNew` source-contract tests, keep `computeNextVersionLineage` ones), `tests/phase23/version-supersede.spec.ts`, `tests/phase29/{version-history-approvals,phase-gate}.spec.ts` (VERIFY), `tests/phase36/version-breakdown-panel.spec.ts` (VERIFY - reads the versions page).
- journeys: `version-supersede` (`restore`, `diff` steps; keep `clone`). CAPABILITY-MATRIX row "Version history" text.

### 1.12 Route/API summary for the dropped list
Pages: `/login/roster`, `/m/[code]`, `/admin/site/plate/[machineId]`, `/admin/sops/[sopId]/qr`, `/admin/sops/[sopId]/video`, `/admin/sops/[sopId]/versions/diff`, `/admin/sops/pipeline/[pipelineId]`, `/admin/blocks`, `/admin/blocks/new`, `/admin/blocks/[blockId]`, `/~offline`. Static-ified: `/sign-up`.
API: `/api/voice/query`, `/api/voice/token`, `/api/voice/tts`, `/api/roster`, `/api/sops/voice-draft`, `/api/sops/[sopId]/ask`, `/api/sops/youtube`, `/api/sops/generate-video`, `/api/sops/generate-video/callback`, `/api/sops/generate-video/finalize`, `/api/sops/recover-renders`, `/api/videos/[jobId]/stream`, `/api/sops/pipeline/[pipelineId]/snapshot`.
Kept API that look related: `/api/sops/transcribe`, `/api/sops/parse`, `/api/sops/ai-prompt`, `/api/sops/restructure`, `/api/sops/[sopId]/{publish,parse-job,download-url,source-url,...}`, `/api/agent-layer/synthesis-sweep`, `/api/version`, `/api/schema`.

## 2. Surgical edits - shared modules (consolidated checklist)

Produced by the surviving-importer analysis; each line is a kept file that imports something being deleted. [VERIFIED: import graph]

| Kept file | What changes |
|-----------|--------------|
| `app/(protected)/layout.tsx:6-7,26-27` | remove `OnlineStatusBanner`, `InstallPrompt` |
| `app/(protected)/sops/page.tsx` | remove `useSopSync`, `useAssignedSops` (use new derivation, 3.2), `db` + `lastSyncMeta`/`lastSyncLabel`/`getRelativeTime`, `PhoneHome` lazy + `wantsPhone`/`phoneSite`/`phone` prop; `invalidateQueries(['assigned-sops'])` -> `['user-sop-assignments']`. Subtractive only (bundle gate). |
| `hooks/useWorkerSops.ts` | derive assigned set from `librarySops` + `assignments`; `raw` typed from `Sop` not `CachedSop` |
| `hooks/useSopDetail.ts` | delete Dexie branch (lines 11-35), keep the Supabase query |
| `hooks/useBuilderAutosave.ts` + `admin/sops/builder/[sopId]/BuilderClient.tsx` | direct `updateSectionLayout` after 750 ms debounce; replace Dexie "synced rows" SAVED pill with local `lastSavedAt` state; drop `useDraftLayoutSync`, `useNetworkStore`, `db`, the "Updated by another admin" toast source (`server_newer` result now returned directly) |
| `stores/completionStore.ts` | remove `db` writes + `restoreFromDexie`; `LocalCompletion` type moves into the store file |
| `components/sop/walkthrough/{MobileWalkthrough,DesktopWalkthrough,ImmersiveStepCard,WalkthroughSwitcher}.tsx` | voice bridge out; Dexie/photo-queue -> direct upload hook (3.3); `restoreFromDexie` effects out; ImmersiveStepCard `removePhoto` import + `QueuedPhoto` type |
| `components/sop/plant/{NowCard,PlantAskBar,PlantHome}.tsx` | `sopMinutes` via Supabase (3.4); mic removed; `voiceSopId` removed |
| `lib/sop/worker-signal.ts:15` | `import type { CachedSop }` -> `Sop` (or a `Pick`) |
| `components/sop/SopLibraryCard.tsx:4` | `CachedSop` -> `Sop` |
| `components/providers/QueryProvider.tsx`, `hooks/useCompletions.ts` | drop `networkMode: 'offlineFirst'` |
| `components/admin/UploadDropzone.tsx` | remove YouTube tab+state+handler, "Take a photo", "Scan document", "Generate video SOP", the two modals/overlays; KEEP upload + record-video tab + browse video |
| `components/admin/ParseJobStatus.tsx`, `lib/admin/job-stages.ts` | remove pipeline (video-generation) mode |
| `lib/governance/publish-core.ts` + `api/sops/[sopId]/publish/route.ts` | remove video auto-queue call and `pipelineAutoQueued` |
| `lib/agent-layer/synthesis.ts` | import `packSopForPrompt` from new path |
| `lib/parsers/verify-sop.ts` | remove `voice_qa` mode |
| `lib/ai/{registry,model-options}.ts` | D10 |
| `components/sop/blocks/{MeasurementBlock,VoiceNoteBlock}.tsx` | strip capture; keep schemas |
| `components/admin/builder-v2/{EditableDocument,BlockEditShell}.tsx`, `visual/MediaGrid.tsx`, `inserter/*`, `builder/AddMenu.tsx` | Reuse tier, update badge, annotate, VoiceNote insert entry |
| `admin/sops/builder/[sopId]/BuilderStageShell.tsx` | remove Flow x2 imports/rows, video + QR menu items |
| `admin/sops/new/blank/WizardClient.tsx` | remove BlockPicker + library picks |
| `admin/sops/new/ai/AiDraftFork.tsx` | collapse to typed brief |
| `admin/sops/[sopId]/versions/page.tsx`, `assign/page.tsx` | remove restore/compare/`/video` links |
| `components/layout/TopHeader.tsx:148` | remove "Content" link |
| `components/admin/site/SiteWorkspace.tsx:342` | remove "Print plate" |
| `app/(protected)/sops/[sopId]/page.tsx`, `components/sop/{SopTabNav.tsx,tabs/index.ts}` | Flow tab |
| `app/(protected)/profile/page.tsx` | remove `OrgSwitcher` |
| `app/(auth)/sign-up/page.tsx`, `components/auth/LoginForm.tsx:88-93`, `app/page.tsx:15-21`, `components/auth/JoinByCodeForm.tsx:76` | ORG copy/links (Section 4) |
| `actions/{auth,completions,versioning,sops,sop-section-blocks}.ts`, `lib/validators/{auth,completions,sop}.ts` | delete the named exports; every remaining export of a `'use server'` file must stay `async` |
| `lib/supabase/middleware.ts:41` | remove `isShotstackCallback` (and from `isPublicRoute`); keep cron + version + schema exemptions; keep `/sign-up` and `/join` in `isAuthRoute` |
| `next.config.ts` | drop Serwist; refresh the `nextDynamic` comment ("offline-db vendors chunk" no longer exists); keep the cacheGroup |
| `scripts/check-bundle-size.ts` | Section 5 |
| `playwright.config.ts` | Section 7 |
| `lib/journeys/{journeys,roles}.ts`, `lib/uat/tests.ts` | Section 9 |

## 3. Worker path rewire (Dexie -> server)

### 3.1 Current flow (as read)
1. `/sops` mounts `useSopSync()` -> `syncAssignedSops(supabase)`: reads `sop_assignments` (+ nested `sops(id,version,updated_at)`), then `sops` with full `sop_sections(sop_steps, sop_images)` for stale ids, writes Dexie `sops/sections/steps/images`, deletes orphans. Debounce 30 s; on mount, online, visibility.
2. `useAssignedSops()` = `db.sops.where('status').equals('published')` (+ category/search filter, title sort) with a persisted React Query cache (`queryPersister` over idb-keyval, staleTime 5 min). After each sync `invalidateQueries(['assigned-sops'])` (the 2026-09-29 first-sync fix).
3. `useWorkerSops(assignedSops)` ALSO already loads `user-sop-assignments` (server action `getUserSopAssignments`, explicit `user_id`/role filter), `library-sops` (all published SOP rows via Supabase client: id,title,sop_number,category_slug,department,published_at), `worker-last-completions`, `sop-refresher-intervals`. It joins them into `WorkerSop[]` with `raw: CachedSop`.
4. Plant home (`PlantHome`): pins from `derivePlantPins(machines, links, sopsById)`, Now card from `pickNowQueue`; `NowCard.sopMinutes` reads Dexie `sections`/`steps`.
5. Walk: `useSopDetail` tries Dexie first, falls back to a Supabase query (with `section_kind` join). `MobileWalkthrough`/`DesktopWalkthrough` use `completionStore` (Zustand + Dexie `completions`), `walkthrough` store (memory), `usePhotoQueue` (Dexie `photoQueue`, 2 s polling), `flushPhotoQueue` on `online`, then `submitCompletion` with `photoStoragePaths` from the queue; `upsertWalkthroughProgress` is already a server action.
6. Admin builder: `useBuilderAutosave` writes `draftLayouts` (dirty) -> `useDraftLayoutSync` flushes via `updateSectionLayout` every 3 s; SAVED pill polls Dexie.
Live importers of `lib/offline/db`: BuilderClient, sops/page, PhotoThumbnail, NowCard, SopLibraryCard, StepItem, StepPhotoZone, VoiceCaptureControl, DesktopWalkthrough, ImmersiveStepCard, MobileWalkthrough, WalkthroughList, useAssignedSops, useBuilderAutosave, usePhotoQueue, useSopDetail, useWorkerSops, worker-signal, completionStore (the dead/voice ones disappear on their own). [VERIFIED: grep]

### 3.2 Recommended minimal rewire
- **Delete `useAssignedSops` entirely.** `useWorkerSops` already holds everything needed: assigned SOPs = `librarySops` whose id is in `assignments`; the rest are the library rows. `SopLibraryCard`, the scope filters and `matchesQuery` read only `id,title,sop_number,category_slug,department,published_at` - all in `LibrarySop`. Build `workerSops` as `[...librarySops.filter(assigned) sorted by title, ...librarySops.filter(!assigned)]`; `raw` becomes `LibrarySop` (widen `WorkerSop.raw` to that shape or `Pick<Sop, ...>`). Behaviour note: previously an admin's Dexie sync (`sop_assignments` with no user filter + the admin FOR ALL policy) cached every assignment in the org; the new path uses `getUserSopAssignments` (explicit user/role filter) so "All yours" is correctly the caller's own. [VERIFIED: `00007_sop_assignments.sql` policies]
- The persisted-cache bug of 2026-09-29 disappears with the persister (no Dexie write to race, no persisted `[]`). Keep the `invalidateQueries(['user-sop-assignments'])` calls in `handleAdd`/`handleRemove`.
- `sops/page.tsx`: `isLoading` for the section = `libraryLoading` (+ assignments loading); no sync hook.
- `useSopDetail`: delete lines 11-35 (Dexie branch); keep the Supabase `sops` select with `section_kind` join; drop the "No persister" comments; `staleTime` can stay.
- `NowCard.sopMinutes`: `supabase.from('sop_sections').select('sop_steps(time_estimate_minutes)').eq('sop_id', id)`, sum client-side; same query key, drop `networkMode`.
- Reads stay client Supabase queries / existing actions (no new server actions) - avoids adding to the Next 16.2.1 server-action queue exposure.

### 3.3 Photo path and completion (walk)
- New hook `hooks/useStepPhotos.ts` (or inline state): per-walkthrough `completionId = crypto.randomUUID()` held in `completionStore` (this is the existing idempotency key and the storage path segment). `addPhoto(stepId, file)`: `compressPhoto(file)` (moved module) -> `getPhotoUploadUrl({ localId, contentType: 'image/jpeg', orgId: '', completionLocalId: completionId })` (server action, already derives org from session) -> `fetch(url, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } })` -> store `{ localId, stepId, storagePath: result.path, contentType, previewUrl: URL.createObjectURL(blob), status }` in component/Zustand state. This is the exact two-call sequence `flushPhotoQueue` performed (`sync-engine.ts` ~172-199), minus Dexie.
- UI state is `'uploading' | 'uploaded' | 'error'` (no "queued"); `ImmersiveStepCard` shows a spinner then a check; photo gate (`photoGateMet`) = at least one `uploaded` photo for the step; submit disabled while any `uploading`; remove = drop from the in-memory list (storage object orphan is harmless; bucket policy unchanged).
- Submit (`MobileWalkthrough.handleSubmit`): same `submitCompletion({ localId, sopId, sopVersion, contentHash, stepData, photoStoragePaths, stepAckTrace })`; remove the Dexie reads/updates (`db.photoQueue...`, `db.completions.update(... 'submitted'/'in_progress')`) and the "photos still uploading" `confirm`. `stepData` = `completionStore` in-memory `stepCompletions`.
- `completionStore` keeps: `startCompletion`, `markStepCompleted`, `getActiveCompletion`, `clearCompletion` (state only). Delete `restoreFromDexie` and the two `useEffect`s that call it.
- Server contract is unchanged: `submitCompletion` (admin client insert, 23505 = idempotent success, photo rows non-fatal), `signOffCompletion`, `getPhotoUploadUrl` (bucket `completion-photos`, path `{org}/completions/{completionId}/{localId}.jpg`). [VERIFIED: actions/completions.ts]
- PRE-EXISTING GAP (do not fix here, do not claim): `DesktopWalkthrough` (>=1024 px) has **no photo capture at all** (`photoStoragePaths: []`, no `photo_required` handling) while `MobileWalkthrough`/`ImmersiveStepCard` gate on photos. Success criterion 1 ("takes a photo on a step that asks for one") is therefore only testable at a phone-width viewport. The eval must walk at 390 px. Phase 58 replaces the walk screen. Flag to the user.

### 3.4 Admin builder autosave
`useBuilderAutosave(sectionId, sopId)` keeps its signature (EditableDocument's `handleChange`). New body: debounce 750 ms, then `updateSectionLayout({ sectionId, layoutData: data, layoutVersion: CURRENT_LAYOUT_VERSION, clientUpdatedAt: Date.now() })`; expose `{ saving, lastSavedAt, error }` via a tiny store or return value so `BuilderClient`'s SAVED pill (lines 187-195) reads it instead of polling Dexie; a `server_newer` result sets the existing "Updated by another admin" toast. Keep a `beforeunload`/visibility flush so a pending debounce is not lost. `updateSectionLayout` already does the LWW check and 128 KB cap.

## 4. One organisation (ORG-01)

Current: `/sign-up` renders `OrgSignUpForm` -> `signUpOrganisation` (admin client: insert `organisations`, `auth.admin.createUser(email_confirm: true)`, insert admin `organisation_members`, rollback on failure). `LoginForm` and `app/page.tsx` and `JoinByCodeForm` link to `/sign-up`. `OrgSwitcher` on `/profile` -> `getUserMemberships` + `switchOrganisation` (writes `user_metadata.active_org_id`, refreshes session). Invite: admin `inviteWorker` -> `inviteUserByEmail` -> `/invite/accept` -> `acceptInvite`. `joinWithInviteCode` adds a worker membership for an already-signed-in user. `/pending` already says "Ask your admin if you have access issues."

Changes:
1. `app/(auth)/sign-up/page.tsx`: static content - heading "SOPstart is by invitation", "Ask your admin to invite you. Already invited? Open the link in your invitation email.", links to `/login` and `/join`. No form, no server action, no `'use client'`.
2. Delete `components/auth/OrgSignUpForm.tsx`; in `actions/auth.ts` delete `signUpOrganisation`, `switchOrganisation`, `getUserMemberships`, `UserMembership`; in `lib/validators/auth.ts` delete `orgSignUpSchema` + `OrgSignUpInput` (keep invite/login/role schemas). Delete `components/profile/OrgSwitcher.tsx`; remove it from `profile/page.tsx` (comment in `ObservationsSection.tsx`, `tests/phase34/worker-observation-visibility.spec.ts` mention it - VERIFY the spec does not read the profile page for `<OrgSwitcher />`).
3. `LoginForm.tsx:88-93`: replace "Need an account? Register a new organisation" with "Need an account? Ask your admin for an invitation."; `login/page.tsx` `registered=1` success banner is now unreachable - delete the banner and the `registered` search param. `app/page.tsx`: remove the "Sign Up" button. `JoinByCodeForm.tsx:76`: remove the sign-up link (D3 keeps `/join`).
4. `lib/journeys/roles.ts:99`: "the first sign-up becomes admin" - reword (admin is created by Potenco/invitation). journeys `sign-up` journey rewritten (route `/sign-up` stays real).
5. **Database: no change.** No trigger/RPC creates orgs; `getSessionContext` already resolves a single membership; the access-token hook (`00017`) falls back to the first membership when `active_org_id` is absent. Existing stale `active_org_id` metadata is harmless. The planner must NOT add a `supabase db push` task for ORG-01. [VERIFIED: migrations grep; 00017 read]
6. Checkpoint (D9): disable Supabase Auth public signups so `POST /auth/v1/signup` cannot create stray auth users; document in the plan as a manual or Management-API step with a before/after probe (an anonymous `signUp` returns a "signups not allowed" error). Confirm the exact flag name first. [ASSUMED]
7. Eval: signed-out `/sign-up` shows the invitation text and zero `input` elements; `/login` has no "Register" link text; `/profile` for admin shows no organisation switcher.

The prod org is the single "SOPstart" org (bd2c2b88..., ex-Potenco merge 2026-09-12) plus eval orgs; nothing in this phase touches data.

## 5. Bundle gate (`scripts/check-bundle-size.ts`, `.bundle-baseline.json`)

Facts [VERIFIED: files read]: gates routes `/sops/[sopId]/page` (baseline 1048 KB) and `/sops/page` (940 KB, captured 2026-09-12); fails only when `current - baseline > +2 KB` (a smaller build never fails); per-route forbidden-marker groups must be absent from the route's chunk set; **marker self-validation** requires every marker to appear somewhere in the whole build or the build fails; Route-A positive assertions require `DesktopWalkthrough` and `WalkthroughVoiceModal` to exist as chunks.

Exact edits:
- Delete the `voiceFound` lookup, its `if (!voiceFound.found) fail(...)` block and the voice location in the final `console.log` (keep `DesktopWalkthrough`).
- Delete marker groups `'phone home (53 D-01)'` and `'scan sheet (53 D-09)'` from BOTH routes and `'voice modal (52 D-13)'` from `/sops/page`. Their literals (`'Show the machines on your site'`, `"That's not a SOPstart plate"`, `'Please acknowledge the safety hazards first'`) vanish from the build with the components, so the self-validation loop would otherwise hard-fail `next build` (exactly the Phase 54 pitfall #1). Keep: pdfjs/mammoth/konva, plant home, library table, governance row, access lens.
- Do NOT add replacement markers for deleted features (absence guards belong to Phase 62's dropped-list guard).
- Specs coupled to these strings: `tests/phase53/scan-sheet.spec.ts:256-258` (deleted with phase53), `tests/phase41/bundle-gate.spec.ts` (unaffected: asserts table/governance/access markers and both route keys), `tests/phase54/deletion-sweep.spec.ts:153-158` (unaffected).
- Baseline: removing Dexie, the persister, voice modal, phone home, scan sheet and jsqr from the worker chunk sets will shrink First Load JS, so the gate passes without touching the baseline. To "move the baseline down" as the roadmap asks: in the LAST task (after the cut is complete and `npm run build` is green) run `npx tsx scripts/capture-bundle-baseline.ts` ONCE, and in the same plan record in SUMMARY/ROADMAP: old -> new KB per route and the reason. Add an acceptance check in that task: `new <= old` for both routes (a one-line `node -e` reading the JSON before and after); if either route grew, STOP - diagnose chunk-graph churn first (CLAUDE.md 2026-09-29: `next.config.ts` `splitChunks` cacheGroups; look for a chunk that appeared on many routes), never recapture upward. The file's `previousBaseline` block records history; extend it rather than overwrite.
- `/sops/page.tsx` edits count against the `/sops/[sopId]` gate too (shared chunk set). Keep them subtractive; add no new static imports.
- Every wave that deletes shared code ends with a real `npm run build`, not only `tsc` (CLAUDE.md 2026-06-27, 2026-09-29).
- Known blind spot (`%5BsopId%5D` manifest path) stays unfixed and unworsened.

## 6. Dropped list artefact (feeds Phase 62's build guard)

Existing precedents [VERIFIED: tests read]: `tests/phase54/deletion-sweep.spec.ts` (DELETED_FILES + DEAD_NAMES regex + DEAD_PARAMS, comment-stripped walk of `src/` and `tests/`, excludes itself), `tests/phase41/reference-sweep.spec.ts`, `tests/phase30/dead-weight.spec.ts`, `tests/lint/no-dead-internal-hrefs.spec.ts` (route-shape set from the `src/app` tree + `next.config.ts` redirects; scans `href`, `route:` fields, `router.push`, `redirect`), `tests/phase43/route-truth.spec.ts`. None is machine-readable data.

Recommendation: **`scripts/dropped-features.json`** (data only, committed), consumed by (a) `tests/phase55/deletion-sweep.spec.ts` now and (b) Phase 62's `scripts/check-dropped.ts` added to `prebuild` next to `contract-check.ts` (a tsx script can read JSON; a `.ts` in `tests/` is not importable from prebuild cleanly). Each later phase appends to it. Shape:

```json
{
  "version": 1,
  "entries": [
    { "feature": "phone-qr", "phase": 55, "kind": "route-page", "path": "/m/[code]", "dir": "src/app/(protected)/m" },
    { "feature": "voice", "phase": 55, "kind": "route-api", "path": "/api/voice/token", "dir": "src/app/api/voice/token" },
    { "feature": "offline", "phase": 55, "kind": "package", "name": "dexie" },
    { "feature": "video-generation", "phase": 55, "kind": "job", "name": "Shotstack completion webhook", "path": "/api/sops/generate-video/callback", "env": ["SHOTSTACK_CALLBACK_SECRET"] },
    { "feature": "library", "phase": 55, "kind": "file", "path": "src/components/admin/blocks/BlockPicker.tsx" },
    { "feature": "voice", "phase": 55, "kind": "symbol", "pattern": "WalkthroughVoiceModal|useTtsPlayback|api/voice" },
    { "feature": "ai-registry", "phase": 55, "kind": "ai-model-key", "key": "voice-qa" }
  ],
  "allow": [
    { "pattern": "accent-voice", "reason": "colour token, not the voice feature" },
    { "pattern": "VoiceNoteBlock", "files": ["src/lib/builder/block-registry.tsx","src/actions/introspection.ts","src/lib/validators/blocks.ts"], "reason": "inert block type until Phase 56 conversion" }
  ]
}
```
The sweep asserts: every `file`/`dir` is absent; every `package` absent from `package.json` deps/devDeps/optionalDeps; every `route-*` has no `page.tsx`/`route.ts` under the dir **and** no `href`/`router.push`/`redirect`/`fetch(` reference to the path in comment-stripped `src/` (CLAUDE.md 2026-08-04: absence of references, not only of files; anchor patterns, e.g. `/sops/` for the removed walkthrough route, so `@/stores/walkthrough` is not a false positive); every `symbol` pattern has zero hits outside `allow`; every `ai-model-key` absent from `AI_MODELS`; the sweep spec excludes itself and the JSON, and describes patterns in words in comments. Mutation-prove each assertion once (plant a violation, watch it go red) per the 2026-08-04/2026-05-25 vacuous-guard learnings, and register the project (`phase55`) in `playwright.config.ts` with a `--list` check (CLAUDE.md 2026-05-25).

## 7. Existing test-suite impact

Scan result [VERIFIED: file-token scan of `tests/` + `src/**/__tests__`]: ~83 spec/test files reference a deleted file token; after removing noise tokens (`pipeline`, `network`) about 60 genuinely depend on deleted code. Triage rule: delete when the subject is wholly dropped; repoint when the spec guards something that stays. Lists per feature are in Section 1. Cross-cutting items:
- Playwright projects to delete: `e2e` (offline-indicator), `phase15-unit` (voice `__tests__`), `video-gen-unit`, `phase8-stubs`, `phase9-stubs`, `phase10-stubs`, `phase24-stubs`, `phase24-unit`, `phase53`. Trim regexes: `phase3-stubs` (drop `offline-sync`), `phase6-stubs` (drop `youtube-url|youtube-no-captions`), `phase12.5-stubs` (drop `voice`), `phase15-stubs` (drop `voice-qa-happy-path|voice-grounding-scope`), `phase24-stubs` n/a, `phase11-stubs` (drop `sb-image-annotation`, maybe `sb-block-library`). ADD `phase55`. A project whose `testDir` is gone should be removed, not left empty.
- Source-contract specs that `readFileSync` a deleted path throw ENOENT rather than failing politely - find them with the token scan, not by running the suite blind.
- Live-Supabase probe specs share one OTP budget (CLAUDE.md 2026-09-28): run the full suite ONCE per gate; compare non-live failures against a recorded baseline; do not loop. Targeted per-wave runs use `--project=phaseNN` for the non-live projects only.
- `tests/phase46/capability-matrix-doc.spec.ts` (asserts 'Version history' and 'Manage blocks library' appear in the matrix) and `tests/phase43/route-truth.spec.ts` ("journeys maps no deleted page") must be repointed in the same commit as the doc/journey edits.
- `tests/lint/no-dead-internal-hrefs.spec.ts` scans `route:` fields in `journeys.ts`, so journeys edits are not optional per-wave: a journey step pointing at a deleted route turns this guard red.
- `tests/lint/design-tokens.spec.ts` allowlists mention `sop/flow/FlowGraphCanvas.tsx`, `annotation-tools.ts`, the QR page: VERIFY whether it asserts allowlisted files exist; if so remove entries in the same commit.

## 8. Deployed eval (`tests/evals/cut-features.eval.ts`, `npm run eval -- --phase 55`)

Runner facts [VERIFIED: scripts/run-evals.mjs]: waits for Railway to serve HEAD (`/api/version`), runs project `evals` with `--workers=1`, writes `.planning/evals/latest/EVAL-REPORT.md` + screenshots and `55-EVAL.md` into the phase dir. Fixtures via `node scripts/eval-fixtures.mjs`; sessions via `tests/evals/lib/session.ts` (`admin`, `worker`, `siteAdmin`, `siteWorker`). Evals self-skip without `EVAL_BASE_URL`.

Fixture gap: no fixture SOP has a `photo_required` step (`eval-fixtures.mjs` creates the plant SOP with one plain step, and only if the section is absent). Add a dedicated **"Eval walk fixture SOP"** (published, assigned to `siteWorker`, one hazard-free procedure section, step 1 plain, step 2 `photo_required: true`, upsert logic so re-runs fix an existing SOP). Do not reuse the plant fixture SOP: completing it would flip `plant-home.eval.ts`'s `data-rel="never"` assertion (CLAUDE.md 2026-09-29, shared fixture DB). Clean up the eval's own `sop_completions` + `completion_photos` rows with the service-role client in `afterAll` (completions are append-only for users but deletable by service role).

New eval tests:
1. **Worker, desktop 1440 (siteWorker):** plant stage renders, pin on EVAL Press, Now card with Walk it/Show me; assert absent: `plant-ask-mic`, `phone-home`, "Install"/"Add to Home Screen" banner text, "No internet" banner (also `context.setOffline(true)` + reload attempt shows no custom offline UI beyond the browser), and `await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(r => r.length))` === 0 after load (kill-switch worked on a clean profile), `indexedDB.databases()` contains no `SopAssistantDB`/`tanstack-query`.
2. **Worker, phone 390 (siteWorker):** open the walk fixture `?tab=walk`; step 1 "I've done this - Next"; step 2 shows "Photo required" and a disabled Next; `setInputFiles` a small PNG on the camera input; wait for the uploaded check; Next enables; finish; "Sign off & submit" -> "Completion submitted"; assert no "queued"/"saved for later" text anywhere. Read the screenshot.
3. **Supervisor/admin sees it waiting:** as `siteAdmin`, open `/activity` and assert the completion is listed pending with 1 photo; open its detail and assert the photo thumbnail loads (criterion 5 for new data). Existing-data check: open the OTG fixture SOP (`sop-detail.eval.ts` constant `/sops/125cf9f1-...`) and an existing completion detail - both still render.
4. **Absent affordances (admin, desktop):** builder tools menu has no Flow, "Make a training video", "Print a QR code", no annotate button on a Visual block; `/admin/sops/new` and `/admin/sops/upload` show no "YouTube URL", "Take a photo", "Scan document", "Generate video SOP", but DO show "Record video"; `/admin/sops/new/ai` shows no "Talk it through" and no mic; `/admin/sops/<id>/versions` has no Compare/Restore (and "Edit into new version" per D2); header has no "Content". Dead addresses `/admin/blocks`, `/m/ABC234`, `/login/roster`, `/admin/sops/<id>/video`, `/admin/sops/<id>/qr`: assert the rendered not-found content ("This page has moved or no longer exists."), **never `response.status()`** (CLAUDE.md 2026-09-29: custom `not-found.tsx` serves 200). For API paths (`/api/voice/token` POST, `/api/roster` GET) assert the old JSON shape is not returned.
5. **ORG:** signed-out `/sign-up` has the invitation text and zero inputs; `/login` has no "Register" text; admin `/profile` has no organisation switcher.
6. Console clean (`watchConsole` from `lib/plant-fixture.ts`) across all; screenshots read before pass (CLAUDE.md 2026-07-14).

Existing evals to change: `phone-home.eval.ts` delete (incl. plate test); `plant-home.eval.ts` remove step 9 (voice dialog) and assert `plant-ask-mic` count 0 (keep ask highlight steps); `sop-surface.eval.ts:211-220` (F3) drop the `phone-home` alternative; `sop-detail.eval.ts:90-95` (admin Flow tab) invert; `dead-surface.eval.ts` tests A and B delete (C, D stay); `governance.eval.ts`/`site-editor.eval.ts`: VERIFY no use of plate link (grep shows none).

## 9. Non-code surfaces (same-commit duties)

- `src/lib/journeys/journeys.ts`: remove/rewrite journeys `roster-login`, `sign-up`, `offline-use`, `machine-qr`, `create-with-voice`, `generate-video`, `reusable-blocks`; trim steps in `find-follow-sop` (machine/phone/scan), `create-from-document` (pipe), `version-supersede` (restore, diff), `walkthrough-complete` (offline/voice/queue steps - VERIFY), `map-the-site` (plate step line 656), `enter-admin-tools` (Content link line 328). Every remaining `route:` must exist (`no-dead-internal-hrefs`). Pathways "All screens" should show 0 not-mapped for the routes that remain (Phase 62 rebuilds the map; do not redesign here).
- `src/lib/journeys/roles.ts:99,185`.
- `src/lib/uat/tests.ts`: archive or remove `p23-roster-login`, `p26-annotation-editor-feel`, `p26-baked-annotation-on-worker-read`, `plant-home-worker` (voice mention VERIFY), `phone-home-worker`, `p36-version-breakdown`/`p23-updated-since-badge` (VERIFY if they reference compare/restore); rewrite `links` pointing at deleted hrefs (`/login/roster`).
- `.planning/codebase/CAPABILITY-MATRIX.md` (maintenance trigger in CLAUDE.md): edit "Create SOP" row (drop AI-voice), "Version history" row (drop restore; keep clone/upload), delete rows "Manage blocks library" and "Print a machine plate (QR)"; update `tests/phase46/capability-matrix-doc.spec.ts`. No role gate changes otherwise (no RLS or `require*` edits in this phase).
- `.planning/codebase/{ARCHITECTURE,STRUCTURE,INTEGRATIONS,STACK}.md` mention Dexie/Serwist/voice/Shotstack - update or leave for the milestone close; at minimum `STACK.md` (package list) and `INTEGRATIONS.md` (Shotstack, Deepgram-streaming).
- `CLAUDE.md` (project): Technology Stack line lists Serwist/Dexie/idb-keyval; Architecture lists `~offline/`, hooks, `src/lib/offline/`, offline strategy section, "Key Directories"; update, and add a `## Learnings` entry per CLAUDE.md triggers after verification.
- `.env.local.example`, `README.md` (VERIFY mentions), `railway.json` (no change).
- Memory file `project_mvp_simplification` already records the cut; no action.

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Retiring an installed service worker | A 404, or deleting `sw.js` | A committed self-destroying `public/sw.js` | Deleting the file leaves the old worker active in browsers [CITED: love2dev.com, dev.to/thepassle] |
| Photo upload from the browser | A new upload API route | existing `getPhotoUploadUrl` server action + signed PUT + `compressPhoto` | Same two calls the flush used; org/path logic and bucket policy already correct |
| Worker "assigned SOPs" list | A new endpoint or Dexie-like cache | existing `useWorkerSops` queries (`getUserSopAssignments`, `library-sops`) | Already loaded on the same page |
| Deletion guard | A new reference scanner | `deletion-sweep.spec.ts` idiom (`stripComments`, `walkTsFiles`, regex sets) + the JSON dropped list | Proven twice (41, 54); handles comments/self-exclusion |
| Dead-link detection | Manual href grep only | `tests/lint/no-dead-internal-hrefs.spec.ts` (live route tree + redirects) | Already catches `route:` fields in journeys |
| Legacy URL for `?tab=flow` | A redirect | `LEGACY_TAB_MAP` entry in `SopTabNav` | The map already exists for the Phase 30 tab merge |
| Reading dependency fan-out | Filename guessing | import-graph walk (Section 2 method) | Found publish-core, synthesis, BuilderClient, UploadDropzone couplings |

**Key insight:** every dropped feature has a thin seam into a kept feature; the cost is in the seams, so enumerate seams (surviving importers) before touching files.

## Common Pitfalls

### 1. Marker self-validation fails the build after the deletions
**What goes wrong:** `check-bundle-size.ts` fails with "forbidden marker not present anywhere in the build". **Why:** the literals belonged to deleted components. **Avoid:** remove the marker groups in the same wave as the components (Section 5); build per wave. **Signal:** the failing message names the marker.

### 2. `--accent-voice` mistaken for the voice feature
**What goes wrong:** deleting the token breaks the safety gate, photo-required UI, pills and login button silently (undefined CSS custom property fails nothing - CLAUDE.md 2026-07-14); or a "no voice" grep flags 15+ legitimate files. **Avoid:** allow-list the token in the dropped-list guard; `tests/lint/no-undefined-css-tokens.spec.ts` will also catch removal. [VERIFIED: used in SafetyAcknowledgement, StepPhotoZone, StatePill, Pill, Login/SignUp forms, VideoOutdatedBanner]

### 3. Prebuild block-contract check
**What goes wrong:** removing VoiceNoteBlock from one of {registry, introspection, Zod union} makes `npm run build` fail at `prebuild`. **Avoid:** keep all three; only strip interactivity and the insert entries (Section 1.2).

### 4. Old service worker keeps serving the old app
**What goes wrong:** after removing Serwist, phones with the worker installed keep stale precached chunks and the offline fallback; no new build ever reaches them reliably. **Avoid:** kill-switch `public/sw.js` (committed; remove the `.gitignore` entries at lines 54-56 or the file is not tracked), served for >= 30 days. Verify with the eval (registrations === 0 on a profile that visited before). [CITED]

### 5. Deleting before rewiring
**What goes wrong:** `lib/offline/db.ts` has 15 live importers; removing it first breaks the build for the whole phase and invites "temporary stubs". **Avoid:** Wave 1 first; `tsc --noEmit` after each wave.

### 6. `'use server'` files and exports
**What goes wrong:** deleting exports leaves a file whose remaining exports include a sync/value export, or a stale type re-export, failing `next build` ("Server Actions must be async functions", CLAUDE.md 2026-06-27). **Avoid:** after trimming `auth.ts`, `versioning.ts`, `sops.ts`, `sop-section-blocks.ts`, `completions.ts` run `npm run build`, not just `tsc`.

### 7. Guards that grep comments and themselves
**What goes wrong:** the new sweep (or a doc comment in an edited file) quotes `WalkthroughVoiceModal`, `/api/voice`, `Dexie`, `qrcode` and trips the sweep or an exact-count lint (CLAUDE.md 2026-09-28, four incidents in one day). **Avoid:** strip comments, exclude the spec and the JSON, describe in words.

### 8. Eval fixture contamination
**What goes wrong:** the walk eval completes the plant fixture SOP and the next `plant-home` run expects `never`. **Avoid:** dedicated walk fixture + service-role cleanup (Section 8).

### 9. Desktop walkthrough has no photos
**What goes wrong:** an eval or a claim of criterion 1 at 1440 px fails/lies. **Avoid:** phone-width walk in the eval; record the gap for Phase 58.

### 10. Hidden cross-feature links in the "voice" word
Non-voice hits for `voice|Voice` in kept code: `--accent-voice` (colour), `sop-parser.ts:110` ("active voice" prose), `orchestrator.ts:160` comment, `VideoOutdatedBanner` token use. Guard patterns must be specific identifiers, not the bare word.

### 11. Chunk-graph churn can add KB on a route even as code is removed
Removing Dexie/persister/jsqr reshuffles shared vendors chunks; a small shared runtime can be duplicated into per-route chunks (CLAUDE.md 2026-09-29). **Avoid:** keep the `nextDynamic` cacheGroup; if a route grows, diff chunk groups before touching code; never recapture upward.

### 12. Next 16.2.1 server-action queue
The rewire adds mount-time server actions on the worker page (`getUserSopAssignments`, `listSiteForWorker`) and a server-action photo URL on capture. Do not call `router.replace/push` from a mount effect on these pages; keep legacy-URL redirects in `next.config.ts`/middleware (CLAUDE.md 2026-09-29). No new redirect is needed in this phase (D3 keeps `/join`, D4 keeps `/sign-up`).

### 13. Existing `layout_data` with removed-feature blocks
`LayoutRenderer`/`sanitizeLayoutContent` already degrades unknown block types to a placeholder, but known types (`VoiceNoteBlock`, `VisualBlock` diagram with `bakedSrc`) must keep rendering. Do not remove them from `BLOCK_COMPONENTS`; Phase 56 converts. A flow-graph or annotation row in the DB with no UI is fine.

### 14. Admin `NowCard`/plant "inline" variant
`NowCard inline` and `Read` link exist only for the phone; removing is optional; if removed, `plant-now-read` testid specs (`tests/phase52/plant-now-card.spec.ts`) need repointing.

## Code Examples

### Self-destroying service worker (`public/sw.js`, committed)
```js
// Replaces the Serwist worker. Browsers re-fetch /sw.js on navigation (<=24h),
// run this, and the worker removes itself and its caches.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
      await self.registration.unregister()
      const clients = await self.clients.matchAll({ type: 'window' })
      clients.forEach((c) => c.navigate(c.url)) // reload once onto the un-controlled app
    })()
  )
})
```
Source pattern: [CITED: https://dev.to/thepassle/self-unregistering-service-workers-3097], [CITED: https://love2dev.com/blog/how-to-uninstall-a-service-worker]. Remove `/public/sw.js` and `/public/sw.js.map` from `.gitignore`. `next.config.ts` becomes `export default nextConfig` (no wrapper), so nothing regenerates the file.

### Direct photo upload (replaces queue + flush)
```ts
// hooks/useStepPhotos.ts (sketch)
import { compressPhoto } from '@/lib/photo/compress'
import { getPhotoUploadUrl } from '@/actions/completions'

export async function uploadStepPhoto(completionId: string, stepId: string, file: File) {
  const blob = await compressPhoto(file)
  const localId = crypto.randomUUID()
  const url = await getPhotoUploadUrl({ localId, contentType: 'image/jpeg', orgId: '', completionLocalId: completionId })
  if ('error' in url) throw new Error(url.error)
  const put = await fetch(url.url, { method: 'PUT', body: blob, headers: { 'Content-Type': 'image/jpeg' } })
  if (!put.ok) throw new Error(`upload failed (${put.status})`)
  return { localId, stepId, storagePath: url.path, contentType: 'image/jpeg', blob }
}
```
Source: the removed `flushPhotoQueue` in `src/lib/offline/sync-engine.ts` (same calls). [VERIFIED: codebase]

### Assigned set without Dexie (inside `useWorkerSops`)
```ts
const assignedIds = new Set(assignments.map((a) => a.sop_id))
const assigned = librarySops.filter((s) => assignedIds.has(s.id)) // already title-ordered by the query
const others = librarySops.filter((s) => !assignedIds.has(s.id))
// map both to WorkerSop exactly as today; raw: s (LibrarySop)
```

### Bundle-gate acceptance check for the baseline move
```bash
node -e "const o=require('./.bundle-baseline.old.json').routes,n=require('./.bundle-baseline.json').routes;for(const k of Object.keys(o)){if(n[k]>o[k]){console.error('baseline grew',k,o[k],n[k]);process.exit(1)}}console.log('baseline moved down only')"
```

## State of the Art

| Old | Current | Impact |
|-----|---------|--------|
| Serwist precache + runtime cache + `/~offline` fallback | No service worker; self-destroying `sw.js` for a retention window | No offline; worker data is always live |
| Dexie mirror + persisted React Query + flush queues | Direct Supabase reads / server actions / signed PUT | Removes the 2026-09-29 stale-persisted-`[]` bug class |
| Voice bridge (Deepgram WS, TTS, intent classifier) | none | AI registry loses 6 keys |
| Multi-tenant sign-up + OrgSwitcher | single org, invitation | one membership per user in practice |

Deprecated/outdated by this phase: Phase 15/22 voice contracts, Phase 53 phone/QR contract, Phase 8-10 video generation, Phase 24 flow tab, Phase 26-11/13 annotation, Phase 13 library UI, Phase 23 roster login and compare/restore UI.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Keep `cloneSopAsDraft` (brief lists it as dropped) | D2, 1.11 | If the owner wants it gone, the only new-version path is re-upload; SOP-04 in Phase 58 must supply another path |
| A2 | Keep `/join` + invite code as the "invitation" channel | D3, 4 | If deleted instead, extra edits in team page components Phase 59 re-homes |
| A3 | Keep `manifest.ts` | D5 | If "no install" includes Add-to-Home-Screen, delete it and `/icons` usage |
| A4 | Keep image file types in document upload; only camera/scanner entries removed | D6 | If photos must go entirely, trim `file-intake.ts` and keep tesseract for PDFs |
| A5 | Do not delete device IndexedDB in the kill-switch | D8 | Stale SOP copies remain on shared devices until Phase 62 |
| A6 | Supabase "disable signups" flag name/availability | D9, 4 | Manual dashboard step instead of scripted |
| A7 | Zustand in-memory completion is acceptable (no resume across reload) | D7, 3.3 | Workers lose partial walks on refresh; mitigated: `walkthrough` store already memory-only |
| A8 | Agent-layer `readVoiceSignals`/`sop_voice_qa_log` reads can stay | 1.2 | Phase 62 sweep for leftovers |
| A9 | `site_machines.code` generation must stay (NOT NULL unique) | 1.3 | If dropped without a migration, machine inserts fail |
| A10 | `DesktopWalkthrough` photo gap is pre-existing and out of scope | 3.3 | Criterion 1 must be proven at phone width |

## Open Questions

1. **Keep `cloneSopAsDraft`?** Known: it is the versions-page "Edit into new version" action; `restoreVersionAsNew` only delegates to it. Unclear: whether the owner meant "restore" only. Recommendation: keep (D2); ask once.
2. **Is Add-to-Home-Screen (manifest) part of "install prompt"?** Recommendation: keep manifest, delete the in-app prompt.
3. **Any external scheduler calling dropped routes (Railway cron service, Shotstack webhook config)?** Unverifiable from the repo; check the Railway/Shotstack dashboards and note the result in the plan summary.
4. **How long to serve the kill-switch?** Recommendation: until Phase 62, then replace with a plain 410/absence.
5. **Do `p23-updated-since-badge` / `p36-version-breakdown` UAT entries describe restore/compare?** VERIFY while editing `tests.ts`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build, tsx scripts | yes | 22.16.0 | - |
| npm | `npm uninstall`, build | yes | 10.9.2 | - |
| Playwright (+ browsers) | specs, evals | yes (binary present) | ^1.58.2 | - |
| Railway deploy + `https://sopstart.com` | `npm run eval -- --phase 55` | VERIFY at execution (not probed) | - | none; eval is the UAT artefact |
| Supabase service role + keys in `.env.local` | eval fixtures, cleanup | yes (`.env.local` present; not read) | - | - |
| Supabase dashboard / Management API | disable-signups checkpoint (D9) | VERIFY | - | manual toggle |

Project rule: no local dev/localhost instructions for SOPstart (memory: Railway-only testing). The wave gates are `tsc`, `npm run build`, targeted source-contract projects; behavioural proof is the deployed eval.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright `@playwright/test` ^1.58.2 (source-contract + unit + deployed evals) |
| Config file | `playwright.config.ts` (713 lines, one project per phase; add `phase55`) |
| Quick run command | `npx tsc --noEmit && npx playwright test --project=phase55` |
| Full suite command | `npm run build && npm run test` (full suite ONCE per gate - OTP budget) |
| Deployed | `npm run eval -- --phase 55` after push |

### Phase Requirements -> Test Map
| Req ID | Behaviour | Test Type | Automated Command | File Exists? |
|--------|-----------|-----------|-------------------|--------------|
| CUT-01 | No offline layer: no `lib/offline`, Dexie, Serwist, persister, banners, `~offline`; kill-switch `public/sw.js` committed; packages absent | source-contract | `npx playwright test --project=phase55 tests/phase55/deletion-sweep.spec.ts` | Wave 0 (fixme scaffold, flips live per wave) |
| CUT-01 | Voice/phone/QR/roster files, routes, API paths, AI keys, bundle-script literals absent; no href/fetch to them | source-contract | same | Wave 0 |
| CUT-01 | Worker path contract: walkthrough uses `getPhotoUploadUrl` + `submitCompletion`, no `@/lib/offline` import anywhere in `src/` | source-contract | `npx playwright test --project=phase55 tests/phase55/worker-path-contract.spec.ts` | Wave 0 |
| CUT-01 | Worker walk + photo + submit works online; no banner/queue; no SW registered | deployed eval | `npm run eval -- --phase 55` (tests 1-3) | Wave 0 (author) |
| CUT-02 | Video-gen/flow/annotation/YouTube/photo-scan/library/compare-restore files, packages, refs absent; kept things present (record-video tab, `cloneSopAsDraft`, `transcribe`, SiteEditor konva, block types, `--accent-voice`) | source-contract (allow-list + positive survivors) | `npx playwright test --project=phase55 tests/phase55/deletion-sweep.spec.ts` | Wave 0 |
| CUT-02 | Admin UI shows none of the dropped affordances; dead addresses render not-found content | deployed eval | tests 4 | Wave 0 (author) |
| ORG-01 | `signUpOrganisation`, `switchOrganisation`, `getUserMemberships`, `OrgSignUpForm`, `OrgSwitcher` absent; `/sign-up` has no form/action; login copy | source-contract | `npx playwright test --project=phase55 tests/phase55/org-single.spec.ts` | Wave 0 |
| ORG-01 | Signed-out `/sign-up` invitation text, no inputs; profile has no switcher | deployed eval | test 5 | Wave 0 (author) |
| all | Build green incl. bundle gate (voice assertion + three marker groups removed, no growth), `contract-check` green, lint clean | build | `npm run build && npm run lint` | exists |
| all | Existing guards green after repoint: `no-dead-internal-hrefs`, `design-tokens`, `no-undefined-css-tokens`, `no-static-desktop-import`, `rls-org-scope`, `phase41`/`phase54` sweeps, `capability-matrix-doc`, `route-truth` | source-contract | `npx playwright test --project=phase15-stubs --project=phase41 --project=phase43 --project=phase46 --project=phase52 --project=phase54` | exists (edits per Section 7) |
| CUT-01/02 | Every guard mutation-proven (plant violation -> red -> green) | manual-once + recorded in SUMMARY | n/a | per plan |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit && npx playwright test --project=phase55`
- **Per wave merge:** `npm run build` (bundle gate, marker self-validation, prebuild contract) + the non-live projects the wave touched (names in Section 7)
- **Phase gate:** full suite ONCE (compare non-live failures to a recorded baseline; live-probe OTP failures are environment, per 2026-09-28), push, `npm run eval -- --phase 55`, read every screenshot, `55-EVAL.md` is the UAT artefact
- Max feedback latency: ~30 s for the quick command

### Wave 0 Gaps
- [ ] `playwright.config.ts` project `phase55` (`testMatch: /tests\/phase55\/.*\.(spec|test)\.ts$/`) + `--list` verification (CLAUDE.md 2026-05-25)
- [ ] `scripts/dropped-features.json` (initial full list from Section 1)
- [ ] `tests/phase55/{deletion-sweep,worker-path-contract,org-single}.spec.ts` (fixme-gated final shape, flip live per wave; sweep reads the JSON)
- [ ] `tests/evals/cut-features.eval.ts` skeleton + walk fixture in `scripts/eval-fixtures.mjs` (upsert, photo-required step 2) + cleanup helper in `tests/evals/lib/`
- [ ] Record the pre-phase full-suite failure baseline (`55-BASELINE-FAILURES.md`) before Wave 2, per the 51 pattern
- [ ] Snapshot `.bundle-baseline.json` to `.bundle-baseline.old.json` outside git (for the move-down check only)
- No framework install needed.

## Security Domain

`security_enforcement` is not set in `.planning/config.json` (absent = enabled).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Remove self-service account/org creation; keep invite (`inviteUserByEmail`) and password login; disable Supabase public signup (D9) |
| V3 Session Management | yes | Unchanged JWT/`getClaims`; removing `switchOrganisation` removes a session-metadata write path |
| V4 Access Control | yes | No gate changes. Confirm `getPhotoUploadUrl` still derives org from the session (it does) and is the only storage-signing path; RLS untouched |
| V5 Input Validation | yes | Zod on `submitCompletion` stays; removing `rosterWorkerId` shrinks the attacker-supplied surface |
| V6 Cryptography | no | none touched |
| V8/V13 Data & API | yes | Deleting `/api/roster` (listed org workers' emails to any signed-in session), `/api/voice/token` (minted Deepgram grants), `/api/voice/*` (paid LLM/TTS) and the unauthenticated-by-cookie Shotstack callback reduces surface and spend exposure |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Stale service worker serving old authenticated shell | Tampering/Info disclosure | kill-switch + cache purge; verify by eval |
| Orphaned public route exemption in middleware (`isShotstackCallback`) pointing at nothing | Spoofing | remove exemption with the route |
| Residual client copies of SOP content / unsent completions in IndexedDB on shared devices | Info disclosure | D8: known residue, Phase 62 sweep; document |
| Direct Supabase signup with the publishable key | Elevation/Spoofing | D9 setting; stray users have no membership so RLS denies data |
| Deleting service-role action exports leaving a sibling that trusts a client-supplied org (CLAUDE.md 2026-06-15/07-29 class) | Tampering | when trimming `completions.ts`/`versioning.ts`, re-read each remaining function's org scoping; do not "simplify" guards |
| Trust-bypass flag copied across sibling actions | Elevation | grep `serviceRole`-style override fields in `src/actions/*` schemas after the library actions are deleted (CLAUDE.md 2026-09-30) |

## Sources

### Primary (HIGH confidence)
- Codebase read/grep this session: `.planning/{REQUIREMENTS,ROADMAP,STATE}.md`, `.claude/skills/sketch-findings-SOPstart/references/one-screen-site.md`, `CLAUDE.md` Learnings, `package.json`, `next.config.ts`, `railway.json`, `.gitignore`, `src/app/**` route tree, `src/lib/supabase/middleware.ts`, `src/hooks/*`, `src/stores/*`, `src/lib/offline/*`, walkthrough/plant/auth/profile components, `src/actions/{auth,completions,versioning,sops,sop-section-blocks,blocks,assignments,sections}.ts`, `scripts/{check-bundle-size,capture-bundle-baseline,contract-check,run-evals,eval-fixtures}`, `.bundle-baseline.json`, `playwright.config.ts`, `tests/phase54/deletion-sweep.spec.ts`, `tests/lint/no-dead-internal-hrefs.spec.ts`, `tests/evals/*`, `supabase/migrations/{00007,00017}`, `.planning/codebase/CAPABILITY-MATRIX.md`, `src/lib/{journeys,uat}/*`.
- Import-graph analysis of all 574 `src/` TS/TSX files (resolver for `@/` and relative specifiers) for delete sets, orphans and surviving importers.

### Secondary (MEDIUM)
- https://dev.to/thepassle/self-unregistering-service-workers-3097 - self-unregistering worker pattern
- https://love2dev.com/blog/how-to-uninstall-a-service-worker - deleting/404 leaves the worker active; replace with an unregistering script; browsers re-check at most every 24 h
- https://kevincox.ca/2020/11/03/removing-a-service-worker/ - same pattern, corroboration

### Tertiary (LOW - flagged)
- Supabase `disable_signup` / "Allow new users to sign up" setting name (training knowledge; confirm in dashboard/Management API docs before scripting)

## Metadata

**Confidence breakdown:**
- Standard stack (remove/keep): HIGH - importer lists grepped per package.
- Deletion inventory: HIGH for src files (graph-derived); MEDIUM for specs (token scan + judgement; items marked VERIFY).
- Worker rewire: HIGH on current behaviour, MEDIUM on the recommended replacement (reads already exist; photo path mirrors the removed flush).
- ORG-01: HIGH that no migration is needed; MEDIUM on D3/D9 choices.
- Bundle gate: HIGH (script read in full).
- Pitfalls: HIGH (each tied to a file or CLAUDE.md learning).

**Research date:** 2026-10-03
**Valid until:** 2026-10-17 (codebase moves fast; re-run the importer analysis at the start of each deleting wave rather than trusting this list blindly)
