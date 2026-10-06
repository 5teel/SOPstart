# SafeStart

## What This Is

A web app that helps people on a factory floor follow Standard Operating Procedures. The whole app is **one screen**: an isometric drawing of the site with a list beside it and a detail panel. Each machine carries its SOPs; the Office is governance, the Smoko room is training, the Workshop is where SOPs are written and edited, and the Noticeboard holds site-wide SOPs. Admins turn existing documents (Word/PDF), a typed description or a recorded video into a structured SOP of sections and steps; workers walk it step by step with photo capture; supervisors sign off. Built for one organisation (Visy) first.

*(Until 2026-10-02 this was a multi-tenant, phone-first, offline-capable PWA with many separate surfaces. Simon cut it to an MVP on that date — see Current Milestone v11.0.)*

## Core Value

A worker can find the SOP for the machine in front of them and follow it step by step with nothing else on the screen — and the business can see, in one ledger, who decided and did what.

*(Reworded 2026-10-03 for the MVP simplification. Previous wording: "Workers can reliably follow any SOP on their phone, step-by-step, with the right safety information always visible — even offline." Phone and offline were dropped by Simon on 2026-10-02; flagged for his confirmation.)*

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

#### v11.0 — One-Screen MVP (defined 2026-10-03)
- One screen: list · isometric site · detail panel; no header navigation; every place has a URL (SHL-01..07)
- Places: Office, Smoko room, Workshop, Noticeboard and machines are the only destinations; departments and machines are part of the site drawing (PLC-01..05)
- Focus: opening a SOP to walk or edit removes the map and the list (FOC-01..04)
- SOP model: sections and steps; hazard and PPE are kinds of step; standards are labels; a SOP belongs to a machine or the site (SOP-01..04)
- Workshop: four ways to start, one editor, honest progress, tick-each-step before publish (WRK-01..07)
- Office: inbox, sign-off, approvals, people and roles, access wiring, owners and review dates (OFF-01..06)
- Decision ledger: every approve / reject / sign-off / assign / publish is one append-only row (DEC-01..04)
- Requests, notifications, objectives as first-class data (RQS-01..04, NTF-01..02, OBJ-01..03)
- Smoko room: training matrix, simple observations, my record (SMK-01..03)
- Single organisation (ORG-01) and removal of every dropped feature (CUT-01..05)

#### v8.0 — Authoring Convergence (closed 2026-10-03)
- Shipped: Phases 40, 41, 43 (DUP-01..04, DAT-01, SUR-01..06, DED-01..04).
- **Phase 42 One Creation Flow (CRE-01..04, PRG-01..02) superseded by v11.0** — its intent (one entry, same details on every path, lands in the editor, honest progress, client-side navigation) is carried by WRK-01..03 against the new shell.

#### v9.0 — Hot End Pilot (superseded 2026-10-03, never started beyond Phase 46)
- Phase 46 Capability Matrix shipped. The rest is absorbed or dropped by v11.0: obligation record → requests/assignments (RQS-03); edit log → decision ledger (DEC-01); worker feedback → requests (RQS-01); standard steps library → standards labels (SOP-02); role ladder, view-as-role and parse relevance → backlog.

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

**Dropped in the 2026-10-02 MVP simplification (Simon) — removed from the product, not hidden:**
- Offline use (service worker, local SOP cache, photo queue, sync)
- Voice: Q&A, read-aloud, voice-driven walkthrough, voice drafting
- Phone experience and QR machine plates (MVP is desktop; revisit after the build)
- Video generation from a SOP
- Flow diagram and image annotation
- Refresher cadence, CSV export of training records, version compare/restore
- YouTube and photo-scan on-ramps; the template on-ramp
- The reusable-content library as its own surface (replaced by standards labels)
- The departments screen and org-chart views (departments live on the site drawing)
- Shared-device (roster) login
- Multiple organisations, organisation sign-up, multi-site

## Current Milestone: v11.0 One-Screen MVP

**Started:** 2026-10-03
**Goal:** Cut the app down to a minimal product that fits on one screen — the isometric site with a list and a detail panel — re-found its data on eight plain types, and remove every feature that did not make the cut.

**NORTH STAR (carried, locked by Simon 2026-07-12):** User ease of use and maintenance FIRST. Simplicity now outranks feature coverage: when a kept feature and simplicity conflict, simplicity wins.

**Why now (Simon, 2026-10-02):** "I want to simplify the app more — cut the features down to a minimal viable product and drop features in favour of simplicity … 1x super simple navigable screen." The product had grown to ~35 screens, nine header entries and seven ways to start a SOP. The plant-floor map (v10.0) proved the site is a better index than any menu, so it becomes the whole app.

**Target features:**
- **One screen** — list (search, next-for-you, rooms, departments ▸ machines) · isometric site · detail panel that widens for tables. No header navigation.
- **Rooms as destinations** — Office (governance), Smoko room (training), Workshop (write and edit SOPs), Noticeboard (site-wide SOPs), machines (their SOPs). The list is the same places as text.
- **Focus rule** — opening a SOP to walk it or edit it removes the map and the list; the SOP, its sections and its steps are the only thing on screen.
- **Eight data types** — decisions (one append-only ledger), objectives (metadata people and agents can set and read), requests, notifications, SOP, steps, standards (labels at SOP / section / step level), users (with roles under governance).
- **Simpler SOP** — sections and steps; hazard and PPE are kinds of step.
- **Workshop** — four ways to start (document · describe to AI · record a video · blank), one editor, AI check and tick-each-step before publish, versions.
- **Office** — inbox (owners, review dates, sign-offs, approvals), requests, decision ledger, people and roles, the current access wiring.
- **Smoko room** — training matrix, simple observations, my record.
- **Single organisation** — Visy. No sign-up-creates-an-org, no tenant switching.
- **Removal** — every dropped feature deleted (see Out of Scope); pathways map and UAT page rebuilt afterwards.

**Design contract:** `.claude/skills/sketch-findings-SOPstart/references/one-screen-site.md` (sketch 008, winner A + focus rule, wrapped 2026-10-03). It governs and carries a supersession table for every older reference.

**Key anti-goals:** no new capability beyond what the sketch shows; no phone layout; no template on-ramp; no dropping of database tables or customer data in this milestone (dropped features lose their code and UI, their rows stay); no bulk-verify shortcut around tick-each-step.

**Build-on (do not rebuild):** the v10.0 site model and scene renderer (`site_layouts` / `site_machines` / `sop_machines`, pins, machine panel, Konva polygon editor); the parse → AI-review → verify → publish spine and `assertPublishGates()`; the Phase 26 inline editor and its component registry; the access-grant model and wiring patch bay (kept as is); the completion + sign-off chain; the competency classifier behind the training matrix; `getSessionContext()` / `requireAdminContext()` auth idiom; the deployed-eval harness.

**Open questions carried into planning:** phone (dropped — confirm the MVP is desktop-only); room artwork (placeholders until the site scene is regenerated with rooms in it); whether workers may enter the Workshop; whether a read-only SOP view exists besides Walk; one physical decisions table vs a ledger over existing tables; whether objectives carry a target and date.

## Previous Milestone: v8.0 Authoring Convergence (closed 2026-10-03 — Phases 40, 41, 43 shipped; Phase 42 superseded by v11.0)

**Started:** 2026-07-28
**Goal:** Collapse the SOP creation path from five divergent on-ramps into one consistent flow — removing duplicated components, dead routes, and inconsistent metadata collection — so every way of making a SOP behaves the same way and lands in the same place. This is a **consolidation milestone**: tighten what exists, delete what duplicates, simplify the workflow. It is explicitly NOT a greenfield rebuild of the builder.

**NORTH STAR (carried, locked by Simon 2026-07-12):** User ease of use and maintenance FIRST. SOPstart wins on (1) accuracy of SOP documentation and (2) ease of use by the actual people on the shop floor. Governance and process never come before ease of use.

**Why now (locked by Simon 2026-07-28):** The product governs SOPs extremely well — ownership, approvals, access, competency, observations, training records all shipped across v6.0/v7.0. What it cannot yet do reliably is get a good SOP *into* the system. v7.0's Phases 38/39 were deferred to backlog precisely because they critique and rank SOP content, and the creation pipeline underneath is pre-alpha. Foundation before more layers on top.

**Evidence base:** a line-verified audit of every creation surface (2026-07-28) found: a picker showing 4 tiles that hit 3 routes; a 5th creation method buried inside the Upload route that lands somewhere different from all the others; upload collecting *no* metadata while its siblings require title or prompt; category written to **two different DB columns from two different vocabularies**; the department picker duplicated three times; HEIC conversion implemented twice; three disagreeing file-accept lists; two progress steppers each re-implementing realtime-with-polling; a builder with no parsing state; and a 404ing primary CTA on the Blocks library.

**Target features (grouped):**

- **SOP surface convergence (SUR-01..06):** one route lists SOPs for every role · admin status/governance/access views become lenses on it, not destinations · one top-level "SOPs" entry (the duplicate `AdminNav` item goes; `UX-02` is superseded in part) · one route chain from a SOP to its builder · worker bundle unaffected (`SB-LINE-06` CI gate is the hard constraint) · "library" survives only as a filter name
- **Creation flow (CRE-01..04):** one entry funnelling every on-ramp including video generation · the same core metadata collected on every path · every path lands in the builder · each method presented exactly once
- **Deduplication (DUP-01..04):** one file-intake component (accept list, size limits, HEIC conversion) · one department/metadata picker · one parse-progress component · one admin page shell
- **Data convergence (DAT-01):** SOP category resolves to one column with one vocabulary, existing rows backfilled — AI-created and wizard-created SOPs filterable together
- **Progress honesty (PRG-01..02):** the builder renders parsing/uploading state so a queued parse never presents as an empty builder · navigation to the builder is consistent client-side routing
- **Dead-surface removal (DED-01..04):** no CTA to a non-existent route · no non-functional affordances shipped · orphaned shims and dead state removed · docs/journeys match real routes — **✅ validated in Phase 43 (2026-09-30):** `/admin/blocks/new` create form live over a hardened `createBlock()`; Scan document wired to PhotoScanner; `/admin/governance` + `/admin/sops` shim pages deleted in favour of `next.config.ts` redirects; repo-wide dead-internal-href lint guard; deployed eval 29/29. Side find: `public.blocks` had carried no SELECT policy since migration 00037 — restored org-scoped in 00068.

**Key anti-goals:** no new authoring capabilities (the template on-ramp from the sketches is a new capability — deferred); no merge of the SOP *detail* route and the admin builder into one URL (sketch decision D-A9 — architecturally large, and the worker side is already one route with three tabs; SUR converges the **list** surfaces only); no conversion/parse *quality* work — that is v9.0.

**Design contract:** `.claude/skills/sketch-findings-SOPstart/references/authoring-flow.md` (wrapped 2026-07-28) — decision D-A1 "every on-ramp lands in the identical builder" is exactly what CRE-01..04 execute. This milestone implements an already-validated design rather than inventing one.

**Build-on (do not rebuild):** the Phase 26 bespoke inline builder and its `BLOCK_COMPONENTS` registry (already shared between worker read path and admin edit path), the frozen `layout_data` / `sop_section_blocks` / `block_provenance` contract, the parse→AI-review→verify→publish spine.

## Superseded plan: v9.0 (was "Conversion Quality", later "Hot End Pilot") — replaced by v11.0 on 2026-10-03

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

- **Platform**: Desktop web first (v11.0). The one-screen layout targets a desktop or line-side terminal browser; a phone layout is out of scope for the MVP.
- **Online only**: No offline mode in the MVP.
- **Accessibility**: Workers may have limited tech literacy — UI must be extremely simple, plain-worded, with large targets. One thing on screen at a time when following a SOP.
- **Single organisation**: Built for Visy. Row-level security stays on (defence in depth) but there is one organisation and no sign-up path that creates another.
- **AI Parsing**: Must handle varied document formats and structures; AI flags and tick-each-step stand between a parse and a published SOP.
- **Tech stack**: Next.js 16 (App Router) · React 19 · Supabase (Postgres, Auth, Storage, RLS) · Tailwind 4 · TanStack Query · Konva (site editor). Deployed on Railway from `master`.
- **Removal is deletion**: a dropped feature loses its routes, components, API endpoints, dependencies and scheduled jobs. Its database rows stay untouched this milestone.

*(Pre-2026-10-02 constraints — PWA installable on iOS/Android, offline with sync, multi-tenant isolation as a product feature — are retired with the features they served.)*

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
| Authoring UX before conversion quality | Two-milestone sequence: v8.0 converges the creation flow, v9.0 makes the parse output trustworthy. Ordering chosen by Simon | ✗ Superseded 2026-10-03 by the MVP simplification |
| MVP simplification: one screen, features dropped for simplicity (v11.0) | ~35 screens and nine header entries had outgrown the people using them; the site map already indexes everything | — Locked by Simon 2026-10-02 |
| The site is the only navigation; rooms are destinations (v11.0) | Office = governance, Smoko room = training, Workshop = authoring, Noticeboard = site-wide SOPs, machines = their SOPs. A list beside the map is the same places as text, never a second menu | — Locked 2026-10-02 (sketch 008) |
| An open SOP owns the screen (v11.0) | "The SOP and its contents are never shared with other elements of the site that could be distracting" — walking or editing removes the map and the list | — Locked by Simon 2026-10-03 |
| Eight data types underpin the app (v11.0) | decisions · objectives · requests · notifications · SOP · steps · standards · users. Decisions are one append-only ledger; objectives are metadata people and agents both set and read; standards are labels, not a library | — Locked by Simon 2026-10-02 |
| A SOP is sections and steps; hazard and PPE are kinds of step (v11.0) | Removes the fixed hazard/PPE section types and the block vocabulary from what admins and workers see | — Locked by Simon 2026-10-02 |
| Single organisation — Visy (v11.0) | "We are building for one organisation only." Multi-tenancy as a product feature is retired; RLS stays as defence in depth | ✗ Supersedes "Multi-tenant SaaS from the start" · Locked 2026-10-02 |
| Offline, voice, phone/QR dropped (v11.0) | Dropped in favour of simplicity. Reverses the original core value's "on their phone … even offline" | ✗ Supersedes "PWA over native apps" as a product commitment · Locked 2026-10-02 — phone flagged for confirmation |
| Keep the current access wiring (v11.0) | The one governance surface kept exactly as built, opened from the Office | — Locked by Simon 2026-10-02 |

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
*Last updated: 2026-10-06 — **Phase 60 (Requests, Notifications & Objectives) complete, verified 5/5, deployed eval 78/80 at `360f6312` (the two reds are the known Phase 59 email-rate-limit and Phase 58 fixture-residue cases)** — three more data types live: `requests` (change a SOP · new SOP · observe me · do a SOP; raise / withdraw / answer in the Office Requests tab, one ledger row per answer, asker notified; supervisor/admin asks auto-accept on their authority and write `sop_assignments` so due/Now-card logic is unchanged; person-targeted asks can be declined), `notifications` (bell with unread count in the list header, browser-client reads under RLS, five NTF-02 triggers + asked-to-do, two header-authenticated cron routes), `objectives` (free text ≤ 200, one per site/department/machine/SOP/person with optional by-date, quiet metadata, agent-set unconfirmed until a person confirms, readable/settable by agents via the AI-field interface); site overview with nothing selected (counts → objectives → notifications → my requests); migration 00074 live; assign screen deleted with a proxy redirect; `/sops/[sopId]` baseline 792→795 (lazy-seam runtime, recorded). Code review 0 critical / 7 warnings all fixed (60-REVIEW-FIX.md). Railway cron services created 2026-10-06 (`cron-review-due` 18:00 UTC, `cron-machines-without-sops` 18:10, `cron-synthesis-sweep` 18:20; image `node:20-alpine`, `CRON_SECRET` referenced from the app service, start command is a `node -e fetch(...)` POST). Prior: 2026-10-06 — **Phase 59 (The Office) complete, verified 5/5, deployed eval 68/68 at `b66b200d`** — governance re-homed into the one screen: `/?place=office&tab=inbox|decisions|people|access`, table tabs widen the pane (SHL-06) with the map re-centring; inbox = one action per row (assign owner · mark reviewed · sign off/reject with photos + lightbox · approve/send back · try again · write a SOP), sign-offs and owner due-reviews are rows, empty state is the goal with a cleared-today count; decisions ledger newest-first with plain-word kind chips; people & roles (admin-only invite with a role, inline role select, departments, remove — which never worked before: `organisation_members` had no DELETE policy); Access lens mounted unchanged; owner + review date under every admin SOP row and in This SOP; migration 00073 (3 ledger kinds) live; `/governance`, `/admin/team`, `/admin/access`, org-chart views and supervisor activity views deleted with proxy redirects, `/admin/training` bridge until Phase 61. Code review 2 critical / 5 warnings all fixed (59-REVIEW-FIX.md: `recordSignature` un-exported, claim-first sign-off, one ledger row per decision, re-invite of pending invitees). Known gaps for 60/61: supervisors lack a Record-observation entry point; worker-owners cannot mark reviewed until they have an Office. Prior: 2026-10-05 — **Phase 58 (The SOP focus screen — walk & edit) complete, verified 5/5, deployed eval 60/60 at `e844e3b1`** — an open SOP owns the screen: worker walk (hazard/PPE acks, photo steps, Send for sign-off) over server-written `sop_walks` (00071 + 00072: worker write policies dropped after review CR-01, writes via the action only); admin editor behind a lazy seam (`?mode=edit`, admin-only switch, tick-each-step, AI findings as `sop_ai_findings` rows keyed to steps, publish gate re-keyed to steps and re-pinned once — D-16); every on-ramp writes focus steps directly; `forkDraft` for new versions, `latestPublished` one-row rule in worker lists; parsing state in the editor; production cutover D-23 (final converter run: 0 changes needed, converter retired); tabbed SOP page, old walkthroughs, builder + versions routes deleted (~220 files), every old address redirects in the proxy; Konva annotation rebuilt on `StepCard` (D-03). Code review 2 critical / 7 warnings all fixed (58-REVIEW-FIX.md). Prior: 2026-10-04 — **Phase 56 (A simpler SOP + the decision ledger) complete, verified 5/5, deployed eval 34/0/1 at `fa65313`** — migrations 00069/00070 live (sops.placement synced from sop_machines, sop_focus_steps, standards ×6 seeded per org, standard_attachments, append-only `decisions` ledger the DB itself protects for every role incl. service_role); all 70 production SOPs converted to focus steps (0 failed, idempotent, original rows kept for the Phase 58 cutover); `recordDecision()` single writer hooked into every existing decision path (approvals, publish, governance, completions, assignments, observations, verify, AI field writes); standards manager panel in the builder Tools menu; placement + standards labels on the worker SOP page and walk views. Code review 0 critical / 4 warnings all fixed (56-REVIEW.md). Open question closed: ONE physical `decisions` table (not a ledger over existing tables). Prior: 2026-10-03 — **Phase 55 (Cut the dropped features, one organisation) complete, verified 7/7, deployed eval 28/0/1 at `2d60b43`** — 13 features deleted (offline, voice, phone/QR, shared-device login, video generation, flow, annotation, YouTube/photo-scan, library, version compare), 8 packages uninstalled, bundle 1045→817 KB (D-07), Supabase public sign-up disabled, worker walk path online-only; code review 2 critical / 4 warnings all fixed (55-REVIEW.md). Same day: **Milestone v11.0 (One-Screen MVP) started** after Simon's 2026-10-02 MVP simplification; v8.0 closed with Phase 42 superseded, v9.0 superseded. What This Is, Core Value, Constraints and Out of Scope rewritten for the one-screen, single-organisation, desktop-first product. Prior: 2026-09-30 — **Phase 43 (Dead-Surface Removal & Route Truth) complete, verified 8/8, deployed eval 29/29; last phase of v8.0 executed — milestone ready for `/gsd-complete-milestone`** (code review: 0 critical / 5 warnings, see 43-REVIEW.md). Prior: 2026-07-28 — **Milestone v8.0 (Authoring Convergence) started**; v7.0 closed at Phase 37 with 4/4 phases and 32/32 plans, Phases 38/39 deferred to backlog 999.4/999.5/999.6 (creation pipeline pre-alpha). v9.0 (Conversion Quality) sequenced next. Prior: Phase 37 (assessor governance, ASR-01) complete, re-verified 14/14 after gap closure (37-07/37-08 closed CR-01/CR-02 + WR-01..WR-05; post-closure review's 2 new warnings fixed same day). Phase 36 (refresher cadence + version-currency) complete, verified 4/4; code review 1 Critical + 7 Warnings all fixed pre-verification (CMP-03/TRN-03/REF-01/REF-02 validated). Phase 35 (competency classifier + training matrix) complete 2026-07-26, UAT 8/8. Prior: Phase 34 (supervisor observations) complete, re-verified 5/5 after gap closure. Milestone v7.0 (Competency & Training Layer) started 2026-07-19; v6.0 quick-closed same day (Phase 31 rolled forward into v7.0). Prior: v5.0 shipped 2026-07-05; ad-hoc AI-layer work 2026-07-06→09 formalized by Phase 27 (2026-07-12); self-healing video render webhook shipped 2026-07-12. Source of truth `.planning/PRODUCT-ROADMAP.md` v0.3 + Visy interview findings (2026-05-05).*
