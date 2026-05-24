# SOPstart — Product Roadmap

**Owner:** Potenco Pty Ltd
**Status:** v0.2 — 2026-05-24 (regenerated from Simon's 2026-05-24 review pass)
**Source of truth:** `.planning/product-roadmap.data.json` (machine-readable)
**Editor:** `.planning/product-roadmap.html` (open in browser to edit and re-export)
**Purpose:** A single, partner-readable record of every feature SOPstart aspires to ship — both what's already on master and what we want to one day add. Each feature has bespoke acceptance criteria, a current grade, a target grade, and a priority tag. Grades are **forward-looking** — a feature is F until every criterion passes; A means industry-leading and complete.

---

## 1. Executive Summary (for partner conversations)

SOPstart is a mobile-first workplace-safety app for blue-collar industrial customers. Workers open an SOP on their phone, walk through it step-by-step, capture photo evidence, and complete a legally defensible sign-off — even offline at remote job sites. Admins author SOPs in a builder, draft them from a prompt, or upload existing documents for AI parsing.

We are post-v3.0 (Native SOP Builder) and entering v4.0+. The next eighteen months are defined by four product pulls:

1. **Safety-critical content fidelity.** Every photo, diagram, table, and step in a parsed SOP must be anchored, verified by AI, and verifiable by a human admin before publish.
2. **Worker accessibility for the actual blue-collar TAM.** Low-literacy workflows, visual-only flow, voice-driven walkthrough, multi-language UI. The Visy interview made clear: today's app excludes most workers on a typical NZ industrial site.
3. **Compliance & Legislation as a product surface.** Customers buy SOP tooling to satisfy regulators. A live legislation library, per-SOP legislation links, and AI compliance scans are a customer-acquisition lever, not an afterthought.
4. **AI as the operating layer, not just a feature.** The end state is an app 99% steerable by AI agents — every editable field has read access, most have write access, and a unified agent-routing + memory architecture sits underneath the UI.

---

## 2. Architectural Principles

These are horizontal — they cut across every feature, not stored in any single category.

### 2.1 AI Everywhere

The product's long-term shape is an app driven primarily by AI agents on behalf of users. Concretely:

- Every editable field offers an AI **read** API.
- Most editable fields offer an AI **write** API (with the user as final approver where stakes are high — sign-off, publish, role assignment).
- The app exposes a **unified agent interface** that any feature surface can call into.
- The agent layer is **upgradeable** without rebuilding features — new models, new agents, new token limits should drop in.

The intended layered architecture:

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

Every feature in the catalog below carries explicit AI read/write criteria so the principle is enforced one feature at a time, not aspirationally.

### 2.2 Safety-Critical Defaults

The product's failure mode is a worker acting on misinformation. Defaults must err on the side of refusing rather than guessing:

- AI verifier output is fail-safe to uncertainty, not fail-open to plausible-but-wrong.
- Publish gates are hard-disabled until verification is complete — no bulk-bypass.
- Voice answers cite specific steps; refuse rather than hallucinate.

### 2.3 Offline-First Worker

A worker on a remote NZ site has unreliable signal. The app must work fully offline for any SOP previously downloaded, and signal clearly when an SOP is stale or unsynced.

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
| **C** | Half of criteria pass; functional but rough; loses side-by-side demo. |
| **D** | Few criteria pass; present but failing. Active overhaul candidate. |
| **F** | Most criteria fail OR feature missing entirely. |

> ⚠ A feature can have demonstrably working parts and still grade F if it doesn't meet the full target vision. The grade tracks the gap to target, not the implementation reality on master.

### Priority

| Tag | Meaning |
|---|---|
| **Now** | Next milestone (v4.0). We're building this. |
| **Next** | Milestone-after-next (v4.5). Tentatively scheduled. |
| **Later** | Year-out horizon (v5.0). On the radar. |
| **Maybe** | Speculative — needs customer signal before committing. |
| **Cut** | Considered and rejected. Logged so we don't re-debate. |
| **Shipped** | On master, complete against target. |

---

## 4. Feature Catalog

Counts: **47 features total** (40 from v0.1, plus 3 new compliance features, plus 4 expanded scope on existing entries). All grades reflect Simon's 2026-05-24 forward-looking pass.

### 4.1 Authoring (7 features)

#### A-01 — SOP Builder (Puck) *(renamed from Block Builder)*

**Plain English:** An admin opens a blank canvas in the browser and drags blocks (Step, Hazard, Tool, Decision, etc.) into the page to compose an SOP. No upload required.

**Criteria:** Admin can create from scratch ✅ · Block palette covers common shapes ✅ · Drag-to-reorder at section level ✅ · Dexie autosave ✅ · Preview toggle ✅ · Two admins concurrent without overwriting ❌ · Builder works on tablets and phones ❌ · **Inline AI assistant inside the builder** ❌ · **Renamed from "Block Builder" to "SOP Builder" across all UI copy** ❌

**Current:** F · **Target:** A · **Priority:** Later

#### A-02 — Blank-Page Wizard

**Plain English:** When an admin clicks "Start blank," a short wizard prompts them for the SOP's name, category, and key fields before opening the builder.

**Criteria:** Wizard appears on new-SOP flow ✅ · Admin picks primary category tag ✅ · Admin picks blocks from the library ✅ · Atomic SOP record creation ✅

**Current:** F (forward-looking — wizard works on master but Simon's standard requires expanded scope) · **Target:** A · **Priority:** Shipped

#### A-03 — AI-Drafted SOP from Prompt

**Plain English:** An admin types a short description ("scaffold inspection for warehouse mezzanine") and Claude drafts a structured SOP for review and edit.

**Criteria:** Freeform prompt → structured draft ✅ · Adversarial verifier on every draft ✅ · Flags surface inline ✅ · Edit-and-republish re-runs verifier ✅ · AI drafts in customer's house style ❌ · AI accepts photos/diagrams alongside prompt ❌ · **New SOP gets relational context from existing library — AI suggests number + title consistent with house naming** ❌

**Current:** F · **Target:** A · **Priority:** Later

#### A-04 — Reusable Block Library

**Plain English:** Common SOP pieces (Lockout-Tagout PPE, Crush-entrapment hazard card, etc.) are stored as reusable blocks. Global-library updates surface as per-SOP "review and accept" prompts.

**Criteria:** Org + Potenco-curated tiers ✅ · 65 NZ-industry seed blocks ✅ · Pin-version or follow-latest ✅ · Per-SOP review modal with diff ✅ · Org admins suggest globals to Potenco ✅ · Block usage analytics ❌ · One-click clone org→global proposal ❌ · **AI-suggested blocks based on draft content** ❌

**Current:** F · **Target:** A · **Priority:** Maybe

#### A-05 — NZ Template Library

**Plain English:** Pre-built complete SOPs for common NZ industrial scenarios (WorkSafe-aligned). An admin clones a template and customises rather than starting blank.

**Criteria:** Browseable catalog of complete SOP templates ❌ · Aligned to WorkSafe categories ❌ · Third entry point in new-SOP flow ❌ · Clone-and-edit with attribution + curator updates ❌ · Industry bundles (forestry, food processing, mining) ❌

> See also Compliance category (C-01..C-04) — Simon's "AI legislation review" and "Legislation library kept active" criteria moved there as their own feature surface.

**Current:** F · **Target:** A · **Priority:** Next

#### A-06 — Image & Diagram Annotation (Konva)

**Plain English:** Admin uploads a machine diagram or photo and adds labelled hotspots, arrows, freeform callouts. Workers tap hotspots to see context.

**Criteria:** Stylus + finger annotation editor ❌ · Dual storage (JSON edit + baked PNG worker view) ❌ · Hotspots link to specific steps ❌ · Palm rejection ❌ · Workers see baked image without editor bundle ❌

**Current:** F · **Target:** A · **Priority:** Later

#### A-07 — Collaborative Editing

**Plain English:** Two admins can work on the same SOP at the same time. The app shows who's editing what, prevents simultaneous edits to the same section, and handles offline reconciliation.

**Criteria:** Section-level pessimistic locks ❌ · Realtime presence indicators ❌ · Optimistic version column for offline-then-reconnect ❌ · Clear conflict modal ❌ · "Updated by another admin" toast ❌

**Current:** F · **Target:** B · **Priority:** Maybe

---

### 4.2 Worker Experience (6 features)

#### W-01 — Step-by-Step Walkthrough

**Plain English:** A worker opens an SOP and the app guides them through one step at a time on their phone. They tap to confirm each step is done.

**Criteria:** Modern phone browser, no install ✅ · Offline once downloaded ✅ · Readable in bright outdoor light ✅ · Tap targets ≥44px ✅ · Photo capture per step ✅ · Step ack trace for audit ✅ · Low-literacy worker can complete ❌ · Visual-only completion (diagrams/photos, no required reading) ❌ · Voice-only completion (AI reads + listens + asks back) ❌ · Multi-language UI (Te Reo, Tagalog, Hindi, Mandarin) ❌

**Current:** B · **Target:** A · **Priority:** Now — literacy / visual / voice gaps are the blue-collar TAM blocker.

#### W-02 — Photo Evidence Capture

**Plain English:** Worker takes a photo with their phone camera at any step. Photo is queued for upload (even offline) and arrives with the completion record.

**Criteria:** Camera fires from step view ✅ · Client-side compression ✅ · Offline queue persists ✅ · Auto-upload on reconnect ✅ · photo_required enforces capture ✅ · Voice-annotated photo (5-sec clip + auto-transcribe) ❌ · GPS + timestamp auto-tag ❌

**Current:** B · **Target:** A · **Priority:** Next

#### W-03 — Offline-First Reliability

**Plain English:** A worker on a construction site with no signal can use the app fully — read, photograph, complete sign-off — and everything syncs when they're back online.

**Criteria:** Serwist asset cache ✅ · Dexie SOP store ✅ · Photo queue survives crash + restart ✅ · Sync engine reconciles on reconnect ✅ · Online/offline indicator ✅ · Per-SOP "download for offline" UI ❌ · iOS Safari eviction warning (7-day purge) ❌ · Last-synced timestamp visible to worker ❌

**Current:** B · **Target:** A · **Priority:** Now — iOS eviction is a known incident risk.

#### W-04 — Immersive Walkthrough (Mobile)

**Plain English:** Full-screen mode for mobile workers. One step at a time, big text, swipe between steps, minimal chrome.

**Criteria:** Full-bleed step render ✅ · Bottom action bar ✅ · Nested layout routing ✅ · Kiosk mode lockdown (tablet can't navigate away) ❌ · Sequence-enforced (can't skip critical step) ❌

**Current:** B · **Target:** A · **Priority:** Next — kiosk mode from Visy interview.

#### W-05 — Completion & Sign-off

**Plain English:** When a worker finishes an SOP, the app captures an immutable completion record and routes it to a supervisor for sign-off.

**Criteria:** Append-only completion records ✅ · Photo evidence attached ✅ · Supervisor signs off (immutable record) ✅ · Supervisor reject-with-reason ✅ · PIN / badge sign-off at shared workstation ❌ · Email/push notification to supervisor ❌ · Bulk supervisor sign-off ❌

**Current:** B · **Target:** A · **Priority:** Next

#### W-06 — Worker Notifications

**Plain English:** Worker receives a notification when a new SOP is assigned, an SOP is updated, or a supervisor responds.

**Criteria:** In-app notification badge ✅ · New-assignment notification record ✅ · Push notifications to mobile ❌ · Email digest of pending SOPs ❌ · Configurable quiet hours ❌

**Current:** C · **Target:** B · **Priority:** Later

---

### 4.3 Safety (5 features)

#### S-01 — Adversarial AI Verifier

**Plain English:** When AI generates an SOP from a prompt or transcript, a second AI (Claude) reads the result critically and flags missing safety info, unrealistic times, vague PPE, or dangerous omissions before the admin sees the draft.

**Criteria:** Verifier auto-runs on every AI draft ✅ · Flags surface inline ✅ · Severity (critical/warning/notice) ✅ · Critical flags must be resolved before publish ✅ · Verifier learns from admin accept/reject over time ❌ · Verifier accepts org's prior SOPs as house-style context ❌

**Current:** B · **Target:** A · **Priority:** Later

#### S-02 — Side-by-Side Source Viewer

**Plain English:** When an admin reviews a parsed SOP, the original document is pinned beside the parsed structure. Click a parsed block → source viewer scrolls to the exact passage; click a source region → parsed block highlights.

**Criteria:** Source rendered alongside parsed blocks ❌ · Click parsed block → source scrolls ❌ · Click source region → block highlights ❌ · Persistent throughout review, not modal ❌ · Works for all intake formats ❌

**Current:** F · **Target:** A · **Priority:** Now — Phase 20 remainder, load-bearing safety story for v4.0.

#### S-03 — AI Reviewer (Five Verification Jobs)

**Plain English:** The conversion pipeline runs five specialised AI jobs on every parsed SOP — omission, anchoring, photo-step alignment, table fidelity, terminology consistency — automatically on first parse and on admin demand.

**Criteria:** Job A: Omission check ❌ · Job B: Anchoring check ❌ · Job C: Step-image alignment ❌ · Job D: Table fidelity ❌ · Job E: Terminology consistency ❌ · All five auto-run on first parse ❌ · Admin can re-run any job manually ❌ · Cost bounded with prompt-caching + per-org cap ❌

**Current:** F · **Target:** A · **Priority:** Now — Phase 20 remainder.

#### S-04 — Per-Block Verify Checklist at Publish Gate

**Plain English:** Before publish, the admin walks through every block and ticks "I have verified this matches the source." Publish is hard-disabled until 100% verification.

**Criteria:** Every block carries verified_by boolean ❌ · Publish hard-disabled until 100% ❌ · Timestamp + admin user_id stored for audit ❌ · Re-edit requires re-verify of THAT block ❌ · No bulk-verify (speed-bump is the feature) ❌ · UI guides eye-flow so admin actually reads each block ❌

**Current:** F · **Target:** A · **Priority:** Now — Phase 20 remainder.

#### S-05 — Safety Reminders Always Visible

**Plain English:** Hazards, PPE, and emergency info for the current step never scroll off the worker's screen — persistent regardless of walkthrough position.

**Criteria:** Hazards/PPE as persistent callout blocks ✅ · Severity colour-coded ✅ · Critical PPE icon strip pinned across all steps ❌ · Worker can re-acknowledge hazards without restarting walkthrough ❌

**Current:** B · **Target:** A · **Priority:** Next

---

### 4.4 Admin & Governance (7 features)

#### G-01 — Version History + Worker-Instance Sign-off

**Plain English:** Every SOP keeps a record of every published version. Admins can compare versions and recover an old version. Every individual worker instance also logs the worker's name, the version they used, and per-step approval as a personal sign-off chain — the act of completing the SOP is the legal signature.

**Criteria:** Every publish creates a new version row ✅ · Old versions preserved ✅ · Version history list per SOP ✅ · Formal supersede flow (deprecate old explicitly) ❌ · Side-by-side diff between any two versions ❌ · One-click restore old version as active ❌ · Workers see "SOP updated since you last completed it" indicator ❌ · **Every SOP instance records a worker's name + per-step approval as immutable sign-off chain — completing the SOP IS the worker signing every step** ❌

**Current:** F · **Target:** A · **Priority:** Now — formal supersede + diff + instance sign-off are partner-requested.

#### G-02 — Multi-Step Approval Chain (Optional, Versioned)

**Plain English:** Before an SOP is published to workers, it routes through a configurable approval chain — e.g. Safety Manager → Operations Manager → Discipline Leader. The chain is optional per SOP (not all SOPs need one) and editable per version (so org-structure changes don't break old SOPs).

**Criteria:** Org admin configures approval chain per SOP category ❌ · "Awaiting approval" state with role-visible queue for next approver ❌ · Approval/rejection logged immutably ❌ · Rejection routes back to author with reason ❌ · Emergency bypass for safety managers (logged) ❌ · **Approval chain is optional per SOP — not every SOP requires one** ❌ · **Approval chain editable per SOP version — accommodates org-structure changes between versions** ❌

**Current:** F · **Target:** A · **Priority:** Next — Visy governance gap.

#### G-03 — Review-Due Cadence + AI Maintenance Schedule

**Plain English:** Every SOP has a review date (annual or category-specific). The system prompts the SOP owner before lapse and flags overdue. A connected AI-assisted **maintenance schedule** designs and maintains the plan for which new SOPs to create and which old SOPs to update — proactive lifecycle management, not just reminders.

**Criteria:** Per-SOP review_due_at field ❌ · Default cadence per category (chemical 6mo, machinery 12mo) ❌ · Dashboard widget for due/overdue ❌ · Email digest T-30 / T-7 / overdue ❌ · Overdue SOPs flagged in worker view ❌ · **AI-assisted SOP development + maintenance schedule — designs the plan for creating new SOPs and updating old ones, evolves with the org's portfolio** ❌

**Current:** F · **Target:** A · **Priority:** Next

#### G-04 — Role-Based Access + Stale-Role Surfacing

**Plain English:** Each user has a role (Worker, Supervisor, Admin, Safety Manager, Discipline Leader) determining what they can see and do. Roles are editable at will, and any SOP whose access list references an outdated role surfaces in the governance review queue.

**Criteria:** Worker, Supervisor, Admin, Safety Manager roles defined ✅ · Role-based RLS server-side ✅ · Role assigned per organisation member ✅ · Discipline Leader role (full) ❌ · Trade-level granularity (electrical-supervisor vs mechanical) ❌ · **Roles can be defined and re-defined at will — SOPs with out-of-date role access surface in governance review queue for update** ❌

**Current:** F · **Target:** A · **Priority:** Next

#### G-05 — Site-Tier Multi-Tenancy

**Plain English:** A multi-site customer (e.g. Visy with ~100 sites) can scope SOPs to specific sites within their org, route assignments / approvals to site-local staff, and view per-site dashboards.

**Criteria:** Site entity in data model ✅ · Sub-trade tags routed via RLS ✅ · Per-site dashboards for site managers ❌ · Per-site SOP rollout ❌ · Per-site sign-off chains ❌

**Current:** F · **Target:** A · **Priority:** Next — Visy is the named customer.

#### G-06 — Training-Record Export (SuccessFactors target)

**Plain English:** Completed SOPs become evidence in a worker's training record. The org can export these records — for audits, for migration into HR systems (SAP SuccessFactors is the target integration).

**Criteria:** Completion records carry timestamp + worker_id + photo ✅ · CSV/Excel export for date range ❌ · Per-worker training-record view ❌ · SAP SuccessFactors integration target ❌ · Export filterable by site, role, category, date ❌

**Current:** D · **Target:** A · **Priority:** Next — Visy interview surfaced SuccessFactors.

#### G-07 — Team & Invite Management

**Plain English:** Org admin invites workers via email or shareable invite code, assigns roles, views active members, revokes access.

**Criteria:** Email invite with role pre-assigned ✅ · Shareable invite code with role pre-assigned ✅ · Active members list with role ✅ · Bulk CSV import ❌ · SSO/SAML for enterprise ❌ · Deactivate-without-delete preserves history ❌

**Current:** B · **Target:** A · **Priority:** Later

---

### 4.5 Accessibility (6 features)

#### X-01 — SOP Search + AI-Managed Categorisation

**Plain English:** Worker types a few words ("scaffold," "manual handling," "electrical isolation") and finds the SOP. Categorisation and structure of SOPs is managed by AI — manufacturing sites aren't database experts, and the taxonomy evolves as new SOP attributes emerge.

**Criteria:** Worker-facing search input on SOPs tab ✅ · Matches title + category tag ✅ · Full-text content search ❌ · Synonym / misspelling tolerance ❌ · Offline search against locally-cached SOPs ❌ · Recently-used SOPs first on empty search ❌ · **Categorisation and structure handled by AI, evolves over time as new SOP attributes are created (orgs aren't database experts)** ❌

**Current:** C · **Target:** A · **Priority:** Next

#### X-02 — AI Voice Q&A on an SOP

**Plain English:** Worker has a hands-free question about the current SOP ("how tight should this bolt be?" "what PPE for the next step?"). Taps a button, asks in plain English, AI answers grounded only to that SOP's content.

**Criteria:** Voice button on walkthrough ✅ · Answers strictly grounded to active SOP ✅ · Citations to specific steps/blocks ✅ · Verifier flags uncertainty rather than guessing ✅ · Per-user concurrency cap ✅ · Reliable transcription in industrial-floor noise ❌ · Answer read back aloud (full-audio loop) ❌ · Voice drives step progression ("I've done step 4, what's next") ❌ · Multi-language voice support ❌

**Current:** F · **Target:** A · **Priority:** Now — voice-driven flow is part of W-01's literacy story.

#### X-03 — Cmd+K Command Palette + Universal AI Access

**Plain English:** Power users press Cmd+K and jump to anything. Underlying this: every editable field in the app has AI read access, most have AI write access. End goal is an app 99% controlled and managed by AI agents.

**Criteria:** Cmd+K global palette ✅ · Cross-SOP search ✅ · Cross admin pages, team, settings ❌ · Recently-used actions first ❌ · Mobile alternative (swipe / long-press) ❌ · **Every editable field offers AI read access** ❌ · **Most editable fields offer AI write access** ❌ · **End goal: app is 99% controllable by AI agents via a unified interface** ❌

**Current:** F · **Target:** A · **Priority:** Now (promoted from Later — this is the architectural backbone)

#### X-04 — Global Header Navigation

**Plain English:** Every page has a header with the SOPstart logo, role-aware nav, profile menu — so users always know where they are and can jump anywhere.

**Criteria:** Persistent top header on every protected route ✅ · Role-aware navigation ✅ · SOPstart brand mark + wordmark ✅ · Profile menu with sign-out ✅ · Mobile hamburger drawer ✅ · Bundle cost bounded by CI gate ✅

**Current:** A · **Target:** A · **Priority:** Shipped 2026-05-22

#### X-05 — AI Assistant as Primary Interface + Layered AI Architecture

**Plain English:** A worker doesn't navigate — they ask the AI. "Show me the lockout SOP." "Mark step 4 as done." "Take a photo of the panel." The whole app is steerable by voice + conversation. Beneath this, AI is built into every surface with a unified interface — designed in layers (database / agent routing / agents / memory / UI) so models, agents, and token budgets are upgradeable without rebuilding features.

**Criteria:** Natural-language commands across all primary actions ❌ · Wake-word or single-tap activation ❌ · Multi-turn conversation (AI asks clarifying questions back) ❌ · Works offline for cached SOPs (no LLM roundtrip) ❌ · AI surfaces own confidence — refuses to act if uncertain ❌ · **Unified AI interface across every app surface, designed in layers (database → agent routing → agents → memory → UI) for upgradeability** ❌

**Current:** F · **Target:** A · **Priority:** Later — vision target. Depends on X-02 and X-03 maturing first.

#### X-06 — Visual-Only Flow

**Plain English:** A worker with low literacy can complete an SOP relying entirely on photos, diagrams, and icons — no required reading.

**Criteria:** Every step carries a primary photo/diagram anchoring the action ❌ · Standardised icons for hazards, PPE, tools ❌ · Visual progress indicator (5 of 12 steps, no English) ❌ · "Show me" affordance opens photo/diagram full-screen ❌ · Visual-only audit trail (supervisor reviews via photos) ❌

**Current:** F · **Target:** A · **Priority:** Now — load-bearing for blue-collar TAM.

---

### 4.6 Compliance & Legislation (4 features — NEW)

This category is new in v0.2. Compliance with WorkSafe NZ / AS-NZS / industry-specific legislation is a customer-acquisition lever for industrial customers, not an afterthought.

#### C-01 — Legislation Library

**Plain English:** A curated, machine-readable library of NZ workplace-safety legislation — WorkSafe regulations, AS/NZS standards, industry-specific codes — kept up to date and queryable by SOP authors.

**Criteria:** Catalog of NZ WorkSafe regulations + AS/NZS standards relevant to industrial SOPs ❌ · Org tier (org's own internal regulations) + Potenco-curated global tier ❌ · Each entry carries: citation, effective date, summary, source link, category tags ❌ · Library refreshed on a periodic cadence (and surfaces changes to subscribers) ❌ · Searchable from the builder + browsable as a standalone admin surface ❌ · AI read/write access (agents can query legislation, propose new entries) ❌

**Current:** F · **Target:** A · **Priority:** Next

#### C-02 — Per-SOP Legislation Links

**Plain English:** Each SOP carries explicit links to the specific clauses / regulations it satisfies. Workers see "this SOP satisfies WorkSafe regulation X clause Y"; auditors see provenance.

**Criteria:** SOP can link to one or more legislation entries (from C-01) ❌ · Links are per-section or per-step, not just per-SOP (granular provenance) ❌ · Workers see "this satisfies regulation X" as inline reference ❌ · Auditors export "all SOPs satisfying regulation X" as a one-shot report ❌ · Links survive SOP versioning (audit trail) ❌

**Current:** F · **Target:** A · **Priority:** Next

#### C-03 — AI Legislation Scanner

**Plain English:** When an SOP is drafted or edited, an AI scans its content and surfaces relevant legislation matches — and gaps. "This SOP describes confined-space entry but doesn't reference Regulation X — should it?"

**Criteria:** AI scan runs on every draft + on demand ❌ · Surfaces matches (legislation X clause Y is referenced) and gaps (regulation Z should be referenced but isn't) ❌ · Confidence-graded — fail-safe to "uncertain" rather than guessing ❌ · Auto-suggests legislation links the admin can accept one-click ❌ · Cost bounded (prompt-caching + per-org spend cap) ❌

**Current:** F · **Target:** A · **Priority:** Next

#### C-04 — Compliance Audit Trail

**Plain English:** Every legislation link, scan, and acceptance is logged immutably. An auditor can reconstruct exactly which regulations an SOP claimed compliance with at any historical point, and which AI scans were run.

**Criteria:** Append-only log of every legislation link (added, removed, updated) ❌ · Log of every AI scan run + the suggestions surfaced + admin response ❌ · Audit-exportable as CSV/PDF for regulatory review ❌ · Survives SOP versioning (links to the version that was active at the time) ❌

**Current:** F · **Target:** A · **Priority:** Later

---

### 4.7 Platform (5 features)

#### P-01 — Multi-Tenant RLS

**Plain English:** Every customer's data is fully isolated. No cross-tenant leakage possible even with a code bug — the database refuses to return another org's rows.

**Criteria:** Supabase RLS on every table ✅ · JWT custom claims carry org_id ✅ · Cross-tenant isolation seed test ✅ · SECURITY DEFINER helpers ✅ · Per-customer encryption-at-rest with org-scoped keys ❌ · Audit log of admin-client cross-tenant boundaries ❌

**Current:** A · **Target:** A · **Priority:** Shipped

#### P-02 — PWA Shell

**Plain English:** The app installs to the worker's phone like a native app, works offline, looks like a normal app icon rather than a browser tab.

**Criteria:** Web App Manifest with maskable + any icons ✅ · Serwist service worker registered + caching ✅ · Installable on iOS Safari + Android Chrome ✅ · Online/offline status banner ✅ · Brand-consistent icons across favicon + apple-touch + PWA ✅ · "Open in Safari/Chrome" install prompts ❌ · Splash-screen + tab-colour customisation per org (white-label) ❌

**Current:** B · **Target:** A · **Priority:** Later

#### P-03 — Bundle Isolation CI Gate

**Plain English:** Every code change is checked against the worker's bundle size. New admin features cannot bloat what workers download.

**Criteria:** check-bundle-size.ts runs in postbuild ✅ · Baseline locked with documented drift rationale ✅ · ±2 KB tolerance per route ✅ · Chunk-existence assertions ✅ · CI workflow blocks merge on gate failure ❌ · Per-PR bundle delta posted to PR conversation ❌

**Current:** B · **Target:** A · **Priority:** Later

#### P-04 — Security Hardening (CSP, HSTS, frame-ancestors)

**Plain English:** Modern HTTP security headers (CSP, HSTS, frame-ancestors) prevent malicious iframe embedding and script injection.

**Criteria:** CSP allowlists for Supabase, Anthropic, Railway ❌ · HSTS max-age=31536000, includeSubDomains, preload ❌ · frame-ancestors 'self' or 'none' ❌ · X-Content-Type-Options nosniff + Referrer-Policy strict-origin ❌ · Permissions-Policy lockdown ❌

**Current:** F · **Target:** A · **Priority:** Next

#### P-05 — Performance Monitoring + Full Usage Telemetry

**Plain English:** When something is slow or broken on a customer's site, we see it immediately. Beyond errors and Web Vitals, the platform captures full usage telemetry — what SOPs were used, user interaction stats, action sequences — structured into databases for AI review and analysis (which feeds X-05 and other AI agents).

**Criteria:** Frontend error tracking (Sentry-equivalent) ❌ · Web Vitals (LCP, FID, CLS) per route per org ❌ · Backend trace capture for parse pipeline ❌ · Async error surfacing — after() errors not silently swallowed (LR-03 debt) ❌ · Per-org rate-limit dashboards (AI spend, photo upload) ❌ · **Full usage telemetry — SOPs used, interaction stats, action sequences — captured + structured for AI review and analysis** ❌

**Current:** F · **Target:** B · **Priority:** Later (telemetry is foundational for AI-everywhere — may promote to Next once X-05 architecture lands)

---

### 4.8 Intake (6 features)

#### I-01 — Word / PDF Document Parsing

**Plain English:** Admin uploads an existing Word doc or PDF SOP; the app parses it into structured sections, runs OCR for scans, and presents the result for review.

**Criteria:** DOCX text + image extraction ✅ · PDF text + image extraction ✅ · OCR fallback for scanned PDFs ✅ · GPT-4o structured parsing ✅ · Async pipeline ✅ · Realtime + polling status ✅ · DOCX images anchored to steps ✅ · Parsed drafts → builder layout_data ✅ · Photos/diagrams/charts/tables extracted with step-level provenance ❌ · Per-block verify checklist at publish gate (Phase 20 — see S-04) ❌ · Side-by-side source viewer (Phase 20 — see S-02) ❌ · AI reviewer × 5 jobs (Phase 20 — see S-03) ❌

**Current:** D · **Target:** A · **Priority:** Now — Phase 20 remainder is the highest-value safety story.

#### I-02 — Image / Photo OCR

**Plain English:** Admin uploads a phone photo of a paper SOP; the app extracts text via OCR and routes through the parse pipeline.

**Criteria:** JPG / PNG upload ✅ · GPT-4o vision as primary OCR ✅ · Pre-flight Laplacian-blur check ✅ · Multi-page photo scan with per-page review ❌ · "Hold camera steady" real-time blur feedback ❌ · Auto-stitching of multi-page photographed documents ❌

**Current:** B · **Target:** A · **Priority:** Later

#### I-03 — Excel / PowerPoint / Text Parsing

**Plain English:** Admin uploads xlsx, pptx, or plain text; routed through the same parse pipeline.

**Criteria:** xlsx / pptx / txt accepted ✅ · officeparser handles xlsx + pptx ✅ · Macro-enabled formats rejected at validation ✅ · Excel tables with merged cells / multi-row headers parsed correctly ❌ · PowerPoint speaker notes incorporated into step text ❌

**Current:** B · **Target:** B · **Priority:** Later — uncommon SOP source formats.

#### I-04 — Video Transcription + AI-Narrated Capture (1st + 3rd Person)

**Plain English:** Admin uploads an MP4/MOV or pastes a YouTube URL; the app transcribes and structures into an SOP draft. **New scope:** Admin (or worker) records video of themselves performing the procedure — either first-person (head-cam style) or third-person — and AI watches the video, describes the physical events, and breaks them into SOP steps. The video itself replaces voice transcription as the input format.

**Criteria:** MP4 / MOV upload (TUS) ✅ · YouTube URL via caption API ✅ · Transcript review surface ✅ · GPT-4o transcript structuring ✅ · Adversarial verifier ✅ · Industrial-floor transcription accuracy on NZ-accented speakers ❌ · Vimeo URL pathway ❌ · Mid-video diagram/whiteboard frame extraction ❌ · **First-person view narration — AI watches procedure video, describes physical actions, breaks into SOP steps** ❌ · **Third-person view narration — AI watches procedure video, describes physical actions, breaks into SOP steps** ❌

**Current:** F · **Target:** A · **Priority:** Later — promoted in scope; the AI-narrated capture is a substantially new intake pathway.

#### I-05 — In-App Video Recording

**Plain English:** Admin presses record in the browser, films a procedure on their phone or laptop, and the app transcribes it into an SOP draft on the spot.

**Criteria:** In-browser camera recording (MediaRecorder) ❌ · iOS Safari fallback (file-upload picker) ❌ · Live transcription preview while recording ❌ · Auto-detection of step boundaries from pauses / "next" cues ❌

**Current:** F · **Target:** B · **Priority:** Maybe — blocked on iOS Safari MediaRecorder maturity.

#### I-06 — Video SOP Generation

**Plain English:** Admin clicks "Generate video SOP" on a published SOP; the app produces a narrated video version for orgs that train via video.

**Criteria:** Narrated slideshow format ✅ · Screen-recording-style format ✅ · AI-generated video format (Shotstack) ✅ · Multiple video versions per SOP with labels ✅ · TTS pronunciation dictionary per org ❌ · Mandatory audio preview before publish ❌ · Streamlined File→Video pipeline ❌ · 90-day TTL retention enforced ❌ · Per-tenant storage quota in settings ❌

**Current:** B · **Target:** A · **Priority:** Later — current implementation functional; polish + cost-control later.

---

## 5. Phased Roadmap (Visual)

### 🟢 v3.0 — Native SOP Builder (SHIPPED 2026-05-23)

Phases 11 / 12 / 12.5 / 13 / 14 / 14.5 / 15 + Phase 20 partial. See `.planning/MILESTONES.md` § v3.0.

---

### 🟡 v4.0 — Safety-Critical Parsing + Worker Accessibility + AI Foundation (NOW)

**Theme:** Three intertwined pulls. (1) Finish the safety-critical conversion pipeline that v3.0 left partial. (2) Make the worker experience usable for the blue-collar TAM (literacy, visual, voice). (3) Lay the AI-everywhere foundation (X-03 architectural backbone) so subsequent milestones build on it instead of retrofitting.

**Goal:** No worker on a NZ industrial site is excluded by literacy. No parsed SOP can be published without verified anchoring. AI read/write is plumbed through the underlying data model for every feature.

| Priority | Feature | Forward grade gap |
|---|---|---|
| Now | S-02 Side-by-side source viewer | F → A |
| Now | S-03 AI reviewer × 5 jobs | F → A |
| Now | S-04 Per-block verify checklist | F → A |
| Now | I-01 Word/PDF parsing (Phase 20 remainder) | D → A |
| Now | W-01 Walkthrough literacy/visual/voice | B → A |
| Now | X-02 Voice Q&A drives walkthrough + reads aloud | F → A |
| Now | X-03 Cmd+K + universal AI read/write field access | F → A |
| Now | X-06 Visual-only flow | F → A |
| Now | G-01 Version supersede + diff + worker-instance sign-off | F → A |
| Now | W-03 iOS storage eviction warning + last-sync timestamp | B → A |

---

### 🟠 v4.5 — Customer-Acquisition + Compliance + Visy Pilot Closeout (NEXT)

**Theme:** Turn the platform into something Visy can move 100 sites onto, and something prospective NZ industrial customers can self-serve into a paid tier. Compliance/legislation moves from afterthought to first-class product surface.

| Priority | Feature | Forward grade gap |
|---|---|---|
| Next | A-05 NZ Template Library | F → A |
| Next | **C-01 Legislation Library** | F → A |
| Next | **C-02 Per-SOP Legislation Links** | F → A |
| Next | **C-03 AI Legislation Scanner** | F → A |
| Next | G-02 Multi-step approval chain (optional, versioned) | F → A |
| Next | G-03 Review-due cadence + AI maintenance schedule | F → A |
| Next | G-04 Roles + stale-role surfacing | F → A |
| Next | G-05 Site-tier multi-tenancy (per-site dashboards + rollout) | F → A |
| Next | G-06 Training-record export + SuccessFactors target | D → A |
| Next | W-04 Kiosk mode + sequence-enforced walkthrough | B → A |
| Next | W-05 PIN/badge sign-off at shared workstations | B → A |
| Next | X-01 Full-text + synonym search + AI-managed taxonomy | C → A |
| Next | S-05 Pinned PPE icon strip | B → A |
| Next | P-04 CSP/HSTS hardening | F → A |
| Next | W-02 Voice-annotated photos + GPS-tagged capture | B → A |

---

### 🔵 v5.0 — Conversational App + Annotation + Telemetry (LATER)

**Theme:** App becomes primarily AI-steerable. Diagram annotation lands. Telemetry feeds the AI layer.

| Priority | Feature | Forward grade gap |
|---|---|---|
| Later | X-05 AI assistant as primary interface + layered architecture | F → A |
| Later | A-06 Konva image/diagram annotation | F → A |
| Later | A-03 AI draft learns house style + multimodal input + relational naming | F → A |
| Later | A-04 AI-suggested blocks | F → A |
| Later | A-01 Inline AI assistant in SOP Builder + collab + tablet | F → A |
| Later | S-01 Adversarial verifier learns from history | B → A |
| Later | C-04 Compliance audit trail | F → A |
| Later | W-06 Push notifications + email digest + quiet hours | C → B |
| Later | X-02 Multi-language voice support | (continued) |
| Later | X-03 (continued — recently-used actions, mobile alternative) | (continued) |
| Later | P-02 White-label splash/tab-colour per org | B → A |
| Later | P-05 Performance monitoring + LR-03 + full usage telemetry | F → B |
| Later | I-04 Industrial transcription accuracy + 1st/3rd person AI-narrated capture | F → A |
| Later | I-06 Streamlined File→Video + TTS pronunciation dictionaries | B → A |

---

### ⚪ Maybe / Speculative

| Feature | Why "Maybe" |
|---|---|
| A-07 Collaborative editing | No contention observed in single-admin pattern. |
| I-05 In-app video recording | iOS Safari MediaRecorder still unreliable. |
| I-02 advanced — multi-page stitching | Photo OCR usage low; revisit if frequency grows. |
| A-04 — Block usage analytics | Internal product instrumentation. |
| G-07 — Bulk CSV team import + SSO | Premium-tier; tie to pricing milestone. |
| P-01 — Per-customer encryption-at-rest | Enterprise sales requirement. |

---

### 🔴 Cut

| Feature | Why cut |
|---|---|
| ModelBlock (3D model embed) | Considered in Phase 12.5, dropped. Bundle weight + niche use. |
| Vimeo URL pathway | API scope never confirmed; YouTube + upload cover use case. |
| In-house OCR engine | tesseract.js + GPT-4o vision are sufficient. |

---

## 6. Partner Communication Index

One-line plain-English explanations for verbal use:

- **A-01 SOP Builder** — "Admins build SOPs in the browser by dragging blocks. AI assists inline."
- **A-03 AI draft** — "Admin types a sentence; AI writes the SOP."
- **A-05 Templates** — "Library of ready-to-clone NZ industry SOPs."
- **C-01 Legislation Library** — "Curated library of WorkSafe NZ + AS/NZS standards, kept current."
- **C-02 Per-SOP Legislation Links** — "Each SOP cites the regulations it satisfies; auditors export by regulation."
- **C-03 AI Legislation Scanner** — "AI scans every SOP and surfaces missing legislation references."
- **W-01 Walkthrough** — "Worker taps through one step at a time on their phone."
- **W-03 Offline** — "Works on a job site with no signal."
- **S-02 Source viewer** — "When reviewing a parsed SOP, admin sees the original side-by-side."
- **S-03 AI reviewer** — "Five AI quality checks run automatically on every parsed SOP."
- **S-04 Verify checklist** — "Admin must tick 'verified' on every block before publish."
- **G-01 Version history + sign-off** — "Every version is saved; every worker run is signed step-by-step."
- **G-02 Approval chain** — "SOPs route through configurable approvers; the chain is optional and per-version."
- **G-03 Maintenance schedule** — "AI helps plan which SOPs to create and which to update."
- **G-06 Training-record export** — "Completed SOPs become evidence; exports to SuccessFactors."
- **X-02 Voice Q&A** — "Worker asks the AI a hands-free question about the current SOP."
- **X-03 AI everywhere** — "Every field is AI-readable; most are AI-writable; goal is 99% AI-controllable."
- **X-05 AI assistant** — "Long-term: workers and admins talk to the AI; navigation becomes optional."
- **X-06 Visual flow** — "Workers with low literacy complete SOPs through pictures and icons only."
- **I-04 AI-narrated capture** — "Record yourself doing the job; AI watches and writes the SOP."
- **P-04 Security hardening** — "Modern security headers; no iframe embedding."
- **P-05 Telemetry** — "Full usage data feeds the AI layer for analysis and improvement."

---

## 7. Open Questions for Partners

- **TAM positioning:** Australian / NZ industrial (Visy-shape) only, or also trades-services SMB? SMB has different pricing and feature acceptance criteria.
- **Pricing tier definitions:** Enterprise (SuccessFactors, SSO, compliance audit), Pro (templates, approval chains, legislation library), Free (basic walkthrough)?
- **Customer-acquisition channel:** direct sales, partner-channel via NZ trade associations, or self-serve?
- **Compliance scope:** WorkSafe NZ general, AS/NZS 4801, ISO 45001? Cert-driven feature gaps differ from competitive-driven gaps.

---

## 8. Maintenance

This document is **generated** from `.planning/product-roadmap.data.json` (the canonical machine-readable source). Edit via `.planning/product-roadmap.html` in your browser, export JSON, and the next regeneration uses the JSON as the new base.

**Regeneration flow:**

1. Open `.planning/product-roadmap.html` in a browser
2. Review / edit / add features / mark reviewed / mark disputed
3. Click **Export JSON** — save the file
4. Hand the JSON back to Claude (or replace `.planning/product-roadmap.data.json` directly)
5. Claude regenerates this Markdown doc (and updates the HTML baseline if structural changes — new categories, criteria patterns)

**Evolution triggers:**

- Milestone completion → feature grades update, completed phases move to "shipped"
- Customer interview → new acceptance criteria added to relevant features
- Quarterly review → priorities re-shuffled based on actual customer signal

---

*Last updated 2026-05-24 — v0.2 (forward-looking grades, AI-everywhere distributed, Compliance & Legislation added, Simon's review pass merged).*
