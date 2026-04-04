# Roadmap: SOP Assistant

## Overview

Four phases deliver the complete v1 product. Phase 1 establishes the multi-tenant foundation that every subsequent feature depends on — this cannot be retrofitted. Phase 2 builds the AI document ingestion pipeline, the core product differentiator. Phase 3 delivers the full worker-facing experience including offline access, SOP library, and SOP management. Phase 4 closes the loop with completion tracking, photo evidence, and supervisor sign-off.

v2.0 adds four phases (5–8) delivering three new SOP creation pathways and a video consumption layer. Phase 5 establishes upload infrastructure and expanded file parsing. Phase 6 delivers video transcription via file upload and URL. Phase 7 adds in-app camera recording (gated on iOS Safari maturity). Phase 8 generates video SOPs from published structured content.

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
- [x] **Phase 6: Video Transcription (Upload and URL)** - MP4/MOV file upload and YouTube URL → structured SOP with transcript review (completed 2026-04-03)
- [ ] **Phase 7: Video Transcription (In-App Recording)** - In-browser camera recording → SOP transcription with iOS Safari fallback
- [ ] **Phase 8: Video SOP Generation** - AI-narrated slideshow, screen-recording-style, and full AI video generated from published SOPs

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
- [ ] 08-01-PLAN.md — TBD
- [ ] 08-02-PLAN.md — TBD
- [ ] 08-03-PLAN.md — TBD
- [ ] 08-04-PLAN.md — TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete   | 2026-03-23 |
| 2. Document Intake | 4/4 | Complete   | 2026-03-25 |
| 3. Worker Experience | 6/6 | Complete   | 2026-03-25 |
| 4. Completion and Sign-off | 3/3 | Complete   | 2026-03-26 |
| 5. Expanded File Intake | 4/4 | Complete   | 2026-04-03 |
| 6. Video Transcription (Upload and URL) | 5/5 | Complete   | 2026-04-03 |
| 7. Video Transcription (In-App Recording) | 0/1 | In progress | - |
| 8. Video SOP Generation | 1/TBD | In progress | - |
