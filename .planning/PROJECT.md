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

### Active

<!-- Current scope. Building toward these. -->

#### v3.0 — SOP Builder (native authoring)
- Blank-page wizard for authoring SOPs from scratch
- AI-assisted draft from admin prompts (GPT-4o)
- NZ-specific template library (WorkSafe categories, machinery, chemical handling)
- Hybrid AI + builder (AI draft lands in same builder for refinement)
- Extensible section schema — additional and custom sections beyond the fixed Hazards/PPE/Steps/Emergency set
- Drag-and-drop layout editor for pages/slides (text, photo, diagram, callout placement)
- Photo and diagram annotation (arrows, highlight boxes, circles, numbered callouts — non-destructive overlay)
- Collaborative editing — multi-admin on a draft SOP with conflict resolution
- Reusable block library — shared hazard/PPE/step blocks surfaced via wizard-prompted selections

#### v2.0 carry-over (not blocking v3.0)
- Vimeo URL support (Phase 6 deferral)
- Phase 7 UAT run + Phase 9 live UAT (`human_needed`)
- Phase 999.1 stale video job cleanup (backlog)

### Out of Scope

- Native iOS/Android apps — PWA-first, native later if needed
- In-place editing of *published* SOPs — the Phase 10 re-upload/version flow remains that path
- Real-time collaboration or chat between workers (collaborative *admin* authoring IS in scope for v3.0)
- Integration with external HR/ERP systems
- Video content within SOPs

## Current Milestone: v3.0 SOP Builder

**Goal:** Enable admins to author SOPs natively in the app — from blank page or AI-drafted start — with an extensible section model, a drag-and-drop layout editor for pages, annotatable photos/diagrams, reusable blocks, NZ-specific templates, and collaborative drafts.

**Target features:**
- **Authoring entry points:** blank-page wizard, AI-assisted draft from prompts, NZ template library, hybrid AI+builder single-flow
- **Structure model:** extensible section schema — additional canonical sections + custom sections with admin-defined titles/behavior
- **Layout & visuals:** per-page drag-and-drop layout editor; non-destructive photo/diagram annotation (arrows, boxes, circles, callouts)
- **Collaboration & reuse:** multi-admin collaborative draft editing; reusable hazard/PPE/step block library with wizard-prompted selections
- **Desktop-authored, mobile-consumed:** layouts authored on desktop must reflow gracefully to worker mobile screens

**Key context:** Inverts v1 decision *"Upload-only for v1 (no in-app authoring)"*. v2.0 infrastructure (pipeline linkage, version management, publish gate) is reusable. Collaborative editing needs CRDT vs. server-lock research before planning. Layout editor + annotation are effectively a mini-Figma-for-SOPs and should be budgeted as multi-phase work.

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
*Last updated: 2026-04-13 — v2.0 archived, v3.0 SOP Builder milestone started*
