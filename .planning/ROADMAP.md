# Roadmap: SOP Assistant

## Overview

Four phases deliver the complete v1 product. Phase 1 establishes the multi-tenant foundation that every subsequent feature depends on — this cannot be retrofitted. Phase 2 builds the AI document ingestion pipeline, the core product differentiator. Phase 3 delivers the full worker-facing experience including offline access, SOP library, and SOP management. Phase 4 closes the loop with completion tracking, photo evidence, and supervisor sign-off.

v2.0 adds four phases (5–8) delivering three new SOP creation pathways and a video consumption layer. Phase 5 establishes upload infrastructure and expanded file parsing. Phase 6 delivers video transcription via file upload and URL. Phase 7 adds in-app camera recording (gated on iOS Safari maturity). Phase 8 generates video SOPs from published structured content.

v3.0 closed 2026-05-23 after delivering the native SOP Builder milestone across Phases 11–15. Phase 11 laid down the additive section_kinds catalog + blocks schema. Phase 12 shipped the Puck-based builder shell + blank-page wizard. Phase 12.5 delivered the worker-first blueprint redesign. Phase 13 delivered the reusable org-vs-global block library (65 NZ seed blocks). Phase 14 added AI-drafted SOPs gated behind the Claude adversarial verifier. Phase 14.5 rolled the blueprint design language across the full admin surface. Phase 15 added Manufacturing-Line Mode (sub-trade tags, voice Q&A, site-tier multi-tenancy) per the 2026-05-05 Visy interview. Phase 20 (Conversion Pipeline V2) partially landed (DOCX → builder layout_data + side-by-side step+photo blocks); the remaining scope (AI reviewer × 5 jobs, persistent side-by-side source viewer, per-block verify checklist) deferred to **v4.0: Safety-Critical Parsing**. Phases 16, 17, 18 deferred to v4.0 backlog. Phase 19 deleted (its dependencies — 9, 16, 17 — all deferred or descoped). Phase 7 remains deferred indefinitely pending iOS Safari MediaRecorder maturity.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Multi-tenant auth, role-based access, and PWA shell (completed 2026-03-23)
- [x] **Phase 2: Document Intake** - AI parsing pipeline, admin review, and SOP publish workflow (completed 2026-03-24)
- [x] **Phase 3: Worker Experience** - Step-by-step walkthrough, offline access, SOP library, and assignment (completed 2026-03-25)
- [x] **Phase 4: Completion and Sign-off** - Completion tracking, photo evidence, and supervisor sign-off (completed 2026-03-26)
- [x] **Phase 5: Expanded File Intake** - TUS upload infrastructure, photo OCR, Excel/PowerPoint/text parsing, and shared intake routing (completed 2026-04-03)
- [x] **Phase 6: Video Transcription (Upload and URL)** - MP4/MOV file upload and YouTube URL → structured SOP with transcript review (completed 2026-04-03)
- [ ] **Phase 7: Video Transcription (In-App Recording)** - In-browser camera recording → SOP transcription with iOS Safari fallback
- [x] **Phase 8: Video SOP Generation** - AI-narrated slideshow, screen-recording-style, and full AI video generated from published SOPs (completed 2026-04-04)
- [ ] **Phase 9: Streamlined File → Video Pipeline** - One-click upload-to-video SOP flow chaining file parsing and video generation
- [x] **Phase 10: Video Version Management** - Multiple video versions per SOP with labels, editing, deletion, and admin management UI (completed 2026-04-13)
- [x] **Phase 11: Section Schema & Block Foundation** - Additive `section_kinds` catalog, `blocks`/`block_versions`/`sop_section_blocks` tables, legacy fallback, and v3.0 wave-0 test stubs (completed 2026-04-15)
- [x] **Phase 12: Builder Shell & Blank-Page Authoring** - Puck-based builder, `layout_data` JSONB, blank-page wizard, unified authoring surface, legacy linear fallback (completed 2026-04-24; UAT 9/11 automated PASS; UAT #3 airplane-mode + UAT #6 cross-admin LWW closed 2026-05-23 as field-verified — offline queue + LWW are structurally in code, prod usage since 2026-04-24 has not surfaced regressions)
- [x] **Phase 12.5: Blueprint Redesign** - Worker-first UX overhaul with paper/ink engineering-drawing aesthetic; unified tabbed interface (overview/tools/hazards/flow/model/walkthrough); mobile immersive walkthrough; voice input (server-side transcription); cmdk; 7 new AI-accessible block types (Measurement, Decision, Escalate, SignOff, Zone, Inspect, VoiceNote) — ModelBlock deferred (completed 2026-05-07; verifier PASSED 10/10 truths; 6 carried human-UAT items: paper/ink theme scoping, mobile immersive viewport routing, Deepgram voice state machine, online voice persistence, Cmd+K palette, Puck FlowGraphField round-trip; walkthrough completion flow + photo-queue guard finalised in 5989852)
- [x] **Phase 13: Reusable Block Library** - Org-vs-global block CRUD, NZ seed blocks (65 globals), wizard "Pick from library" step, pin-version vs follow-latest semantics, platform-admin curation UI (implementation complete 2026-05-07; verifier PASSED 5/5; browser UAT for 13-03/04/05 closed 2026-05-23 as field-verified — Phase 13 plumbing exercised continuously through Phase 14/15/20 work without regression)
- [x] **Phase 14: AI-Drafted SOPs** - Natural-language prompt → GPT-4o structured draft → Claude adversarial verification gate → editable draft lands in the builder (implementation complete 2026-05-10; verifier PASSED 9/9; closed 2026-05-23 — human UAT 1/2/4 closed as verified-via-downstream, since Phase 20 conversion pipeline work has been exercising the AI draft → builder path against the live Anthropic API since 2026-05-15)
- [x] **Phase 14.5: Blueprint Shell Rollout** - Paper/ink design language rolled across admin, auth, dashboard, library, and worker SOP surfaces (~90 files migrated 2026-05-11/12; legacy steel/yellow theme + SiteThemeProvider + ThemePicker removed). Residual scope (role-aware home + global Cmd+K) rolled into Phase 15.
- [x] **Phase 15: Manufacturing-Line Mode** - Derived from Visy customer interview (2026-05-05). Six sub-scopes: site tier in multi-tenancy, terminal/kiosk shell, voice Q&A over a single SOP, SOP governance & lifecycle, sub-trade tags + extended roles, training-record export. Implementation 5/5 plans complete 2026-05-13; closed 2026-05-23 with migration 00030 confirmed live on prod (`db push` reported up-to-date). Visy demo dry-run carried as a manual pre-demo task.
- [→] **Phase 16: NZ Template Library** — **deferred to v4.0 backlog** 2026-05-23. Curated WorkSafe / machinery / chemical handling templates as a third builder entry point. Defer reason: own milestone scale; not blocking v3.0 closure.
- [⤳] **Phase 17: Image & Diagram Annotation** — **ABSORBED into Phase 26 (v5.0) 2026-07-02**. Konva editor with dual-store, DiagramHotspotBlock, stylus + palm rejection. Pulled forward into the builder redesign (CONTEXT D-03); do not build separately — its three planned slices are reused verbatim inside Phase 26. (Was deferred to v4.0 backlog 2026-05-23.)
- [→] **Phase 18: Collaborative Editing** — **deferred to v4.0 backlog** 2026-05-23. Section-level pessimistic locks, Realtime presence, conflict modal. Defer reason: multi-week build; current single-admin pattern has not surfaced contention.
- ~~Phase 19: Pipeline Integration, Bundle Isolation & v3.0 Closeout~~ — **deleted from roadmap 2026-05-23**. Its only purpose was to tie Phases 9 + 12 + 16 + 17 together; with 9 unstarted and 16/17 deferred, there is nothing to close out. v3.0 archive captures the closeout instead.
- [x] **Phase 20: Conversion Pipeline V2 (partial — v3.0 slice)** - DOCX → Puck `layout_data` directly in the Phase 12 builder with side-by-side step + photo blocks shipped 2026-05-15..17 (commits `1a2bbbc`, `c47baa7`, `e33669e`, `064e819`). SPEC + 4 validated spikes captured 2026-05-15..16. Remaining scope (persistent side-by-side source viewer, AI reviewer × 5 jobs auto/manual, mandatory per-block verify checklist at publish gate) **carried to v4.0 Phase 21: Safety-Critical Parsing**.

### Phase 27: AI Provider & Settings — formal spec pass

**Goal:** Retroactively formalize the AI provider/model-selection arc that shipped ad-hoc 2026-07-06/07 (`src/lib/ai/registry.ts`, `src/lib/ai/llm.ts`, `AiModelSelect` + `/admin/ai-settings` (migration 00042), the R&D-validated grounding prompt + title-naming guard in `sop-parser.ts`/`sop-title.ts`): write a SPEC.md capturing the architecture as-built, add REQUIREMENTS.md traceability (AIPS-*), and close the 3 gaps the code survey found — `OPENROUTER_API_KEY` undocumented in `.env.local.example`, the `ai_model_settings` service-role write path has no test proving org self-enforcement (same class as the 2026-06-15 cross-tenant learning), and the whole arc currently has zero automated test coverage.
**Requirements**: AIPS-REG-01, AIPS-REG-02, AIPS-SET-01, AIPS-SET-02, AIPS-PROMPT-01, AIPS-PARSE-01, AIPS-TITLE-01, AIPS-GAP-01, AIPS-GAP-02, AIPS-GAP-03
**Depends on:** Phase 26, Phase 26.5
**Plans:** 1/1 plans complete

Plans:

- [x] 27-01-PLAN.md — SPEC.md as-built + REQUIREMENTS traceability + phase27-unit/phase27-stubs Playwright projects + OPENROUTER_API_KEY doc + registry/llm-routing/title-guard unit tests + ai_model_settings org-scope runtime regression (Wave 1)

---

## v6.0 — SOP Ownership & Governance Infrastructure (started 2026-07-12)

Closes the #1 governance gap surfaced by the 2026-05-05 Visy Packaging customer interview ("Nobody owns SOPs — there isn't anybody"). **NORTH STAR (locked by Simon 2026-07-12):** ease of use and maintenance first — process and blockers never beat ease of use; governance state NEVER blocks worker read/walkthrough access. Approval chains are opt-in per category (absent chain = today's publish flow, byte-identical). Owners and review dates auto-backfill — no admin data-entry campaign. Builds on existing infra only: version supersede + sign-off chain (Phase 23), departments (Phase 25), completions (Phase 4), AI adapter + agent metadata (Phase 26.5/27), site tier (Phase 15). Execution order 28 → 29 → 30.

- [x] **Phase 28: Ownership + Review Lifecycle + Governance Queue** - Every SOP gets an accountable owner and review-due date (both auto-backfilled), plus one unified governance queue with one-click actions — worker read access is never gated by any of it (completed 2026-07-12)
- [ ] **Phase 29: Approval Chains** - Optional per-category 1–4 step approval chain, snapshotted per version, one-click approve — categories without a chain publish exactly as today
- [ ] **Phase 30: UX Consolidation & Simplification** - One home per role, one admin nav, one create entry, one governance surface, 3-tab worker SOP view, plain language throughout (UX-01..08)

### Phase 28: Ownership + Review Lifecycle + Governance Queue

**Goal**: Every SOP displays a single accountable owner and a review-due date — both auto-backfilled with zero admin data-entry — and admins get one unified governance queue (due-soon / overdue / unowned / stale-role) with one-click actions; worker read/walkthrough access is never blocked by ownership or review state.
**Depends on**: Phase 25 (departments + `owner_user_id` pattern), Phase 23 (version supersede — "confirm current" routes into it), Phase 4 (completions feed queue/staleness signals)
**Requirements**: OWN-01, OWN-02, OWN-03, OWN-04, REV-01, REV-02, REV-03, REV-04, GQ-01, GQ-02, GQ-03, GQ-04
**Success Criteria** (what must be TRUE):

  1. Every SOP (existing and new) displays a single accountable owner, auto-backfilled to creator or org admin with no manual data-entry campaign; admin can reassign the owner in ≤2 clicks from the SOP library row or builder/detail page
  2. An owner can open a "My SOPs" view listing every SOP they own with review status at a glance; if an owner is deactivated or removed from the org, their SOPs automatically surface as "unowned" in the governance queue rather than going silently orphaned
  3. Every SOP has a review-due date derived from a per-category default cadence (overridable per SOP, auto-backfilled from published/updated date); marking it reviewed is one click ("Confirm current") or routes into the existing edit → version-supersede flow
  4. Overdue SOPs show a visible badge/grey-out in the admin library and workers see a lightweight "current as of <date>" indicator on the SOP view — but review/ownership state never blocks a worker from opening, reading, or completing any SOP
  5. Admin sees one unified governance queue (due-soon / overdue / unowned / stale-role — the latter triggered when a role/department referenced by an SOP's assignments is renamed or removed) with a one-click primary action inline on every row, plus a dashboard widget on the admin home showing queue counts with deep links into the queue

**Plans**: 6 plans
**UI hint**: yes

Plans:
**Wave 1**

- [x] 28-01-PLAN.md — Migration 00043 (owner + review columns + owner-default trigger + sop_review_cadences + sop_review_events) + db push + types + idempotent backfill (Wave 1)
- [x] 28-02-PLAN.md — Pure governance logic (classifyGovernanceRow, resolveCadenceMonths) + phase28/phase28-unit Playwright projects + unit specs (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 28-03-PLAN.md — governance.ts server actions (setSopOwner / confirmSopCurrent / setReviewCadence / listGovernanceQueue) + publish-route review-clock reset + source-contract specs (Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 28-04-PLAN.md — /admin/governance queue page + filter chips + one-wired-action rows + inline OwnerPicker + journeys.ts entry (Wave 3)
- [x] 28-05-PLAN.md — Admin library owner column/overdue badge/confirm-current + owner=me filter + dashboard widget + worker "Current as of" caption (Wave 3)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 28-06-PLAN.md — Merged-tree gate: full suite + tsc + npm run build + pathways coverage + 12-requirement audit (Wave 4)

### Phase 29: Approval Chains

**Goal**: Admins can optionally define a per-category multi-step approval chain that gates publish only when configured — SOPs in categories without a chain continue to publish exactly as they do today.
**Depends on**: Phase 28 (governance queue + schema foundation the chain hangs off)
**Requirements**: APR-01, APR-02, APR-03, APR-04, APR-05
**Success Criteria** (what must be TRUE):

  1. Admin can define an optional approval chain (1–4 ordered approver steps, by role or named member) per SOP category; categories without a configured chain publish exactly as today with zero added friction
  2. The chain is snapshotted per SOP version — a new version can carry an adjusted chain while historical versions retain the chain they were approved under
  3. An approver can approve or request changes in one click from the SOP itself and from the governance queue — there is no separate approval console
  4. When a chain exists, publish completes automatically after final approval; pending state ("who's next") is visible both on the SOP and in the governance queue
  5. Approval history (who, when, which version) is visible in the existing version-history surface

**Plans**: 6 plans in 4 waves
**UI hint**: yes
Plans:
**Wave 1**

- [x] 29-01-PLAN.md — Schema (00045 live) + pure chain logic + performPublish extraction (byte-identical no-chain proof)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 29-02-PLAN.md — Server actions (setApprovalChain/approveStep/requestChanges) + publish-route chain-gate + awaiting_approval classifier

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 29-03-PLAN.md — Approval-chain config editor on /admin/governance (dnd-kit 1-4 step, admin/safety_manager scoped)
- [x] 29-04-PLAN.md — Builder PublishStage pending-chain panel + one-click approve/request-changes
- [x] 29-05-PLAN.md — Governance queue Approve action + awaiting-approval widget/chip + version-history approval log

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 29-06-PLAN.md — Merged-tree gate: full suite + phase28 regression + tsc + build + 5-req audit

### Phase 30: UX Consolidation & Simplification

**Goal**: Every question a user has gets exactly ONE place that answers it — one home per role, one admin nav, one create entry, one governance surface, a 3-tab worker SOP view, and plain language throughout — so workers and admins never have to learn the app.
**Depends on**: Phase 29 (approval surfaces stable — governance merge must not regress APR-03/04), Phase 28 (governance queue is the merge target)
**Requirements**: UX-01, UX-02, UX-03, UX-04, UX-05, UX-06, UX-07, UX-08
**Source analysis**: 30-CONTEXT.md (full frontend audit 2026-07-12: 3 disagreeing admin menus, 5 list styles, 3 governance surfaces, 8 create entry points, dead Model tab/orphan routes; usability-lab SOP-0068A findings F-01..F-16)
**Success Criteria** (what must be TRUE):

  1. Dead weight removed: Model tab, walkthrough redirect route + orphan layout, legacy shims (WalkthroughTab.tsx, BuilderWithSourceViewer.tsx), fake notifications bell, no-op department filter — all gone (UX-08)
  2. One shared AdminNav component renders the identical admin menu on every admin page; /admin/agent and /admin/governance are reachable from it; the three previous disagreeing menus are gone (UX-02)
  3. One "New SOP" entry point opens a single method-picker (Upload first, then Talk/Describe/Blank); the 8 scattered create buttons are gone (UX-04)
  4. Each role lands on its real home (worker /sops, supervisor+safety_manager /activity, admin /admin/sops); the dashboard page is deleted and no nav item points at it (UX-01)
  5. Worker SOP detail has exactly 3 tabs (Read / Walk it / Flow) with PPE+equipment rendered once; QR deep-links still land correctly (UX-05)
  6. Plain-language pass applied: Check/Edit/Send-to-workers stage names, plain AI-reviewer flag titles, human step names instead of "block N", every icon action labelled (UX-07)
  7. Admin SOP list rows are one line (title · status chip · flag chip · owner) — click opens the builder where all per-SOP actions live as labelled actions (UX-06)
  8. Governance folded into /admin/sops as the "Needs attention" filter with flag chips; GovernanceWidget and LibraryReviewCell removed as separate surfaces; approval-chain editor relocated to admin settings; APR-03/04 approve-from-queue behaviour preserved (UX-03)
  9. journeys.ts updated in the same change for every rerouted/removed screen; /pathways shows 0 not-mapped

**Plans**: 8 plans in 8 sequential waves
**UI hint**: yes

Plans:

**Wave 1**

- [x] 30-01-PLAN.md — Wave-0 phase30 test harness + fix 2 pre-existing scp failures + delete BuilderWithSourceViewer + bundle baseline (UX-05, UX-08)

**Wave 2**

- [x] 30-02-PLAN.md — UX-01 role homes: roleHome helper + /dashboard redirect shim + /pending + not-found.tsx + login/middleware landing (UX-01)

**Wave 3**

- [x] 30-03-PLAN.md — UX-02 shared AdminNav + /admin/settings hub + replace 5 copy-pasted sub-navs (UX-02)

**Wave 4**

- [x] 30-04-PLAN.md — TopHeader/global-nav cleanup: one Admin link, no Dashboard, delete fake bell, move Pathways/UAT to account menu (UX-01, UX-02, UX-08)

**Wave 5**

- [x] 30-05-PLAN.md — UX-04 single New SOP entry -> Upload-first method picker; scattered create buttons removed (UX-04)

**Wave 6**

- [ ] 30-06-PLAN.md — UX-05 worker 6->3 tabs (Read/Walk/Flow) + delete Model/Walkthrough tabs + walkthrough route + dept filter + bundle re-baseline (UX-05, UX-08, UX-04)

**Wave 7**

- [ ] 30-07-PLAN.md — UX-06 builder labelled action menu + UX-07 plain language (Check/Edit/Send-to-workers, plain flag titles, offline pill) (UX-06, UX-07)

**Wave 8**

- [ ] 30-08-PLAN.md — UX-03 governance fold into /admin/sops + one-line rows + /admin/governance shim + editor->settings + merged-tree gate (UX-03, UX-06)

### Phase 31: Training Records + AI Maintenance Schedule

**Goal**: Completions become exportable per-worker training evidence, admins can see who trained on an outdated SOP version after a supersede, and the governance dashboard surfaces an AI-prioritized review plan built on the existing AI adapter + agent metadata layer.
**Depends on**: Phase 30 (consolidated admin surfaces host the training + schedule views), Phase 28 (governance data), Phase 23 (completions + sign-off chain), Phase 26.5/27 (AI adapter + agent metadata layer powers the maintenance schedule)
**Requirements**: TRN-01, TRN-02, TRN-03, REV-05
**Success Criteria** (what must be TRUE):

  1. A per-worker training record view renders every SOP completion as training evidence (SOP, version completed, date, sign-off chain), built entirely on existing completion data
  2. Admin can export training records as CSV, filterable by worker, SOP, department, and date range
  3. SOP detail (admin) shows which workers have completed the current version vs. a prior version, surfacing workers "trained on an outdated version" after a supersede
  4. The governance dashboard shows an AI-proposed maintenance schedule — a prioritized review plan ranked by staleness, usage, and reviewer flags, powered by the existing AI adapter + agent metadata layer (no new AI infrastructure)

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] TBD (created by /gsd-plan-phase)

---

## v4.0 — Safety-Critical Parsing + Voice + AI Foundation (started 2026-05-24 · ✅ shipped 2026-07-02)

Bundles the 8 v4.0 NOW features from `.planning/PRODUCT-ROADMAP.md` v0.3. Planned 21 → 22 → 23; grew in-flight with 21.5/21.6 (builder UX) and 24/25 (flow graph + departments). All phases executed and code-reviewed; residual = human UAT (21.6/22/23/25) carried per the v3.0 field-verification precedent. Archive via `/gsd-complete-milestone`.

- [x] **Phase 21: Safety-Critical Parsing** ✅ 2026-05-25 (PASS-WITH-NOTES) — Finishes the Phase 20 contract. Side-by-side source viewer (S-02) + AI reviewer × 5 verification jobs (S-03) + per-block verify checklist at publish gate (S-04) + Word/PDF parsing with step-level provenance (I-01). 5 plans / 5 waves merged; 23/23 SCP-* requirements covered; defence-in-depth publish gate (UI disabled + server 400); D-21-07 no-bulk-verify lint guard live in CI. See `.planning/phases/21-safety-critical-parsing/VERIFICATION.md`.
- [x] **Phase 21.5: Builder Review UX** ✅ 2026-06-02 (5/5 plans) — Restructure the admin SOP builder review/publish surface to remove first-run confusion (currently 5–6 always-on panels, internal jargon like "StepBlock", a hidden publish gate). One-step-at-a-time "Review Station" (step navigator left · step-in-app centre · source document right), AI reviewer check rendered inside the step card it relates to, 3-stage stepper (Build → Review → Publish), humanized labels ("Verify / Send back to edit", not a/d), publish-gate lock reason shown inline. Validated design: `sketch-builder-redesign-01.html` on the paper/ink sketch-findings-SOPstart system. Reuses shipped Phase 21 code (BuilderWithSourceViewer, SourceViewerPane, VerifyChecklistGate, ReviewerFlagsPanel). Runs **before** Phase 22 per Simon's priority. UI-led — produces a UI-SPEC.
- [x] **Phase 21.6: Builder Edit Stage Redesign** (INSERTED 2026-06-05) — Apply the 21.5 review-redesign philosophy to the **Build/edit** stage, which is still the untouched Puck editor. First-time admins hit internal jargon ("Block"), two redundant block lists (Puck component palette = add-new vs outline = already-placed), unanchored canvas figures with no clear action, and a cramped right-rail field editor. Scope from UAT feedback: (1) humanize block-type labels in the Puck palette + outline (reuse `humanizeBlockType` / `block-type-labels.ts` from 21.5 — currently only on the review surface); (2) collapse palette + outline into one clear affordance; (3) move content editing into the central canvas instead of the narrow right rail; (4) clarify the `SectionListSidebar` purpose + 1st→last ordering; (5) clarify what the user does with canvas figures/images. UI-led — produces a UI-SPEC. Runs **before** Phase 22. (completed 2026-06-05)
- [x] **Phase 22: Voice-Driven Walkthrough** — Turn the Phase 15 voice Q&A shell into a real end-to-end voice loop on the mobile immersive walkthrough: live Deepgram STT in (push-to-talk, SOP-keyterm-boosted for factory-floor noise), gpt-4o-mini-tts read-back out, spoken "next"/"done" driving step progression through the existing D-02 safety-gated path, plus an always-on visual layer (photo-or-icon per step) so a low-literacy worker can follow visually. Closes W-01 literacy gaps + X-02 voice-driven mode. **English-only this phase — multi-language (VDW-LIT-04, VDW-VOICE-04: Te Reo, Tagalog, Hindi, Mandarin) is DEFERRED to a fast-follow per CONTEXT D-08** (prove the loop first; translation-correctness risk on safety wording + weak Te Reo STT/TTS vendor support). Reuses the scaffolded `deepgram-stream.ts` + `WalkthroughVoiceModal` + `/api/voice/query`; preserves the SB-LINE-06 `next/dynamic` bundle isolation. No new npm packages. (completed 2026-06-24)

  **Plans:** 5/8 plans executed

  - [x] 22-01-PLAN.md — Wave 0: register `phase22-stubs` Playwright project + 6 source-contract/unit stub specs (Wave 0)
  - [x] 22-02-PLAN.md — Voice infra: Deepgram keyterms + `/api/voice/tts` route + `useTtsPlayback` hook + `classifyIntent` (Wave 1)
  - [x] 22-04-PLAN.md — Always-on visual layer (photo-or-icon per step) in `ImmersiveStepCard` (Wave 1)
  - [x] 22-03-PLAN.md — Wire the live voice loop: STT + intent dispatch + TTS read-back + onVoiceNext→handleMarkComplete (D-02) + human UAT (Wave 2)
- [x] **Phase 23: AI Field Layer + Version Supersede** — Universal AI read/write access to every editable field (X-03) + version history formal supersede + diff + restore + worker-instance sign-off chain (G-01). X-03 is the architectural backbone v5.0 conversational app builds on; G-01 fits naturally alongside as a small standalone bundle. (Cmd+K / AFL-AI-04 **removed from scope 2026-06-25** — palette dropped from the product.) (completed 2026-06-25)
- [x] **Phase 24: Procedure Flow — Spatial Node Graph** — Promoted from v4.0 backlog 2026-06-11 (added 2026-06-09); prototype work already on master (commits `c1440fc`, `9a395bd`, `b223786`). Closes a Phase 12.5 gap: req #8 ("Flow tab renders an SVG node graph") shipped as a vertical list of expandable step cards, NOT the blueprint sketch's design (`sketches/sop-blueprint/index.html` → FLOW tab) — a spatial node-graph canvas with positioned, colour-coded nodes, arrow-connected edges carrying yes/no/escalate branch labels, decision branching, node/branch counts, and FIT / EXPORT-PNG controls. The data model already supports it (`flow_graph` nodes carry `position`; edges carry `kind`). (completed 2026-06-12)
- [x] **Phase 25: Department as a First-Class Entity** (added 2026-06-14) — First output of the UX-simplification initiative (sketches: `sketches/departments`, `sketches/unified-block-library`, `sketches/team-departments`). Introduces a `departments` table (org-scoped: name, code, colour, icon, **owner_user_id**, archived) with many-to-many junctions to blocks, SOPs, and members. **Replaces** the Phase 13 org-vs-global block model with a single-org + departments model (65 global seed blocks migrate to org-owned, tagged "All departments") and replaces the free-text SOP `category` with `sop_departments`. Department membership gates worker SOP visibility (RLS). Owner accountability addresses the Visy "nobody owns SOPs" finding. Sub-trade tags (00030/00031) are left untouched — dept↔sub-trade combination semantics deferred. Delivers all three sketched surfaces: `/admin/departments` management page, block-library department tagging/filter, team department assignment + ownership, and the create-SOP wizard department field. SPEC: `.planning/phases/25-department-first-class-entity/25-SPEC.md`. (completed 2026-06-15)

  **Plans:** 6 plans / 4 waves

  - [x] 25-01-PLAN.md — Schema + data + RLS migrations (00035/00036/00037) + Department types (Wave 1)
  - [x] 25-02-PLAN.md — [BLOCKING] apply migrations to live DB + cross-tenant/visibility/no-recursion integration tests (Wave 1)
  - [x] 25-03-PLAN.md — departments.ts actions + blocks/sops/auth rewiring + DChip/DepartmentPicker + member-dept test (Wave 2)
  - [x] 25-04-PLAN.md — /admin/departments page: cards, counts, owner accountability, create/edit/archive (Wave 3)
  - [x] 25-05-PLAN.md — Block library dept rework + delete /admin/global-blocks + journeys.ts + worker library (Wave 3)
  - [x] 25-06-PLAN.md — Team dept assignment + owner badge + create-SOP department field (blank + AI) (Wave 3)

## v5.0 — AI-Native Builder + Agent Foundation (started 2026-07-02)

v4.0 (Phases 21–25) shipped. v5.0 rebuilds the SOP builder as a bespoke inline surface and lays the agent-metadata foundation the conversational/AI-native direction (Phase 23 X-03) builds on. Execution order 26 → 26.5. Forks locked in `26-CONTEXT.md` 2026-07-02.

- [ ] **Phase 26: SOP Builder Redesign — Inline Surface (v5.0 opener)** — Replace Puck with a **full bespoke** inline editor: one surface for create / convert / edit where the admin edits the *exact document a worker reads*; a tiered, context-aware block inserter with auto-dismissing smart-suggestion ghosts; a unified **Visual** block (photo · diagram · video) with **full Konva diagram annotation (Phase 17 ABSORBED — D-03)** — all while preserving the frozen `layout_data` / `sop_section_blocks` junction / `block_provenance` contract so the parse → AI-review → verify → publish spine is untouched. Agent-metadata layer split to 26.5 (contract hooks only here — D-02). Highest-effort/-risk engine choice taken deliberately for the highest interface ceiling (D-01). **HARD constraint:** workers never download Konva (baked PNG read path). SPEC: `.planning/phases/26-sop-builder-redesign/26-SPEC.md`; CONTEXT: `26-CONTEXT.md`; sketch: `sketches/sop-builder-redesign/index.html`.
  **Plans:** 14 plans / 10 waves (heavily-waved per D-01; builder arc + Konva arc run in parallel where files are disjoint)

  - [x] 26-01-PLAN.md — W1: dependency legitimacy checkpoint + install (@dnd-kit ×3, konva, react-konva)
  - [x] 26-02-PLAN.md — W1: phase26 Playwright project + pre-phase convert golden fixture (R6 baseline)
  - [x] 26-03-PLAN.md — W2: bespoke block-registry + sanitize-layout + Puck-free LayoutRenderer (read) + contract-check repoint + bundle re-baseline (R2/R6)
  - [x] 26-04-PLAN.md — W3: edit canvas — content-ops reducer + EditableDocument + BlockEditShell + InlineText + dnd-kit reorder + autosave re-wire (R1/R2/R7, P11) (completed 2026-07-03)
  - [x] 26-05-PLAN.md — W3: Konva foundation — canvas externalization + Next-16 spike (PASSED) + 00039 migration (applied+verified on live DB) + worker-isolation gate (R5/R8, D-03) (completed 2026-07-03)
  - [x] 26-06-PLAN.md — W4: field editors part 1 — field-map reachability registry (all 17 blocks) + inline patterns A/B/D (EnumChip, InlineToken, FIELD_MAP-driven shell; one Zod-validated lossless commit path); C/E declared but deferred to 26-07/26-09 (P14 partial) (completed 2026-07-03)
  - [x] 26-07-PLAN.md — W5: field editors part 2 — Pattern C array editors + per-block reachability parity (0 unreachable, all 18) (P14) ✅ 2026-07-03
  - [x] 26-08-PLAN.md — W6: tiered context-aware inserter + Reuse tier + ＋ dividers (R3) ✅ 2026-07-03
  - [x] 26-09-PLAN.md — W6: unified Visual block 3-place contract + media grid + convert-through (R5/R7, D-02/D-03) ✅ 2026-07-03
  - [x] 26-10-PLAN.md — W7: smart-next auto-dismissing ghosts (R4) ✅ 2026-07-03
  - [x] 26-11-PLAN.md — W7: Konva annotation primitives + DiagramHotspotBlock (R5, D-03) ✅ 2026-07-03 (device-UX feel carried as deferred-residual — verify on sopstart.com after 26-13 wires the launch point; UAT `p26-annotation-editor-feel`)
  - [x] 26-12-PLAN.md — W8: spine re-wire — selection-sync + AI-flag overlays + orphan chip + verify UI/publish gate, behavioural parity (R8, P12/P13/P9/P8) ✅ 2026-07-03 (canvas↔source selection-sync, ⚑ flag badge + reused ReviewerFlagsPanel, Reference-images chip, per-block verify chip; server publish gate UNCHANGED — real-route 400 regression green; phase26 85 green, next build Δ0KB)
  - [x] 26-13-PLAN.md — W9: bake-on-publish + saveAnnotation (service-role org self-enforce) + worker baked-PNG read (R5/R8, D-03) ✅ 2026-07-03 (saveAnnotation/bakeAnnotation service-role + org self-enforce via parseJwtPayload, async-only 'use server' with pure baked-path helpers split out; client stage.toDataURL → content-versioned baked PNG; VisualBlock baked-vs-raw Konva-free worker read; annotate launch wired MediaGrid→DiagramAnnotateModal→AnnotationEditorLoader — 26-11 editor now reachable; deleted 26-05 spike route; 27 phase26 specs green, next build Δ0KB Konva-isolated. Known Stub: diagram VisualItems need sopImageId at parse/upload before "Save & bake" enables for hand-added slots)
  - [x] 26-14-PLAN.md — W10: convert golden-path byte-equivalence + R8 regression sweep + remove @puckeditor/core + journeys/uat update (R1/R6/R8, D-01/D-04) ✅ 2026-07-03 (R6 convert-golden byte-equivalent to pre-phase fixture; spine-regression sweeps the R8 invariants — publish 400 gate, junctionId+block_provenance survive content-ops edits (behavioural), no-bulk-verify, append-only completions; **@puckeditor/core fully removed** — package.json+lockfile+node_modules, puck-config.tsx deleted, last consumers dropped; field-map P14 parity repointed to a committed puck-field-baseline.json fixture (0-unreachable/18 blocks preserved); journeys Build-stage + 2 UAT items updated; phase26 102 green, tsc clean, real npm run build green, worker bundle Δ0KB Puck-absent. Pre-existing obsolete Phase-11 Puck-contract specs logged to deferred-items.md)
- [x] **Phase 26.5: Agent Metadata Layer** — The human-invisible per-SOP + per-block machine layer (semantic tags, entities, embeddings, cross-SOP links, **memory**, **learning proposals**, **review state**) that agents read, write, and traverse individually and collectively (summarise across SOPs). Builds on Phase 23 X-03 (universal AI field read/write) + graphify (cross-SOP graph). Delivers the `⚇ Agent layer` surfacing + the memory/learning/review reasoning that Phase 26 only wires contract hooks for. (completed 2026-07-05)

### Post-26.5 ad-hoc work (2026-07-06 → 2026-07-09, not formally phased)

Shipped directly on master without a GSD phase/plan (Simon's "build fast, fix forward" mode). Two arcs:

- **AI provider flexibility** — `src/lib/ai/registry.ts` single-source model catalog (13 callsites normalized); `src/lib/ai/llm.ts` provider-agnostic adapter (Anthropic/OpenAI/OpenRouter, routes GLM 5.2 + other OpenRouter models); `AiModelSelect` component + `/admin/ai-settings` org-level model override tool (migration 00042); R&D-validated grounding prompt ported from `.autoresearch` loop (composite 75.9→87.3, hallucinations→0); `gpt-parser.ts` renamed `sop-parser.ts`; SOP title-naming conventions + guard; parser hardening for non-Anthropic models (empty-field normalization, idempotent retries, OpenRouter structured-output fence extraction + retry).
- **Builder + worker UX fixes** — unified AI-draft surface at `/admin/sops/new/ai` (Type a brief / Talk it through tabs, voice route folded in); QR machine deep links; read-step-aloud (mobile + desktop walkthrough); draft triage queue (worst-first ordering, confidence chips); tree-rail navigation overhaul (section/step/block rows all `focusCanvasBlock`, verify auto-advance, real preview text instead of generic titles, focus-flash feedback); the `layout_data`-trio bug fix across all 5 section-inserting routes (non-DOCX drafts were rendering an empty canvas) + prod backfill.

Not tracked as a phase; folded into PROJECT.md Validated requirements and CLAUDE.md Learnings. No REQUIREMENTS.md mapping.

## Phase Details

### Phase 26.5: Agent Metadata Layer

**Goal**: Every published SOP carries a machine-readable agent-metadata layer — semantic tags, entities, Voyage-3/pgvector embeddings, cross-SOP links, append-only memory, evidence-backed learning proposals, and a per-SOP agent assessment — populated by a real synthesis job (Haiku 4.5) reading the four org signal sources, and surfaced to admins via the `⚇ Agent layer` builder toggle + an org dashboard (proposals queue + activity feed). Infrastructure + surfacing only; no flagship agent capability this phase, but no dead UI either — backfill embeds/tags/links all currently-published SOPs.
**Depends on**: Phase 23 (X-03 `FieldDescriptor` registry + gateWrite approval path — proposals extend it), Phase 26 (D-02 contract hooks: `BLOCK_REGISTRY` medium tags on `/api/schema`, props round-trip in `content-ops.ts`; frozen `layout_data`/junction/provenance contract)
**Requirements**: Locked decisions D-01..D-16 in `26.5-CONTEXT.md` (storage model, Voyage-3 + pgvector, on-publish regeneration, memory/proposal semantics, two admin surfaces, synthesis job + backfill). No REQUIREMENTS.md mapping — CONTEXT.md is the ID source.
**Plans**: 8 plans / 6 waves
Plans:
**Wave 1**

- [x] 26.5-01-PLAN.md — Harness + package gate + lazy Voyage client & model constants (D-03, D-16)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 26.5-02-PLAN.md — Migration 00040: 5 append-only tables + pgvector + HNSW + similarity RPC + db push (D-01, D-02, D-03, D-05, D-07, D-08)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 26.5-03-PLAN.md — Voice Q&A transcript write path + 4 signal readers + similarity wrapper (D-05, D-06)

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 26.5-04-PLAN.md — Proposal lifecycle + synthesis pipeline (embed/tag/memory/assessment/proposals) (D-04, D-07, D-08, D-12, D-16)

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 26.5-05-PLAN.md — Publish-hook regeneration + backfill of all published SOPs (D-04, D-15)
- [x] 26.5-06-PLAN.md — Authed cron synthesis-sweep route + VOYAGE_API_KEY Railway gate (D-14) ✅ 2026-07-04 (route + live auth spec shipped; **gate DEFERRED — VOYAGE_API_KEY not yet on Railway, CRON_SECRET pending** — both must be set before first deploy of this phase; route 503-fails-fast in the interim)
- [x] 26.5-07-PLAN.md — Admin server actions + builder agentview toggle + read-only purple panel (D-02, D-09, D-10, D-12)

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 26.5-08-PLAN.md — Org agent dashboard (proposals queue + activity feed) + pathways map (D-09, D-10, D-11, D-13)

### Phase 21.5: Builder Review UX

**Goal**: A first-time admin can, without guidance, understand each builder pane's purpose and complete review and publish — via a sequenced Build → Review → Publish flow that replaces the 5–6 always-on jargon-labelled panels.
**Depends on**: Phase 21 (reuses the shipped source viewer, AI reviewer, verify checklist, and publish gate)
**Requirements**: R1 stepper, R2 review-station, R3 inline-AI, R4 humanized-labels, R5 plain-actions, R6 inline-publish-reason, R7 publish-stage, R8 adaptive-stepper, R9 tablet-responsive, R10 safety-invariants (SPEC.md is the ID source)
**Plans**: 5 plans / 3 waves

Plans:

- [x] 21.5-01-PLAN.md — Humanized block-type labels + word-labelled verify/send-back row actions (R4, R5)
- [x] 21.5-02-PLAN.md — Adaptive Build→Review→Publish stepper + inline publish reason + Review orientation strip (R1, R6, R8, R9)
- [x] 21.5-03-PLAN.md — Dedicated Publish stage with always-visible blocked reason + gated publish button (R6, R7)
- [x] 21.5-04-PLAN.md — Review Station 3-zone grid (navigator / step-in-app + inline AI / source), responsive ≥768px (R2, R3, R9)
- [x] 21.5-05-PLAN.md — Builder stage shell integration + page wiring + safety-invariant verification spec (R1, R8, R10)

### Phase 21.6: Builder Edit Stage Redesign (INSERTED)

**Goal**: A first-time admin can edit SOP content in the Build stage without internal jargon or redundant panels — one block list (not separate palette + outline), humanized block labels, and content editing in the central canvas rather than a cramped side rail.
**Depends on**: Phase 21.5 (reuses `block-type-labels.ts` / `humanizeBlockType`, `BuilderStageShell`, `SectionListSidebar`, the `BuilderClient` Puck editor)
**Requirements** (21.6-SPEC.md is the ID source): E1 step-centric-list, E2 humanized-labels, E3 one-content-list, E4 inline-canvas-editing, E5 section-list-clarity, E6 reference-gallery, E7 no-safety-regression
**Plans**: 5 plans (3 waves)

Plans:

- [x] 21.6-01-PLAN.md — Wave 0: source-contract spec + E2 lint guard + phase21.6-stubs playwright project (E2-E7 gate)
- [x] 21.6-02-PLAN.md — Reconfigure puck-config: suppress palette/outline (E3) + contentEditable inline editing (E4); preserve componentItem/componentOverlay (E7)
- [x] 21.6-03-PLAN.md — BuilderTreeRail + Tree{Section,Step,Block}Row: humanised Section-Steps spine, reorder, Reference-images relabel (E1/E2/E5/E6)
- [x] 21.6-04-PLAN.md — AddMenu (humanised + From-library) + StructuredFieldPopover (E3/E4)
- [x] 21.6-05-PLAN.md — Wire BuilderTreeRail + ui sidebar suppression + Add/library/popover into BuilderClient; E6 canvas chip; preserve autosave/junction/gate (E1/E3/E6/E7)

### Phase 24: Procedure Flow — Spatial Node Graph

**Goal**: The Flow tab's default view is a production-quality spatial node-graph canvas matching the blueprint sketch (`sketches/sop-blueprint/index.html` → FLOW tab) — positioned, colour-coded nodes, arrow-connected edges with yes/no/escalate branch labels, node/branch counts, and FIT / EXPORT-PNG controls — productionising the prototype already on master.
**Depends on**: Phase 12.5 (`sops.flow_graph` JSONB, `deriveFlowGraph`, Puck `FlowGraphField`), prototype commits `c1440fc` (FlowGraphCanvas.tsx + FlowTab "Graph (preview)" toggle), `9a395bd` (builder Flow preview button), `b223786` (branch-aware derivation + flow-graph-derivation tests)
**Requirements** (defined here — no REQUIREMENTS.md mapping for this phase):

- FLOW-01: Spatial SVG renderer with auto-layout for derived/linear graphs AND honouring explicit node positions from Puck authoring
- FLOW-02: Branch-aware derivation — `deriveFlowGraph` emits yes/no edges from DecisionBlock + escalate edges from EscalateBlock (✅ shipped in `b223786`; verify coverage, no rework unless gaps found)
- FLOW-03: FIT (zoom-to-fit) + EXPORT-PNG controls on the graph canvas
- FLOW-04: Vertical step-card list retained as fallback/mobile view; graph becomes the desktop default (drop "preview" gating)
- FLOW-05: Phase 12.5-carried Puck `FlowGraphField` round-trip verified (author positions in builder → persists to `sops.flow_graph` → renders in Flow tab)

**Plans**: 3 plans

Plans:
**Wave 1**

- [x] 24-01-PLAN.md — Wave-0 test surface + FlowGraphSchema relaxation (FLOW-05 schema) + FLOW-02 coverage audit + FLOW-05 round-trip investigation ✅ 2026-06-11

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 24-02-PLAN.md — FlowGraphCanvas productionisation: honour explicit positions (FLOW-01) + viewBox Fit & Export-PNG (FLOW-03) + accent-token unification ✅ 2026-06-11

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 24-03-PLAN.md — Desktop-default graph view (FLOW-04) + re-surface FlowGraphEditor & round-trip (FLOW-05) + journeys.ts + bundle gate + human-UAT

### Phase 23: AI Field Layer + Version Supersede

**Goal**: Ship two bundles — (X-03) a single unified AI field layer where every editable field registers a read API and (for most fields) a write API governed by a tiered approval model (low-stakes auto-apply; published-SOP + member-role changes require inline admin accept/reject), as the v5.0-consumable backbone with NO user-facing command surface this phase; and (G-01) a formal version-supersede flow (edit-into-draft clone → publish supersedes), side-by-side version diff, restore-as-new-version, an "updated since last completion" worker indicator, and a worker+supervisor instance sign-off chain where roster name-select identifies the signer and completing the SOP is the legal signature.
**Depends on**: Phase 12.5 (`diff-block-content.ts`, block model), Phase 13 (version model in `versioning.ts`), Phase 4 (completions + supervisor review), Phase 15 (00030/00031 org + sub-trade RLS — must be reconciled with roster name-select login)
**Requirements** (mapped in REQUIREMENTS.md § "AI Field Layer + Version Supersede (Phase 23)" L429):

- AFL-AI-01: Every editable field exposes an AI read API (agent can fetch the current value)
- AFL-AI-02: Most editable fields expose an AI write API with the tiered D-01/D-02/D-03 approval model (auto-apply vs inline admin accept/reject)
- AFL-AI-03: Unified field registry — every feature surface registers fields via a single shared, v5.0-consumable mechanism (no per-feature bespoke API)
- ~~AFL-AI-04~~: **REMOVED from scope 2026-06-25** (Cmd+K command palette dropped from the product)
- AFL-VER-01: Admin edits an SOP into a new version via edit-into-draft clone; publishing supersedes and deprecates the prior version (formal supersede flow)
- AFL-VER-02: Side-by-side diff between SOP versions (reuse `diff-block-content.ts`)
- AFL-VER-03: Restore an old version as a NEW current version with one click (append-only history)
- AFL-VER-04: Workers see an indicator when an SOP has a new published version since their last completion
- AFL-VER-05: Every SOP instance is recorded against the worker's roster-selected identity with a worker + supervisor sign-off chain — completing the SOP is the legal signature

**Plans**: 8 plans / 5 waves

Plans:

**Wave 0**

- [x] 23-00-PLAN.md — Register phase23-stubs + phase23-unit Playwright projects + source-contract stubs gating every AFL-* + D-11 ✅ 2026-06-25 (32 tests discovered; 10 pass; 22 skip pre-implementation; commits 544c882/9b30863/a44beb0)

**Wave 1**

- [x] 23-01-PLAN.md — Migration 00038 (roster_worker_id + sop_completion_signatures + ai_field_proposals) + [BLOCKING] schema push + to_regclass verify

**Wave 2** *(after schema)*

- [x] 23-02-PLAN.md — X-03 backbone: unified field registry (AFL-AI-03) + read API (AFL-AI-01) + validators
- [x] 23-03-PLAN.md — Version actions: cloneSopAsDraft supersede (AFL-VER-01) + restoreVersionAsNew append-only (AFL-VER-03)

**Wave 3**

- [x] 23-04-PLAN.md — AI write layer: gateWrite tiered approval (AFL-AI-02, D-01/D-02) + write API + inline Accept/Reject diff (D-03)
- [x] 23-05-PLAN.md — Version diff page (AFL-VER-02) + versions-page clone/restore/compare + "updated since" badge (AFL-VER-04)
- [x] 23-06-PLAN.md — Roster name-select login on shared devices (D-11) + worker+supervisor sign-off chain (AFL-VER-05)

**Wave 4**

- [x] 23-07-PLAN.md — journeys.ts + uat/tests.ts updates + full-phase verification gate + final UAT

### Phase 1: Foundation

**Goal**: Organisations and users can securely access the app with full tenant isolation, correct roles, and a functional PWA shell
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, PLAT-01, PLAT-02, PLAT-03
**Success Criteria** (what must be TRUE):

  1. An organisation admin can register their organisation and create their account
  2. Users can sign up, log in, and remain logged in across browser refresh and app relaunch
  3. Admin can assign Worker, Supervisor, Admin, and Safety Manager roles to users
  4. One organisation's users cannot see or access any data belonging to another organisation
  5. The app is installable to home screen on iOS and Android and loads in all modern mobile browsers with online/offline status visible

**Plans**: 4 plans

Plans:

- [x] 01-00-PLAN.md — Wave 0: Playwright test framework setup and stub test files for all requirements
- [x] 01-01-PLAN.md — Next.js 16 scaffold + Supabase multi-tenant schema with RLS, JWT custom claims, and cross-tenant isolation seed test
- [x] 01-02-PLAN.md — Auth flows (org registration, login, invite code join, email invite acceptance, role assignment)
- [x] 01-03-PLAN.md — PWA shell (Serwist service worker, manifest, offline indicator, bottom tab bar)

### Phase 2: Document Intake

**Goal**: Admins can upload Word and PDF SOP documents, review AI-parsed output, and publish structured SOPs to the library
**Depends on**: Phase 1
**Requirements**: PARSE-01, PARSE-02, PARSE-03, PARSE-04, PARSE-05, PARSE-06, PARSE-07
**Success Criteria** (what must be TRUE):

  1. Admin can upload a .docx or PDF file and the app extracts its text and embedded images
  2. AI automatically produces a structured SOP with labelled sections (Hazards, PPE, Steps, Emergency) that the admin can review
  3. Admin sees the parsed output alongside the original document before publishing
  4. Admin can edit any parsed section to correct errors before publishing
  5. Parsed SOPs stay in draft state until admin explicitly publishes them; published SOPs appear in the library

**Plans**: 4 plans

Plans:

- [x] 02-00-PLAN.md — Wave 0: Playwright test stubs for all PARSE requirements (sop-upload, sop-parsing, sop-review)
- [x] 02-01-PLAN.md — SOP data model (sops/sop_sections/sop_steps/sop_images schema + RLS), Storage buckets, presigned upload URL flow, upload UI, SOP library admin page
- [x] 02-02-PLAN.md — Async parsing pipeline: mammoth + unpdf text extraction, tesseract.js OCR fallback, GPT-4o structured output parser, image upload, parse Route Handler
- [x] 02-03-PLAN.md — Admin review UI: side-by-side layout, section editor with inline editing + approval, publish workflow, re-parse, delete draft, real-time parse status

### Phase 3: Worker Experience

**Goal**: Workers can find, walk through, and browse any assigned SOP on their phone — including offline — with the SOP library, search, and assignment managed by admins
**Depends on**: Phase 2
**Requirements**: WORK-01, WORK-02, WORK-03, WORK-04, WORK-05, WORK-06, WORK-07, WORK-08, WORK-09, WORK-10, MGMT-01, MGMT-02, MGMT-03, MGMT-04, MGMT-05, MGMT-06, MGMT-07
**Success Criteria** (what must be TRUE):

  1. Worker can walk through an SOP step-by-step in a full-screen glove-friendly interface, navigate backwards, and see progress — with hazard and PPE information shown before steps begin
  2. Worker can view any SOP section (Hazards, PPE, Steps, Emergency) directly via tabbed quick-reference without walking through all steps
  3. Worker can search and browse the SOP library; assigned SOPs appear first; images within steps display inline with zoom
  4. Worker can access all assigned SOPs without an internet connection; data entered offline syncs when connectivity returns
  5. Admin can assign SOPs to roles or individual workers; uploading a new document version retains previous versions linked to historical completions; workers see an update notification when an assigned SOP changes

**Plans**: 6 plans

Plans:

- [x] 03-00-PLAN.md — Wave 0: Playwright test stubs for all WORK and MGMT requirements (17 stubs across 6 test files)
- [x] 03-01-PLAN.md — Offline-first data layer: Dexie.js IndexedDB schema, TanStack Query persister, SOP sync engine, walkthrough state store, Serwist image caching, FTS and assignment migrations
- [x] 03-02-PLAN.md — Worker SOP walkthrough: safety acknowledgement gate, scrolling step list with tap-to-complete, progress indicator, inline images with zoom, full-screen glove-friendly layout
- [x] 03-03-PLAN.md — SOP library and quick reference: SOP card list, search overlay, category bottom sheet/sidebar, SOP detail page with tabbed section navigation
- [x] 03-04-PLAN.md — Admin SOP assignment: assign SOPs to roles and individual workers, assignment row component, server actions with admin role guards
- [x] 03-05-PLAN.md — SOP versioning and notifications: version history page, re-upload flow, superseded_by lineage, worker notifications table, notification polling and badge

### Phase 4: Completion and Sign-off

**Goal**: Worker completions are durably recorded with photo evidence and SOP version snapshot, and supervisors can review and sign off completions
**Depends on**: Phase 3
**Requirements**: COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07
**Success Criteria** (what must be TRUE):

  1. When a worker completes an SOP walkthrough, a completion record is created with a server-side timestamp and a reference to the exact SOP version followed
  2. Worker can capture photos during specific walkthrough steps; photos are tied to the step they were taken on
  3. Completion records cannot be deleted or modified after creation; they form an append-only audit trail
  4. Supervisor can view all completion records for workers they oversee and can approve or reject each completion

**Plans**: 3 plans

Plans:

- [x] 04-01-PLAN.md — Completion data foundation: migration 00010 (sop_completions, completion_photos, completion_sign_offs with append-only RLS), Dexie v2 schema, completionStore with Dexie persistence, photo-compress utility, sync engine extensions, server actions (submitCompletion, signOffCompletion, getPhotoUploadUrl), StatusBadge extensions
- [x] 04-02-PLAN.md — Photo capture and walkthrough integration: StepPhotoZone with camera input, PhotoThumbnail with upload status, usePhotoQueue hook, walkthrough page extended with completion store (resume support), photo-required gate, Submit Completion flow with content hash
- [x] 04-03-PLAN.md — Supervisor sign-off UI: role-aware Activity page (worker history / supervisor feed), filter pills, completion detail page with step rows and photo lightbox, approve/reject sign-off panel with mandatory rejection reason

### Phase 5: Expanded File Intake

**Goal**: Admins can upload photos of printed SOPs, Excel checklists, PowerPoint slide decks, and plain text files — all routed through the existing AI structuring pipeline and review UI — and TUS upload infrastructure is in place for all large file uploads
**Depends on**: Phase 4
**Requirements**: FILE-01, FILE-02, FILE-03, FILE-04, FILE-05, FILE-06, FILE-07, FILE-08, INFRA-01, INFRA-02
**Success Criteria** (what must be TRUE):

  1. Admin can photograph a printed SOP with their device camera; the system checks image quality (blur, glare, rotation) before submitting, and the extracted text appears in the standard admin review UI alongside the original image
  2. Admin can upload an Excel (.xlsx), PowerPoint (.pptx), or plain text (.txt) file and receive a structured SOP draft with tables preserved as readable tables in SOP steps
  3. All new file types use format-specific AI prompts — the admin review confidence scoring and high-risk token flagging applies to every new input type
  4. Large files (including future video uploads) use TUS resumable upload direct to Supabase Storage, not routed through the Next.js server body
  5. Every new intake pathway (photo, XLSX, PPTX, TXT) routes through the existing gpt-parser structuring pipeline without changes to the review UI

**Plans**: 4 plans
**UI hint**: yes

Plans:

- [x] 05-01-PLAN.md — Backend parsing pipeline: DB migration (file_type constraint + input_type), type/validator extensions, extractors (xlsx, pptx, txt, image via GPT-4o vision), format-specific GPT prompts, parse route dispatch
- [x] 05-02-PLAN.md — Upload UX: TUS resumable upload infrastructure, UploadDropzone extension (new MIME types, Scan button, HEIC conversion, TUS progress bar)
- [x] 05-03-PLAN.md — PhotoScanner: multi-page capture flow, client-side image quality checks, page order detection, IndexedDB session persistence, UploadDropzone wiring
- [x] 05-04-PLAN.md — SopTable: rich table component with markdown parsing, SectionContent table detection, SectionEditor table editing support

### Phase 6: Video Transcription (Upload and URL)

**Goal**: Admins can upload an MP4/MOV video file or paste a YouTube URL and receive a structured SOP draft with the raw transcript visible for manual review — including adversarial AI verification and mandatory warnings when hazard or PPE sections are absent
**Depends on**: Phase 5
**Requirements**: VID-01, VID-02, VID-04, VID-05, VID-06, VID-07
**Success Criteria** (what must be TRUE):

  1. Admin can upload an MP4 or MOV video file; the upload progresses in named stages (uploading → transcribing → structuring → ready) with visible progress at each stage
  2. Admin can paste a YouTube URL and the system fetches captions into a structured SOP without downloading the video
  3. Admin sees the raw transcript alongside the structured SOP output in the review UI before publishing, with adversarial AI verification flags for discrepancies
  4. The system warns the admin when mandatory SOP sections (hazards, PPE) are absent from the video source
  5. Transcription-sourced SOPs pass through the same confidence scoring and admin approval gate as document-parsed SOPs before they can be published

**Plans**: 5 plans
**UI hint**: yes

Plans:

- [x] 06-00-PLAN.md — Wave 0: Playwright test stubs for all VID requirements (7 test files + config)
- [x] 06-01-PLAN.md — Foundation: DB migration (parse_jobs extensions, sop-videos bucket), type extensions (video SourceFileType, TranscriptSegment, VerificationFlag), validator updates, GPT parser video hint, npm package install
- [x] 06-02-PLAN.md — Video transcription pipeline: audio transcription (gpt-4o-transcribe), YouTube caption fetch (youtube-transcript), adversarial verification (Claude SDK), missing section detection, transcribe + youtube route handlers, video upload server action
- [x] 06-03-PLAN.md — Upload UX: UploadDropzone video MIME acceptance + YouTube URL tab with terms checkbox, ParseJobStatus 5-step video stage stepper with retry/delete
- [x] 06-04-PLAN.md — Review UI: VideoReviewPanel (video player + scrollable transcript with timestamp sync), AdversarialFlagBanner (expandable amber flag list), MissingSectionWarningBanner (warn-but-allow with acknowledge checkbox), ReviewClient + page wiring

### Phase 7: Video Transcription (In-App Recording)

**Goal**: Admins can record a procedure video directly in the browser and submit it for transcription into a structured SOP, with an explicit fallback for iOS devices where MediaRecorder support is unreliable
**Depends on**: Phase 6
**Requirements**: VID-03
**Success Criteria** (what must be TRUE):

  1. Admin can tap "Record video" on Android/Chrome and capture a procedure directly in the browser; on submission the recording is transcribed into a structured SOP via the same pipeline as uploaded videos
  2. On iOS devices where MediaRecorder is unsupported or unreliable, the admin sees an explicit fallback message directing them to use file upload instead of silently failing

**Plans**: 1 plan
**UI hint**: yes

Plans:

- [ ] 07-01-PLAN.md — VideoRecorder overlay (full-screen camera recording, 15-min timer, audio extraction, preview) + UploadDropzone Record tab with iOS fallback

### Phase 8: Video SOP Generation

**Goal**: Admins can generate narrated slideshow, screen-recording-style, and full AI video versions of any published SOP, workers can watch those videos with chapter navigation from within the SOP view, and video viewing is tracked as a completion event
**Depends on**: Phase 5
**Requirements**: VGEN-01, VGEN-02, VGEN-03, VGEN-04, VGEN-05, VGEN-06, VGEN-07, VGEN-08, VGEN-09, INFRA-03
**Success Criteria** (what must be TRUE):

  1. Admin can trigger generation of a narrated slideshow (one slide per section, AI voiceover, hazards before steps always) or a scrolling-text screen-recording-style video from any published SOP; generation shows named stages (analyzing → generating → adding narration → finalizing)
  2. Admin can trigger generation of a full AI avatar or animated-visual video from a published SOP (highest cost format — shown separately from the two standard formats)
  3. Admin can preview the generated video and re-generate before publishing; a "video is outdated" warning appears when the source SOP is updated after video generation
  4. Workers see a "Video version" button within the SOP view; the video player supports chapter navigation, timestamp jumps to specific sections, and playback speed control
  5. Worker video viewing is recorded as a completion event in the same audit trail as text walkthrough completions; generated videos are excluded from service worker caching to prevent device storage bloat

**Plans**: TBD
**UI hint**: yes

Plans:

- [x] 08-00-PLAN.md — Wave 0: Playwright test stubs for all VGEN and INFRA-03 requirements (7 test files + config, VGEN-03 marked DEFERRED per D-01)
- [x] 08-01-PLAN.md — Foundation: DB migration (video_generation_jobs), TypeScript types, Zod validators, TTS module (gpt-4o-mini-tts), Shotstack API client
- [x] 08-02-PLAN.md — Generation pipeline: narrated slideshow builder, screen-recording builder, pipeline orchestrator, API route, server actions
- [x] 08-03-PLAN.md — TBD
- [x] 08-04-PLAN.md — TBD

### Phase 9: Streamlined File → Video Pipeline

**Goal**: Admin can upload a source file (docx/pdf/image/xlsx/pptx/video) and reach a generated video SOP in a single guided flow without manually navigating between parse review, publish, and video generation as three separate steps
**Depends on**: Phase 5, Phase 8
**Requirements**: PATH-01, PATH-02, PATH-03, PATH-04, PATH-05, PATH-06
**Success Criteria** (what must be TRUE):

  1. Admin clicks "Generate video SOP" on UploadDropzone, selects a format in a modal, picks a file, and is landed on a unified progress page
  2. A single pipeline_run_id links upload → parse_job → sop → video_generation_job for stepper rendering and audit
  3. Publishing a pipeline-linked SOP auto-queues video generation with the format chosen at upload; the existing publish review gate is preserved exactly
  4. The progress page renders 5 named stages (Uploading, Parsing, Review, Generating video, Ready) with deep-link CTAs to the review page and video panel
  5. Video generation failure after publish keeps the SOP published and routes the admin to the existing video panel retry path

**Plans**: 5 plans
**UI hint**: yes

Plans:

- [x] 09-00-PLAN.md — Wave 0: Playwright test stubs for all six PATH requirements (pipeline-entry, pipeline-linkage, pipeline-autoqueue, pipeline-progress, pipeline-failure-recovery, pipeline-review-gate)
- [x] 09-01-PLAN.md — Foundation: sop_pipeline_runs migration + pipeline_run_id FKs on parse_jobs/sops/video_generation_jobs, type + validator extensions, createVideoSopPipelineSession server action
- [x] 09-02-PLAN.md — Entry UI: "Generate video SOP" button on UploadDropzone + VideoFormatSelectionModal (file + format picker + upload dispatch + navigate to progress page)
- [x] 09-03-PLAN.md — Publish auto-queue: enqueueVideoGenerationForPipeline helper + publish route extension (gate preserved, auto-queue runs after successful publish)
- [x] 09-04-PLAN.md — Progress page: /admin/sops/pipeline/[pipelineId] route with 5-stage PipelineStepper, realtime+polling hybrid, deep-link CTAs, ReviewClient back-to-pipeline breadcrumb

### Phase 10: Video Version Management

**Goal**: Admins can generate multiple video versions from a single published SOP, label and manage each version, and control which version workers see — with edit, archive, and re-generate controls
**Depends on**: Phase 8
**Requirements**: VVM-01, VVM-02, VVM-03, VVM-04, VVM-05, VVM-06, VVM-07, VVM-08
**Success Criteria** (what must be TRUE):

  1. Admin can generate multiple video versions per SOP; each generation creates a new version row with auto-incrementing version number
  2. Version list shows all non-archived versions in descending order with v1/v2/v3 labels, format badges, and status badges
  3. Publishing a version auto-unpublishes all other versions for that SOP; workers see only the published version
  4. Admin can archive versions (soft delete to collapsible section) and permanently delete from archive
  5. Admin can edit an optional label on each version (max 60 chars) via inline editor
  6. Active/generating versions show live progress stepper inline in the version list

**Plans**: 4 plans
**UI hint**: yes

Plans:

- [x] 10-01-PLAN.md — Foundation: Playwright test stubs (8 VVM stubs), DB migration 00018 (drop UNIQUE, add version_number/label/archived, partial unique index), TypeScript type extensions
- [x] 10-02-PLAN.md — Server actions: generateNewVersion, publishVersionExclusive, archiveVersion, unarchiveVersion, permanentDeleteVersion, updateVersionLabel + generate-video route update
- [x] 10-03-PLAN.md — UI components: VideoVersionRow (inline actions, confirm panels, label editor, generation stepper) + VideoVersionList (version rows, collapsible archived section, empty state)
- [x] 10-04-PLAN.md — Wiring: Rewrite VideoGeneratePanel + video page for multi-version, update VideoAdminPreview actions, push DB schema, human verification checkpoint

<!-- ======================================================================= -->
<!-- v3.0 — SOP Builder milestone (Phases 11–18)                             -->
<!-- ======================================================================= -->

### Phase 11: Section Schema & Block Foundation

**Goal**: The additive data model for v3.0 is in place — `section_kinds` catalog, `blocks` / `block_versions` / `sop_section_blocks` junction, legacy fallback, RLS, types, validators — and wave-0 Playwright stubs exist for every SB-XX requirement so downstream phases can execute on a prepared test surface
**Depends on**: Phase 4 (v1 sop_sections schema)
**Requirements**: SB-SECT-01, SB-SECT-02, SB-SECT-03, SB-SECT-04
**Success Criteria** (what must be TRUE):

  1. Admin can add two "Hazards" sections to the same SOP scoped to different machine states, and both render correctly in the worker walkthrough via the joined `section_kinds` metadata (icon, colour, render priority)
  2. Admin can define a custom section with an admin-provided title (e.g. "Pre-flight check") and it renders in the worker walkthrough using the `custom` render family fallback
  3. Every v1/v2 SOP still renders identically — the `section_kinds` catalog is seeded with canonical kinds, and legacy `section_type` substring matching remains the fallback path for rows with no `section_kind_id`
  4. Wave-0 Playwright stubs exist for all 37 SB-XX requirements and are registered in a new `phase11-stubs` test project

**Plans**: TBD
**UI hint**: no

Plans:

- [x] 11-00-PLAN.md — Wave 0: Playwright test stubs for every SB-XX requirement (SB-AUTH, SB-SECT, SB-LAYOUT, SB-ANNOT, SB-COLLAB, SB-BLOCK, SB-INFRA) + `phase11-stubs` project config
- [x] 11-01-PLAN.md — DB migration: `section_kinds` catalog (with canonical seed rows: hazards, ppe, steps, emergency, signoff, content, custom), `blocks` + `block_versions` tables, `sop_section_blocks` junction with `pin_mode` + snapshot columns, `sop_sections.section_kind_id` advisory FK, RLS policies (org-scoped + null-org global read)
- [x] 11-02-PLAN.md — Type layer: `SectionKind`, `Block`, `BlockVersion`, `SopSectionBlock` TypeScript types; Zod validators; walkthrough renderer extension to read `section_kinds` join with legacy substring fallback; verify all v1/v2 SOPs render unchanged
- [x] 11-03-PLAN.md — Admin UI plumbing: section-kind picker in the existing admin review UI, add-custom-section control, multi-instance-of-same-kind support, regression pass against Phase 2/5/6 review UIs

### Phase 12: Builder Shell & Blank-Page Authoring

**Goal**: Admin can start a new SOP from a blank wizard, reach one unified Puck-based builder regardless of entry point, drag blocks onto each section, save drafts auto-debounced to Dexie + Supabase, and workers continue to render every existing SOP via a legacy linear fallback when `layout_data` is absent
**Depends on**: Phase 11
**Requirements**: SB-AUTH-01, SB-AUTH-04, SB-AUTH-05, SB-LAYOUT-01, SB-LAYOUT-02, SB-LAYOUT-03, SB-LAYOUT-04, SB-LAYOUT-06, SB-SECT-05
**Success Criteria** (what must be TRUE):

  1. Admin can click "New SOP" → blank-page wizard (title → canonical sections → review → draft save) and land in the builder without uploading anything
  2. Admin can drag text, heading, photo, callout, step, hazard-card, and PPE-card blocks onto a page, rearrange them, and reflow the result on a 5.5" phone preview via Tailwind breakpoints without authoring a separate mobile variant
  3. Every block component renders identically in the admin editor and the worker walkthrough — there is one component tree, not two
  4. Layout persists as JSONB on `sop_sections.layout_data` with a `layout_version` pin, and admin can reorder sections via drag-and-drop (persists as `sort_order`)
  5. Legacy SOPs with no `layout_data` still render correctly in the worker walkthrough via the linear step-list fallback renderer
  6. A builder-authored draft is visually distinguishable from an uploaded draft in the admin SOP library, but both flow through the same Phase 2 publish gate

**Plans**: 4 plans
**UI hint**: yes

Plans:

- [x] 12-01-PLAN.md — Puck infrastructure: install `@puckeditor/core@0.21.2` (renamed from @measured/puck), admin `/admin/sops/builder/[sopId]` route with `'use client'` + `next/dynamic`(ssr:false), migration 00020 (layout_data JSONB + layout_version INT + sops.source_type + reorder_sections RPC), worker LayoutRenderer branch + linear fallback in SectionContent
- [x] 12-02-PLAN.md — Block components: 7 shared blocks (Text, Heading, Photo, Callout, Step, HazardCard, PPECard) lifted from SectionContent palette with co-located Zod schemas; puck-config.tsx registers all 7 with SafeRender guards; BuilderClient + LayoutRenderer share the same config
- [x] 12-03-PLAN.md — Blank-page wizard + library chip: 4-step wizard (title → canonical kinds → review → submit), createSopFromWizard server action (source_type='blank' + compensating cleanup), AUTHORED IN BUILDER chip in /admin/sops. SEND TO REVIEW reuses existing review page + publish route (D-04). D-08 purge wired into sync engine + ReviewClient.
- [x] 12-04-PLAN.md — Draft persistence + section reorder: Dexie v4 draftLayouts table, flushDraftLayouts in sync-engine (LWW via server_newer sentinel + overwrittenByServer toast), useBuilderAutosave (750ms) + useDraftLayoutSync (3s), reorderSections server action via reorder_sections RPC, SectionListSidebar with HTML5 drag handles, updateSectionLayout with 128KB cap, DESKTOP/MOBILE preview toggle (430px phone-frame)

Verifier verdict: FLAG (human_needed) — 9/9 requirements structurally verified, no duplicate publish flow, no stub-dressed tests. 11-item UAT required before REQUIREMENTS.md flip. See `12-VERIFICATION.md`.

### Phase 12.5: Blueprint Redesign

**Goal**: Ship the worker-first engineering-drawing UI. Workers, supervisors, and admins all use a single unified tabbed interface (overview / tools / hazards / flow / model / walkthrough) on paper/ink palette with JetBrains Mono + Inter typography and 20px grid-paper backgrounds on canvas screens. Mobile walkthrough is immersive (full-screen step card). Voice capture (server-side transcription) populates measurements and free-form notes. Command palette (Cmd/Ctrl+K) enables jump-to-step + ask-AI (SOP-scoped) + tool/hazard lookup. 7 new AI-accessible block types ship with the redesign and are exposed via `/api/schema` through the three-place contract.
**Depends on**: Phase 11, Phase 12
**Requirements**: SB-UX-01..SB-UX-10 (to be assigned in SPEC.md)
**Success Criteria** (what must be TRUE):

  1. Worker `/sops/[sopId]` renders the 6-tab interface with paper/ink palette — no more steel-900/brand-yellow dark theme on worker-facing routes
  2. Mobile walkthrough is immersive-only on phones (≤430px); list-style walkthrough still available on desktop
  3. 7 new block types registered in puckConfig + `/api/schema` + BlockContentSchema (three-place contract): Measurement, Decision, Escalate, SignOff, Zone, Inspect, VoiceNote
  4. EscalateBlock accepts `escalationMode: 'alert' | 'lock' | 'form'` prop; default is `form` (supervisor form with audit trail)
  5. Voice capture works end-to-end with server-side transcription: idle → listening → transcribing → captured → persisted to cloud
  6. Command palette responds to Cmd/Ctrl+K globally; returns results from JUMP TO STEP + ASK AI (scoped to current SOP only) + TOOLS & HAZARDS
  7. Preview toggle (desktop ↔ 430px mobile frame) is available on worker-facing tabs (not just admin builder); preference persists in localStorage
  8. Flow tab renders an SVG node graph built via BOTH derivation (Option A: from sections/steps + block types) AND an explicit `sops.flow_graph` JSONB column (Option B) — derived is the default, explicit overrides when present
  9. Flow graph is editable inside the Puck editor (extend Puck for flow-graph authoring — NOT a separate tool)
  10. ModelBlock is registered in the three-place contract (palette entry + schema) but the 3D viewer implementation is stubbed behind a feature flag; file formats and upload flow deferred to a future phase

**Plans**: TBD (created by /gsd-plan-phase after spec+discuss)
**UI hint**: yes (heavy)

Resolved open questions (from sketch wrap-up):

- Scope: all tabs at once
- Voice: server-side transcription
- 3D: exclude format support for now; stub ModelBlock
- Escalation: hybrid — EscalateBlock carries per-instance `escalationMode`; default = supervisor form
- Flow editing: inside Puck
- New blocks: all 7 (excl. ModelBlock) ship in 12.5
- Mobile walkthrough: both modes (immersive + list) — immersive default on phones
- cmdk Ask AI: SOP-scoped only
- Voice notes: cloud-first persistence
- Flow data shape: build BOTH derivation (A) and explicit JSONB (B); derived is default, explicit overrides when present

Canonical refs:

- Design skill: `.claude/skills/sketch-findings-SOPstart/` (auto-loaded via CLAUDE.md)
- Sketch source: `sketches/sop-blueprint/index.html`
- Wrap-up: `.planning/sketches/WRAP-UP-SUMMARY.md`

### Phase 13: Reusable Block Library

**Goal**: Admin can save, browse, and re-use hazard / PPE / step blocks from an org-scoped library alongside a read-only NZ global block set, and the wizard surfaces matching blocks at the right step with explicit pin-version vs follow-latest semantics
**Depends on**: Phase 11, Phase 12
**Requirements**: SB-BLOCK-01, SB-BLOCK-02, SB-BLOCK-03, SB-BLOCK-04, SB-BLOCK-05, SB-BLOCK-06
**Success Criteria** (what must be TRUE):

  1. Admin can save any hazard / PPE / step as a reusable block to their organisation's library with a name and optional category tags
  2. The builder wizard shows "Pick from library (N matches)" alongside "Write new" at the appropriate section step, filtered by section kind and SOP category
  3. Global NZ blocks (WorkSafe standards, common machinery hazards) are visible read-only to every org, while org-created blocks are isolated via RLS
  4. When a block is added to a SOP, its content is snapshotted into the `sop_section_blocks` junction row so the SOP renders correctly even if the block is later deleted or the worker is offline
  5. Admin can choose "pin to this version" (default) or "follow latest" per block usage; follow-latest SOPs show an "update available" badge when the source block changes and route through the publish gate before workers see the update

**Plans**: 5 plans
**UI hint**: yes

Plans:

- [x] 13-01-PLAN.md — Block CRUD foundation: server actions (`createBlock` with scope option, `updateBlock`, `archiveBlock`, `saveFromSection`, `listBlocks` with globalOnly + includeContent options, `promoteSuggestion`, `rejectSuggestion`), `/admin/blocks` library list page, block detail/editor, org-vs-global RLS policies, category tag support, `sops.category_tag` column (D-Tax-03) (completed 2026-05-07)
- [x] 13-02-PLAN.md — NZ global block seed: migration 00023 inserts 65 globals (57 hazard + 5 PPE + 3 step) with `organisation_id = null` from corpus-analysis § 7; auditable JSON source-of-truth committed at `seed-source/global-blocks.json`; idempotency guard prevents double-seed (completed 2026-05-07)
- [x] 13-03-PLAN.md — Wizard integration: SOP-level category select (D-Tax-03), `BlockPicker` component filtered by kind + SOP category, "Pick from library" tab alongside "Write new" in the wizard, pin-vs-follow-latest toggle per selection, snapshot-on-add via junction table, atomic `reorder_sop_section_blocks` RPC (00024), three-dot menu via Puck componentItem override (implementation complete 2026-05-07; Task 7 UAT pending Simon's manual browser verification)
- [x] 13-04-PLAN.md — Follow-latest tracking + update badging: AFTER-INSERT trigger on `block_versions` flips `update_available`, accept/decline RPCs, `sop_block_update_decisions` audit table, `UpdateAvailableBadge` + `BlockUpdateReviewModal`, publish-gate integration (status flip published->draft on accept), diff function (implementation complete 2026-05-07; migration 00025 live on gknxhqinzjvuupccyojv; browser UAT pending Simon's verification, batchable with 13-03 UAT)
- [x] 13-05-PLAN.md — Platform super-admin curation UI: `platform-admin-guard.ts` route guard (calls `is_platform_admin()` RPC, redirects non-admins to `/dashboard`), `/admin/global-blocks` landing reusing `BlockListTable` from 13-01 with `listBlocks({ globalOnly: true })`, `/admin/global-blocks/suggestions` queue, `SuggestionReviewRow` with snapshot preview + Promote/Reject decision form; consumes 13-01's pre-declared server-action surface verbatim — no schema changes (implementation complete 2026-05-07; renamed from "Summit super-admin" in commit e093d45 — Potenco-owned, not Summit; browser UAT pending Simon's verification, batchable with 13-03 + 13-04 UAT scenarios)

### Phase 14: AI-Drafted SOPs

**Goal**: Admin can type a natural-language prompt ("PPE check for forklift operators at our Hamilton site") and receive a structured draft pre-filled with hazards, PPE, steps, and emergency sections — which passes the Phase 6 adversarial Claude verification gate before reaching the admin review UI, then opens in the same builder used for blank-page and template flows
**Depends on**: Phase 6 (adversarial verifier), Phase 12 (builder shell)
**Requirements**: SB-AUTH-02, SB-INFRA-04
**Success Criteria** (what must be TRUE):

  1. Admin can enter a natural-language prompt and receive a structured SOP draft within the named-stages progress UI used by Phase 6
  2. The AI-drafted output is cross-checked by Claude (adversarial verifier) before it reaches the admin review UI — hallucinated hazards or missing PPE sections are flagged in the same amber-banner UI used for video transcription
  3. Once reviewed, the AI draft lands in the same unified builder surface as blank-page and template flows — admin cannot tell "draft source: AI" apart from "draft source: blank" once they're editing
  4. The draft flows through the existing Phase 2 publish gate and Phase 11 section-kind resolver

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 14-01-PLAN.md — Prompt entry: `/admin/sops/new/ai` route with prompt textarea, category selector, named-stage progress UI; `parse_jobs` row with `source: 'ai_prompt'` to reuse existing stage stepper
- [ ] 14-02-PLAN.md — GPT-4o structured draft generator: prompt-engineering pass, structured output schema matching `SopSection[]`, `section_kind_id` assignment, integration with GPT parser module
- [ ] 14-03-PLAN.md — Adversarial verification reuse: route AI draft through existing Phase 6 Claude verifier, surface flags via existing `AdversarialFlagBanner`, missing-section detection, land draft in the builder with flags visible in the review panel

### Phase 14.5: Blueprint Shell Rollout (Complete 2026-05-12)

**Outcome**: Paper/ink design language rolled across the full admin/auth/dashboard/library/worker surfaces in ~90 files migrated across 5 parallel worktree clusters. Legacy steel/yellow Tailwind tokens, marketing-themes system (12 themes via SiteThemeProvider + Zustand store + ThemePicker), `next-themes` ThemeProvider, and PaperThemeMount opt-in pattern all removed — body now ships `data-theme="paper"` at SSR root.

**What shipped:**

- `/dashboard` rebuilt on paper tokens with role-adaptive tiles (AI Draft tile added)
- `/admin/sops` library rebuilt with Upload|Blank|AI Draft button group, platform-admin "Curate Globals" sub-nav link, and "Edit in builder" row CTA for non-uploaded sources
- Every `/admin/*` sub-page migrated (review, assign, versions, video, upload, new-blank, new-ai, pipeline, builder shell, blocks, global-blocks, team)
- Auth pages (`/login`, `/sign-up`, `/invite/accept`, `/join`) migrated
- Worker SOP components (`/components/sop/*`, blocks, walkthrough, etc.) migrated
- `globals.css` trimmed from 400 → 5 lines; `next-themes` uninstalled

**Residual scope rolled into Phase 15:**

- Role-aware home (engineering-drawing home that adapts per role beyond admin tile grid)
- Global app-wide Cmd+K (currently scoped to `/sops/*` only — needs to surface kiosk navigation actions, library access, ask-AI globally)

These two items belong with kiosk mode + site-tier work in Phase 15 because they all touch the same shell-level surfaces.

### Phase 15: Manufacturing-Line Mode

> **Source**: Derived from Visy customer interview 2026-05-05 — see `.planning/research/customer-interviews/2026-05-05-visy-findings.md`. Visy = Pratt-family packaging, ~100 AU/NZ industrial sites, glass + cans + cardboard. Bryce (Engineering Manager) is the named trial sign-off contact.

**Goal**: Ship the full shop-floor industrial-manufacturing experience as one coordinated release. After this phase: a 50–500-SOP industrial manufacturer with shared shop-floor terminals can run SafeStart end-to-end. Operators read at the line terminal in kiosk mode with big-text and voice Q&A, supervisors sign off on a tablet/phone, admins manage SOPs through a governance loop with site-specific overlays and multi-step approval, and completion records flow into the org's HRIS as training evidence.

**Depends on**: Phase 11 (section schema), Phase 12 (builder), Phase 13 (block library — extended for site-tier), Phase 14 (AI prompts — feeds the RAG), Phase 14.5 (paper/ink shell)

**Requirements**: SB-LINE-01, SB-LINE-02, SB-LINE-03, SB-LINE-04, SB-LINE-05, SB-LINE-06

**Success Criteria** (what must be TRUE):

  1. A Visy admin can model their org structure as: corporate organisation → ~100 sites → site-specific SOP overlays on top of org/global SOPs. Existing single-org tenants migrate transparently with a synthetic single "default site" so no Phase 1–14 RLS or UI breaks.
  2. An operator at the Auckland glass plant walks up to the line terminal, picks an SOP from the kiosk list, reads it without logging in, taps a PIN (or badge) on completion sign-off, and the completion is attributed to that operator. Camera coverage at the terminal + attribution timestamp form the accountability layer rather than per-read auth.
  3. The same operator presses the mic and asks "how do I change the blank side hanger" — the system returns an answer grounded in this specific SOP's structured content (sections, blocks, hazards, PPE), with explicit citations to the section it drew from. Available on both mobile AND kiosk modes.
  4. An admin marks an SOP as needing 24-month review; when the review date passes, the SOP appears greyed-out in the library and the configured approver chain is notified. Stale SOPs are still readable by workers but visibly flagged as "Pending review".
  5. A multi-step approval chain (e.g. Site Manager → Discipline Leader → Safety Manager) can be configured per-SOP at the org or site level; publish gates on all required sign-offs in order, with the existing publish gate remaining the single point of "this is now live to workers".
  6. New roles surfaced from Visy interview are modelled: **Discipline Leader** (cross-site SOP approver, e.g. "Global Forming Discipline Leader"), **Engineering Manager**, **Plant Manager**. Worker role gains optional sub-trade tags (Operator / Fitter / Sparky / etc.) used in SOP-to-role assignment filtering.
  7. A site safety manager exports the last 90 days of completion records as a CSV including operator name, SOP ID + version, timestamp, sign-off chain, and competency tag. Success Factors API connector is spec'd; built only if Visy provides API access during trial.
  8. Engineering-drawing role-aware home replaces `/dashboard` — adapts by role (admin sees library + creation paths + governance queue; supervisor sees activity + review queue; worker → /sops; operator-at-terminal → kiosk SOP list).
  9. Global app-wide Cmd+K mounted across all `(protected)` routes — surfaces app-wide navigation (Library, Blocks, Team, Create via Upload/Blank/AI, Settings, kiosk site selector for multi-site admins) alongside the existing SOP-scoped jump-to-step + ask-AI on SOP pages.
  10. Bundle isolation: kiosk mode chunks + voice Q&A RAG client do not leak into the existing mobile worker bundle; mobile worker walkthrough First Load JS does not grow as a result of Phase 15.

**Plans:** 8/8 plans complete

Plans:

- [x] 15-00-PLAN.md — Wave 0: capture pre-Phase-15 bundle baseline + scaffold all Playwright/test fixture files referenced in 15-VALIDATION.md (completed 2026-05-13; baseline = 1088 KB for /sops/[sopId]/page; 13 spec scaffolds + live lint guard; commits 847dca0, b40d3ae, 77d3481)
- [x] 15-01-PLAN.md — Wave 1: foundation — migration 00030 (sub_trades + junctions + RLS helper + sop_completions.step_ack_trace) + database.types.ts manual extension + voice/sub-trades validators + useViewport hook + walkthrough store ack-trace extension (code-complete 2026-05-13; commits 454b442, 989c0ba, 9498e88; 11 new tests pass; awaiting Simon's `npx supabase db push` to apply 00030 — Task 2 blocking checkpoint, see 15-01-SUMMARY.md § Awaiting Action)
- [x] 15-02-PLAN.md — Wave 2: UI — extract MobileWalkthrough, build DesktopWalkthrough (big-text ≥24px, 60px Next button), WalkthroughSwitcher (next/dynamic ssr:false), floating mic-pill + WalkthroughVoiceModal, sequential ack gate on both layouts
- [x] 15-03-PLAN.md — Wave 3: voice backend — packSopForPrompt utility + voice-qa.ts two-call pipeline with Anthropic prompt caching + verify-sop.ts mode voice_qa extension (fail-safe to uncertainty) + /api/voice/query route with full Zod + RLS-scoped SOP fetch + 7-threat coverage (completed 2026-05-13; commits 6218b41, 019ef51, fd792bd, 538b9be; 25 new tests pass; SB-LINE-03 + SB-LINE-04 marked complete)
- [x] 15-04-PLAN.md — Wave 4: admin UI + completion + CI gate + demo prep — SubTradePicker + admin/team + admin/sops/[id]/assign + completions.step_ack_trace persistence + activate bundle-isolation CI gate + Visy ENF4-03-031 demo prep doc (completed 2026-05-13; commits 221cd28, 3f8219a, 8bf72ed, a58c31d, 6eda170; 23 new tests pass; SB-LINE-05 + SB-LINE-06 marked complete; bundle re-baselined to 1095 KB with hard-fail gate; awaiting Simon's phase UAT — see 15-04-SUMMARY.md § Awaiting Phase UAT)

**UI hint**: yes (heavy)

Open scope decisions to resolve in spec/discuss:

1. Kiosk shell: separate Next.js route group, or runtime mode-switch (env var or query param)?
2. Voice Q&A grounding: ground only to this SOP, or also to org's block library + global blocks?
3. PIN-on-completion: 4-digit PIN per operator (admin-issued), or NFC badge tap (hardware dependency)?
4. Discipline Leader role: cross-site within an org, or also cross-org for platform-admin curated globals?
5. Success Factors: spec-only this phase, or build the connector if Visy provides API access during trial?

### Phase 16: NZ Template Library

**Goal**: Admin can browse a curated NZ template library (WorkSafe categories, common machinery, chemical handling) and pick a template as the starting point for a new SOP — which opens in the same unified builder surface as blank-page and AI flows
**Depends on**: Phase 12, Phase 13 (template entries reuse block library rows)
**Requirements**: SB-AUTH-03
**Success Criteria** (what must be TRUE):

  1. Admin sees a NZ template library organised by WorkSafe category, common machinery, and chemical-handling families on `/admin/sops/new/template`
  2. Selecting a template clones its sections, blocks, and `layout_data` into a new draft SOP and opens the unified builder
  3. The template clone is independent — editing the new SOP does not modify the template, and templates can be updated without affecting existing SOPs

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 16-01-PLAN.md — Template catalog: `sop_templates` table (or flag on `sops` with `is_template`), curation list with NZ WorkSafe categories, seed data for forklift ops, grinder use, chemical handling, confined space entry, hot work permit
- [ ] 16-02-PLAN.md — Template picker UI: `/admin/sops/new/template` route, category sidebar + card grid, template preview drawer, "Use this template" action that clones sections + blocks + layout into a fresh draft SOP

### Phase 17: Image & Diagram Annotation — ⤳ ABSORBED into Phase 26 (v5.0) 2026-07-02

> **This phase is not built separately.** Its scope + the four plans below were pulled forward into **Phase 26** (CONTEXT D-03) as the Visual block's diagram-annotation capability. The goal/criteria/plans below are retained as the authoritative spec Phase 26 reuses verbatim.

**Goal**: Admin can non-destructively annotate any photo or diagram with arrows, rectangles, ellipses, text labels, numbered callouts, and freehand sketches (with Apple Pencil palm rejection), re-edit them later, and place numbered hotspots at freeform x/y on a machine diagram via a specialty `DiagramHotspotBlock` — while workers never download Konva because a baked PNG is served for the read path
**Depends on**: Phase 11 (section schema), Phase 12 (builder shell — annotation is invoked from photo blocks)
**Requirements**: SB-ANNOT-01, SB-ANNOT-02, SB-ANNOT-03, SB-ANNOT-04, SB-ANNOT-05, SB-LAYOUT-05
**Success Criteria** (what must be TRUE):

  1. Admin can open any photo or diagram block in the annotation editor, draw arrows / rectangles / ellipses / text labels / numbered callouts, and save — and re-open the same image later to edit those exact annotations (non-destructive Konva JSON scene graph)
  2. On publish, the client bakes a flattened PNG of the annotated image to Supabase Storage at a version-bumped path; workers load the baked PNG via `<img>` and the worker route's First Load JS does not grow by Konva's size
  3. Admin can add a `DiagramHotspotBlock` to any section, drop a machine diagram into it, and place numbered callouts at freeform x/y on the diagram (the only freeform-positioning exception in the otherwise block-reflow builder)
  4. Apple Pencil / stylus freehand sketching works with palm rejection when a pen is detected; non-pen input is filtered while pen-mode is active
  5. If admin replaces the underlying image with a new one of similar dimensions, annotation coordinates are preserved and admin is prompted to review placement before saving

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 17-01-PLAN.md — Konva foundation: install `konva` + `react-konva`, `serverExternalPackages: ['canvas']` in `next.config.ts`, `sop_image_annotations` migration (scene jsonb, natural_width, natural_height, baked_storage_path, baked_at, RLS), dynamic-imported `AnnotationEditor` component stub on admin route, Next.js 16 canvas-module spike
- [ ] 17-02-PLAN.md — Annotation primitives: Arrow / Rect / Ellipse / Text / Label (numbered callout) / Line (freehand) tools, `Konva.Transformer` wiring for resize + rotate, undo/redo via scene JSON snapshots, text-editing `<textarea>` overlay, stylus pointer-type filter + palm-rejection toggle
- [ ] 17-03-PLAN.md — Bake-on-publish pipeline: client-side `stage.toDataURL()` flatten, upload to `sop-images/baked/{sop_id}/{image_id}.v{N}.png`, update `baked_storage_path` + `baked_at`, worker read path prefers baked PNG, PhotoBlock renderer switches baked-vs-raw without importing Konva
- [ ] 17-04-PLAN.md — DiagramHotspotBlock: specialty Puck block with image drop zone + freeform x/y numbered-hotspot placement, coordinate preservation on photo replacement with review prompt, integration with the rest of the builder's block set

### Phase 18: Collaborative Editing

**Goal**: Multi-admin teams can concurrently edit different sections of the same SOP draft without conflict, see presence indicators for who is editing what, and safely reconcile offline edits on reconnect — via section-level pessimistic locks plus an optimistic version column and a plain-English conflict modal
**Depends on**: Phase 11 (schema), Phase 12 (builder shell — locks live in section edit flow)
**Requirements**: SB-COLLAB-01, SB-COLLAB-02, SB-COLLAB-03, SB-COLLAB-04, SB-COLLAB-05, SB-COLLAB-06
**Success Criteria** (what must be TRUE):

  1. When Alice opens a section for editing, Bob sees "Alice is editing this section" and cannot modify it until the lock releases; Bob can concurrently edit a *different* section on the same SOP without conflict
  2. Locks auto-release after 5 minutes of inactivity (heartbeat expiry), on explicit release, or on tab close — no admin can permanently block a section
  3. Admin who held a lock before going offline can continue editing locally; on reconnect, changes push cleanly if the optimistic `version` column has not advanced, otherwise a "keep mine / keep theirs / merge manually" modal appears
  4. Presence indicators (who-is-editing-what) route through per-organisation Supabase Realtime channels with zero cross-tenant leakage
  5. All collaborative-editing UI, lock logic, and presence channels are gated behind admin routes — a `next build` bundle analysis shows zero leakage into worker routes

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 18-01-PLAN.md — Lock schema: migration adding `locked_by`, `locked_at`, `lock_expires_at`, `version` to `sop_sections`; RLS policy updates; `acquireLock` / `releaseLock` / `heartbeat` server actions; 5-minute expiry sweep
- [ ] 18-02-PLAN.md — Presence + UI: Supabase Realtime presence channel per SOP (org-scoped via channel name), `SectionLockIndicator` component (avatar + "Alice is editing"), read-only guard when locked by another admin, explicit release on tab close
- [ ] 18-03-PLAN.md — Offline handoff + conflict modal: optimistic version bump on save, "keep mine / keep theirs / merge manually" modal on reconnect when server version has advanced, Dexie draft sync integration, wave-1 verification that worker routes do not import presence or lock logic

### Phase 19: Pipeline Integration, Bundle Isolation & v3.0 Closeout

**Goal**: Builder-authored SOPs route through the Phase 9 `sop_pipeline_runs` linkage for one-click video generation, the builder auto-saves through the existing Dexie + sync-engine path without any new "save" step, and a CI check proves that Puck, Konva, Yjs, and y-dexie stay out of worker bundles — closing out the v3.0 milestone
**Depends on**: Phase 9 (pipeline runs), Phase 12, Phase 16, Phase 17
**Requirements**: SB-INFRA-01, SB-INFRA-02, SB-INFRA-03
**Success Criteria** (what must be TRUE):

  1. Admin can author a SOP in the builder, click "Generate video SOP", and flow through the same Phase 9 unified progress page and publish auto-queue used by uploaded SOPs — via a shared `pipeline_run_id`
  2. The builder auto-saves to Dexie on change and to Supabase on a debounce with no explicit "save" button visible to the admin; offline authoring continues working uninterrupted across network drops
  3. A CI script runs `next build` and asserts that the worker walkthrough route's First Load JS does not include `@measured/puck`, `konva`, `react-konva`, `yjs`, or `y-dexie` import paths; build fails if any slip in
  4. v3.0 milestone closeout: all SB-XX requirements have passing tests, Dexie schema bump is deployed, bundle CI check is green, and human verification checklist is signed off

**Plans**: TBD
**UI hint**: yes

Plans:

- [ ] 19-01-PLAN.md — Pipeline linkage: extend `createVideoSopPipelineSession` to accept a builder-authored SOP id, route "Generate video SOP" button into the existing Phase 9 progress page, verify publish auto-queue works for builder-sourced SOPs
- [ ] 19-02-PLAN.md — Dexie + sync-engine closeout: final Dexie schema bump (draftLayouts, sopImageAnnotations, sectionLocks mirrors), sync-engine hook-up for each new table, offline authoring end-to-end verification
- [ ] 19-03-PLAN.md — Bundle isolation CI: `scripts/check-worker-bundle.ts` that parses `.next/app-build-manifest.json` and fails on disallowed imports in worker route chunks, wire into `npm run build`, regression pass
- [ ] 19-04-PLAN.md — v3.0 human verification + milestone closeout: human UAT checklist covering every SB-XX requirement, verification run, learnings log entries, milestone retrospective hand-off

### Phase 20: Conversion Pipeline V2

> **Source**: Surfaced during /gsd-explore session 2026-05-14 after Phase 15 wrap. Decisions captured in `.planning/notes/conversion-pipeline-v2-decisions.md`.

**Goal**: An admin uploading a Word / PDF / scan / video SOP that contains photos, diagrams, charts, and tables receives a structured draft where every visual element is preserved AND anchored to the correct step/section, and the review surface IS the Phase 12 builder — with persistent side-by-side source viewing, an AI reviewer that runs five verification jobs (auto on first parse + manual re-run), and a mandatory per-block verify checklist at the publish gate. Safety-critical: no extraction is trusted without three independent layers of verification.

**Depends on**: Phase 2 (existing parser), Phase 5 (expanded intake), Phase 6 (adversarial verifier), Phase 11 (block schema), Phase 12 (builder shell), Phase 13 (block library matching), Phase 14.5 (paper/ink shell)

**Requirements**: TBD (assigned during /gsd-spec-phase)

**Success Criteria** (what must be TRUE):

  1. A DOCX or PDF containing embedded photos, diagrams, hazards tables, and process-flow charts produces a draft where every visual is retained as a SafeStart-native block (PhotoBlock anchored to its step, HazardCard per table row, DiagramHotspotBlock for machine diagrams) — none are dropped, none flattened to prose
  2. Each block carries source-provenance metadata (page + bbox for PDFs, paragraph/run id for DOCX, image crop coords for scans, video timestamp for Phase 6 sources) sufficient for the source viewer to highlight on click
  3. The legacy `/admin/sops/[sopId]/review` ReviewClient retires — parsed drafts open in the Phase 12 builder with `layout_data` pre-populated by the parser, edit at block granularity in the paper/ink blueprint style, publish gate sits on top of the builder
  4. Source viewer renders persistently alongside the builder canvas on desktop; clicking any block scrolls/highlights the source region it came from; works for DOCX, PDF, scan image, and video sources
  5. AI reviewer runs all five jobs on first parse: (A) hallucination — every claim traces to source; (B) omission — flag source content missing from the draft; (C) anchoring — verify each photo/diagram is on the correct step; (D) safety completeness — pattern-match against NZ-industry minimums (hazards + PPE + emergency); (E) clarity — flag line-worker-hostile jargon/sentence length. Admin can manually re-run the reviewer after edits.
  6. Publish gate forces admin through a per-block verify checklist — every block has a checkbox tied to its source provenance; publish is blocked until all blocks signed off. The checklist UI doesn't allow bulk-tick.
  7. Phase 13 block-library matching runs during extraction — if an extracted hazard semantically matches a global/org block, the parser proposes "link to existing block X" alongside "write new block"; admin chooses.
  8. PDF embedded image extraction is bundle-safe (resolves the Phase 2-02 D `@napi-rs/canvas` deferral) — production build cost and runtime memory profile validated before Plan 20-01 commits to an extraction library.

**Plans**: 5 plans (sketch — finalised by /gsd-plan-phase)
**UI hint**: yes (heavy — review surface convergence + new source viewer pane + verify checklist UI)

Plans:

- [ ] 20-00-PLAN.md — Wave 0: Playwright test stubs for all conversion-V2 acceptance criteria; provenance schema fixture files (DOCX/PDF/scan/video sample sources with hand-labelled expected anchoring); test project registration
- [ ] 20-01-PLAN.md — Provenance schema + PDF image extraction: unified `block_provenance` JSONB shape (source_type + source_ref + region_coords/timestamp/paragraph_id) on `sop_section_blocks` and/or `block_versions`; PDF embedded-image extraction spike outcome implementation (resolves Phase 2-02 D); DOCX paragraph/run id capture; scan crop-region capture
- [ ] 20-02-PLAN.md — Parser refactor: gpt-parser emits Puck `layout_data` directly with provenance per block (not just `sop_sections` + `sop_steps` rows); semantic extraction of tables → HazardCard[] / SopTable, diagrams → PhotoBlock or DiagramHotspotBlock with hotspot pre-placement, charts → image + extracted-data block; block-library matching during extraction (propose link-to-existing alongside write-new)
- [ ] 20-03-PLAN.md — Review surface convergence: `/admin/sops/[sopId]/review` retired; parsed drafts route into `/admin/sops/builder/[sopId]` with parse-status banner; SourceViewerPane component (persistent right-pane on desktop, drawer on tablet) with click-to-highlight via provenance metadata; builder ↔ source bidirectional selection sync
- [ ] 20-04-PLAN.md — AI reviewer (5 jobs) + verify-checklist publish gate: extend `verify-sop.ts` to run jobs A–E with structured output schema; ReviewerFlagsPanel surfaces flags per-block in the builder canvas; manual re-run trigger; VerifyChecklistGate component blocks publish until every block ticked; rejection-flow back to builder; audit row in `sop_publish_verifications`

**Open scope decisions to resolve in spec/discuss:**

1. AI prompt SOPs (Phase 14) — no source to verify against; do jobs A/B/C N/A, leaving only D + E? Or skip the verify-checklist gate entirely for AI-prompt source?
2. Video-source provenance — timestamp anchoring vs. frame-grab thumbnails as the "source region" the source viewer highlights?
3. Block-library matching threshold — at what semantic similarity does the parser propose link-to-existing vs. always write-new?
4. Per-block verify checklist — single sign-off pass, or split by section (hazards verified by safety_manager, steps verified by supervisor)?
5. Where does AI-reviewer cost get capped — re-run limit per SOP per day? Token budget per parse?

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → … → 15 → 20 → **21 → 21.5 → 21.6 → 22 → 23 → 24 → 25** (v4.0) → **26 → 26.5** (v5.0) → **27** (v5.0 close) → **28 → 29 → 30** (v6.0)

**v3.0 closeout 2026-05-23.** Phases 16, 17, 18 deferred to v4.0 backlog. Phase 19 deleted (no remaining dependencies). Phase 20 partial — DOCX-to-builder slice shipped on master; remaining safety-critical verification scope carried to v4.0 Phase 21.

**v4.0 kicked off 2026-05-24 · ✅ shipped 2026-07-02.** Phases 21, 21.5, 21.6, 22, 23, 24, 25 executed + code-reviewed. Residual = human UAT (21.6/22/23/25) carried per v3.0 field-verification precedent. Archive via `/gsd-complete-milestone`.

**v5.0 kicked off 2026-07-02.** Phase 26 (bespoke inline builder redesign; Phase 17 Konva absorbed) → Phase 26.5 (agent-metadata layer on X-03 + graphify). Forks locked in `26-CONTEXT.md`.

**v6.0 kicked off 2026-07-12.** Phase 28 (ownership + review lifecycle + governance queue foundation) → Phase 29 (approval chains) → Phase 30 (UX consolidation & simplification — inserted 2026-07-12 from full frontend audit) → Phase 31 (training records + AI maintenance schedule). North star: ease of use beats process; governance never blocks worker access.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete   | 2026-03-23 |
| 2. Document Intake | 4/4 | Complete   | 2026-03-25 |
| 3. Worker Experience | 6/6 | Complete   | 2026-03-25 |
| 4. Completion and Sign-off | 3/3 | Complete   | 2026-03-26 |
| 5. Expanded File Intake | 4/4 | Complete   | 2026-04-03 |
| 6. Video Transcription (Upload and URL) | 5/5 | Complete   | 2026-04-03 |
| 7. Video Transcription (In-App Recording) | — | Deferred (iOS Safari MediaRecorder maturity) |  |
| 8. Video SOP Generation | 5/5 | Complete   | 2026-04-04 |
| 9. Streamlined File → Video Pipeline | 1/5 | Deferred to v4.0 backlog |  |
| 10. Video Version Management | 4/4 | Complete    | 2026-04-13 |
| 11. Section Schema & Block Foundation | 4/4 | Complete    | 2026-04-15 |
| 12. Builder Shell & Blank-Page Authoring | 4/4 | Complete (UAT field-verified) | 2026-04-24 |
| 12.5. Blueprint Redesign | n/a | Complete | 2026-05-07 |
| 13. Reusable Block Library | 5/5 | Complete (UAT field-verified) | 2026-05-07 |
| 14. AI-Drafted SOPs | 3/3 | Complete (UAT closed verified-via-downstream) | 2026-05-10 |
| 14.5. Blueprint Shell Rollout | n/a | Complete (no formal plans — shipped ad-hoc) | 2026-05-12 |
| 15. Manufacturing-Line Mode | 5/5 | Complete pending Simon's prod migration push | 2026-05-13 |
| 16. NZ Template Library | — | Deferred to v4.0 backlog |  |
| 17. Image & Diagram Annotation | — | ⤳ Absorbed into Phase 26 (v5.0) 2026-07-02 |  |
| 18. Collaborative Editing | — | Deferred to v4.0 backlog |  |
| 19. Pipeline Integration, Bundle Isolation & v3.0 Closeout | — | Deleted 2026-05-23 |  |
| 20. Conversion Pipeline V2 | partial | Partial complete — DOCX→builder slice shipped; remainder → v4.0 Phase 21 | 2026-05-17 |
| **21. Safety-Critical Parsing (v4.0)** | 6/6 | ✅ Complete — PASS-WITH-NOTES (includes 21-05 gap closure — parser→library junction integration) | 2026-05-26 |
| **21.5. Builder Review UX (v4.0)** | 5/5 | ✅ Complete | 2026-06-02 |
| **21.6. Builder Edit Stage Redesign (v4.0)** | 5/5 | ✅ Complete (residual: 4 human-UAT items) | 2026-06-05 |
| **22. Voice-Driven Walkthrough (v4.0)** | 4/4 | ✅ Complete (residual: human UAT on sopstart.com) | 2026-06-24 |
| **23. AI Field Layer + Version Supersede (v4.0)** | 8/8 | ✅ Complete + code-reviewed (residual: 4 human-UAT items) | 2026-06-25 |
| **24. Procedure Flow — Spatial Node Graph (v4.0)** | 3/3 | ✅ Complete | 2026-06-12 |
| **25. Department as a First-Class Entity (v4.0)** | 6/6 | ✅ Complete (residual: 7 human-UAT tests) | 2026-06-15 |
| **26. SOP Builder Redesign — Inline Surface (v5.0)** | 14/14 | ✅ Complete — Puck fully removed, worker bundle Δ0KB | 2026-07-03 |
| **26.5. Agent Metadata Layer (v5.0)** | 8/8 | ✅ Complete | 2026-07-05 |
| *(post-26.5 ad-hoc)* | — | AI provider flexibility + builder tree-rail UX — not phased, see note above | 2026-07-09 |
| **27. AI Provider & Settings (v5.0 close)** | 1/1 | ✅ Complete | 2026-07-12 |
| 28. Ownership + Review Lifecycle + Governance Queue | 6/6 | Complete    | 2026-07-12 |
| 29. Approval Chains | 5/6 | In Progress|  |
| 30. UX Consolidation & Simplification | 5/8 | In Progress|  |

## Backlog

### Phase 999.1: Stale video job cleanup service (BACKLOG)

**Goal:** Scheduled task or cron that marks video_generation_jobs stuck in queued/analyzing/generating_audio/rendering for >30 minutes as 'failed' with a timeout error. Could also notify admin. Triggered by finding a hours-old rendering job during Phase 10 verification.
**Requirements:** TBD
**Plans:** 4/4 plans complete

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.2: Graphify full LLM build (BACKLOG)

**Goal:** Run the full `/graphify` pipeline (not AST-only) across src/, .planning/, supabase/migrations/, scripts/ so the knowledge graph also captures doc→code rationale edges, cross-phase concept clustering, and plan→commit traceability. AST-only graph already exists (961 nodes / 155 communities) — this upgrades it with semantic-subagent extraction + community labelling.
**Requirements:** N/A (internal developer tooling)
**Plans:** 1 plan stubbed

Plans:

- [ ] Full-corpus graphify run: dispatch ~40+ semantic subagents on src/ + .planning/ + supabase/migrations/; build `graphify-out/graph.json` with EXTRACTED/INFERRED/AMBIGUOUS edges; label communities; produce HTML viz. Estimated cost: ~40 subagents × ~45s = ~10-15 min wall, ~$1-3 token spend. Triggered when Phase 13 planning needs cross-document concept surfacing (e.g. "which phase-12 blocks relate to phase-13 reusable library requirements").

### Phase 999.3: Security hardening pass — CSP, HSTS, frame-ancestors (BACKLOG)

**Goal:** Add proper response-header security to sopstart.com:

- **Content-Security-Policy** with allowlists for `'self'`, Supabase (REST + Realtime + Storage), Anthropic API, Railway, and `'wasm-unsafe-eval'` for the tesseract.js client OCR path (used by `src/components/admin/PhotoScanner.tsx`).
- **Strict-Transport-Security** (HSTS) with `max-age=31536000; includeSubDomains; preload`.
- **frame-ancestors 'none'** (or `'self'`) to prevent clickjacking embeds.
- **X-Content-Type-Options: nosniff**, **Referrer-Policy: strict-origin-when-cross-origin**, **Permissions-Policy** stub locking down sensors / payment / serial.

Also consider whether OCR should move server-side to drop tesseract.js from the client bundle entirely (smaller bundle, loses offline OCR, adds server round-trip per scan).

**Requirements:** TBD
**Plans:** 0 plans

**Trigger:** Surfaced during Phase 15 UAT (2026-05-13) — Chrome DevTools flagged `wasm-unsafe-eval` advisory from tesseract.js. No functional impact today (no CSP currently set). Worth a dedicated security pass after the Visy demo lands.

Plans:

- [ ] TBD (promote with /gsd-review-backlog when ready)
