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

- ✓ Supervisor observations — append-only sop_observations table (RLS: recorder-role org reads + worker self-read only, cross-org guard, no update/delete), 30-second record modal from PersonPanel + /activity, worker-visible history on /profile with NZ Privacy Act trust framing, org-renamable verdict labels — Phase 34 (v7.0, OBS-01..03), re-verified 5/5 after gap closure 34-10
- ✓ Competency classifier + training matrix + per-worker training records + SuccessFactors-shaped CSV export — derived live from existing evidence, zero stored state — Phase 35 (v7.0, CMP-01/02/04, MTX-01..03, TRN-01/02)
- ✓ Refresher cadence + version-currency — trained-on-outdated-version surfacing after supersede, due/overdue re-walkthroughs, informational only — Phase 36 (v7.0, CMP-03, TRN-03, REF-01/02)
- ✓ Assessor governance — only a signed-off assessor can record a competence-advancing observation, audited always-available admin override for new-org bootstrap — Phase 37 (v7.0, ASR-01), re-verified 14/14 after gap closure 37-07/37-08

### Active

<!-- Current scope. Building toward these. -->

#### v8.0 — Authoring Convergence (defined 2026-07-28)
- One creation flow: every on-ramp (upload, video, AI-describe, AI-voice, blank) funnels through one entry and lands in the builder (CRE-01..04)
- Deduplication: one file-intake component, one department/metadata picker, one progress component, one page shell (DUP-01..04)
- Data convergence: SOP category resolves to a single column + single vocabulary, existing rows backfilled (DAT-01)
- Progress honesty: builder renders parsing state; consistent client-side navigation (PRG-01..02)
- Dead-surface removal: no CTA to a non-existent route, no non-functional affordances, dead shims/vars gone, docs match real routes (DED-01..04)

#### Deferred to backlog (2026-07-28)
- 999.4 AI-reviewer completeness rubric + risk triage (RUB-01..03, TRI-01) — blocked on conversion-pipeline maturity
- 999.5 Document codes + register export (DOC-01..02) — independently promotable, no pipeline dependency
- 999.6 AI-prioritized maintenance schedule (REV-05) — blocked on 999.4's flags

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

## Current Milestone: v8.0 Authoring Convergence

**Started:** 2026-07-28
**Goal:** Collapse the SOP creation path from five divergent on-ramps into one consistent flow — removing duplicated components, dead routes, and inconsistent metadata collection — so every way of making a SOP behaves the same way and lands in the same place. This is a **consolidation milestone**: tighten what exists, delete what duplicates, simplify the workflow. It is explicitly NOT a greenfield rebuild of the builder.

**NORTH STAR (carried, locked by Simon 2026-07-12):** User ease of use and maintenance FIRST. SOPstart wins on (1) accuracy of SOP documentation and (2) ease of use by the actual people on the shop floor. Governance and process never come before ease of use.

**Why now (locked by Simon 2026-07-28):** The product governs SOPs extremely well — ownership, approvals, access, competency, observations, training records all shipped across v6.0/v7.0. What it cannot yet do reliably is get a good SOP *into* the system. v7.0's Phases 38/39 were deferred to backlog precisely because they critique and rank SOP content, and the creation pipeline underneath is pre-alpha. Foundation before more layers on top.

**Evidence base:** a line-verified audit of every creation surface (2026-07-28) found: a picker showing 4 tiles that hit 3 routes; a 5th creation method buried inside the Upload route that lands somewhere different from all the others; upload collecting *no* metadata while its siblings require title or prompt; category written to **two different DB columns from two different vocabularies**; the department picker duplicated three times; HEIC conversion implemented twice; three disagreeing file-accept lists; two progress steppers each re-implementing realtime-with-polling; a builder with no parsing state; and a 404ing primary CTA on the Blocks library.

**Target features (grouped):**

- **Creation flow (CRE-01..04):** one entry funnelling every on-ramp including video generation · the same core metadata collected on every path · every path lands in the builder · each method presented exactly once
- **Deduplication (DUP-01..04):** one file-intake component (accept list, size limits, HEIC conversion) · one department/metadata picker · one parse-progress component · one admin page shell
- **Data convergence (DAT-01):** SOP category resolves to one column with one vocabulary, existing rows backfilled — AI-created and wizard-created SOPs filterable together
- **Progress honesty (PRG-01..02):** the builder renders parsing/uploading state so a queued parse never presents as an empty builder · navigation to the builder is consistent client-side routing
- **Dead-surface removal (DED-01..04):** no CTA to a non-existent route · no non-functional affordances shipped · orphaned shims and dead state removed · docs/journeys match real routes

**Key anti-goals:** no new authoring capabilities (the template on-ramp from the sketches is a new capability — deferred); no merge of the worker route and admin builder into one URL (architecturally large, and the worker side is already one route with three tabs); no conversion/parse *quality* work — that is v9.0.

**Design contract:** `.claude/skills/sketch-findings-SOPstart/references/authoring-flow.md` (wrapped 2026-07-28) — decision D-A1 "every on-ramp lands in the identical builder" is exactly what CRE-01..04 execute. This milestone implements an already-validated design rather than inventing one.

**Build-on (do not rebuild):** the Phase 26 bespoke inline builder and its `BLOCK_COMPONENTS` registry (already shared between worker read path and admin edit path), the frozen `layout_data` / `sop_section_blocks` / `block_provenance` contract, the parse→AI-review→verify→publish spine.

## Next Milestone (planned): v9.0 Conversion Quality

Sequenced by Simon 2026-07-28: **v8.0 authoring UX first, then v9.0 conversion quality.** v9.0 addresses whether the parse produces something worth editing — the actual pre-alpha concern. It is also the unblocking dependency for backlog 999.4 (AI-reviewer completeness rubric), which was deferred because a rubric tuned against pre-alpha parse output would need retuning.

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
| Foundation before more governance layers (v8.0) | Governance shipped well across v6.0/v7.0, but every layer sits on content whose creation path is fragmented and whose parse quality is pre-alpha. Phases 38/39 deferred rather than built on unstable ground | — Locked 2026-07-28 |
| v8.0 is consolidation, not rebuild | The ask is tightening current design, removing duplicative routes, simplifying workflows — not a greenfield builder. New capabilities (template on-ramp) are deferred even where sketched | — Locked 2026-07-28 |
| Authoring UX before conversion quality | Two-milestone sequence: v8.0 converges the creation flow, v9.0 makes the parse output trustworthy. Ordering chosen by Simon | — Locked 2026-07-28 |

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
*Last updated: 2026-07-28 — **Milestone v8.0 (Authoring Convergence) started**; v7.0 closed at Phase 37 with 4/4 phases and 32/32 plans, Phases 38/39 deferred to backlog 999.4/999.5/999.6 (creation pipeline pre-alpha). v9.0 (Conversion Quality) sequenced next. Prior: Phase 37 (assessor governance, ASR-01) complete, re-verified 14/14 after gap closure (37-07/37-08 closed CR-01/CR-02 + WR-01..WR-05; post-closure review's 2 new warnings fixed same day). Phase 36 (refresher cadence + version-currency) complete, verified 4/4; code review 1 Critical + 7 Warnings all fixed pre-verification (CMP-03/TRN-03/REF-01/REF-02 validated). Phase 35 (competency classifier + training matrix) complete 2026-07-26, UAT 8/8. Prior: Phase 34 (supervisor observations) complete, re-verified 5/5 after gap closure. Milestone v7.0 (Competency & Training Layer) started 2026-07-19; v6.0 quick-closed same day (Phase 31 rolled forward into v7.0). Prior: v5.0 shipped 2026-07-05; ad-hoc AI-layer work 2026-07-06→09 formalized by Phase 27 (2026-07-12); self-healing video render webhook shipped 2026-07-12. Source of truth `.planning/PRODUCT-ROADMAP.md` v0.3 + Visy interview findings (2026-05-05).*
