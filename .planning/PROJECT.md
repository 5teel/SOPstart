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

### Active

<!-- Current scope. Building toward these. -->

#### Pathway 1 — Video → SOP
- Upload video file (MP4/MOV) and transcribe to structured SOP
- Paste YouTube/Vimeo URL, fetch and transcribe to SOP
- Record video in-app from device camera, transcribe to SOP

#### Pathway 3 — File → Video SOP
- Narrated slideshow (AI voice over auto-generated slides/cards)
- Full AI video (generated visuals/animations with narration)
- Screen recording style (scrolling SOP content with voice overlay)

### Out of Scope

- Native iOS/Android apps — PWA-first, native later if needed
- In-app SOP authoring — upload-only for v1
- Real-time collaboration or chat between workers
- Integration with external HR/ERP systems
- Video content within SOPs

## Current Milestone: v2.0 SOP Creation Pathways

**Goal:** Three new ways to create and consume SOPs — from video transcription, from expanded file types (photos, Excel, PowerPoint), and as generated video content with AI narration.

**Target features:**
- Video → SOP: upload, YouTube/Vimeo URL, or in-app recording transcribed into structured SOP
- File → SOP: photo OCR, improved AI parsing, Excel/PowerPoint/plain text support
- File → Video SOP: narrated slideshow, full AI video, screen recording style — all three output formats

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
| PWA over native apps | Faster to ship, works on all devices, no app store friction for enterprise deployment | — Pending |
| AI auto-parse over manual mapping | Reduces admin burden; hundreds of SOPs make manual entry impractical | — Pending |
| Multi-tenant SaaS from the start | Product is intended for multiple organizations, not a single-company tool | — Pending |
| Upload-only for v1 (no in-app authoring) | Orgs already have SOPs in docs — focus on making existing ones usable, not replacing authoring tools | — Pending |

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
*Last updated: 2026-04-03 — Phase 5 (Expanded File Intake) complete*
