# Requirements: SafeStart

**Defined:** 2026-03-23
**Core Value:** Workers can reliably follow any SOP on their phone, step-by-step, with the right safety information always visible — even offline.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Authentication & Multi-Tenancy

- [x] **AUTH-01**: Organisation can register and create an account with company details
- [x] **AUTH-02**: User can sign up with email and password within an organisation
- [x] **AUTH-03**: User session persists across browser refresh and app relaunch
- [x] **AUTH-04**: Admin can assign roles to users (Worker, Supervisor, Admin, Safety Manager)
- [x] **AUTH-05**: Each organisation's data is fully isolated from other organisations
- [x] **AUTH-06**: Users only see data belonging to their organisation

### Document Intake & Parsing

- [x] **PARSE-01**: Admin can upload SOP documents in Word (.docx) format
- [x] **PARSE-02**: Admin can upload SOP documents in PDF format
- [x] **PARSE-03**: AI automatically parses uploaded documents into structured sections (hazards, PPE, steps, emergency procedures, etc.)
- [x] **PARSE-04**: AI extracts embedded images and figures from uploaded documents
- [x] **PARSE-05**: Admin can review parsed SOP alongside original document before publishing
- [x] **PARSE-06**: Admin can edit/correct parsed sections before publishing
- [x] **PARSE-07**: Parsed SOPs remain in draft state until admin explicitly publishes them

### Worker Experience

- [x] **WORK-01**: Worker can walk through an SOP step-by-step with clear progress indication
- [x] **WORK-02**: Worker can navigate back to previous steps during a walkthrough
- [x] **WORK-03**: Worker can view SOP sections (Hazards, PPE, Steps, Emergency) via tabbed quick-reference mode
- [x] **WORK-04**: Worker can jump directly to any section without walking through all steps
- [x] **WORK-05**: Hazard and PPE information is prominently displayed before procedure steps begin
- [x] **WORK-06**: Images and figures display inline within SOP steps with zoom capability
- [x] **WORK-07**: Worker can access cached SOPs without internet connection
- [x] **WORK-08**: Data entered offline syncs automatically when connectivity returns
- [x] **WORK-09**: All primary actions (Next, Complete, Photo) use large tap targets (72px+) usable with gloves
- [x] **WORK-10**: Walkthrough uses full-screen card interface optimised for one-handed use

### Completion Tracking & Sign-off

- [x] **COMP-01**: Worker's SOP completion is recorded with server-side timestamp
- [x] **COMP-02**: Worker can capture photos as evidence during specific SOP steps
- [x] **COMP-03**: Photos are tied to the specific step they were captured on
- [x] **COMP-04**: Completion records reference the specific SOP version that was followed
- [x] **COMP-05**: Supervisor can view completion records for workers they oversee
- [x] **COMP-06**: Supervisor can approve or reject a worker's SOP completion
- [x] **COMP-07**: Completion records are immutable (append-only audit trail)

### SOP Management

- [x] **MGMT-01**: Admin can assign SOPs to specific roles or individual workers
- [x] **MGMT-02**: Worker sees assigned SOPs first when browsing the library
- [x] **MGMT-03**: Worker can search the full SOP library by title and content
- [x] **MGMT-04**: Worker can browse SOPs by category or department
- [x] **MGMT-05**: Admin can update an SOP by uploading a new version of the document
- [x] **MGMT-06**: Previous SOP versions are retained and linked to historical completions
- [x] **MGMT-07**: Workers are notified when an assigned SOP has been updated

### Platform

- [x] **PLAT-01**: App is a Progressive Web App installable to home screen on iOS and Android
- [x] **PLAT-02**: App works across modern Android and iOS browsers
- [x] **PLAT-03**: App indicates online/offline status to the user

## v2.0 Requirements

Requirements for SOP Creation Pathways milestone. Each maps to roadmap phases.

### Video Transcription & Intake

- [x] **VID-01**: Admin can upload a video file (MP4/MOV) and the system transcribes it into a structured SOP with standard sections
- [x] **VID-02**: Admin can paste a YouTube URL and the system extracts captions into a structured SOP (Vimeo deferred per D-06)
- [x] **VID-03**: Admin can record video in-app from the device camera and submit it for transcription into a structured SOP
- [x] **VID-04**: System shows async processing progress with named stages (uploading → transcribing → structuring → ready)
- [x] **VID-05**: Admin can view and edit the raw transcript alongside the structured SOP output before publishing
- [x] **VID-06**: Transcription-sourced SOPs go through the same confidence scoring and admin review gate as document-parsed SOPs
- [x] **VID-07**: System flags when mandatory SOP sections (hazards, PPE) are absent from the video source

### Expanded File Intake

- [x] **FILE-01**: Admin can upload a photo/image of a printed SOP and the system OCRs it into a structured SOP
- [x] **FILE-02**: System provides image quality feedback before processing (blur, glare, rotation detection)
- [x] **FILE-03**: Admin can capture multiple pages sequentially to create a single SOP from a multi-page printed document
- [x] **FILE-04**: Admin can upload Excel (.xlsx) files and the system extracts content into a structured SOP
- [x] **FILE-05**: Admin can upload PowerPoint (.pptx) files and the system extracts slides into a structured SOP
- [x] **FILE-06**: Admin can upload plain text (.txt) files and the system structures them into an SOP
- [ ] **FILE-07**: Table structures in Excel/PowerPoint are preserved as readable tables within SOP steps
- [x] **FILE-08**: AI parsing uses format-specific prompts for improved section detection across all input types

### Video SOP Generation

- [ ] **VGEN-01**: Admin can generate a narrated slideshow video from a published SOP with AI voiceover and one slide per section/step
- [ ] **VGEN-02**: Admin can generate a screen-recording-style video with scrolling SOP text synced to AI voice narration
- [ ] **VGEN-03**: Admin can generate a full AI video with avatar or animated visuals synchronized to narration
- [ ] **VGEN-04**: Generated videos include chapter markers per SOP section and timestamps per step for direct navigation
- [ ] **VGEN-05**: Admin can preview generated video and re-generate before publishing to workers
- [ ] **VGEN-06**: Video generation shows async progress with named stages (analyzing → generating → adding narration → finalizing)
- [ ] **VGEN-07**: Workers can access the video version of an SOP from within the existing SOP view with an in-app video player
- [ ] **VGEN-08**: Video player supports chapter navigation, timestamp jumps, and playback speed control
- [ ] **VGEN-09**: Worker video viewing is tracked as a completion event alongside text walkthrough completions

### Shared Infrastructure

- [x] **INFRA-01**: Video and large file uploads use resumable upload (TUS) direct to storage, bypassing server body limits
- [x] **INFRA-02**: All new intake pathways route through the existing SOP structuring pipeline and admin review UI
- [ ] **INFRA-03**: Generated videos are excluded from service worker caching to prevent device storage bloat

## Future Requirements

Deferred to future release. Tracked but not in current roadmap.

### Compliance & Competency

- **COMPL-01**: Multi-role competency sign-off chain (worker → trainer → verifier → manager)
- **COMPL-02**: Acknowledgement tracking — workers confirm reading of updated SOPs with audit trail
- **COMPL-03**: Audit report export (PDF/CSV) for compliance reporting

### Administration

- **ADMIN-01**: Bulk CSV user import for large organisations
- **ADMIN-02**: SSO / SCIM integration for enterprise customers
- **ADMIN-03**: Analytics dashboard (completion rates, time per step, drop-off points)

### Advanced Features

- **ADV-01**: Skills matrix / training assignment tracking
- **ADV-02**: Multi-language support for SOP content

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| In-app SOP authoring | Orgs already have SOPs in docs — focus on consuming, not creating. Would double scope. |
| Real-time chat between workers | Scope explosion; Slack/Teams already exist. Add "raise issue" button instead. |
| AI-generated SOP creation from scratch | Hallucinations in safety-critical content are dangerous; orgs have existing verified docs |
| Conditional branching in SOPs | Increases safety risk; manufacturing SOPs are linear by design |
| Public SOP marketplace | Liability issues — safety procedures from one org applied in another |
| Native iOS/Android apps | PWA-first; native later if needed |
| ERP/HR system integration | High per-client integration cost; manual user management for v1 |
| Custom voice cloning for video SOPs | Legal, ethical, and quality concerns — use pre-approved AI voices only |
| Interactive video branching | Different product category (Articulate Storyline); linear video with chapters is sufficient |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Complete |
| AUTH-06 | Phase 1 | Complete |
| PARSE-01 | Phase 2 | Complete |
| PARSE-02 | Phase 2 | Complete |
| PARSE-03 | Phase 2 | Complete |
| PARSE-04 | Phase 2 | Complete |
| PARSE-05 | Phase 2 | Complete |
| PARSE-06 | Phase 2 | Complete |
| PARSE-07 | Phase 2 | Complete |
| WORK-01 | Phase 3 | Complete |
| WORK-02 | Phase 3 | Complete |
| WORK-03 | Phase 3 | Complete |
| WORK-04 | Phase 3 | Complete |
| WORK-05 | Phase 3 | Complete |
| WORK-06 | Phase 3 | Complete |
| WORK-07 | Phase 3 | Complete |
| WORK-08 | Phase 3 | Complete |
| WORK-09 | Phase 3 | Complete |
| WORK-10 | Phase 3 | Complete |
| COMP-01 | Phase 4 | Complete |
| COMP-02 | Phase 4 | Complete |
| COMP-03 | Phase 4 | Complete |
| COMP-04 | Phase 4 | Complete |
| COMP-05 | Phase 4 | Complete |
| COMP-06 | Phase 4 | Complete |
| COMP-07 | Phase 4 | Complete |
| MGMT-01 | Phase 3 | Complete |
| MGMT-02 | Phase 3 | Complete |
| MGMT-03 | Phase 3 | Complete |
| MGMT-04 | Phase 3 | Complete |
| MGMT-05 | Phase 3 | Complete |
| MGMT-06 | Phase 3 | Complete |
| MGMT-07 | Phase 3 | Complete |
| PLAT-01 | Phase 1 | Complete |
| PLAT-02 | Phase 1 | Complete |
| PLAT-03 | Phase 1 | Complete |
| FILE-01 | Phase 5 | Complete |
| FILE-02 | Phase 5 | Complete |
| FILE-03 | Phase 5 | Complete |
| FILE-04 | Phase 5 | Complete |
| FILE-05 | Phase 5 | Complete |
| FILE-06 | Phase 5 | Complete |
| FILE-07 | Phase 5 | Pending |
| FILE-08 | Phase 5 | Complete |
| INFRA-01 | Phase 5 | Complete |
| INFRA-02 | Phase 5 | Complete |
| VID-01 | Phase 6 | Complete |
| VID-02 | Phase 6 | Complete |
| VID-04 | Phase 6 | Complete |
| VID-05 | Phase 6 | Complete |
| VID-06 | Phase 6 | Complete |
| VID-07 | Phase 6 | Complete |
| VID-03 | Phase 7 | Complete |
| VGEN-01 | Phase 8 | Pending |
| VGEN-02 | Phase 8 | Pending |
| VGEN-03 | Phase 8 | Pending |
| VGEN-04 | Phase 8 | Pending |
| VGEN-05 | Phase 8 | Pending |
| VGEN-06 | Phase 8 | Pending |
| VGEN-07 | Phase 8 | Pending |
| VGEN-08 | Phase 8 | Pending |
| VGEN-09 | Phase 8 | Pending |
| INFRA-03 | Phase 8 | Pending |

**v1 Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

**v2.0 Coverage:**
- v2.0 requirements: 27 total (note: original count of 28 in prior traceability header was off-by-one)
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-29 — v2.0 traceability mapped (Phases 5–8)*
