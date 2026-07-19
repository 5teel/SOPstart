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

- ✓ Bespoke inline SOP builder (Puck fully removed) — tiered inserter, smart-next ghosts, unified Visual block w/ Konva diagram annotation, verify-checklist tree rail — Phase 26
- ✓ Agent metadata layer — embeddings/tags/entities/memory/proposals per SOP+block, synthesis pipeline + cron sweep, `⚇ Agent layer` builder toggle + org dashboard — Phase 26.5
- ✓ Provider-agnostic AI layer — single-source model registry + adapter (Anthropic/OpenAI/OpenRouter incl. GLM 5.2), org-level model overrides via AI Settings admin tool — shipped ad-hoc 2026-07-06/07, formalized (SPEC + tests + org-isolation regression) Phase 27
- ✓ Unified AI-draft surface (`/admin/sops/new/ai` — type-a-brief / talk-it-through voice tabs), R&D-validated grounding prompt, SOP title-naming guard — shipped ad-hoc 2026-07-06/07
- ✓ QR machine deep links, read-step-aloud (mobile+desktop walkthrough), worst-first draft triage queue — shipped ad-hoc 2026-07-07
- ✓ Builder tree-rail navigation overhaul — section/step/block rows all focus the canvas, verify auto-advance, real preview text, focus-flash feedback — shipped ad-hoc 2026-07-07/09

- ✓ Side-by-side source viewer + AI reviewer × 5 jobs + per-block verify checklist at publish gate + step-level provenance — Phase 21 (v4.0)
- ✓ Voice-driven walkthrough — literacy gaps closed, voice Q&A drives walkthrough, read-aloud, multi-language — Phase 22 (v4.0)
- ✓ Universal AI read/write field access (unified agent interface) — Phase 23 (v4.0)
- ✓ Version supersede + diff + restore + worker-instance sign-off chain (completing the SOP IS the legal signature) — Phase 23 (v4.0, G-01)
- ✓ Spatial node-graph Flow tab — Phase 24 (v4.0)
- ✓ Departments as first-class entities (member/SOP/block junctions) — Phase 25 (v4.0)
- ✓ Self-healing video render finalization via Shotstack completion webhook — ad-hoc 2026-07-12 (replaces parked 999.1 cleanup service)

- ✓ SOP ownership (owner on every SOP, auto-backfilled 23/23, trigger-defaulted, ≤2-click reassign) + review lifecycle (12mo default cadence, one-click Confirm current, append-only review events) + unified governance queue (/admin/governance: overdue/due-soon/unowned/stale-role, one-click actions) + dashboard widget + worker "Current as of" caption — Phase 28 (v6.0), verified 12/12 vs live prod DB

### Active

<!-- Current scope. Building toward these. -->

#### v6.0 — SOP Ownership & Governance Infrastructure (Phase 28 ✅ · 29–30 remaining)
- Optional multi-step approval chain per category, versioned, one-click approve — SOPs without a chain publish exactly as today (Phase 29)
- AI-proposed maintenance schedule (prioritized review plan from staleness + usage + flags) (Phase 30)
- Per-worker training record view (completion = training evidence: SOP, version, date, sign-off chain) + CSV export (Phase 30)
- Deferred within v6.0: cadence-config UI (12mo default suffices; per-SOP override = Phase 30 candidate slice, see 28-HUMAN-UAT)

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

## Current Milestone: v7.0 Competency & Training Layer

**Started:** 2026-07-19
**Goal:** Turn the data SOPstart already stores (access grants = who must know what; completions + immutable sign-off chains = what's been evidenced) into a full competency system: a training matrix, competency states per person-per-SOP, and supervisor observation records — the audit artifact every ACC reviewer, WorkSafe inspector, and site manager asks for. Plus the safety-org guidance-notes quality adoptions that make individual SOPs better training modules. Absorbs v6.0's unshipped Phase 31 (training records + AI maintenance schedule).

**NORTH STAR (carried from v6.0, locked by Simon 2026-07-12):** User ease of use and maintenance FIRST. Process and blockers must never be prioritised over ease of use. SOPstart wins on (1) accuracy of SOP documentation and (2) ease of use by the actual people on the shop floor. Competency tracking exists ONLY in service of those two things — any feature that adds worker-facing friction is wrong by definition. Spirit over letter: adopt the guidance notes' intent (staged, observed, evidenced training), never their rigid choreography.

**Target features (grouped):**

- **Training matrix:** people × required-SOPs × status view derived from access grants (Phases 32–33) joined to completions/sign-offs — the audit artifact; per-department and per-worker cuts
- **Competency states:** 3–4 minimal states per person-per-SOP (e.g. not started / read / supervised / competent-signed-off) — NOT the guidance notes' rigid 5-step ladder
- **Supervisor observations:** 30-second supervisor-initiated record ("watched worker do X against the SOP — consistent / needs reset") under the worker's profile; the legal-evidence layer and complacency-reset mechanism
- **Assessor capability:** who may assess/sign off is itself governed (trainer must be signed off) — folds into the G-04 role work
- **Training records (Phase 31 rollforward, TRN-01..03 + REV-05):** per-worker training evidence view, CSV export, trained-on-outdated-version surfacing after supersede, AI-prioritized maintenance schedule on the existing AI adapter
- **Guidance-notes adoptions (999.4–999.7 promoted):** AI-reviewer completeness rubric (hazards/controls/LOTO with named "E-stops ≠ isolation" check, quality outcomes, too-long flag); document codes + register-style export; risk/priority rating for SOP triage; refresher re-walkthrough cadence

**Key anti-goals:** no disciplinary workflow (records exportable, enforcement stays human); no HRIS API integration yet (CSV export only — SuccessFactors is a "Later" target); no worker-facing friction from competency states (a worker's read/walkthrough access is never gated by competency status); no rigid training choreography.

**Build-on (do not rebuild):** access grants + materialization (Phases 32–33), completions + immutable sign-off chain (Phases 4/23, D-17), departments (Phase 25), AI reviewer jobs (Phase 21) for the completeness rubric, agent metadata + AI adapter (Phase 26.5/27) for the maintenance schedule, governance queue (Phase 28) for surfacing due refreshers.

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
| Governance never blocks workers (v6.0) | North star: ease of use + accuracy beat process; a worker must always be able to read/run any published SOP regardless of review/approval state | — Locked 2026-07-12 |
| Approval chains opt-in per category (v6.0) | Visy needs 3–4-manager chains for some SOPs, but forcing chains everywhere adds friction; absent chain = today's publish flow | — Locked 2026-07-12 |
| Training records = CSV export only (v6.0) | HRIS/Success Factors API integration stays out of scope; CSV covers the audit/training-evidence need without integration surface | — Locked 2026-07-12 |

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
*Last updated: 2026-07-19 — Milestone v7.0 (Competency & Training Layer) started; v6.0 quick-closed same day (Phase 31 rolled forward into v7.0). Prior: v5.0 shipped 2026-07-05; ad-hoc AI-layer work 2026-07-06→09 formalized by Phase 27 (2026-07-12); self-healing video render webhook shipped 2026-07-12. Source of truth `.planning/PRODUCT-ROADMAP.md` v0.3 + Visy interview findings (2026-05-05).*
