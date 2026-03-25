# SOP Assistant

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

### Active

<!-- Current scope. Building toward these. -->
- [ ] Step-by-step guided walkthrough mode for workers
- [ ] Quick reference/lookup mode with sectioned navigation (Hazards, PPE, Steps, Emergency, etc.)
- [ ] Photo capture as evidence during SOP completion
- [ ] Optional completion tracking and sign-off per SOP
- [ ] Supervisor review of completion records
- [ ] SOP assignment to workers by role/trade
- [ ] Search + browse SOP library (assigned SOPs first, full library searchable)
- [ ] Offline-capable PWA for mixed connectivity sites
- [ ] Image/figure display within SOP steps

### Out of Scope

- Native iOS/Android apps — PWA-first, native later if needed
- In-app SOP authoring — upload-only for v1
- Real-time collaboration or chat between workers
- Integration with external HR/ERP systems
- Video content within SOPs

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

---
*Last updated: 2026-03-25 after Phase 2 completion*
