# SOPstart — Product Roadmap

**Owner:** Potenco Pty Ltd
**Status:** v0.3 — 2026-05-24 (regenerated after Simon's 21:12 review pass)
**Source of truth:** `.planning/product-roadmap.data.json` (machine-readable)
**Editor:** `.planning/product-roadmap.html` (open in browser to edit and re-export)
**Purpose:** A single, partner-readable record of every feature SOPstart aspires to ship. Each feature has bespoke acceptance criteria, a current grade, a target grade, and a priority tag. Grades are **forward-looking** — a feature is F until every criterion passes; A means industry-leading and complete.

**v0.3 changes from v0.2:**
- 9 priority shifts (notably W-03 + X-06 demoted out of v4.0, several compliance features pushed to Later/Maybe)
- 2 features moved to "Cut (shipped — no further investment)": W-02 photo evidence + G-05 site-tier multi-tenancy
- S-02 side-by-side viewer kept at Now (Simon confirmed earlier demotion was a misclick)
- v4.0 NOW surface narrowed from 10 to 8 features
- Simon's review notes pulled into feature entries

45 of 46 features marked reviewed by Simon. The one outstanding: A-02 Blank-Page Wizard (already shipped, low priority to re-review).

---

## 1. Executive Summary (for partner conversations)

SOPstart is a mobile-first workplace-safety app for blue-collar industrial customers. Workers open an SOP on their phone, walk through it step-by-step, capture photo evidence, and complete a legally defensible sign-off — even offline at remote job sites. Admins author SOPs in a builder, draft them from a prompt, or upload existing documents for AI parsing.

We are post-v3.0 (Native SOP Builder) and entering v4.0+. v0.3's review pass has sharpened the next milestone. **v4.0 is now defined by two intertwined pulls:**

1. **Safety-critical parsing fidelity** — finish the Phase 20 contract. Word/PDF documents parse into the builder with side-by-side source verification, an AI reviewer running five quality jobs on every parse, and a mandatory per-block verify checklist at the publish gate. Workers must never act on misaligned content.
2. **AI as the operating layer** — every editable field gets AI read access, most get AI write access. Workers with low literacy can complete SOPs by voice; admins can drive authoring conversationally. The end state is an app 99% steerable by AI agents.

The Visy-pilot themes (kiosk mode, approval chains, NZ templates) are now v4.5. Konva annotation, telemetry, and the conversational primary interface push to v5.0.

---

## 2. Architectural Principles

Horizontal — they cut across every feature.

### 2.1 AI Everywhere

The product's long-term shape is an app driven primarily by AI agents on behalf of users. Every editable field offers an AI **read** API. Most editable fields offer an AI **write** API (with the user as final approver for high-stakes actions). A **unified agent interface** sits underneath every surface.

Intended layered architecture:

```
┌─────────────────────────────────────────────┐
│              UI Layer                        │ ← user-facing surfaces (builder, walkthrough, admin)
├─────────────────────────────────────────────┤
│              Agents                          │ ← task-specific agents (draft, verify, voice Q&A, etc.)
├─────────────────────────────────────────────┤
│              Memory Layer                    │ ← per-org, per-user, per-SOP context
├─────────────────────────────────────────────┤
│              Agent Routing Layer             │ ← dispatch, model selection, token budgeting
├─────────────────────────────────────────────┤
│              Database Layers                 │ ← structured (Postgres/RLS), unstructured (storage), relational
└─────────────────────────────────────────────┘
```

### 2.2 Safety-Critical Defaults

The product's failure mode is a worker acting on misinformation. Defaults err toward refusing over guessing. AI verifier output is fail-safe to uncertainty, not fail-open to plausible-but-wrong. Publish gates are hard-disabled until verification is complete — no bulk-bypass.

### 2.3 Offline-First Worker

A worker on a remote NZ site has unreliable signal. The app must work fully offline for any SOP previously downloaded.

### 2.4 Multi-Tenancy Hard from Day 1

RLS at the database layer, JWT custom claims, SECURITY DEFINER helpers for cross-policy checks. No cross-tenant leakage even with code bugs.

---

## 3. How to Read This Document

### Categories (8)

| Category | What lives here |
|---|---|
| **Authoring (A-)** | Anything an admin does to create / edit / manage SOPs |
| **Worker Experience (W-)** | What a worker sees on the floor — walkthrough, photo capture, offline |
| **Safety (S-)** | Guardrails — adversarial AI, per-block verify, sign-off chains |
| **Admin & Governance (G-)** | Versioning, approvals, roles, audit trails |
| **Accessibility (X-)** | Findability and assistive access — search, AI assistants, voice, command palette |
| **Compliance & Legislation (C-)** | Legislation library, per-SOP legislation links, AI compliance scans, audit trail |
| **Platform (P-)** | Multi-tenancy, PWA shell, security, bundle hygiene, telemetry |
| **Intake (I-)** | Bringing existing knowledge in — file parse, OCR, video transcription, AI-narrated capture |

### Grades (forward-looking)

| Grade | Meaning |
|---|---|
| **A** | All criteria pass. Industry-leading and complete. |
| **B** | Almost all criteria pass; small known gaps. Competitive today. |
| **C** | Half of criteria pass; functional but rough. |
| **D** | Few criteria pass; present but failing. Active overhaul candidate. |
| **F** | Most criteria fail OR feature missing entirely. |

### Priority

| Tag | Meaning |
|---|---|
| **Now** | v4.0 milestone. We're building this. |
| **Next** | v4.5 milestone. Tentatively scheduled. |
| **Later** | v5.0+ horizon. On the radar. |
| **Maybe** | Speculative — needs customer signal before committing. |
| **Cut** | No further roadmap investment. **For shipped features (W-02, G-05): code remains in product; we won't extend them.** For unbuilt features (ModelBlock, Vimeo, in-house OCR): rejected, never built. |
| **Shipped** | On master, target spec met. |

---

## 4. Feature Catalog by Category

Counts: **46 features** across 8 categories. **8 Now, 9 Next, 19 Later, 5 Maybe, 2 Cut, 3 Shipped.**

### 4.1 Authoring (7 features)

#### A-01 — SOP Builder (Puck) · Later

Admin opens a blank canvas in the browser and drags blocks into the page to compose an SOP.

> **Simon's note:** *The block selection editor is difficult to navigate, we shouldn't expect users to have to learn what each block means — we need an intuitive helper to make it clear. We shouldn't expect users to know the best way to structure a SOP, the user should be guided to use blocks in sequences which are easy for future users to understand.*

**Open criteria:** concurrent multi-admin editing · tablet/phone support · inline AI assistant · rename "Block Builder" → "SOP Builder" in UI copy.
**Current:** F · **Target:** A

#### A-02 — Blank-Page Wizard · Shipped

Short wizard prompts for SOP name, category, key fields before opening the builder.
**Current:** F (forward-looking — wizard works on master) · **Target:** A

#### A-03 — AI-Drafted SOP from Prompt · Later

Admin types a short description and Claude drafts a structured SOP for review.
**Open criteria:** house-style learning · multimodal input (photos/diagrams) · relational naming/numbering vs library.
**Current:** F · **Target:** A

#### A-04 — Reusable Block Library · Maybe

Common SOP pieces stored as reusable blocks with version pinning + diff review on updates.

> **Simon's note:** *(same as A-01)* — block-selection navigation needs the same intuitive helper treatment.

**Open criteria:** block usage analytics · one-click clone org→global proposal · AI-suggested blocks.
**Current:** F · **Target:** A

#### A-05 — NZ Template Library · Next

Pre-built complete SOPs for common NZ industrial scenarios. Admin clones + customises rather than starting blank.

> **Simon's note:** *Customer-acquisition lift. Visy is our primary first client so we should build templates that are likely to be used by Visy — research the types of equipment Visy operates in New Zealand glass manufacture.*

**Current:** F · **Target:** A

#### A-06 — Image & Diagram Annotation (Konva) · Later

Konva-based annotation editor with hotspots, stylus support, dual storage (JSON edit + baked PNG worker view).

> **Simon's note:** *Requires AI assistant control and integration.*

**Current:** F · **Target:** A

#### A-07 — Collaborative Editing · Maybe

Section-level locks, realtime presence, conflict modal.
**Current:** F · **Target:** B · No contention observed in single-admin pattern — wait for first complaint.

---

### 4.2 Worker Experience (6 features)

#### W-01 — Step-by-Step Walkthrough · Now

Worker opens an SOP, taps through one step at a time, confirms each done.
**Open criteria (v4.0 scope):** low-literacy completion · visual-only completion · voice-only completion (W-01 ↔ X-02 are the same story) · multi-language UI.
**Current:** B · **Target:** A

#### W-02 — Photo Evidence Capture · **Cut (shipped, no further work)**

Worker takes a photo at any step. Photo queued + uploaded.
> Code remains in product. No additional roadmap investment planned for voice-annotated photos or GPS-tagging unless customer signal emerges.

**Current:** B · **Target:** A

#### W-03 — Offline-First Reliability · Later

A worker on a no-signal job site can use the app fully. Sync on reconnect.

> Demoted from Now in v0.3. iOS Safari storage eviction warning + last-sync timestamp + per-SOP download UI still on the radar — not v4.0 priority.

**Current:** B · **Target:** A

#### W-04 — Immersive Walkthrough (Mobile) · Next

Full-screen mobile mode. Kiosk lockdown + sequence-enforced walkthrough (Visy pattern).
**Current:** B · **Target:** A

#### W-05 — Completion & Sign-off · Next

Immutable completion record + supervisor sign-off. Adds PIN/badge sign-off at shared workstations + supervisor notifications + bulk sign-off.
**Current:** B · **Target:** A

#### W-06 — Worker Notifications · Later

In-app + push + email digest + quiet hours.
**Current:** C · **Target:** B

---

### 4.3 Safety (5 features)

#### S-01 — Adversarial AI Verifier · Later

Second AI scrutinises every AI-generated draft for safety omissions before admin sees it.
**Open criteria:** verifier learns from admin accept/reject over time · accepts org's prior SOPs as house-style context.
**Current:** B · **Target:** A

#### S-02 — Side-by-Side Source Viewer · Now

Source document pinned beside parsed structure. Click parsed block → source scrolls; click source → block highlights.

> **v0.3 note:** Priority restored to Now after Simon confirmed the v0.2-pass demotion was a misclick. This is the load-bearing v4.0 safety story alongside S-03 + S-04.

**Current:** F · **Target:** A

#### S-03 — AI Reviewer (Five Verification Jobs) · Now

Five specialised AI jobs run on every parsed SOP — omission, anchoring, photo-step alignment, table fidelity, terminology consistency. Auto on parse + manual re-run.
**Current:** F · **Target:** A

#### S-04 — Per-Block Verify Checklist at Publish Gate · Now

Admin walks through every block ticking "verified." Publish hard-disabled until 100% verification. No bulk-bypass.
**Current:** F · **Target:** A

#### S-05 — Safety Reminders Always Visible · Next

PPE icon strip pinned across all steps. Worker can re-acknowledge hazards anytime.
**Current:** B · **Target:** A

---

### 4.4 Admin & Governance (7 features)

#### G-01 — Version History + Worker-Instance Sign-off · Now

Formal supersede flow + side-by-side diff + one-click restore. **Every SOP instance run by a worker logs the worker's name + per-step approval as a personal sign-off chain — completing the SOP IS the legal signature.**
**Current:** F · **Target:** A

#### G-02 — Multi-Step Approval Chain (Optional, Versioned) · Next

Configurable approval chain per SOP category. **Optional** per SOP — not all need one. **Editable per version** — accommodates org-structure changes between versions.
**Current:** F · **Target:** A

#### G-03 — Review-Due Cadence + AI Maintenance Schedule · Next

Per-SOP review_due_at + category cadence + dashboard widget + email digest. **AI-assisted maintenance schedule** designs and maintains the plan for creating new SOPs and updating old ones — proactive lifecycle, not just reminders.
**Current:** F · **Target:** A

#### G-04 — Role-Based Access + Stale-Role Surfacing · Next

Roles editable at will. **SOPs whose access lists reference outdated roles surface in the governance review queue for update.**
**Current:** F · **Target:** A

#### G-05 — Site-Tier Multi-Tenancy · **Cut (shipped, no further work)**

> Migration 00030 lives on prod. Phase 15 manufacturing-line mode uses this. Per-site dashboards + per-site SOP rollout + per-site sign-off chains not pursued unless customer signal arrives.

**Current:** F · **Target:** A

#### G-06 — Training-Record Export · Later

CSV/Excel export + per-worker view + SAP SuccessFactors integration target. Demoted from Next in v0.3.
**Current:** D · **Target:** A

#### G-07 — Team & Invite Management · Later

> **Simon's note:** *Team structures are necessary.*

Bulk CSV import + SSO/SAML + deactivate-preserving-history.
**Current:** B · **Target:** A

---

### 4.5 Accessibility (6 features)

#### X-01 — SOP Search + AI-Managed Categorisation · Next

Full-text + synonym/misspelling tolerance + offline search + recently-used first. **Categorisation managed by AI, evolves as new SOP attributes emerge — manufacturing sites aren't database experts.**
**Current:** C · **Target:** A

#### X-02 — AI Voice Q&A on an SOP · Now

Worker has hands-free question about current SOP. AI grounded only to that SOP's content.
**Open criteria (v4.0 scope):** reliable transcription in industrial-floor noise · answer read back aloud · voice drives step progression · multi-language voice.
**Current:** F · **Target:** A

#### X-03 — Cmd+K Command Palette + Universal AI Access · Now

Power-user Cmd+K palette. Underlying this: **every editable field offers AI read access, most offer AI write access. End goal: app is 99% controllable by AI agents via a unified interface.**
**Current:** F · **Target:** A

#### X-04 — Global Header Navigation · Shipped

Persistent top header on every protected route. Role-aware nav, brand mark, profile menu, mobile hamburger drawer.
**Current:** A · **Target:** A · Shipped 2026-05-22

#### X-05 — AI Assistant as Primary Interface + Layered Architecture · Later

Worker doesn't navigate — they talk to the AI. Underlying layered architecture (database → routing → agents → memory → UI) is upgradeable without rebuilding features.
**Current:** F · **Target:** A · Depends on X-02 and X-03 maturing first.

#### X-06 — Visual-Only Flow · Maybe

Worker with low literacy completes SOPs entirely through photos, diagrams, icons. No required reading.

> Demoted from Now in v0.3. Voice-driven completion (W-01 + X-02) carries the literacy story for v4.0; visual-only flow returns to the roadmap if voice doesn't close the TAM gap.

**Current:** F · **Target:** A

---

### 4.6 Compliance & Legislation (4 features)

#### C-01 — Legislation Library · Maybe

Curated machine-readable library of NZ workplace-safety legislation. Demoted in v0.3 — needs explicit customer signal before commitment.
**Current:** F · **Target:** A

#### C-02 — Per-SOP Legislation Links · Later

Each SOP cites specific clauses it satisfies. Auditors export by regulation.
**Current:** F · **Target:** A

#### C-03 — AI Legislation Scanner · Later

AI scans every SOP, surfaces relevant legislation matches and gaps.
**Current:** F · **Target:** A

#### C-04 — Compliance Audit Trail · Later

Append-only log of every legislation link + scan + acceptance.
**Current:** F · **Target:** A

---

### 4.7 Platform (5 features)

#### P-01 — Multi-Tenant RLS · Shipped

Supabase RLS + JWT custom claims + cross-tenant seed test + SECURITY DEFINER helpers.
**Current:** A · **Target:** A · Phase 1.

#### P-02 — PWA Shell · Later

Web App Manifest, service worker, install-prompts, white-label splash + tab colour per org.
**Current:** B · **Target:** A

#### P-03 — Bundle Isolation CI Gate · Later

check-bundle-size in postbuild, ±2 KB tolerance, CI merge-blocking on failure, per-PR delta report.
**Current:** B · **Target:** A

#### P-04 — Security Hardening (CSP, HSTS) · Next

Modern HTTP security headers (CSP, HSTS, frame-ancestors, X-Content-Type-Options, Permissions-Policy).
**Current:** F · **Target:** A

#### P-05 — Performance Monitoring + Full Usage Telemetry · Later

Error tracking + Web Vitals + backend traces + async error surfacing (LR-03) + per-org rate-limit dashboards. **Full usage telemetry (SOPs used, interaction stats, action sequences) structured for AI review and analysis.**
**Current:** F · **Target:** B

---

### 4.8 Intake (6 features)

#### I-01 — Word / PDF Document Parsing · Now

Admin uploads Word/PDF; app parses to structured sections + OCR fallback + GPT-4o structured parsing. **v4.0 target:** Phase 20 contract complete — extracted photos/diagrams/charts/tables with step-level provenance + side-by-side source viewer (S-02) + AI reviewer × 5 jobs (S-03) + per-block verify checklist (S-04).
**Current:** D · **Target:** A

#### I-02 — Image / Photo OCR · Later

JPG/PNG upload + GPT-4o vision OCR + blur check + multi-page scan + auto-stitching.
**Current:** B · **Target:** A

#### I-03 — Excel / PowerPoint / Text Parsing · Later

xlsx/pptx/txt accepted + officeparser + merged cells + speaker notes.
**Current:** B · **Target:** B

#### I-04 — Video Transcription + AI-Narrated Capture · Later

MP4/MOV upload + YouTube + GPT-4o structuring. **Substantial new scope:** record video of yourself doing the procedure (first OR third person view); AI watches, describes physical actions, breaks into SOP steps.
**Current:** F · **Target:** A

#### I-05 — In-App Video Recording · Maybe

In-browser MediaRecorder + iOS Safari fallback + live transcription preview + step-boundary auto-detection. Blocked on iOS Safari MediaRecorder maturity.
**Current:** F · **Target:** B

#### I-06 — Video SOP Generation · Later

Narrated slideshow + screen-recording + Shotstack AI video + per-org TTS pronunciation + retention TTL + per-tenant quota.
**Current:** B · **Target:** A

---

## 5. Phased Roadmap

### 🟢 v3.0 — Native SOP Builder (SHIPPED 2026-05-23)

Phases 11 / 12 / 12.5 / 13 / 14 / 14.5 / 15 + Phase 20 partial. See `.planning/MILESTONES.md` § v3.0.

---

### 🟡 v4.0 — Safety-Critical Parsing + AI Foundation + Voice-Driven Workers (NOW)

**Theme:** Two intertwined pulls. (1) Finish Phase 20 — every parsed SOP has source-anchored fidelity, AI-verified content, and a publish gate that forces per-block verification. (2) Lay the AI-everywhere foundation that the conversational app vision (v5.0) builds on. Voice-driven walkthrough (W-01 + X-02) carries the literacy story.

**Goal:** No parsed SOP can be published without verified anchoring. Every editable field is AI-callable. A worker who can't read English can still complete an SOP by voice.

| # | Feature | Forward grade gap |
|---|---|---|
| 1 | **S-02** Side-by-side source viewer | F → A |
| 2 | **S-03** AI reviewer × 5 jobs | F → A |
| 3 | **S-04** Per-block verify checklist | F → A |
| 4 | **I-01** Word/PDF parsing (Phase 20 contract complete) | D → A |
| 5 | **W-01** Walkthrough literacy/voice gaps closed | B → A |
| 6 | **X-02** Voice Q&A drives walkthrough + reads aloud | F → A |
| 7 | **X-03** Cmd+K + universal AI read/write field access | F → A |
| 8 | **G-01** Version supersede + diff + worker-instance sign-off | F → A |

**Out of v4.0 scope (carried to v4.5 or later):** offline polish (W-03), visual-only flow (X-06), legislation library (C-01..C-03), kiosk mode (W-04), approval chains (G-02), templates (A-05).

---

### 🟠 v4.5 — Customer-Acquisition + Visy Pilot Closeout (NEXT)

**Theme:** Make the platform Visy-deployable across 100 sites. Templates, governance chains, search, security hardening.

| # | Feature | Forward grade gap |
|---|---|---|
| 1 | A-05 NZ Template Library (Visy glass-mfg-focused research) | F → A |
| 2 | W-04 Kiosk mode + sequence-enforced walkthrough | B → A |
| 3 | W-05 PIN/badge sign-off at shared workstations | B → A |
| 4 | S-05 Pinned PPE icon strip | B → A |
| 5 | G-02 Multi-step approval chain (optional, versioned) | F → A |
| 6 | G-03 Review-due cadence + AI maintenance schedule | F → A |
| 7 | G-04 Roles + stale-role surfacing | F → A |
| 8 | X-01 Full-text search + AI-managed taxonomy | C → A |
| 9 | P-04 CSP/HSTS security hardening | F → A |

---

### 🔵 v5.0 — Conversational App + Telemetry + Diagram Annotation (LATER)

**Theme:** App becomes primarily AI-steerable. Annotation lands. Telemetry feeds the AI layer.

| Feature |
|---|
| A-01 SOP Builder polish — inline AI assistant + collab + tablet/phone |
| A-03 AI draft — house style + multimodal + relational naming |
| A-06 Konva image/diagram annotation (requires AI integration) |
| W-03 Offline polish — iOS eviction warning, last-sync UI |
| W-06 Push notifications + email digest + quiet hours |
| S-01 Adversarial verifier learns from history |
| G-06 Training-record export + SuccessFactors |
| G-07 Team management — bulk CSV, SSO, deactivate-preserving-history |
| X-05 AI assistant as primary interface + layered architecture |
| C-02 Per-SOP legislation links |
| C-03 AI legislation scanner |
| C-04 Compliance audit trail |
| P-02 White-label PWA splash/tab-colour per org |
| P-03 CI workflow blocks merge on bundle-gate failure |
| P-05 Performance monitoring + full usage telemetry |
| I-02 Multi-page photo OCR + auto-stitching |
| I-03 Excel merged cells + PowerPoint speaker notes |
| I-04 Industrial transcription accuracy + 1st/3rd-person AI-narrated capture |
| I-06 Streamlined File→Video + TTS pronunciation dictionaries |

---

### ⚪ Maybe / Speculative

| Feature | Why "Maybe" |
|---|---|
| A-04 Block library — usage analytics + AI-suggested blocks | Existing library functional; analytics is internal instrumentation |
| A-07 Collaborative editing | No contention observed; wait for first complaint |
| X-06 Visual-only flow | Voice-driven completion (W-01 + X-02) carries literacy story for now |
| C-01 Legislation Library | Demoted in v0.3 — needs explicit customer signal first |
| I-05 In-app video recording | iOS Safari MediaRecorder still unreliable |

---

### 🔴 Cut

**Cut (shipped — no further roadmap investment):**

| Feature | Why "Cut but shipped" |
|---|---|
| W-02 Photo Evidence Capture | Code remains in product. No voice-annotated-photo or GPS-tagging extension unless customer signal arrives. |
| G-05 Site-Tier Multi-Tenancy | Migration 00030 lives on prod; Phase 15 manufacturing-line uses it. Per-site dashboards + rollouts not pursued unless customer signal arrives. |

**Cut (rejected, never built):**

| Feature | Why cut |
|---|---|
| ModelBlock (3D model embed) | Considered in Phase 12.5, dropped. Bundle weight + niche use. |
| Vimeo URL pathway | API scope never confirmed; YouTube + upload cover use case. |
| In-house OCR engine | tesseract.js + GPT-4o vision sufficient. |

---

## 6. Partner Communication Index

- **A-01 SOP Builder** — "Admins build SOPs in the browser. Block selection needs better guidance for first-timers."
- **A-03 AI draft** — "Admin types a sentence; AI writes the SOP."
- **A-05 Templates** — "Library of ready-to-clone NZ industry SOPs, Visy-glass-mfg-focused first."
- **W-01 Walkthrough** — "Worker taps through one step at a time on their phone — soon they'll be able to do it entirely by voice."
- **S-02 Source viewer** — "When reviewing a parsed SOP, admin sees the original side-by-side."
- **S-03 AI reviewer** — "Five AI quality checks run automatically on every parsed SOP."
- **S-04 Verify checklist** — "Admin must tick 'verified' on every block before publish."
- **G-01 Version history + sign-off** — "Every version is saved; every worker run is signed step-by-step."
- **G-02 Approval chain** — "SOPs route through configurable approvers; the chain is optional and per-version."
- **G-03 Maintenance schedule** — "AI helps plan which SOPs to create and which to update."
- **G-04 Stale-role surfacing** — "When roles change at the org, affected SOPs surface in the governance queue."
- **X-02 Voice Q&A** — "Worker asks the AI a hands-free question about the current SOP."
- **X-03 AI everywhere** — "Every field is AI-readable; most are AI-writable; goal is 99% AI-controllable."
- **X-05 AI assistant** — "Long-term: workers and admins talk to the AI; navigation becomes optional."
- **I-01 Document parsing** — "Word, PDF, photo of a paper SOP — all parse into the builder with verified anchoring."
- **I-04 AI-narrated capture** — "Record yourself doing the job; AI watches and writes the SOP."
- **P-04 Security hardening** — "Modern security headers; no iframe embedding."

---

## 7. Open Questions for Partners

- **TAM positioning:** Australian / NZ industrial (Visy-shape) primary, or also trades-services SMB?
- **Pricing tier definitions:** Enterprise (SuccessFactors, SSO), Pro (templates, approval chains), Free (basic walkthrough)?
- **Customer-acquisition channel:** direct sales, partner-channel, or self-serve?
- **Compliance scope:** WorkSafe NZ general, AS/NZS 4801, ISO 45001? (Demoting the Legislation features in v0.3 means we're not committing to this yet — flag if you want it back.)

---

## 8. Maintenance

This document is generated from `.planning/product-roadmap.data.json` (the canonical machine-readable source). Edit via `.planning/product-roadmap.html` in your browser, export JSON, and the next regeneration uses the JSON as the new base.

**Regeneration flow:**

1. Open `.planning/product-roadmap.html` in a browser
2. Review / edit / add features / mark reviewed / mark disputed
3. Click **Export JSON** — save the file
4. Hand the JSON back to Claude (or replace `.planning/product-roadmap.data.json` directly)
5. Claude regenerates this Markdown doc and updates `product-roadmap-data.js` (the editor baseline)

**Evolution triggers:**

- Milestone completion → feature grades update, completed phases move to "shipped"
- Customer interview → new acceptance criteria added to relevant features
- Quarterly review → priorities re-shuffled

---

*Last updated 2026-05-24 — v0.3 (Simon's 21:12 review pass — 9 priority shifts, "Cut-but-shipped" semantics introduced, S-02 restored to Now).*
