# Roadmap: SOP Assistant

## Overview

Four phases deliver the complete v1 product. Phase 1 establishes the multi-tenant foundation that every subsequent feature depends on — this cannot be retrofitted. Phase 2 builds the AI document ingestion pipeline, the core product differentiator. Phase 3 delivers the full worker-facing experience including offline access, SOP library, and SOP management. Phase 4 closes the loop with completion tracking, photo evidence, and supervisor sign-off.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Multi-tenant auth, role-based access, and PWA shell (completed 2026-03-23)
- [x] **Phase 2: Document Intake** - AI parsing pipeline, admin review, and SOP publish workflow (completed 2026-03-24)
- [ ] **Phase 3: Worker Experience** - Step-by-step walkthrough, offline access, SOP library, and assignment
- [ ] **Phase 4: Completion and Sign-off** - Completion tracking, photo evidence, and supervisor sign-off

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
**Plans**: TBD

Plans:
- [ ] 03-01: Offline-first data layer — Dexie.js IndexedDB schema (SOPs, steps, completion states, photo queue), TanStack Query offlineFirst mode, SOP sync engine (version diff → fetch stale → cache images)
- [ ] 03-02: Worker SOP walkthrough UI — full-screen card interface, 72px+ touch targets, step navigation (forward/back), hazard/PPE prominence, image rendering with zoom, progress indicator
- [ ] 03-03: Quick reference mode — tabbed interface (Hazards / PPE / Steps / Emergency), direct section jump, per-SOP cache readiness indicator, offline status indicator
- [ ] 03-04: SOP library, search, and assignment — full-text search (title + content), browse by category/department, assigned SOPs first, admin assignment UI (role and individual)
- [ ] 03-05: SOP versioning and worker notifications — version integer, previous versions retained, admin re-upload flow, worker in-app notification on SOP update

### Phase 4: Completion and Sign-off
**Goal**: Worker completions are durably recorded with photo evidence and SOP version snapshot, and supervisors can review and sign off completions
**Depends on**: Phase 3
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07
**Success Criteria** (what must be TRUE):
  1. When a worker completes an SOP walkthrough, a completion record is created with a server-side timestamp and a reference to the exact SOP version followed
  2. Worker can capture photos during specific walkthrough steps; photos are tied to the step they were taken on
  3. Completion records cannot be deleted or modified after creation; they form an append-only audit trail
  4. Supervisor can view all completion records for workers they oversee and can approve or reject each completion
**Plans**: TBD

Plans:
- [ ] 04-01: Completion FSM and offline-first recording — not_started → in_progress → pending_sign_off state machine, append-only completions table, step completion recording via offline sync queue, SOP version hash snapshot at completion
- [ ] 04-02: Photo capture and upload queue — camera capture with iOS fallback (input[capture]), Canvas client-side compression (~200KB target), Dexie photo queue, flush to Supabase Storage on reconnect, step-photo foreign key
- [ ] 04-03: Supervisor sign-off UI — completion record list filtered to supervised workers, approve/reject action (creates second immutable record), completion status visible to supervisor

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete   | 2026-03-23 |
| 2. Document Intake | 4/4 | Complete   | 2026-03-24 |
| 3. Worker Experience | 0/5 | Not started | - |
| 4. Completion and Sign-off | 0/3 | Not started | - |
