# Roadmap: SOP Assistant

## Overview

Four phases deliver the complete v1 product. Phase 1 establishes the multi-tenant foundation that every subsequent feature depends on — this cannot be retrofitted. Phase 2 builds the AI document ingestion pipeline, the core product differentiator. Phase 3 delivers the full worker-facing experience including offline access, SOP library, and SOP management. Phase 4 closes the loop with completion tracking, photo evidence, and supervisor sign-off.

v2.0 adds four phases (5–8) delivering three new SOP creation pathways and a video consumption layer. Phase 5 establishes upload infrastructure and expanded file parsing. Phase 6 delivers video transcription via file upload and URL. Phase 7 adds in-app camera recording (gated on iOS Safari maturity). Phase 8 generates video SOPs from published structured content.

v3.0 adds eight phases (11–18) delivering the native SOP Builder milestone. Phase 11 lays down the additive section_kinds catalog + blocks schema that every downstream builder phase depends on. Phase 12 ships the Puck-based builder shell with the blank-page wizard and single unified authoring surface. Phase 13 delivers the reusable org-vs-global block library. Phase 14 adds AI-drafted SOPs gated behind the Phase 6 adversarial verifier. Phase 15 adds the NZ template library. Phase 16 delivers Konva-based image/diagram annotation with dual-store (JSON for editing, baked PNG for workers) and the specialty DiagramHotspotBlock. Phase 17 adds collaborative editing via pessimistic section locks with an optimistic version column for offline handoff. Phase 18 wires the builder into the Phase 9 pipeline runs, enforces bundle isolation via CI, and closes out the milestone.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Multi-tenant auth, role-based access, and PWA shell (completed 2026-03-23)
- [x] **Phase 2: Document Intake** - AI parsing pipeline, admin review, and SOP publish workflow (completed 2026-03-24)
- [x] **Phase 3: Worker Experience** - Step-by-step walkthrough, offline access, SOP library, and assignment (completed 2026-03-25)
- [x] **Phase 4: Completion and Sign-off** - Completion tracking, photo evidence, and supervisor sign-off (completed 2026-03-26)
- [x] **Phase 5: Expanded File Intake** - TUS upload infrastructure, photo OCR, Excel/PowerPoint/text parsing, and shared intake routing (completed 2026-04-03)
- [x] **Phase 6: Video Transcription (Upload and URL)** - MP4/MOV file upload and YouTube URL → structured SOP with transcript review (completed 2026-04-03)
- [ ] **Phase 7: Video Transcription (In-App Recording)** - In-browser camera recording → SOP transcription with iOS Safari fallback
- [x] **Phase 8: Video SOP Generation** - AI-narrated slideshow, screen-recording-style, and full AI video generated from published SOPs (completed 2026-04-04)
- [ ] **Phase 9: Streamlined File → Video Pipeline** - One-click upload-to-video SOP flow chaining file parsing and video generation
- [x] **Phase 10: Video Version Management** - Multiple video versions per SOP with labels, editing, deletion, and admin management UI (completed 2026-04-13)
- [x] **Phase 11: Section Schema & Block Foundation** - Additive `section_kinds` catalog, `blocks`/`block_versions`/`sop_section_blocks` tables, legacy fallback, and v3.0 wave-0 test stubs (completed 2026-04-15)
- [x] **Phase 12: Builder Shell & Blank-Page Authoring** - Puck-based builder, `layout_data` JSONB, blank-page wizard, unified authoring surface, legacy linear fallback (completed 2026-04-24; UAT 9/11 automated PASS, UAT #3 airplane-mode + UAT #6 cross-admin LWW carried as human-verification items)
- [ ] **Phase 12.5: Blueprint Redesign** - Worker-first UX overhaul with paper/ink engineering-drawing aesthetic; unified tabbed interface (overview/tools/hazards/flow/model/walkthrough); mobile immersive walkthrough; voice input (server-side transcription); cmdk; 7 new AI-accessible block types (Measurement, Decision, Escalate, SignOff, Zone, Inspect, VoiceNote) — ModelBlock deferred
- [ ] **Phase 13: Reusable Block Library** - Org-vs-global block CRUD, NZ seed blocks, wizard "Pick from library" step, pin-version vs follow-latest semantics
- [ ] **Phase 14: AI-Drafted SOPs** - Natural-language prompt → GPT-4o structured draft → Claude adversarial verification gate → editable draft lands in the builder
- [ ] **Phase 15: NZ Template Library** - Curated WorkSafe / machinery / chemical handling templates surfaced as a third entry point into the builder
- [ ] **Phase 16: Image & Diagram Annotation** - Konva editor with dual-store (JSON scene + baked PNG), DiagramHotspotBlock for machine-diagram freeform callouts, stylus + palm rejection
- [ ] **Phase 17: Collaborative Editing** - Section-level pessimistic locks, Supabase Realtime presence, optimistic version column for offline handoff, conflict modal
- [ ] **Phase 18: Pipeline Integration, Bundle Isolation & v3.0 Closeout** - Builder ↔ Phase 9 pipeline linkage, Dexie draft sync, worker-bundle leakage CI check, v3.0 milestone closeout

## Phase Details

### Phase 1: Foundation
**Goal**: Organisations and users can securely access the app with full tenant isolation, correct roles, and a functional PWA shell
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, PLAT-01, PLAT-02, PLAT-03
**Success Criteria** (what must be TRUE):
  1. An organisation admin can register their organisation and create their account
  2. Users can sign up, log in, and remain logged in across browser refresh and app relaunch
  3. Admin can assign Worker, Supervisor, Admin, and Safety Manager roles to users
  4. One organisation's users cannot see or access any data belonging to another organisation
  5. The app is installable to home screen on iOS and Android and loads in all modern mobile browsers with online/offline status visible
**Plans**: 4 plans

Plans:
- [x] 01-00-PLAN.md — Wave 0: Playwright test framework setup and stub test files for all requirements
- [x] 01-01-PLAN.md — Next.js 16 scaffold + Supabase multi-tenant schema with RLS, JWT custom claims, and cross-tenant isolation seed test
- [x] 01-02-PLAN.md — Auth flows (org registration, login, invite code join, email invite acceptance, role assignment)
- [x] 01-03-PLAN.md — PWA shell (Serwist service worker, manifest, offline indicator, bottom tab bar)

### Phase 2: Document Intake
**Goal**: Admins can upload Word and PDF SOP documents, review AI-parsed output, and publish structured SOPs to the library
**Depends on**: Phase 1
**Requirements**: PARSE-01, PARSE-02, PARSE-03, PARSE-04, PARSE-05, PARSE-06, PARSE-07
**Success Criteria** (what must be TRUE):
  1. Admin can upload a .docx or PDF file and the app extracts its text and embedded images
  2. AI automatically produces a structured SOP with labelled sections (Hazards, PPE, Steps, Emergency) that the admin can review
  3. Admin sees the parsed output alongside the original document before publishing
  4. Admin can edit any parsed section to correct errors before publishing
  5. Parsed SOPs stay in draft state until admin explicitly publishes them; published SOPs appear in the library
**Plans**: 4 plans

Plans:
- [x] 02-00-PLAN.md — Wave 0: Playwright test stubs for all PARSE requirements (sop-upload, sop-parsing, sop-review)
- [x] 02-01-PLAN.md — SOP data model (sops/sop_sections/sop_steps/sop_images schema + RLS), Storage buckets, presigned upload URL flow, upload UI, SOP library admin page
- [x] 02-02-PLAN.md — Async parsing pipeline: mammoth + unpdf text extraction, tesseract.js OCR fallback, GPT-4o structured output parser, image upload, parse Route Handler
- [x] 02-03-PLAN.md — Admin review UI: side-by-side layout, section editor with inline editing + approval, publish workflow, re-parse, delete draft, real-time parse status

### Phase 3: Worker Experience
**Goal**: Workers can find, walk through, and browse any assigned SOP on their phone — including offline — with the SOP library, search, and assignment managed by admins
**Depends on**: Phase 2
**Requirements**: WORK-01, WORK-02, WORK-03, WORK-04, WORK-05, WORK-06, WORK-07, WORK-08, WORK-09, WORK-10, MGMT-01, MGMT-02, MGMT-03, MGMT-04, MGMT-05, MGMT-06, MGMT-07
**Success Criteria** (what must be TRUE):
  1. Worker can walk through an SOP step-by-step in a full-screen glove-friendly interface, navigate backwards, and see progress — with hazard and PPE information shown before steps begin
  2. Worker can view any SOP section (Hazards, PPE, Steps, Emergency) directly via tabbed quick-reference without walking through all steps
  3. Worker can search and browse the SOP library; assigned SOPs appear first; images within steps display inline with zoom
  4. Worker can access all assigned SOPs without an internet connection; data entered offline syncs when connectivity returns
  5. Admin can assign SOPs to roles or individual workers; uploading a new document version retains previous versions linked to historical completions; workers see an update notification when an assigned SOP changes
**Plans**: 6 plans

Plans:
- [x] 03-00-PLAN.md — Wave 0: Playwright test stubs for all WORK and MGMT requirements (17 stubs across 6 test files)
- [x] 03-01-PLAN.md — Offline-first data layer: Dexie.js IndexedDB schema, TanStack Query persister, SOP sync engine, walkthrough state store, Serwist image caching, FTS and assignment migrations
- [x] 03-02-PLAN.md — Worker SOP walkthrough: safety acknowledgement gate, scrolling step list with tap-to-complete, progress indicator, inline images with zoom, full-screen glove-friendly layout
- [x] 03-03-PLAN.md — SOP library and quick reference: SOP card list, search overlay, category bottom sheet/sidebar, SOP detail page with tabbed section navigation
- [x] 03-04-PLAN.md — Admin SOP assignment: assign SOPs to roles and individual workers, assignment row component, server actions with admin role guards
- [x] 03-05-PLAN.md — SOP versioning and notifications: version history page, re-upload flow, superseded_by lineage, worker notifications table, notification polling and badge

### Phase 4: Completion and Sign-off
**Goal**: Worker completions are durably recorded with photo evidence and SOP version snapshot, and supervisors can review and sign off completions
**Depends on**: Phase 3
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07
**Success Criteria** (what must be TRUE):
  1. When a worker completes an SOP walkthrough, a completion record is created with a server-side timestamp and a reference to the exact SOP version followed
  2. Worker can capture photos during specific walkthrough steps; photos are tied to the step they were taken on
  3. Completion records cannot be deleted or modified after creation; they form an append-only audit trail
  4. Supervisor can view all completion records for workers they oversee and can approve or reject each completion
**Plans**: 3 plans

Plans:
- [x] 04-01-PLAN.md — Completion data foundation: migration 00010 (sop_completions, completion_photos, completion_sign_offs with append-only RLS), Dexie v2 schema, completionStore with Dexie persistence, photo-compress utility, sync engine extensions, server actions (submitCompletion, signOffCompletion, getPhotoUploadUrl), StatusBadge extensions
- [x] 04-02-PLAN.md — Photo capture and walkthrough integration: StepPhotoZone with camera input, PhotoThumbnail with upload status, usePhotoQueue hook, walkthrough page extended with completion store (resume support), photo-required gate, Submit Completion flow with content hash
- [x] 04-03-PLAN.md — Supervisor sign-off UI: role-aware Activity page (worker history / supervisor feed), filter pills, completion detail page with step rows and photo lightbox, approve/reject sign-off panel with mandatory rejection reason

### Phase 5: Expanded File Intake
**Goal**: Admins can upload photos of printed SOPs, Excel checklists, PowerPoint slide decks, and plain text files — all routed through the existing AI structuring pipeline and review UI — and TUS upload infrastructure is in place for all large file uploads
**Depends on**: Phase 4
**Requirements**: FILE-01, FILE-02, FILE-03, FILE-04, FILE-05, FILE-06, FILE-07, FILE-08, INFRA-01, INFRA-02
**Success Criteria** (what must be TRUE):
  1. Admin can photograph a printed SOP with their device camera; the system checks image quality (blur, glare, rotation) before submitting, and the extracted text appears in the standard admin review UI alongside the original image
  2. Admin can upload an Excel (.xlsx), PowerPoint (.pptx), or plain text (.txt) file and receive a structured SOP draft with tables preserved as readable tables in SOP steps
  3. All new file types use format-specific AI prompts — the admin review confidence scoring and high-risk token flagging applies to every new input type
  4. Large files (including future video uploads) use TUS resumable upload direct to Supabase Storage, not routed through the Next.js server body
  5. Every new intake pathway (photo, XLSX, PPTX, TXT) routes through the existing gpt-parser structuring pipeline without changes to the review UI
**Plans**: 4 plans
**UI hint**: yes

Plans:
- [x] 05-01-PLAN.md — Backend parsing pipeline: DB migration (file_type constraint + input_type), type/validator extensions, extractors (xlsx, pptx, txt, image via GPT-4o vision), format-specific GPT prompts, parse route dispatch
- [x] 05-02-PLAN.md — Upload UX: TUS resumable upload infrastructure, UploadDropzone extension (new MIME types, Scan button, HEIC conversion, TUS progress bar)
- [x] 05-03-PLAN.md — PhotoScanner: multi-page capture flow, client-side image quality checks, page order detection, IndexedDB session persistence, UploadDropzone wiring
- [x] 05-04-PLAN.md — SopTable: rich table component with markdown parsing, SectionContent table detection, SectionEditor table editing support

### Phase 6: Video Transcription (Upload and URL)
**Goal**: Admins can upload an MP4/MOV video file or paste a YouTube URL and receive a structured SOP draft with the raw transcript visible for manual review — including adversarial AI verification and mandatory warnings when hazard or PPE sections are absent
**Depends on**: Phase 5
**Requirements**: VID-01, VID-02, VID-04, VID-05, VID-06, VID-07
**Success Criteria** (what must be TRUE):
  1. Admin can upload an MP4 or MOV video file; the upload progresses in named stages (uploading → transcribing → structuring → ready) with visible progress at each stage
  2. Admin can paste a YouTube URL and the system fetches captions into a structured SOP without downloading the video
  3. Admin sees the raw transcript alongside the structured SOP output in the review UI before publishing, with adversarial AI verification flags for discrepancies
  4. The system warns the admin when mandatory SOP sections (hazards, PPE) are absent from the video source
  5. Transcription-sourced SOPs pass through the same confidence scoring and admin approval gate as document-parsed SOPs before they can be published
**Plans**: 5 plans
**UI hint**: yes

Plans:
- [x] 06-00-PLAN.md — Wave 0: Playwright test stubs for all VID requirements (7 test files + config)
- [x] 06-01-PLAN.md — Foundation: DB migration (parse_jobs extensions, sop-videos bucket), type extensions (video SourceFileType, TranscriptSegment, VerificationFlag), validator updates, GPT parser video hint, npm package install
- [x] 06-02-PLAN.md — Video transcription pipeline: audio transcription (gpt-4o-transcribe), YouTube caption fetch (youtube-transcript), adversarial verification (Claude SDK), missing section detection, transcribe + youtube route handlers, video upload server action
- [x] 06-03-PLAN.md — Upload UX: UploadDropzone video MIME acceptance + YouTube URL tab with terms checkbox, ParseJobStatus 5-step video stage stepper with retry/delete
- [x] 06-04-PLAN.md — Review UI: VideoReviewPanel (video player + scrollable transcript with timestamp sync), AdversarialFlagBanner (expandable amber flag list), MissingSectionWarningBanner (warn-but-allow with acknowledge checkbox), ReviewClient + page wiring

### Phase 7: Video Transcription (In-App Recording)
**Goal**: Admins can record a procedure video directly in the browser and submit it for transcription into a structured SOP, with an explicit fallback for iOS devices where MediaRecorder support is unreliable
**Depends on**: Phase 6
**Requirements**: VID-03
**Success Criteria** (what must be TRUE):
  1. Admin can tap "Record video" on Android/Chrome and capture a procedure directly in the browser; on submission the recording is transcribed into a structured SOP via the same pipeline as uploaded videos
  2. On iOS devices where MediaRecorder is unsupported or unreliable, the admin sees an explicit fallback message directing them to use file upload instead of silently failing
**Plans**: 1 plan
**UI hint**: yes

Plans:
- [ ] 07-01-PLAN.md — VideoRecorder overlay (full-screen camera recording, 15-min timer, audio extraction, preview) + UploadDropzone Record tab with iOS fallback

### Phase 8: Video SOP Generation
**Goal**: Admins can generate narrated slideshow, screen-recording-style, and full AI video versions of any published SOP, workers can watch those videos with chapter navigation from within the SOP view, and video viewing is tracked as a completion event
**Depends on**: Phase 5
**Requirements**: VGEN-01, VGEN-02, VGEN-03, VGEN-04, VGEN-05, VGEN-06, VGEN-07, VGEN-08, VGEN-09, INFRA-03
**Success Criteria** (what must be TRUE):
  1. Admin can trigger generation of a narrated slideshow (one slide per section, AI voiceover, hazards before steps always) or a scrolling-text screen-recording-style video from any published SOP; generation shows named stages (analyzing → generating → adding narration → finalizing)
  2. Admin can trigger generation of a full AI avatar or animated-visual video from a published SOP (highest cost format — shown separately from the two standard formats)
  3. Admin can preview the generated video and re-generate before publishing; a "video is outdated" warning appears when the source SOP is updated after video generation
  4. Workers see a "Video version" button within the SOP view; the video player supports chapter navigation, timestamp jumps to specific sections, and playback speed control
  5. Worker video viewing is recorded as a completion event in the same audit trail as text walkthrough completions; generated videos are excluded from service worker caching to prevent device storage bloat
**Plans**: TBD
**UI hint**: yes

Plans:
- [x] 08-00-PLAN.md — Wave 0: Playwright test stubs for all VGEN and INFRA-03 requirements (7 test files + config, VGEN-03 marked DEFERRED per D-01)
- [x] 08-01-PLAN.md — Foundation: DB migration (video_generation_jobs), TypeScript types, Zod validators, TTS module (gpt-4o-mini-tts), Shotstack API client
- [x] 08-02-PLAN.md — Generation pipeline: narrated slideshow builder, screen-recording builder, pipeline orchestrator, API route, server actions
- [x] 08-03-PLAN.md — TBD
- [x] 08-04-PLAN.md — TBD

### Phase 9: Streamlined File → Video Pipeline
**Goal**: Admin can upload a source file (docx/pdf/image/xlsx/pptx/video) and reach a generated video SOP in a single guided flow without manually navigating between parse review, publish, and video generation as three separate steps
**Depends on**: Phase 5, Phase 8
**Requirements**: PATH-01, PATH-02, PATH-03, PATH-04, PATH-05, PATH-06
**Success Criteria** (what must be TRUE):
  1. Admin clicks "Generate video SOP" on UploadDropzone, selects a format in a modal, picks a file, and is landed on a unified progress page
  2. A single pipeline_run_id links upload → parse_job → sop → video_generation_job for stepper rendering and audit
  3. Publishing a pipeline-linked SOP auto-queues video generation with the format chosen at upload; the existing publish review gate is preserved exactly
  4. The progress page renders 5 named stages (Uploading, Parsing, Review, Generating video, Ready) with deep-link CTAs to the review page and video panel
  5. Video generation failure after publish keeps the SOP published and routes the admin to the existing video panel retry path
**Plans**: 5 plans
**UI hint**: yes

Plans:
- [x] 09-00-PLAN.md — Wave 0: Playwright test stubs for all six PATH requirements (pipeline-entry, pipeline-linkage, pipeline-autoqueue, pipeline-progress, pipeline-failure-recovery, pipeline-review-gate)
- [x] 09-01-PLAN.md — Foundation: sop_pipeline_runs migration + pipeline_run_id FKs on parse_jobs/sops/video_generation_jobs, type + validator extensions, createVideoSopPipelineSession server action
- [x] 09-02-PLAN.md — Entry UI: "Generate video SOP" button on UploadDropzone + VideoFormatSelectionModal (file + format picker + upload dispatch + navigate to progress page)
- [x] 09-03-PLAN.md — Publish auto-queue: enqueueVideoGenerationForPipeline helper + publish route extension (gate preserved, auto-queue runs after successful publish)
- [x] 09-04-PLAN.md — Progress page: /admin/sops/pipeline/[pipelineId] route with 5-stage PipelineStepper, realtime+polling hybrid, deep-link CTAs, ReviewClient back-to-pipeline breadcrumb

### Phase 10: Video Version Management
**Goal**: Admins can generate multiple video versions from a single published SOP, label and manage each version, and control which version workers see — with edit, archive, and re-generate controls
**Depends on**: Phase 8
**Requirements**: VVM-01, VVM-02, VVM-03, VVM-04, VVM-05, VVM-06, VVM-07, VVM-08
**Success Criteria** (what must be TRUE):
  1. Admin can generate multiple video versions per SOP; each generation creates a new version row with auto-incrementing version number
  2. Version list shows all non-archived versions in descending order with v1/v2/v3 labels, format badges, and status badges
  3. Publishing a version auto-unpublishes all other versions for that SOP; workers see only the published version
  4. Admin can archive versions (soft delete to collapsible section) and permanently delete from archive
  5. Admin can edit an optional label on each version (max 60 chars) via inline editor
  6. Active/generating versions show live progress stepper inline in the version list
**Plans**: 4 plans
**UI hint**: yes

Plans:
- [x] 10-01-PLAN.md — Foundation: Playwright test stubs (8 VVM stubs), DB migration 00018 (drop UNIQUE, add version_number/label/archived, partial unique index), TypeScript type extensions
- [x] 10-02-PLAN.md — Server actions: generateNewVersion, publishVersionExclusive, archiveVersion, unarchiveVersion, permanentDeleteVersion, updateVersionLabel + generate-video route update
- [x] 10-03-PLAN.md — UI components: VideoVersionRow (inline actions, confirm panels, label editor, generation stepper) + VideoVersionList (version rows, collapsible archived section, empty state)
- [x] 10-04-PLAN.md — Wiring: Rewrite VideoGeneratePanel + video page for multi-version, update VideoAdminPreview actions, push DB schema, human verification checkpoint

<!-- ======================================================================= -->
<!-- v3.0 — SOP Builder milestone (Phases 11–18)                             -->
<!-- ======================================================================= -->

### Phase 11: Section Schema & Block Foundation
**Goal**: The additive data model for v3.0 is in place — `section_kinds` catalog, `blocks` / `block_versions` / `sop_section_blocks` junction, legacy fallback, RLS, types, validators — and wave-0 Playwright stubs exist for every SB-XX requirement so downstream phases can execute on a prepared test surface
**Depends on**: Phase 4 (v1 sop_sections schema)
**Requirements**: SB-SECT-01, SB-SECT-02, SB-SECT-03, SB-SECT-04
**Success Criteria** (what must be TRUE):
  1. Admin can add two "Hazards" sections to the same SOP scoped to different machine states, and both render correctly in the worker walkthrough via the joined `section_kinds` metadata (icon, colour, render priority)
  2. Admin can define a custom section with an admin-provided title (e.g. "Pre-flight check") and it renders in the worker walkthrough using the `custom` render family fallback
  3. Every v1/v2 SOP still renders identically — the `section_kinds` catalog is seeded with canonical kinds, and legacy `section_type` substring matching remains the fallback path for rows with no `section_kind_id`
  4. Wave-0 Playwright stubs exist for all 37 SB-XX requirements and are registered in a new `phase11-stubs` test project
**Plans**: TBD
**UI hint**: no

Plans:
- [x] 11-00-PLAN.md — Wave 0: Playwright test stubs for every SB-XX requirement (SB-AUTH, SB-SECT, SB-LAYOUT, SB-ANNOT, SB-COLLAB, SB-BLOCK, SB-INFRA) + `phase11-stubs` project config
- [x] 11-01-PLAN.md — DB migration: `section_kinds` catalog (with canonical seed rows: hazards, ppe, steps, emergency, signoff, content, custom), `blocks` + `block_versions` tables, `sop_section_blocks` junction with `pin_mode` + snapshot columns, `sop_sections.section_kind_id` advisory FK, RLS policies (org-scoped + null-org global read)
- [x] 11-02-PLAN.md — Type layer: `SectionKind`, `Block`, `BlockVersion`, `SopSectionBlock` TypeScript types; Zod validators; walkthrough renderer extension to read `section_kinds` join with legacy substring fallback; verify all v1/v2 SOPs render unchanged
- [x] 11-03-PLAN.md — Admin UI plumbing: section-kind picker in the existing admin review UI, add-custom-section control, multi-instance-of-same-kind support, regression pass against Phase 2/5/6 review UIs

### Phase 12: Builder Shell & Blank-Page Authoring
**Goal**: Admin can start a new SOP from a blank wizard, reach one unified Puck-based builder regardless of entry point, drag blocks onto each section, save drafts auto-debounced to Dexie + Supabase, and workers continue to render every existing SOP via a legacy linear fallback when `layout_data` is absent
**Depends on**: Phase 11
**Requirements**: SB-AUTH-01, SB-AUTH-04, SB-AUTH-05, SB-LAYOUT-01, SB-LAYOUT-02, SB-LAYOUT-03, SB-LAYOUT-04, SB-LAYOUT-06, SB-SECT-05
**Success Criteria** (what must be TRUE):
  1. Admin can click "New SOP" → blank-page wizard (title → canonical sections → review → draft save) and land in the builder without uploading anything
  2. Admin can drag text, heading, photo, callout, step, hazard-card, and PPE-card blocks onto a page, rearrange them, and reflow the result on a 5.5" phone preview via Tailwind breakpoints without authoring a separate mobile variant
  3. Every block component renders identically in the admin editor and the worker walkthrough — there is one component tree, not two
  4. Layout persists as JSONB on `sop_sections.layout_data` with a `layout_version` pin, and admin can reorder sections via drag-and-drop (persists as `sort_order`)
  5. Legacy SOPs with no `layout_data` still render correctly in the worker walkthrough via the linear step-list fallback renderer
  6. A builder-authored draft is visually distinguishable from an uploaded draft in the admin SOP library, but both flow through the same Phase 2 publish gate
**Plans**: 4 plans
**UI hint**: yes

Plans:
- [x] 12-01-PLAN.md — Puck infrastructure: install `@puckeditor/core@0.21.2` (renamed from @measured/puck), admin `/admin/sops/builder/[sopId]` route with `'use client'` + `next/dynamic`(ssr:false), migration 00020 (layout_data JSONB + layout_version INT + sops.source_type + reorder_sections RPC), worker LayoutRenderer branch + linear fallback in SectionContent
- [x] 12-02-PLAN.md — Block components: 7 shared blocks (Text, Heading, Photo, Callout, Step, HazardCard, PPECard) lifted from SectionContent palette with co-located Zod schemas; puck-config.tsx registers all 7 with SafeRender guards; BuilderClient + LayoutRenderer share the same config
- [x] 12-03-PLAN.md — Blank-page wizard + library chip: 4-step wizard (title → canonical kinds → review → submit), createSopFromWizard server action (source_type='blank' + compensating cleanup), AUTHORED IN BUILDER chip in /admin/sops. SEND TO REVIEW reuses existing review page + publish route (D-04). D-08 purge wired into sync engine + ReviewClient.
- [x] 12-04-PLAN.md — Draft persistence + section reorder: Dexie v4 draftLayouts table, flushDraftLayouts in sync-engine (LWW via server_newer sentinel + overwrittenByServer toast), useBuilderAutosave (750ms) + useDraftLayoutSync (3s), reorderSections server action via reorder_sections RPC, SectionListSidebar with HTML5 drag handles, updateSectionLayout with 128KB cap, DESKTOP/MOBILE preview toggle (430px phone-frame)

Verifier verdict: FLAG (human_needed) — 9/9 requirements structurally verified, no duplicate publish flow, no stub-dressed tests. 11-item UAT required before REQUIREMENTS.md flip. See `12-VERIFICATION.md`.

### Phase 12.5: Blueprint Redesign
**Goal**: Ship the worker-first engineering-drawing UI. Workers, supervisors, and admins all use a single unified tabbed interface (overview / tools / hazards / flow / model / walkthrough) on paper/ink palette with JetBrains Mono + Inter typography and 20px grid-paper backgrounds on canvas screens. Mobile walkthrough is immersive (full-screen step card). Voice capture (server-side transcription) populates measurements and free-form notes. Command palette (Cmd/Ctrl+K) enables jump-to-step + ask-AI (SOP-scoped) + tool/hazard lookup. 7 new AI-accessible block types ship with the redesign and are exposed via `/api/schema` through the three-place contract.
**Depends on**: Phase 11, Phase 12
**Requirements**: SB-UX-01..SB-UX-10 (to be assigned in SPEC.md)
**Success Criteria** (what must be TRUE):
  1. Worker `/sops/[sopId]` renders the 6-tab interface with paper/ink palette — no more steel-900/brand-yellow dark theme on worker-facing routes
  2. Mobile walkthrough is immersive-only on phones (≤430px); list-style walkthrough still available on desktop
  3. 7 new block types registered in puckConfig + `/api/schema` + BlockContentSchema (three-place contract): Measurement, Decision, Escalate, SignOff, Zone, Inspect, VoiceNote
  4. EscalateBlock accepts `escalationMode: 'alert' | 'lock' | 'form'` prop; default is `form` (supervisor form with audit trail)
  5. Voice capture works end-to-end with server-side transcription: idle → listening → transcribing → captured → persisted to cloud
  6. Command palette responds to Cmd/Ctrl+K globally; returns results from JUMP TO STEP + ASK AI (scoped to current SOP only) + TOOLS & HAZARDS
  7. Preview toggle (desktop ↔ 430px mobile frame) is available on worker-facing tabs (not just admin builder); preference persists in localStorage
  8. Flow tab renders an SVG node graph built via BOTH derivation (Option A: from sections/steps + block types) AND an explicit `sops.flow_graph` JSONB column (Option B) — derived is the default, explicit overrides when present
  9. Flow graph is editable inside the Puck editor (extend Puck for flow-graph authoring — NOT a separate tool)
  10. ModelBlock is registered in the three-place contract (palette entry + schema) but the 3D viewer implementation is stubbed behind a feature flag; file formats and upload flow deferred to a future phase
**Plans**: TBD (created by /gsd-plan-phase after spec+discuss)
**UI hint**: yes (heavy)

Resolved open questions (from sketch wrap-up):
- Scope: all tabs at once
- Voice: server-side transcription
- 3D: exclude format support for now; stub ModelBlock
- Escalation: hybrid — EscalateBlock carries per-instance `escalationMode`; default = supervisor form
- Flow editing: inside Puck
- New blocks: all 7 (excl. ModelBlock) ship in 12.5
- Mobile walkthrough: both modes (immersive + list) — immersive default on phones
- cmdk Ask AI: SOP-scoped only
- Voice notes: cloud-first persistence
- Flow data shape: build BOTH derivation (A) and explicit JSONB (B); derived is default, explicit overrides when present

Canonical refs:
- Design skill: `.claude/skills/sketch-findings-SOPstart/` (auto-loaded via CLAUDE.md)
- Sketch source: `sketches/sop-blueprint/index.html`
- Wrap-up: `.planning/sketches/WRAP-UP-SUMMARY.md`

### Phase 13: Reusable Block Library
**Goal**: Admin can save, browse, and re-use hazard / PPE / step blocks from an org-scoped library alongside a read-only NZ global block set, and the wizard surfaces matching blocks at the right step with explicit pin-version vs follow-latest semantics
**Depends on**: Phase 11, Phase 12
**Requirements**: SB-BLOCK-01, SB-BLOCK-02, SB-BLOCK-03, SB-BLOCK-04, SB-BLOCK-05, SB-BLOCK-06
**Success Criteria** (what must be TRUE):
  1. Admin can save any hazard / PPE / step as a reusable block to their organisation's library with a name and optional category tags
  2. The builder wizard shows "Pick from library (N matches)" alongside "Write new" at the appropriate section step, filtered by section kind and SOP category
  3. Global NZ blocks (WorkSafe standards, common machinery hazards) are visible read-only to every org, while org-created blocks are isolated via RLS
  4. When a block is added to a SOP, its content is snapshotted into the `sop_section_blocks` junction row so the SOP renders correctly even if the block is later deleted or the worker is offline
  5. Admin can choose "pin to this version" (default) or "follow latest" per block usage; follow-latest SOPs show an "update available" badge when the source block changes and route through the publish gate before workers see the update
**Plans**: 5 plans
**UI hint**: yes

Plans:
- [x] 13-01-PLAN.md — Block CRUD foundation: server actions (`createBlock` with scope option, `updateBlock`, `archiveBlock`, `saveFromSection`, `listBlocks` with globalOnly + includeContent options, `promoteSuggestion`, `rejectSuggestion`), `/admin/blocks` library list page, block detail/editor, org-vs-global RLS policies, category tag support, `sops.category_tag` column (D-Tax-03) (completed 2026-05-07)
- [ ] 13-02-PLAN.md — NZ global block seed: migration with WorkSafe hazards, common PPE (hi-vis, hearing, respirator, harness), machinery hazard library (forklift, grinder, press brake), chemical-handling blocks; seed rows with `organisation_id = null`
- [ ] 13-03-PLAN.md — Wizard integration: SOP-level category select (D-Tax-03), `BlockPicker` component filtered by kind + SOP category, "Pick from library" tab alongside "Write new" in the wizard, pin-vs-follow-latest toggle per selection, snapshot-on-add via junction table, atomic `reorder_sop_section_blocks` RPC, three-dot menu via Puck componentItem override
- [ ] 13-04-PLAN.md — Follow-latest tracking + update badging: AFTER-INSERT trigger on `block_versions` flips `update_available`, accept/decline RPCs, `sop_block_update_decisions` audit table, `UpdateAvailableBadge` + `BlockUpdateReviewModal`, publish-gate integration (status flip published->draft on accept), diff function
- [ ] 13-05-PLAN.md — Summit super-admin curation UI: `summit-admin-guard.ts` route guard, `/admin/global-blocks` landing (lists globals via `listBlocks({ globalOnly: true })`), `/admin/global-blocks/suggestions` queue with promote/reject, `SuggestionReviewRow` component (no schema changes)

### Phase 14: AI-Drafted SOPs
**Goal**: Admin can type a natural-language prompt ("PPE check for forklift operators at our Hamilton site") and receive a structured draft pre-filled with hazards, PPE, steps, and emergency sections — which passes the Phase 6 adversarial Claude verification gate before reaching the admin review UI, then opens in the same builder used for blank-page and template flows
**Depends on**: Phase 6 (adversarial verifier), Phase 12 (builder shell)
**Requirements**: SB-AUTH-02, SB-INFRA-04
**Success Criteria** (what must be TRUE):
  1. Admin can enter a natural-language prompt and receive a structured SOP draft within the named-stages progress UI used by Phase 6
  2. The AI-drafted output is cross-checked by Claude (adversarial verifier) before it reaches the admin review UI — hallucinated hazards or missing PPE sections are flagged in the same amber-banner UI used for video transcription
  3. Once reviewed, the AI draft lands in the same unified builder surface as blank-page and template flows — admin cannot tell "draft source: AI" apart from "draft source: blank" once they're editing
  4. The draft flows through the existing Phase 2 publish gate and Phase 11 section-kind resolver
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 14-01-PLAN.md — Prompt entry: `/admin/sops/new/ai` route with prompt textarea, category selector, named-stage progress UI; `parse_jobs` row with `source: 'ai_prompt'` to reuse existing stage stepper
- [ ] 14-02-PLAN.md — GPT-4o structured draft generator: prompt-engineering pass, structured output schema matching `SopSection[]`, `section_kind_id` assignment, integration with GPT parser module
- [ ] 14-03-PLAN.md — Adversarial verification reuse: route AI draft through existing Phase 6 Claude verifier, surface flags via existing `AdversarialFlagBanner`, missing-section detection, land draft in the builder with flags visible in the review panel

### Phase 15: NZ Template Library
**Goal**: Admin can browse a curated NZ template library (WorkSafe categories, common machinery, chemical handling) and pick a template as the starting point for a new SOP — which opens in the same unified builder surface as blank-page and AI flows
**Depends on**: Phase 12, Phase 13 (template entries reuse block library rows)
**Requirements**: SB-AUTH-03
**Success Criteria** (what must be TRUE):
  1. Admin sees a NZ template library organised by WorkSafe category, common machinery, and chemical-handling families on `/admin/sops/new/template`
  2. Selecting a template clones its sections, blocks, and `layout_data` into a new draft SOP and opens the unified builder
  3. The template clone is independent — editing the new SOP does not modify the template, and templates can be updated without affecting existing SOPs
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 15-01-PLAN.md — Template catalog: `sop_templates` table (or flag on `sops` with `is_template`), curation list with NZ WorkSafe categories, seed data for forklift ops, grinder use, chemical handling, confined space entry, hot work permit
- [ ] 15-02-PLAN.md — Template picker UI: `/admin/sops/new/template` route, category sidebar + card grid, template preview drawer, "Use this template" action that clones sections + blocks + layout into a fresh draft SOP

### Phase 16: Image & Diagram Annotation
**Goal**: Admin can non-destructively annotate any photo or diagram with arrows, rectangles, ellipses, text labels, numbered callouts, and freehand sketches (with Apple Pencil palm rejection), re-edit them later, and place numbered hotspots at freeform x/y on a machine diagram via a specialty `DiagramHotspotBlock` — while workers never download Konva because a baked PNG is served for the read path
**Depends on**: Phase 11 (section schema), Phase 12 (builder shell — annotation is invoked from photo blocks)
**Requirements**: SB-ANNOT-01, SB-ANNOT-02, SB-ANNOT-03, SB-ANNOT-04, SB-ANNOT-05, SB-LAYOUT-05
**Success Criteria** (what must be TRUE):
  1. Admin can open any photo or diagram block in the annotation editor, draw arrows / rectangles / ellipses / text labels / numbered callouts, and save — and re-open the same image later to edit those exact annotations (non-destructive Konva JSON scene graph)
  2. On publish, the client bakes a flattened PNG of the annotated image to Supabase Storage at a version-bumped path; workers load the baked PNG via `<img>` and the worker route's First Load JS does not grow by Konva's size
  3. Admin can add a `DiagramHotspotBlock` to any section, drop a machine diagram into it, and place numbered callouts at freeform x/y on the diagram (the only freeform-positioning exception in the otherwise block-reflow builder)
  4. Apple Pencil / stylus freehand sketching works with palm rejection when a pen is detected; non-pen input is filtered while pen-mode is active
  5. If admin replaces the underlying image with a new one of similar dimensions, annotation coordinates are preserved and admin is prompted to review placement before saving
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 16-01-PLAN.md — Konva foundation: install `konva` + `react-konva`, `serverExternalPackages: ['canvas']` in `next.config.ts`, `sop_image_annotations` migration (scene jsonb, natural_width, natural_height, baked_storage_path, baked_at, RLS), dynamic-imported `AnnotationEditor` component stub on admin route, Next.js 16 canvas-module spike
- [ ] 16-02-PLAN.md — Annotation primitives: Arrow / Rect / Ellipse / Text / Label (numbered callout) / Line (freehand) tools, `Konva.Transformer` wiring for resize + rotate, undo/redo via scene JSON snapshots, text-editing `<textarea>` overlay, stylus pointer-type filter + palm-rejection toggle
- [ ] 16-03-PLAN.md — Bake-on-publish pipeline: client-side `stage.toDataURL()` flatten, upload to `sop-images/baked/{sop_id}/{image_id}.v{N}.png`, update `baked_storage_path` + `baked_at`, worker read path prefers baked PNG, PhotoBlock renderer switches baked-vs-raw without importing Konva
- [ ] 16-04-PLAN.md — DiagramHotspotBlock: specialty Puck block with image drop zone + freeform x/y numbered-hotspot placement, coordinate preservation on photo replacement with review prompt, integration with the rest of the builder's block set

### Phase 17: Collaborative Editing
**Goal**: Multi-admin teams can concurrently edit different sections of the same SOP draft without conflict, see presence indicators for who is editing what, and safely reconcile offline edits on reconnect — via section-level pessimistic locks plus an optimistic version column and a plain-English conflict modal
**Depends on**: Phase 11 (schema), Phase 12 (builder shell — locks live in section edit flow)
**Requirements**: SB-COLLAB-01, SB-COLLAB-02, SB-COLLAB-03, SB-COLLAB-04, SB-COLLAB-05, SB-COLLAB-06
**Success Criteria** (what must be TRUE):
  1. When Alice opens a section for editing, Bob sees "Alice is editing this section" and cannot modify it until the lock releases; Bob can concurrently edit a *different* section on the same SOP without conflict
  2. Locks auto-release after 5 minutes of inactivity (heartbeat expiry), on explicit release, or on tab close — no admin can permanently block a section
  3. Admin who held a lock before going offline can continue editing locally; on reconnect, changes push cleanly if the optimistic `version` column has not advanced, otherwise a "keep mine / keep theirs / merge manually" modal appears
  4. Presence indicators (who-is-editing-what) route through per-organisation Supabase Realtime channels with zero cross-tenant leakage
  5. All collaborative-editing UI, lock logic, and presence channels are gated behind admin routes — a `next build` bundle analysis shows zero leakage into worker routes
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 17-01-PLAN.md — Lock schema: migration adding `locked_by`, `locked_at`, `lock_expires_at`, `version` to `sop_sections`; RLS policy updates; `acquireLock` / `releaseLock` / `heartbeat` server actions; 5-minute expiry sweep
- [ ] 17-02-PLAN.md — Presence + UI: Supabase Realtime presence channel per SOP (org-scoped via channel name), `SectionLockIndicator` component (avatar + "Alice is editing"), read-only guard when locked by another admin, explicit release on tab close
- [ ] 17-03-PLAN.md — Offline handoff + conflict modal: optimistic version bump on save, "keep mine / keep theirs / merge manually" modal on reconnect when server version has advanced, Dexie draft sync integration, wave-1 verification that worker routes do not import presence or lock logic

### Phase 18: Pipeline Integration, Bundle Isolation & v3.0 Closeout
**Goal**: Builder-authored SOPs route through the Phase 9 `sop_pipeline_runs` linkage for one-click video generation, the builder auto-saves through the existing Dexie + sync-engine path without any new "save" step, and a CI check proves that Puck, Konva, Yjs, and y-dexie stay out of worker bundles — closing out the v3.0 milestone
**Depends on**: Phase 9 (pipeline runs), Phase 12, Phase 16, Phase 17
**Requirements**: SB-INFRA-01, SB-INFRA-02, SB-INFRA-03
**Success Criteria** (what must be TRUE):
  1. Admin can author a SOP in the builder, click "Generate video SOP", and flow through the same Phase 9 unified progress page and publish auto-queue used by uploaded SOPs — via a shared `pipeline_run_id`
  2. The builder auto-saves to Dexie on change and to Supabase on a debounce with no explicit "save" button visible to the admin; offline authoring continues working uninterrupted across network drops
  3. A CI script runs `next build` and asserts that the worker walkthrough route's First Load JS does not include `@measured/puck`, `konva`, `react-konva`, `yjs`, or `y-dexie` import paths; build fails if any slip in
  4. v3.0 milestone closeout: all SB-XX requirements have passing tests, Dexie schema bump is deployed, bundle CI check is green, and human verification checklist is signed off
**Plans**: TBD
**UI hint**: yes

Plans:
- [ ] 18-01-PLAN.md — Pipeline linkage: extend `createVideoSopPipelineSession` to accept a builder-authored SOP id, route "Generate video SOP" button into the existing Phase 9 progress page, verify publish auto-queue works for builder-sourced SOPs
- [ ] 18-02-PLAN.md — Dexie + sync-engine closeout: final Dexie schema bump (draftLayouts, sopImageAnnotations, sectionLocks mirrors), sync-engine hook-up for each new table, offline authoring end-to-end verification
- [ ] 18-03-PLAN.md — Bundle isolation CI: `scripts/check-worker-bundle.ts` that parses `.next/app-build-manifest.json` and fails on disallowed imports in worker route chunks, wire into `npm run build`, regression pass
- [ ] 18-04-PLAN.md — v3.0 human verification + milestone closeout: human UAT checklist covering every SB-XX requirement, verification run, learnings log entries, milestone retrospective hand-off

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete   | 2026-03-23 |
| 2. Document Intake | 4/4 | Complete   | 2026-03-25 |
| 3. Worker Experience | 6/6 | Complete   | 2026-03-25 |
| 4. Completion and Sign-off | 3/3 | Complete   | 2026-03-26 |
| 5. Expanded File Intake | 4/4 | Complete   | 2026-04-03 |
| 6. Video Transcription (Upload and URL) | 5/5 | Complete   | 2026-04-03 |
| 7. Video Transcription (In-App Recording) | 1/1 | Complete   | 2026-04-04 |
| 8. Video SOP Generation | 5/5 | Complete   | 2026-04-04 |
| 9. Streamlined File → Video Pipeline | 1/5 | In Progress|  |
| 10. Video Version Management | 4/4 | Complete    | 2026-04-13 |
| 11. Section Schema & Block Foundation | 4/4 | Complete    | 2026-04-15 |
| 12. Builder Shell & Blank-Page Authoring | 0/4 | Not started |  |
| 13. Reusable Block Library | 0/4 | Not started |  |
| 14. AI-Drafted SOPs | 0/3 | Not started |  |
| 15. NZ Template Library | 0/2 | Not started |  |
| 16. Image & Diagram Annotation | 0/4 | Not started |  |
| 17. Collaborative Editing | 0/3 | Not started |  |
| 18. Pipeline Integration, Bundle Isolation & v3.0 Closeout | 0/4 | Not started |  |

## Backlog

### Phase 999.1: Stale video job cleanup service (BACKLOG)

**Goal:** Scheduled task or cron that marks video_generation_jobs stuck in queued/analyzing/generating_audio/rendering for >30 minutes as 'failed' with a timeout error. Could also notify admin. Triggered by finding a hours-old rendering job during Phase 10 verification.
**Requirements:** TBD
**Plans:** 4/4 plans complete

Plans:
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.2: Graphify full LLM build (BACKLOG)

**Goal:** Run the full `/graphify` pipeline (not AST-only) across src/, .planning/, supabase/migrations/, scripts/ so the knowledge graph also captures doc→code rationale edges, cross-phase concept clustering, and plan→commit traceability. AST-only graph already exists (961 nodes / 155 communities) — this upgrades it with semantic-subagent extraction + community labelling.
**Requirements:** N/A (internal developer tooling)
**Plans:** 1 plan stubbed

Plans:
- [ ] Full-corpus graphify run: dispatch ~40+ semantic subagents on src/ + .planning/ + supabase/migrations/; build `graphify-out/graph.json` with EXTRACTED/INFERRED/AMBIGUOUS edges; label communities; produce HTML viz. Estimated cost: ~40 subagents × ~45s = ~10-15 min wall, ~$1-3 token spend. Triggered when Phase 13 planning needs cross-document concept surfacing (e.g. "which phase-12 blocks relate to phase-13 reusable library requirements").
