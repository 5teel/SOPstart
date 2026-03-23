# Requirements: SOP Assistant

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

- [ ] **PARSE-01**: Admin can upload SOP documents in Word (.docx) format
- [ ] **PARSE-02**: Admin can upload SOP documents in PDF format
- [ ] **PARSE-03**: AI automatically parses uploaded documents into structured sections (hazards, PPE, steps, emergency procedures, etc.)
- [ ] **PARSE-04**: AI extracts embedded images and figures from uploaded documents
- [ ] **PARSE-05**: Admin can review parsed SOP alongside original document before publishing
- [ ] **PARSE-06**: Admin can edit/correct parsed sections before publishing
- [ ] **PARSE-07**: Parsed SOPs remain in draft state until admin explicitly publishes them

### Worker Experience

- [ ] **WORK-01**: Worker can walk through an SOP step-by-step with clear progress indication
- [ ] **WORK-02**: Worker can navigate back to previous steps during a walkthrough
- [ ] **WORK-03**: Worker can view SOP sections (Hazards, PPE, Steps, Emergency) via tabbed quick-reference mode
- [ ] **WORK-04**: Worker can jump directly to any section without walking through all steps
- [ ] **WORK-05**: Hazard and PPE information is prominently displayed before procedure steps begin
- [ ] **WORK-06**: Images and figures display inline within SOP steps with zoom capability
- [ ] **WORK-07**: Worker can access cached SOPs without internet connection
- [ ] **WORK-08**: Data entered offline syncs automatically when connectivity returns
- [ ] **WORK-09**: All primary actions (Next, Complete, Photo) use large tap targets (72px+) usable with gloves
- [ ] **WORK-10**: Walkthrough uses full-screen card interface optimised for one-handed use

### Completion Tracking & Sign-off

- [ ] **COMP-01**: Worker's SOP completion is recorded with server-side timestamp
- [ ] **COMP-02**: Worker can capture photos as evidence during specific SOP steps
- [ ] **COMP-03**: Photos are tied to the specific step they were captured on
- [ ] **COMP-04**: Completion records reference the specific SOP version that was followed
- [ ] **COMP-05**: Supervisor can view completion records for workers they oversee
- [ ] **COMP-06**: Supervisor can approve or reject a worker's SOP completion
- [ ] **COMP-07**: Completion records are immutable (append-only audit trail)

### SOP Management

- [ ] **MGMT-01**: Admin can assign SOPs to specific roles or individual workers
- [ ] **MGMT-02**: Worker sees assigned SOPs first when browsing the library
- [ ] **MGMT-03**: Worker can search the full SOP library by title and content
- [ ] **MGMT-04**: Worker can browse SOPs by category or department
- [ ] **MGMT-05**: Admin can update an SOP by uploading a new version of the document
- [ ] **MGMT-06**: Previous SOP versions are retained and linked to historical completions
- [ ] **MGMT-07**: Workers are notified when an assigned SOP has been updated

### Platform

- [x] **PLAT-01**: App is a Progressive Web App installable to home screen on iOS and Android
- [x] **PLAT-02**: App works across modern Android and iOS browsers
- [x] **PLAT-03**: App indicates online/offline status to the user

## v2 Requirements

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
- **ADV-03**: Per-section confidence scoring visible to admins during review

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| In-app SOP authoring | Orgs already have SOPs in docs — focus on consuming, not creating. Would double scope. |
| Real-time chat between workers | Scope explosion; Slack/Teams already exist. Add "raise issue" button instead. |
| Video content in SOP steps | Large files defeat offline caching; storage/CDN cost; difficult to produce for 500 SOPs |
| AI-generated SOP creation | Hallucinations in safety-critical content are dangerous; orgs have existing verified docs |
| Conditional branching in SOPs | Increases safety risk; manufacturing SOPs are linear by design |
| Public SOP marketplace | Liability issues — safety procedures from one org applied in another |
| Native iOS/Android apps | PWA-first; native later if needed |
| ERP/HR system integration | High per-client integration cost; manual user management for v1 |

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
| PARSE-01 | Phase 2 | Pending |
| PARSE-02 | Phase 2 | Pending |
| PARSE-03 | Phase 2 | Pending |
| PARSE-04 | Phase 2 | Pending |
| PARSE-05 | Phase 2 | Pending |
| PARSE-06 | Phase 2 | Pending |
| PARSE-07 | Phase 2 | Pending |
| WORK-01 | Phase 3 | Pending |
| WORK-02 | Phase 3 | Pending |
| WORK-03 | Phase 3 | Pending |
| WORK-04 | Phase 3 | Pending |
| WORK-05 | Phase 3 | Pending |
| WORK-06 | Phase 3 | Pending |
| WORK-07 | Phase 3 | Pending |
| WORK-08 | Phase 3 | Pending |
| WORK-09 | Phase 3 | Pending |
| WORK-10 | Phase 3 | Pending |
| COMP-01 | Phase 4 | Pending |
| COMP-02 | Phase 4 | Pending |
| COMP-03 | Phase 4 | Pending |
| COMP-04 | Phase 4 | Pending |
| COMP-05 | Phase 4 | Pending |
| COMP-06 | Phase 4 | Pending |
| COMP-07 | Phase 4 | Pending |
| MGMT-01 | Phase 3 | Pending |
| MGMT-02 | Phase 3 | Pending |
| MGMT-03 | Phase 3 | Pending |
| MGMT-04 | Phase 3 | Pending |
| MGMT-05 | Phase 3 | Pending |
| MGMT-06 | Phase 3 | Pending |
| MGMT-07 | Phase 3 | Pending |
| PLAT-01 | Phase 1 | Complete |
| PLAT-02 | Phase 1 | Complete |
| PLAT-03 | Phase 1 | Complete |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0

---
*Requirements defined: 2026-03-23*
*Last updated: 2026-03-23 — traceability populated after roadmap creation*
