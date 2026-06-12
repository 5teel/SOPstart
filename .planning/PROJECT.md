# SafeStart

## What This Is

A multi-tenant SaaS progressive web app that helps blue-collar tradespeople and inspectors follow Standard Operating Procedures on-site. Organizations upload their existing SOP documents (Word/PDF), AI parses them into structured, mobile-friendly procedures, and workers walk through them step-by-step on their phones — with photo capture, completion tracking, and supervisor sign-off.

## Core Value

Workers can reliably follow any SOP on their phone, step-by-step, with the right safety information always visible — even offline.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Multi-tenant organisation management — Phase 1
- ✓ Role-based access (Workers, Supervisors, SOP Admins, Safety Managers) — Phase 1
- ✓ PWA installable on iOS and Android — Phase 1
- ✓ AI-powered SOP document parsing (Word/PDF to structured data) — Phase 2
- ✓ Step-by-step guided walkthrough mode for workers — Phase 3
- ✓ Quick reference/lookup mode with sectioned navigation — Phase 3
- ✓ SOP assignment to workers by role/trade — Phase 3
- ✓ Search + browse SOP library (assigned SOPs first) — Phase 3
- ✓ Offline-capable PWA for mixed connectivity sites — Phase 3
- ✓ Image/figure display within SOP steps — Phase 3

- ✓ Photo capture as evidence during SOP completion — Phase 4
- ✓ Optional completion tracking and sign-off per SOP — Phase 4
- ✓ Supervisor review of completion records — Phase 4

- ✓ Photo/image upload with GPT-4o vision OCR → structured SOP — Phase 5
- ✓ Excel (.xlsx), PowerPoint (.pptx), plain text (.txt) file parsing — Phase 5
- ✓ Format-specific AI prompts with confidence scoring — Phase 5
- ✓ TUS resumable upload for large files — Phase 5
- ✓ Multi-page document scanner with quality checks — Phase 5
- ✓ Table preservation from Excel/PowerPoint sources — Phase 5

- ✓ Video file upload (MP4/MOV) with audio transcription to structured SOP — Phase 6
- ✓ YouTube URL caption fetch to structured SOP (Vimeo deferred) — Phase 6
- ✓ Adversarial AI verification (Claude cross-checks GPT output) — Phase 6
- ✓ Side-by-side transcript + structured SOP review with video player — Phase 6
- ✓ Missing hazards/PPE section warnings — Phase 6
- ✓ Named processing stages with progress indicators — Phase 6

- ✓ In-browser video recording with MediaRecorder (Android/Chrome) — Phase 7
- ✓ iOS guided fallback to native camera + file upload — Phase 7

- ✓ Native SOP builder (Puck-based drag-and-drop) — Phase 12
- ✓ Blank-page wizard for authoring SOPs from scratch — Phase 12
- ✓ AI-assisted draft from admin prompts (GPT-4o + Claude adversarial verifier) — Phase 14
- ✓ Reusable block library — org + Potenco-curated global tiers, 65 NZ seed blocks — Phase 13
- ✓ Extensible section schema — additional and custom sections beyond fixed Hazards/PPE/Steps/Emergency — Phase 11
- ✓ Paper/ink design language rolled across admin + auth + dashboard + library + worker surfaces — Phase 12.5 + 14.5
- ✓ Sub-trade tags + site-tier multi-tenancy (Visy customer interview-driven) — Phase 15
- ✓ AI Voice Q&A grounded to single SOP with citations + uncertainty fail-safe — Phase 15
- ✓ DOCX → Puck layout_data with side-by-side step+photo blocks — Phase 20 partial

### Active

<!-- Current scope. Building toward these. -->

#### v4.0 — Safety-Critical Parsing + Voice + AI Foundation
- Side-by-side source viewer (admin sees original document beside parsed blocks, click-to-sync scroll)
- AI reviewer running five verification jobs (omission, anchoring, photo-step alignment, table fidelity, terminology) on every parsed SOP
- Per-block verify checklist at publish gate (publish hard-disabled until 100% verified, no bulk-bypass)
- Word/PDF parsing — Phase 20 contract complete (full step-level provenance for photos/diagrams/charts/tables)
- Worker walkthrough literacy gaps closed — visual-only flow + voice-driven completion + multi-language UI
- AI Voice Q&A drives walkthrough (full audio loop, advances on "I've done step 4," multi-language)
- Universal AI read/write field access — every editable field AI-callable via unified agent interface (architectural backbone for v5.0 conversational app)
- Version history formal supersede + diff + restore + worker-instance sign-off chain (completing the SOP IS the legal signature)

#### v3.0 carry-over (deferred to v4.5 backlog)
- A-05 NZ Template Library (Visy glass-mfg-focused)
- W-04 Kiosk mode + sequence-enforced walkthrough
- W-05 PIN/badge sign-off at shared workstations
- S-05 Pinned PPE icon strip
- G-02 Multi-step approval chain (optional, versioned)
- G-03 Review-due cadence + AI maintenance schedule
- G-04 Roles + stale-role surfacing
- X-01 Full-text search + AI-managed taxonomy
- P-04 CSP/HSTS security hardening

#### v2.0 carry-over (not blocking v4.0)
- Phase 7 UAT run + Phase 9 live UAT (`human_needed`)
- Phase 999.1 stale video job cleanup (backlog)

### Out of Scope

- Native iOS/Android apps — PWA-first, native later if needed
- In-place editing of *published* SOPs — the Phase 10 re-upload/version flow remains that path
- Real-time collaboration or chat between workers (collaborative *admin* authoring IS in scope for v3.0)
- Integration with external HR/ERP systems
- Video content within SOPs

## Current Milestone: v4.0 Safety-Critical Parsing + Voice + AI Foundation

**Started:** 2026-05-24
**Goal:** No parsed SOP can be published without verified anchoring (Phase 20 contract complete). A worker who can't read English can still complete an SOP by voice. Every editable field in the app is AI-callable — laying the architectural backbone for the v5.0 conversational app.

**Target features (8, grouped into 3 phases):**

- **Phase 21 — Safety-Critical Parsing** (S-02 + S-03 + S-04 + I-01):
  - Side-by-side source viewer (admin sees original document beside parsed blocks)
  - AI reviewer × 5 verification jobs (omission, anchoring, photo-step, table fidelity, terminology)
  - Per-block verify checklist at publish gate (no bulk-bypass)
  - Word/PDF parsing — full step-level provenance for photos/diagrams/charts/tables
- **Phase 22 — Voice-Driven Walkthrough** (W-01 + X-02):
  - Walkthrough literacy gaps closed — low-literacy / visual-only / voice-only completion + multi-language UI
  - Voice Q&A drives walkthrough (reads aloud, advances on "done," multi-language)
- **Phase 23 — AI Field Layer + Version Supersede** (X-03 + G-01):
  - Universal AI read/write access to every editable field (unified agent interface)
  - Cmd+K palette extended across admin pages + team + settings
  - Version supersede + diff + one-click restore + worker-update indicator
  - Worker-instance sign-off chain — completing the SOP IS the legal signature

**Key context:** Source of truth is `.planning/PRODUCT-ROADMAP.md` v0.3 (Simon's 2026-05-24 review pass). v3.0's deferrals (NZ templates, kiosk mode, approval chains, search, security hardening, the compliance category) carry to v4.5. The Visy customer interview (2026-05-05) remains the primary domain anchor; v4.0 finishes the safety story before v4.5 broadens to multi-customer acquisition.

**Execution order:** 21 → 22 → 23. Phase 21 unblocks the most safety risk. Phase 23 lays the AI-field foundation that v5.0's conversational interface (X-05) builds on.

**Current state:** Phase 24 complete (2026-06-12) — Flow tab ships the production spatial node-graph canvas (explicit positions, accent tokens, Fit/Export-PNG, desktop-default graph view, builder FlowGraphEditor re-surfaced), closing the Phase 12.5 req #8 gap. Promoted from backlog 2026-06-11.

## Context

- **New Zealand market** — built for NZ professionals and organizations, NZ-based SaaS
- Target users are blue-collar tradespeople and inspectors in industrial/manufacturing settings (glass manufacturing, machine shops, etc.)
- SOPs range widely: from safety-critical chemical handling procedures (PPE-heavy, hazard warnings, emergency procedures) to software configuration guides to equipment maintenance
- Typical SOP structure includes: hazard warnings, PPE requirements, training/qualification prerequisites, emergency procedures, numbered step-by-step instructions with figures/photos, and competency assessment/sign-off sections
- Organizations may have 50-500 SOPs across multiple departments and sites
- Workers are often on factory floors with mixed internet connectivity — some sites have WiFi, others don't
- Existing SOPs live in Word (.docx) and PDF formats, many with embedded images and tables
- Competency assessments in existing SOPs include trainer sign-off, verifier observation, and management review — the app needs to digitize this workflow

## Constraints

- **Platform**: Progressive Web App — must work across Android and iOS browsers, installable to home screen
- **Offline**: Must function with intermittent connectivity — cached SOPs accessible offline, sync when back online
- **Accessibility**: Workers may have limited tech literacy — UI must be extremely simple and glove-friendly (large tap targets)
- **Multi-tenant**: Each organization's SOPs and data must be fully isolated
- **AI Parsing**: Must handle varied document formats and structures; confidence scoring to flag sections that need admin review
- **Tech stack**: To be determined by research phase

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PWA over native apps | Faster to ship, works on all devices, no app store friction for enterprise deployment | ✓ Validated v1.0–v2.0 |
| AI auto-parse over manual mapping | Reduces admin burden; hundreds of SOPs make manual entry impractical | ✓ Validated Phase 2 + 5 |
| Multi-tenant SaaS from the start | Product is intended for multiple organizations, not a single-company tool | ✓ Validated Phase 1 RLS |
| Upload-only for v1 (no in-app authoring) | Orgs already have SOPs in docs — focus on making existing ones usable, not replacing authoring tools | ✗ Superseded v3.0 — orgs also want to author net-new SOPs in the builder |
| v3.0 adds native authoring | Upload flow shipped; orgs now ask for on-app authoring for net-new SOPs and customized variants — not just import | — Pending v3.0 |
| Collaborative draft editing (v3.0) | Multiple admins share SOP drafting load; avoids email-attachment churn; needs conflict resolution model | — Pending v3.0 research |
| Non-destructive image annotation (v3.0) | Admins must be able to re-edit annotations after saving; burned-in pixels would require re-upload | — Pending v3.0 research |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-12 — Phase 24 (Procedure Flow — Spatial Node Graph) complete. v4.0 = Phases 21/22/23 (+24 promoted from backlog), source of truth `.planning/PRODUCT-ROADMAP.md` v0.3.*
