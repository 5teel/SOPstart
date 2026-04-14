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

- [x] **VGEN-01**: Admin can generate a narrated slideshow video from a published SOP with AI voiceover and one slide per section/step
- [x] **VGEN-02**: Admin can generate a screen-recording-style video with scrolling SOP text synced to AI voice narration
- [ ] **VGEN-03**: Admin can generate a full AI video with avatar or animated visuals synchronized to narration
- [x] **VGEN-04**: Generated videos include chapter markers per SOP section and timestamps per step for direct navigation
- [x] **VGEN-05**: Admin can preview generated video and re-generate before publishing to workers
- [x] **VGEN-06**: Video generation shows async progress with named stages (analyzing → generating → adding narration → finalizing)
- [x] **VGEN-07**: Workers can access the video version of an SOP from within the existing SOP view with an in-app video player
- [x] **VGEN-08**: Video player supports chapter navigation, timestamp jumps, and playback speed control
- [x] **VGEN-09**: Worker video viewing is tracked as a completion event alongside text walkthrough completions

### Shared Infrastructure

- [x] **INFRA-01**: Video and large file uploads use resumable upload (TUS) direct to storage, bypassing server body limits
- [x] **INFRA-02**: All new intake pathways route through the existing SOP structuring pipeline and admin review UI
- [x] **INFRA-03**: Generated videos are excluded from service worker caching to prevent device storage bloat

## v3.0 Requirements — SOP Builder

Requirements for native SOP authoring in the app. Delivered across the v3.0 milestone
phases. All SB-XX requirements scope admin-facing functionality; worker walkthrough
must continue to render all new content correctly without any new worker UI surfaces
beyond image rendering tweaks for baked annotation layers.

**Design contracts locked in from research (see `.planning/research/v3.0-*.md`):**

1. Block-based layout editor (Puck) is the default editor. A single specialty `DiagramHotspotBlock` handles freeform x/y positioning for machine-diagram annotations.
2. Image annotation uses Konva + react-konva with a dual-store model: Konva JSON for editing, baked PNG to Supabase Storage for the worker read path (zero Konva bytes in the worker bundle).
3. Extensible section schema is additive — `section_type` is already free text; v3.0 adds a `section_kinds` catalog plus `blocks` / `block_versions` / `sop_section_blocks` junction. No destructive migration.
4. Collaborative editing is section-level pessimistic locking in v3.0, with an optimistic version column for offline handoff. Yjs CRDT migration via `y-dexie` is deferred to v3.1+ (additive schema, no rewrite).
5. All collaborative-editing and authoring UI code lives under admin routes only — workers never download Puck, Konva, presence channels, or lock logic.

### Authoring Entry Points

- [ ] **SB-AUTH-01**: Admin can start a new SOP from a blank page wizard that walks through title → canonical sections → review → draft save, without uploading any source document
- [ ] **SB-AUTH-02**: Admin can generate a draft SOP by typing a natural-language prompt ("PPE check for forklift operators at our Hamilton site") and receive a structured draft with hazards, PPE, steps, and emergency sections pre-filled for review
- [ ] **SB-AUTH-03**: Admin can pick a template from the NZ template library (WorkSafe categories, common machinery, chemical handling) as a starting point for a new SOP
- [ ] **SB-AUTH-04**: Admin reaches the same builder UI whether they start blank, from AI draft, or from a template — there is one authoring surface, not three separate flows
- [ ] **SB-AUTH-05**: A draft SOP started in the builder is clearly distinguishable in the admin SOP library from an uploaded SOP, but is published through the same admin review + publish workflow used in Phase 2

### Extensible Section Schema

- [ ] **SB-SECT-01**: Admin can add multiple sections of the same canonical kind to a single SOP (e.g. two "Hazards" sections scoped to different machine states)
- [ ] **SB-SECT-02**: Admin can define a custom section with an admin-provided title (e.g. "Pre-flight check", "Escalation path") and have it render correctly in the worker walkthrough alongside canonical sections
- [ ] **SB-SECT-03**: The `section_kinds` catalog is seeded with canonical kinds (hazards, ppe, steps, emergency, sign-off) plus rendering metadata (icon, colour family, priority) consumed by the worker UI
- [ ] **SB-SECT-04**: Existing SOPs from v1/v2 continue to render identically — the extensible schema is additive and legacy `section_type` strings fall through to today's substring-matched renderer
- [ ] **SB-SECT-05**: Admin can reorder sections via drag-and-drop in the builder; order persists as `sort_order` consistent with the existing schema

### Layout Editor

- [ ] **SB-LAYOUT-01**: Admin can drag blocks (text, photo, heading, callout, step, hazard card, PPE card, diagram hotspot) onto a page and rearrange them in a linear column or 2-column grid on wide screens
- [ ] **SB-LAYOUT-02**: Each block's React component is shared between the admin editor and the worker walkthrough — there is no separate "author view" and "worker view" component tree
- [ ] **SB-LAYOUT-03**: Layouts reflow correctly on a 5.5" phone screen without requiring the admin to author a separate mobile variant — Tailwind breakpoints drive the reflow
- [ ] **SB-LAYOUT-04**: Layout data persists as JSONB on `sop_sections.layout_data` with a `layout_version` pin so future renderer upgrades do not silently break published SOPs
- [ ] **SB-LAYOUT-05**: Admin can add a DiagramHotspotBlock to any section, drop a machine diagram image into it, and place numbered hotspot callouts at freeform x/y positions on the diagram for specific-component annotation
- [ ] **SB-LAYOUT-06**: Worker walkthrough falls back to a linear step-list renderer for any SOP that lacks `layout_data` (legacy SOPs) or whose `layout_version` is unsupported, so no SOP is ever unrenderable

### Image & Diagram Annotation

- [ ] **SB-ANNOT-01**: Admin can annotate any uploaded photo or diagram with arrows, rectangles, ellipses, text labels, and numbered callouts (filled circle + number + optional label)
- [ ] **SB-ANNOT-02**: Annotations are non-destructive — the original image is preserved and admins can re-edit annotations later without re-uploading
- [ ] **SB-ANNOT-03**: On publish, the client-side editor bakes a flattened PNG of the annotated image and writes it to Supabase Storage at a version-bumped path; workers load the baked PNG via `<img>` with zero Konva bytes in their bundle
- [ ] **SB-ANNOT-04**: Admin can use Apple Pencil / stylus input for freehand sketching on a diagram, with palm rejection when a pen is detected
- [ ] **SB-ANNOT-05**: Annotations survive photo replacement in the editing pass — if an admin replaces the underlying image with a new one of similar dimensions, annotation coordinates are preserved and the admin is prompted to review placement

### Collaborative Editing

- [ ] **SB-COLLAB-01**: When an admin opens a section for editing, other admins in the same organisation see a read-only indicator "Alice is editing this section" and cannot modify it until the lock releases
- [ ] **SB-COLLAB-02**: Locks auto-release after 5 minutes of inactivity (heartbeat expiry), on explicit release, or on tab close, so no admin can permanently block a section
- [ ] **SB-COLLAB-03**: Different admins can edit different sections of the same SOP concurrently without any locking conflict
- [ ] **SB-COLLAB-04**: Admin can edit a locked section offline (e.g. on a factory floor with no connectivity) if they were the one holding the lock when they went offline; on reconnect, changes are pushed if the version on server has not advanced, or a plain-English "keep mine / keep theirs / merge manually" modal appears if it has
- [ ] **SB-COLLAB-05**: Presence indicators (who is currently editing what) are scoped per organisation via Supabase Realtime channels — no cross-tenant leakage
- [ ] **SB-COLLAB-06**: All collaborative-editing UI, lock logic, and presence channels are gated behind admin routes; worker bundles contain zero code from this feature set

### Reusable Block Library

- [ ] **SB-BLOCK-01**: Admin can save any hazard, PPE item, or step as a reusable block to the organisation's block library with an admin-provided name and optional category tags
- [ ] **SB-BLOCK-02**: The wizard surfaces "Pick from library (N matches)" alongside "Write new" at the right wizard step (hazards step offers hazard blocks, PPE step offers PPE blocks, etc.)
- [ ] **SB-BLOCK-03**: Global NZ blocks (WorkSafe standards, common machinery hazards) are available to all orgs read-only, while org-scoped blocks are isolated via RLS to each organisation
- [ ] **SB-BLOCK-04**: When an admin adds a block to a SOP, the block content is snapshotted into the junction row so the SOP renders correctly even if the block definition is later deleted or the worker is offline
- [ ] **SB-BLOCK-05**: Admin can choose between "pin to this version" (default — the SOP continues to render the snapshot content forever) and "follow latest" (auto-updates if the block definition changes, with a publish gate)
- [ ] **SB-BLOCK-06**: When a block definition is updated, all SOPs using it in "follow latest" mode are marked with an "update available" badge; admins review the change before publishing the updated SOP version

### Infrastructure & Safety Gates

- [ ] **SB-INFRA-01**: Draft SOPs authored in the builder integrate with the Phase 9 `sop_pipeline_runs` linkage so a builder-authored SOP can be routed to video generation with the same progress page and publish auto-queue used by uploaded SOPs
- [ ] **SB-INFRA-02**: All builder-created content persists through Dexie for offline authoring and syncs via the existing sync engine; admins do not need a special "save" step — the builder auto-saves to Dexie on change and to Supabase on a debounce
- [ ] **SB-INFRA-03**: Builder bundle is code-split so admin-only editor code does not ship to worker routes; a CI check verifies that worker route First-Load-JS does not include Puck, Konva, Yjs, or y-dexie imports
- [ ] **SB-INFRA-04**: AI-drafted content passes the same adversarial verification gate used in Phase 6 (Claude cross-checks GPT output) before admin review, so hallucinated hazards/PPE are flagged before reaching the reviewer

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
| ~~In-app SOP authoring~~ | **Superseded v3.0** — builder milestone adds native authoring (SB-AUTH-01..05). Original rationale (orgs have existing docs) no longer holds because orgs also want to author net-new SOPs and customised variants in-app. |
| ~~AI-generated SOP creation from scratch~~ | **Superseded v3.0** — SB-AUTH-02 allows AI-drafted starting points, gated behind the same adversarial verification used in Phase 6 and mandatory admin review (SB-INFRA-04). |
| In-place editing of *published* SOPs | Phase 10 re-upload/version flow remains the publish-edit path. Editing a live SOP would break audit trail and worker cache invariants. |
| True freeform x/y layout across all blocks | Blocks reflow via Tailwind breakpoints; freeform positioning only exists inside a single specialty `DiagramHotspotBlock` for machine-diagram callouts. Full-freeform layouts would break mobile reflow and accessibility. |
| Yjs CRDT concurrent editing | Deferred to v3.1+ via `y-dexie`. v3.0 uses section-level pessimistic locking + optimistic version column for offline handoff. |
| Real-time chat between workers | Scope explosion; Slack/Teams already exist. Add "raise issue" button instead. |
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
| VGEN-01 | Phase 8 | Complete |
| VGEN-02 | Phase 8 | Complete |
| VGEN-03 | Phase 8 | Pending |
| VGEN-04 | Phase 8 | Complete |
| VGEN-05 | Phase 8 | Complete |
| VGEN-06 | Phase 8 | Complete |
| VGEN-07 | Phase 8 | Complete |
| VGEN-08 | Phase 8 | Complete |
| VGEN-09 | Phase 8 | Complete |
| INFRA-03 | Phase 8 | Complete |

**v1 Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

**v2.0 Coverage:**
- v2.0 requirements: 27 total (note: original count of 28 in prior traceability header was off-by-one)
- Mapped to phases: 27
- Unmapped: 0

**v3.0 Coverage:**
- v3.0 requirements: 33 total (SB-AUTH ×5, SB-SECT ×5, SB-LAYOUT ×6, SB-ANNOT ×5, SB-COLLAB ×6, SB-BLOCK ×6, SB-INFRA ×4)
- Mapped to phases: 0 (pending roadmapper)
- Unmapped: 33

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-04-13 — v3.0 SOP Builder milestone requirements added (SB-XX)*
