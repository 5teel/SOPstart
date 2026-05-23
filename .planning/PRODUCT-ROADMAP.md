# SOPstart — Product Roadmap

**Owner:** Potenco Pty Ltd
**Status:** v0.1 working draft — 2026-05-23
**Purpose:** A single, partner-readable record of every feature SOPstart aspires to ship — both what's already on master and what we want to one day add. Each feature has bespoke acceptance criteria, a current grade, a target grade, and a priority tag. The grade tells us which existing features need overhaul; the priority tells us what to build next.

---

## 1. Executive Summary (for partner conversations)

SOPstart is a mobile-first workplace-safety app. Blue-collar tradespeople open an SOP on their phone and the app walks them through it step-by-step — with safety information always visible, photo evidence per step, and offline support for any job site without signal. Behind the worker view is a builder where SOP admins author procedures from scratch, draft them from a prompt, or upload existing documents and let AI structure them.

We are post-v3.0 (Native SOP Builder) and entering v4.0+ planning. The next twelve months will be defined by three pulls:

1. **Safety-critical content fidelity** — every photo, diagram, table, and step in a parsed SOP must be anchored to the correct context, verified by AI, and verifiable by the admin before publish. Workers should never act on misaligned information.
2. **Accessibility for the actual blue-collar worker** — today the app works for a tradesperson who can read English fluently. We will close that to the workers who can't. Visual-only flow, voice-driven walkthrough, AI assistant conversation as the primary interface.
3. **Customer-acquisition surface** — NZ industrial customers need to see "this is what a finished SOP looks like" before they upload anything. Templates, onboarding flow, and a polished public surface.

---

## 2. How to Read This Document

### Categories

Features are grouped into seven categories. A category groups how the team thinks about features, not how a worker uses them.

| Category | What lives here |
|---|---|
| **Authoring** | Anything an admin does to create / edit / manage SOPs |
| **Worker Experience** | What a worker sees on the floor — walkthrough, photo capture, offline |
| **Safety** | Guardrails — adversarial AI verification, per-block checklists, sign-off chains |
| **Admin & Governance** | Version control, approval workflows, role + site management, audit trails |
| **Accessibility** | Findability and assistive access — search, AI assistants, voice, command palette, notifications |
| **Platform** | Infrastructure — multi-tenancy, PWA shell, security, bundle hygiene |
| **Intake** | Bringing existing knowledge in — file parse, photo OCR, video transcription |

### Acceptance criteria

Each feature has its own bespoke list of yes/no acceptance criteria. Generic axes (Safety: pass/fail) flatten too much — a parse pipeline has different criteria than a tap-to-confirm widget. The criteria define what "good" looks like for THAT feature.

### Grade

| Grade | Meaning |
|---|---|
| **A** | Industry-leading. All criteria pass. Defensibly best-in-class. |
| **B** | Meets target. Most criteria pass; gaps are minor. Competitive. |
| **C** | Functional but rough. Works for tolerant users; would lose a side-by-side demo against a competitor. |
| **D** | Present but failing. Active complaint surface. Needs overhaul. |
| **F** | Missing entirely. |

### Target grade

What we want this feature to be once we're "done" with it. Not every feature needs to hit A — a back-office utility can sit at B forever; a worker-facing safety widget MUST be A.

### Priority

| Tag | Meaning |
|---|---|
| **Now** | Next milestone. We're building this. |
| **Next** | Milestone-after-next. Tentatively scheduled. |
| **Later** | Year-out horizon. On the radar. |
| **Maybe** | Speculative — needs customer signal before committing. |
| **Cut** | Considered and rejected. Logged so we don't re-debate. |

---

## 3. Feature Catalog

### 3.1 Authoring

#### A-01 — Native Block Builder (Puck)

**Plain English:** An admin opens a blank canvas in the browser and drags blocks (Step, Hazard, Tool, Decision, etc.) into the page to compose an SOP. No upload required.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | Admin can create an SOP from scratch with no source document |
| ✅ | Block palette covers the common SOP shapes (steps, hazards, PPE, tools, sign-off, photos, callouts, decision, measurement, escalate, voice note, inspect, zone) |
| ✅ | Drag-to-reorder works at the section level |
| ✅ | Dexie autosave keeps work safe if the tab closes |
| ✅ | Preview toggle shows worker-view without leaving the builder |
| ❌ | Two admins can edit the same SOP at the same time without overwriting each other (collaborative editing) |
| ❌ | Builder works on tablets and phones, not just desktops (currently desktop-optimized) |

**Current grade:** **B** · **Target:** **A** · **Priority:** **Later** (collab editing + tablet was Phases 17/18 — deferred)

#### A-02 — Blank-Page Wizard

**Plain English:** When an admin clicks "Start blank," a short wizard prompts them for the SOP's name, category, and a few key fields before opening the builder. Less daunting than an empty canvas.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | Wizard appears for first-time admins on the new-SOP flow |
| ✅ | Admin can pick the SOP's primary category tag (hazard cluster + area) |
| ✅ | Admin can pick blocks from the library during the wizard |
| ✅ | Wizard creates the SOP record + initial layout_data atomically |

**Current grade:** **A** · **Target:** **A** · **Priority:** Shipped

#### A-03 — AI-Drafted SOP from Prompt

**Plain English:** An admin types a short description ("scaffold inspection for warehouse mezzanine") and Claude drafts a structured SOP for them to review and edit.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | Admin enters a freeform prompt (20–2000 chars) and gets a structured draft |
| ✅ | Draft is verified by Claude adversarially before reaching the admin (catches missing PPE, unrealistic step times, dangerous omissions) |
| ✅ | Adversarial flags are surfaced inline in the builder, not hidden |
| ✅ | Admin can edit and republish; verifier re-runs on changes |
| ❌ | AI can draft based on a customer's existing fleet of SOPs to match house style |
| ❌ | AI accepts photos/diagrams alongside the prompt to anchor the draft to real equipment |

**Current grade:** **B** · **Target:** **A** · **Priority:** **Later** (house-style learning and multimodal input)

#### A-04 — Reusable Block Library

**Plain English:** Common SOP pieces (e.g. "Lockout-Tagout PPE list," "Crush-entrapment hazard card") are stored as reusable blocks. When the global library updates a block, every SOP that uses it gets a "review and accept" prompt — they don't break silently.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | Organisations can save their own blocks (org tier) and use Potenco-curated global blocks |
| ✅ | 65 NZ-industry seed blocks ship with the product |
| ✅ | An SOP using a global block can pin to a specific version or follow latest |
| ✅ | Global-block updates surface as a per-SOP review modal with diff |
| ✅ | Org admins can suggest new global blocks to Potenco for curation |
| ❌ | Block usage analytics — "which blocks are most reused" for product decisions |
| ❌ | Admin can clone an org block into the global library proposal queue with one click |

**Current grade:** **B** · **Target:** **A** · **Priority:** **Maybe** (analytics is internal; clone is small)

#### A-05 — NZ Template Library

**Plain English:** Pre-built complete SOPs for common NZ industrial scenarios (WorkSafe-aligned). An admin can clone a template and customise it, rather than starting blank.

**Acceptance criteria:**

| ❌ | Browseable catalog of complete SOP templates (not just blocks) |
| ❌ | Templates aligned to WorkSafe categories (machinery, chemical handling, manual handling, electrical) |
| ❌ | Templates available as a third entry point in the new-SOP flow (after AI / Blank / Upload) |
| ❌ | Clone-and-edit preserves attribution to the template + lets the curator push updates |
| ❌ | Industry-specific bundles (forestry, food processing, mining) at the front of the catalog |

**Current grade:** **F** · **Target:** **A** · **Priority:** **Next** (customer acquisition lift — was deferred Phase 16)

#### A-06 — Image & Diagram Annotation (Konva)

**Plain English:** Admin can upload a machine diagram or photo and add labelled hotspots ("This is the e-stop"), arrows, and freeform callouts that workers tap to see context.

**Acceptance criteria:**

| ❌ | Stylus + finger annotation editor (Konva-based) |
| ❌ | Dual storage: editable JSON scene + baked PNG for worker view |
| ❌ | Hotspots on diagrams that link to specific steps in the SOP |
| ❌ | Palm rejection on iPad / large Android tablets |
| ❌ | Workers see the baked image without needing the editor bundle |

**Current grade:** **F** · **Target:** **A** · **Priority:** **Later** (was deferred Phase 17)

#### A-07 — Collaborative Editing

**Plain English:** Two admins can work on the same SOP at the same time. The app shows who's editing what, prevents simultaneous edits to the same section, and handles offline reconciliation.

**Acceptance criteria:**

| ❌ | Section-level pessimistic locks (one editor per section at a time) |
| ❌ | Realtime presence indicators (who is in this SOP right now) |
| ❌ | Optimistic version column for offline-then-reconnect conflict detection |
| ❌ | Clear conflict modal when two admins fight over the same block |
| ❌ | "Updated by another admin" toast — soft warning before write |

**Current grade:** **F** · **Target:** **B** · **Priority:** **Maybe** (current single-admin pattern has not surfaced contention)

---

### 3.2 Worker Experience

#### W-01 — Step-by-Step Walkthrough

**Plain English:** A worker opens an SOP and the app guides them through one step at a time on their phone. They tap to confirm each step is done.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | Works on any modern phone browser, no install required |
| ✅ | Works offline once the SOP is downloaded |
| ✅ | Readable in bright outdoor light (paper/ink high-contrast theme) |
| ✅ | Tap targets ≥44px (glove-friendly) |
| ✅ | Photo capture per step |
| ✅ | Step acknowledgement trace captured for audit |
| ❌ | A worker with low literacy can complete the SOP (currently text-heavy) |
| ❌ | A worker can complete the SOP visually — diagrams, photos, no required reading |
| ❌ | A worker can complete the SOP entirely by voice — AI reads steps aloud, listens for "done," asks questions back |
| ❌ | Multi-language UI (Te Reo, Tagalog, Hindi, Mandarin common on NZ industrial sites) |

**Current grade:** **B** · **Target:** **A** · **Priority:** **Now** — literacy / visual / voice gaps are the blue-collar TAM blocker the Visy interview surfaced

#### W-02 — Photo Evidence Capture

**Plain English:** Worker takes a photo with their phone camera at any step. Photo is queued for upload, even offline, and arrives with the completion record.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | Camera fires from the step view (one tap to capture) |
| ✅ | Photos compress client-side before queueing |
| ✅ | Offline queue persists across tab close + device restart |
| ✅ | Auto-upload resumes when connectivity returns |
| ✅ | Per-step photo_required flag enforces capture before step can be marked complete |
| ❌ | Worker can add voice annotation to the photo (5-second clip + auto-transcription) |
| ❌ | Photo is auto-tagged with GPS + timestamp on capture (for outdoor / multi-site audits) |

**Current grade:** **B** · **Target:** **A** · **Priority:** **Next**

#### W-03 — Offline-First Reliability

**Plain English:** A worker on a construction site with no signal can still download SOPs in advance and use the app fully — read, photograph, complete sign-off — and everything syncs when they're back online.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | Service worker (Serwist) caches assets aggressively |
| ✅ | Dexie/IndexedDB stores all assigned SOPs locally |
| ✅ | Photo upload queue survives crash + restart |
| ✅ | Sync engine reconciles on reconnect without manual intervention |
| ✅ | Online/offline indicator visible at all times |
| ❌ | Explicit per-SOP "download for offline" UI with progress + storage usage |
| ❌ | iOS Safari storage eviction warning (PWA storage purges after ~7 days inactivity) |
| ❌ | Worker can see WHEN an SOP was last synced — so they don't act on stale revisions |

**Current grade:** **B** · **Target:** **A** · **Priority:** **Now** (the iOS eviction issue is a known incident risk)

#### W-04 — Immersive Walkthrough (Mobile)

**Plain English:** Optional full-screen mode for mobile workers. One step at a time, big text, swipe between steps, minimal chrome. Optimised for in-the-procedure focus.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | Full-bleed step rendering on mobile viewports |
| ✅ | Bottom action bar with primary action (Next / I've done this) |
| ✅ | Routes through the walkthrough/layout.tsx nested layout |
| ❌ | Kiosk mode lockdown — workstation tablet can't navigate away from the active SOP |
| ❌ | Sequence-enforced walkthrough — worker cannot skip a critical step |

**Current grade:** **B** · **Target:** **A** · **Priority:** **Next** (kiosk mode came from Visy interview)

#### W-05 — Completion & Sign-off

**Plain English:** When a worker finishes an SOP, the app captures a completion record (immutable, legally defensible) and routes it to a supervisor for sign-off.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | Completion records are append-only (no UPDATE/DELETE) |
| ✅ | Photo evidence attached to record |
| ✅ | Supervisor reviews and signs off (separate immutable record) |
| ✅ | Supervisor can reject with reason |
| ❌ | PIN / badge sign-off at a shared workstation (Visy interview pattern) |
| ❌ | Email / push notification to supervisor when worker submits |
| ❌ | Bulk supervisor sign-off for multiple SOPs at once |

**Current grade:** **B** · **Target:** **A** · **Priority:** **Next**

#### W-06 — Worker Notifications

**Plain English:** Worker receives a notification when a new SOP is assigned to them, when an SOP is updated, or when a supervisor responds to their submission.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | In-app notification badge on the SOPs tab |
| ✅ | New-assignment notification record created on assign |
| ❌ | Push notifications to mobile (requires PWA install + iOS 16.4+) |
| ❌ | Email digest of pending SOPs |
| ❌ | Worker can configure notification quiet hours (no pings during night shift) |

**Current grade:** **C** · **Target:** **B** · **Priority:** **Later**

---

### 3.3 Safety

#### S-01 — Adversarial AI Verifier (Phase 6 / 14)

**Plain English:** When AI generates an SOP from a prompt or transcript, a second AI (Claude) reads the result with a critical eye and flags missing safety information, unrealistic time estimates, vague PPE callouts, or dangerous omissions before the admin sees the draft.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | Verifier runs automatically on every AI-generated draft |
| ✅ | Flags surface inline in the builder (not in a hidden log) |
| ✅ | Each flag has severity (critical / warning / notice) |
| ✅ | Critical flags must be resolved or explicitly acknowledged before publish |
| ❌ | Verifier learns from admin accept/reject decisions over time (currently stateless per call) |
| ❌ | Verifier accepts the org's prior SOPs as ground-truth context for house-style |

**Current grade:** **B** · **Target:** **A** · **Priority:** **Later**

#### S-02 — Side-by-Side Source Viewer

**Plain English:** When an admin reviews an SOP parsed from a Word/PDF, the original document is pinned beside the parsed structure. They can scroll the source and the parsed blocks light up in sync — so the admin can verify nothing was misread.

**Acceptance criteria:**

| ❌ | Source PDF / DOCX / image rendered alongside parsed blocks |
| ❌ | Click a parsed block → source viewer scrolls to the exact passage that produced it |
| ❌ | Click a source region → parsed block highlights |
| ❌ | Source viewer is persistent throughout review, not modal |
| ❌ | Source viewer works for all supported intake formats (DOCX, PDF, image, video transcript) |

**Current grade:** **F** · **Target:** **A** · **Priority:** **Now** (Phase 20 remainder — load-bearing safety story for next milestone)

#### S-03 — AI Reviewer (Five Verification Jobs)

**Plain English:** Beyond the single adversarial verifier, the conversion pipeline runs five specialised AI jobs (omission check, anchoring check, photo-to-step alignment, table fidelity, terminology consistency) on every parsed SOP, both automatically and on admin demand.

**Acceptance criteria:**

| ❌ | Job A: Omission check — did we drop any safety-critical content from the source? |
| ❌ | Job B: Anchoring check — are photos/diagrams attached to the correct step? |
| ❌ | Job C: Step-image alignment — does each photo actually depict its anchored step? |
| ❌ | Job D: Table fidelity — were dosages, torque values, temperatures preserved exactly? |
| ❌ | Job E: Terminology consistency — does parsed language match the org's existing SOP vocabulary? |
| ❌ | All five jobs auto-run on first parse |
| ❌ | Admin can re-run any job manually after editing |
| ❌ | Cost per parse bounded with prompt-caching + per-org spend cap |

**Current grade:** **F** · **Target:** **A** · **Priority:** **Now** (Phase 20 remainder)

#### S-04 — Per-Block Verify Checklist at Publish Gate

**Plain English:** Before an admin can publish an SOP, they must walk through every block and tick "I have verified this matches the source." The publish button is hard-disabled until every block is signed off.

**Acceptance criteria:**

| ❌ | Every block in a draft carries a "verified by" boolean |
| ❌ | Publish button hard-disabled until 100% block verification |
| ❌ | Verification timestamps + admin user_id stored for audit |
| ❌ | Re-edits to a block require re-verification of THAT block, not the whole SOP |
| ❌ | Bulk-verify is NOT offered — speed-bump is the feature |
| ❌ | UI guides eye-flow such that admin actually reads each block (not just clicks through) |

**Current grade:** **F** · **Target:** **A** · **Priority:** **Now** (Phase 20 remainder)

#### S-05 — Safety Reminders Always Visible

**Plain English:** Hazards, PPE, and emergency information for the current step never scroll off the worker's screen — they're persistent regardless of where the worker is in the walkthrough.

**Acceptance criteria:**

| ✅ | Hazards/PPE rendered as persistent callout blocks (not buried in section content) |
| ✅ | Block severity colour-coded (critical / warning / notice) |
| ❌ | Critical PPE icons pinned to a fixed strip visible across all steps in a section |
| ❌ | Worker can re-acknowledge hazards at any time without restarting walkthrough |

**Current grade:** **B** · **Target:** **A** · **Priority:** **Next**

---

### 3.4 Admin & Governance

#### G-01 — Version History

**Plain English:** Every SOP keeps a record of every published version. Admins can compare versions, view who changed what when, and recover an old version if a change was wrong.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | Every publish creates a new version row |
| ✅ | Old versions are preserved, not overwritten |
| ✅ | Admin can view a version history list for any SOP |
| ❌ | An SOP can be edited to a new version with the old version explicitly deprecated and saved in history (formal supersede flow) |
| ❌ | Side-by-side diff between any two versions |
| ❌ | Restore an old version as the active one with one click |
| ❌ | Workers see a "this SOP was updated since you last completed it" indicator |

**Current grade:** **C** · **Target:** **A** · **Priority:** **Now** (formal supersede + diff are partner-requested)

#### G-02 — Multi-Step Approval Chain

**Plain English:** Before an SOP is published to workers, it routes through a configurable approval chain — e.g. Safety Manager reviews first, then Operations Manager, then Discipline Leader.

**Acceptance criteria:**

| ❌ | Org admin can configure an approval chain per SOP category |
| ❌ | SOPs sit in "awaiting approval" state with role-based visibility for the next approver |
| ❌ | Approval / rejection at each step is logged immutably |
| ❌ | Rejection routes back to the author with a reason field |
| ❌ | Bypass-on-emergency option for safety managers (logged) |

**Current grade:** **F** · **Target:** **A** · **Priority:** **Next** (Visy governance gap)

#### G-03 — Review-Due Cadence

**Plain English:** Every SOP has a periodic review date (annual, or category-specific). The system prompts the SOP owner to review before the date lapses and flags SOPs that are overdue.

**Acceptance criteria:**

| ❌ | Per-SOP review_due_at field |
| ❌ | Default cadence per category (chemical handling 6 months, machinery 12, etc.) |
| ❌ | Dashboard widget for admins shows SOPs due / overdue |
| ❌ | Email digest to SOP owners at T-30, T-7, and overdue |
| ❌ | Overdue SOPs flagged in the worker view ("This SOP is overdue for review") |

**Current grade:** **F** · **Target:** **A** · **Priority:** **Next**

#### G-04 — Role-Based Access (Worker, Supervisor, Admin, Safety Manager, Discipline Leader)

**Plain English:** Each user has a role that determines what they can see and do. Discipline Leader is a senior expert who owns SOPs for a specific discipline (electrical, mechanical, etc.).

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | Worker, Supervisor, Admin, Safety Manager roles defined |
| ✅ | Role-based RLS enforced server-side, not just UI |
| ✅ | Role can be assigned per organisation member |
| ❌ | Discipline Leader role (Phase 15 scope, partial) — owns SOPs for a discipline |
| ❌ | Trade-level granularity within roles (electrical-supervisor vs mechanical-supervisor) |

**Current grade:** **B** · **Target:** **A** · **Priority:** **Next**

#### G-05 — Site-Tier Multi-Tenancy (Org → Site → SOP)

**Plain English:** A multi-site customer (e.g. Visy with ~100 sites) can scope SOPs to one or more sites within their org, and route assignments / approvals to site-local staff.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | Site entity exists in the data model (Phase 15) |
| ✅ | Sub-trade tags routed via RLS (Phase 15 migration 00030) |
| ❌ | Per-site dashboards for site managers |
| ❌ | Per-site SOP rollout (publish to site A but not site B) |
| ❌ | Per-site sign-off chains |

**Current grade:** **C** · **Target:** **A** · **Priority:** **Next** (Visy is the named customer here)

#### G-06 — Training-Record Export

**Plain English:** Completed SOPs become evidence in a worker's training record. The org can export these records — for audits, for migration into HR systems (SAP SuccessFactors is the target integration).

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | Completion records carry timestamp + worker_id + photo_evidence_url |
| ❌ | CSV / Excel export of all completion records for a date range |
| ❌ | Per-worker training record view (every SOP completed, dated, signed off) |
| ❌ | SAP SuccessFactors integration target — push completion events as training-completed records |
| ❌ | Export filterable by site, role, SOP category, date range |

**Current grade:** **C** · **Target:** **A** · **Priority:** **Next** (Visy interview surfaced SuccessFactors)

#### G-07 — Team & Invite Management

**Plain English:** Org admin can invite workers via email or shareable invite code, assign roles, view active members, and revoke access.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | Email invite flow with role pre-assigned |
| ✅ | Shareable invite code with role pre-assigned |
| ✅ | Active members list with role |
| ❌ | Bulk CSV import of team members |
| ❌ | SSO / SAML for enterprise customers |
| ❌ | Deactivate (without delete) for departed workers — preserves their completion history |

**Current grade:** **B** · **Target:** **A** · **Priority:** **Later**

---

### 3.5 Accessibility (findability + assistive access)

#### X-01 — SOP Search

**Plain English:** Worker types a few words ("scaffold," "manual handling," "electrical isolation") and finds the relevant SOP instantly.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | Worker-facing search input on the SOPs tab |
| ✅ | Search matches title + category tag |
| ❌ | Search matches step / hazard content (full-text) |
| ❌ | Search matches synonyms / common misspellings ("forklift" finds "FLT," "MHE") |
| ❌ | Search works offline against locally-cached SOPs |
| ❌ | Recently-used SOPs surface first on empty search |

**Current grade:** **C** · **Target:** **A** · **Priority:** **Next**

#### X-02 — AI Voice Q&A on an SOP

**Plain English:** A worker has a hands-free question about the current SOP ("how tight should this bolt be?" "what PPE for the next step?"). They tap a button, ask in plain English, and the AI answers grounded only to that SOP's content.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | Voice button on the walkthrough view |
| ✅ | Answers strictly grounded to the active SOP (no hallucination from other SOPs) |
| ✅ | Answer includes citations to specific steps / blocks |
| ✅ | Verifier flags uncertainty rather than guessing |
| ✅ | Per-user concurrency cap to bound cost |
| ❌ | Voice input transcribed reliably with industrial-floor noise |
| ❌ | Answer is read back aloud (full-audio loop) |
| ❌ | Voice Q&A drives step progression — "I've done step 4, what's next" advances walkthrough |
| ❌ | Multi-language voice support |

**Current grade:** **B** · **Target:** **A** · **Priority:** **Now** (voice-driven flow is part of W-01's literacy story)

#### X-03 — Cmd+K Command Palette

**Plain English:** Power users (mostly admins) press Cmd+K and jump to anything — an SOP by name, a team member, a setting, an admin action — without navigating menus.

**Acceptance criteria:**

| ✅ | Cmd+K opens a global command palette |
| ✅ | Search across SOPs |
| ❌ | Search across admin pages, team members, settings |
| ❌ | Recently-used actions surface first |
| ❌ | Mobile alternative (swipe / long-press primary nav) |

**Current grade:** **C** · **Target:** **B** · **Priority:** **Later**

#### X-04 — Global Header Navigation

**Plain English:** Every page in the app has a header with the SOPstart logo, the user's primary navigation links, and a profile menu — so workers and admins always know where they are and can jump to anywhere.

**Acceptance criteria:**

| ✅ | Persistent top header on every protected route |
| ✅ | Role-aware navigation (worker sees worker links, admin sees admin links) |
| ✅ | SOPstart brand mark + wordmark on the left |
| ✅ | Profile menu with sign-out |
| ✅ | Mobile collapses center nav into a hamburger drawer |
| ✅ | Bundle cost of header is bounded by CI gate (≤ +2 KB drift) |

**Current grade:** **A** · **Target:** **A** · **Priority:** Shipped 2026-05-22

#### X-05 — AI Assistant as Primary Interface (long-term)

**Plain English:** A worker doesn't navigate — they ask the AI to do things. "Show me the lockout SOP." "Mark step 4 as done." "Take a photo of the panel." The whole app is steerable by voice + conversation.

**Acceptance criteria:**

| ❌ | AI accepts natural-language commands across all primary actions (open SOP, mark step, capture photo) |
| ❌ | Wake-word or single-tap activation |
| ❌ | Conversation is multi-turn (AI asks clarifying questions back) |
| ❌ | AI works fully offline for cached SOPs (no roundtrip to LLM) |
| ❌ | AI surfaces its own confidence — refuses to act if certainty is low |

**Current grade:** **F** · **Target:** **A** · **Priority:** **Later** (vision target — depends on X-02 maturing first)

#### X-06 — Visual-Only Flow

**Plain English:** A worker with low literacy can complete an SOP relying entirely on photos, diagrams, and icons — no required reading.

**Acceptance criteria:**

| ❌ | Every step can carry a primary photo / diagram that anchors the action |
| ❌ | Standardised icons for hazards, PPE, tools (workers learn the icon set, not the words) |
| ❌ | Visual progress indicator (5 of 12 steps done, no English text) |
| ❌ | "Show me" affordance on every step that opens the photo / diagram full-screen |
| ❌ | Visual-only audit trail — supervisor can review completion via photos, not text |

**Current grade:** **F** · **Target:** **A** · **Priority:** **Now** (load-bearing for blue-collar TAM)

---

### 3.6 Platform

#### P-01 — Multi-Tenant RLS

**Plain English:** Every customer's data is fully isolated from every other customer's data. No cross-tenant leakage is possible even with a code bug — the database itself refuses to return another org's rows.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | Supabase RLS policies on every customer-data table |
| ✅ | JWT custom claims carry org_id; RLS reads from JWT |
| ✅ | Cross-tenant isolation seed test in Playwright suite |
| ✅ | SECURITY DEFINER helpers for legitimate cross-policy checks (avoid recursion) |
| ❌ | Per-customer encryption-at-rest with org-scoped keys |
| ❌ | Audit log of every cross-tenant boundary the admin client crosses |

**Current grade:** **A** · **Target:** **A** · **Priority:** Shipped (Phase 1)

#### P-02 — PWA Shell

**Plain English:** The app installs to the worker's phone like a native app (add-to-home-screen), works offline, and looks like a normal app icon rather than a browser tab.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | Web App Manifest with name, icons (192/512), maskable + any purposes |
| ✅ | Service worker (Serwist) registered and caching |
| ✅ | Installable on iOS Safari + Android Chrome |
| ✅ | Online/offline status banner |
| ✅ | Brand-consistent icons across favicon + apple-touch + PWA |
| ❌ | "Open in Safari" / "Open in Chrome" prompts to ensure install path |
| ❌ | Splash-screen + tab-color customisation per organisation (white-label) |

**Current grade:** **B** · **Target:** **A** · **Priority:** **Later**

#### P-03 — Bundle Isolation CI Gate

**Plain English:** Every code change is checked against the worker's bundle size. New admin features cannot bloat what workers download.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | `check-bundle-size.ts` runs in postbuild on every build |
| ✅ | Baseline locked in `.bundle-baseline.json` with documented drift rationale |
| ✅ | ±2 KB tolerance per route |
| ✅ | Chunk-existence assertions prove dynamic imports stay out-of-band |
| ❌ | CI workflow blocks merge on bundle-gate failure (currently postbuild warning only) |
| ❌ | Per-PR bundle delta report posted to the PR conversation |

**Current grade:** **B** · **Target:** **A** · **Priority:** **Later**

#### P-04 — Security Hardening (CSP, HSTS, frame-ancestors)

**Plain English:** The app sends modern HTTP security headers (Content-Security-Policy, HSTS, frame-ancestors) so it can't be embedded in a malicious iframe or hijacked via injected scripts.

**Acceptance criteria:**

| ❌ | CSP with explicit allowlists for Supabase, Anthropic, Railway |
| ❌ | HSTS with max-age=31536000, includeSubDomains, preload |
| ❌ | frame-ancestors 'self' (or 'none') |
| ❌ | X-Content-Type-Options nosniff + Referrer-Policy strict-origin-when-cross-origin |
| ❌ | Permissions-Policy locking down sensors/payment/serial |

**Current grade:** **F** · **Target:** **A** · **Priority:** **Next** (carried from backlog 999.3)

#### P-05 — Performance Monitoring

**Plain English:** When something is slow or broken on a customer's site, we see it in dashboards immediately — without waiting for a support ticket.

**Acceptance criteria:**

| ❌ | Frontend error tracking (Sentry or equivalent) |
| ❌ | Web Vitals capture (LCP, FID, CLS) per route, per org |
| ❌ | Backend trace capture for parse pipeline runs (timing per step) |
| ❌ | Async error surfacing (`after()` errors not silently swallowed — LR-03 debt from v2.0) |
| ❌ | Per-org rate-limit dashboards (AI spend, photo upload volume) |

**Current grade:** **F** · **Target:** **B** · **Priority:** **Later**

---

### 3.7 Intake

#### I-01 — Word / PDF Document Parsing

**Plain English:** Admin uploads an existing Word doc or PDF SOP; the app parses it into structured sections (hazards, PPE, steps, emergency), runs OCR for scans, and presents the result for review.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | DOCX text + image extraction (mammoth) |
| ✅ | PDF text + image extraction (unpdf) |
| ✅ | OCR fallback for scanned PDFs (tesseract.js) |
| ✅ | GPT-4o structured parsing with section labels |
| ✅ | Async pipeline (parse_jobs table; >30s LLM tasks supported) |
| ✅ | Realtime + polling hybrid for parse status |
| ✅ | DOCX images anchored to steps by table-row containment (not stream proximity) |
| ✅ | Parsed drafts land as Puck layout_data in the builder (Phase 20 partial) |
| ❌ | Photos / diagrams / charts / tables extracted with step-level provenance (Phase 20 full) |
| ❌ | Per-block verify checklist at publish gate (Phase 20 — see S-04) |
| ❌ | Side-by-side source viewer (Phase 20 — see S-02) |
| ❌ | AI reviewer × 5 jobs (Phase 20 — see S-03) |

**Current grade:** **C** · **Target:** **A** · **Priority:** **Now** (Phase 20 remainder is the highest-value safety story)

#### I-02 — Image / Photo OCR

**Plain English:** Admin uploads a phone photo of a paper SOP. The app extracts the text via OCR and routes it through the parsing pipeline.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | JPG / PNG accepted as upload |
| ✅ | GPT-4o vision used as primary OCR (better accuracy than tesseract for SOPs) |
| ✅ | Pre-flight Laplacian-blur check warns admin on bad scans |
| ❌ | Multi-page photo scan with per-page review |
| ❌ | "Hold camera steady" guidance during capture (real-time blur feedback) |
| ❌ | Auto-stitching of photographed multi-page documents |

**Current grade:** **B** · **Target:** **A** · **Priority:** **Later**

#### I-03 — Excel / PowerPoint / Text Parsing

**Plain English:** Admin uploads xlsx, pptx, or plain text — these are routed through the same parse pipeline as DOCX and PDF.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | xlsx, pptx, txt accepted as upload |
| ✅ | officeparser handles xlsx + pptx |
| ✅ | Macro-enabled formats (.xlsm, .pptm) rejected at validation |
| ❌ | Excel tables with merged cells / multi-row headers parsed correctly |
| ❌ | PowerPoint speaker notes incorporated into parsed step text |

**Current grade:** **B** · **Target:** **B** · **Priority:** **Later** (uncommon SOP source formats)

#### I-04 — Video Transcription (Upload + YouTube)

**Plain English:** Admin uploads an MP4 / MOV or pastes a YouTube URL of a training video. The app transcribes it and structures the transcript into an SOP draft.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | MP4 / MOV upload (TUS for large files) |
| ✅ | YouTube URL via caption API (no scraping / DMCA risk) |
| ✅ | Transcript review surface with admin edits |
| ✅ | Transcript-to-SOP structuring through GPT-4o |
| ✅ | Adversarial verifier on the result |
| ❌ | Factory-floor transcription accuracy on NZ-accented speakers (~75-85% — needs domain vocabulary prompt) |
| ❌ | Vimeo URL pathway (deferred — API scope unconfirmed) |
| ❌ | Mid-video diagram / whiteboard frames extracted as step photos |

**Current grade:** **B** · **Target:** **A** · **Priority:** **Later** (transcription quality is the gap)

#### I-05 — In-App Video Recording

**Plain English:** Admin presses record in the browser, films a procedure on their phone or laptop, and the app transcribes the recording into an SOP draft on the spot.

**Acceptance criteria:**

| ❌ | In-browser camera recording (MediaRecorder API) |
| ❌ | iOS Safari fallback (file-upload picker) |
| ❌ | Live transcription preview while recording |
| ❌ | Auto-detection of step boundaries from pauses / "next" cues |

**Current grade:** **F** · **Target:** **B** · **Priority:** **Maybe** (blocked on iOS Safari MediaRecorder maturity)

#### I-06 — Video SOP Generation

**Plain English:** Admin clicks "Generate video SOP" on a published SOP and the app produces a narrated video version — for orgs that prefer to train via video.

**Acceptance criteria:**

| ✓ | Criterion |
|---|---|
| ✅ | Narrated slideshow format |
| ✅ | Screen-recording-style format (for software SOPs) |
| ✅ | AI-generated video format (Shotstack) |
| ✅ | Multiple video versions per SOP with labels |
| ❌ | TTS pronunciation dictionary per org (NZ place names, industrial terms) |
| ❌ | Mandatory audio preview before publish |
| ❌ | Streamlined File→Video pipeline (Phase 9 — partial code on master) |
| ❌ | Retention policy (90-day TTL) actually enforced |
| ❌ | Per-tenant storage quota visible in settings |

**Current grade:** **B** · **Target:** **A** · **Priority:** **Later** (current implementation is functional; polish + cost-control later)

---

## 4. Phased Roadmap (Visual)

Each phase is a milestone-shaped chunk of work. Priorities are the planning view; phase grouping is the execution view.

### 🟢 v3.0 — Native SOP Builder (SHIPPED 2026-05-23)

| Theme | Features delivered |
|---|---|
| Authoring | A-01 (Builder), A-02 (Blank-page wizard), A-03 (AI draft), A-04 (Block library) |
| Worker Experience | W-04 (Immersive mobile), partial W-01 enhancements |
| Safety | S-01 (Adversarial verifier — Phase 14) |
| Admin & Governance | G-04 (Roles incl. Discipline Leader partial), G-05 (Site tier) |
| Accessibility | X-01 (Search basics), X-02 (Voice Q&A on SOP), X-03 (Cmd+K basics), X-04 (Global header) |
| Intake | I-01 partial (DOCX→builder), I-02 (Photo OCR via vision), I-03 (xlsx/pptx) |

---

### 🟡 v4.0 — Safety-Critical Parsing + Worker Accessibility (NEXT)

**Theme:** Finish the safety-critical conversion pipeline AND make the worker experience usable for the blue-collar TAM (low-literacy / visual-only / voice-only flows). Two pulls, one milestone — because they share the same underlying block model.

**Goal:** No worker on a NZ industrial site is excluded by literacy, and no parsed SOP can be published without verified anchoring.

| # | Priority | Feature | Current → Target |
|---|---|---|---|
| 1 | Now | S-02 — Side-by-side source viewer | F → A |
| 2 | Now | S-03 — AI reviewer × 5 verification jobs | F → A |
| 3 | Now | S-04 — Per-block verify checklist at publish gate | F → A |
| 4 | Now | I-01 — Word/PDF parsing (rest of Phase 20 contract) | C → A |
| 5 | Now | W-01 — Walkthrough literacy/visual/voice gaps | B → A |
| 6 | Now | X-02 — Voice Q&A drives walkthrough + reads aloud | B → A |
| 7 | Now | X-06 — Visual-only flow | F → A |
| 8 | Now | G-01 — Version supersede + diff | C → A |
| 9 | Now | W-03 — iOS storage eviction warning + last-sync timestamp | B → A |

**Out of scope for v4.0:** anything in v4.5+ below.

---

### 🟠 v4.5 — Customer-Acquisition + Visy Pilot Closeout (NEXT-AFTER-NEXT)

**Theme:** Turn the platform into something Visy can move 100 sites onto, and something prospective NZ industrial customers can self-serve into a paid tier.

| # | Priority | Feature | Current → Target |
|---|---|---|---|
| 1 | Next | A-05 — NZ Template Library | F → A |
| 2 | Next | G-02 — Multi-step approval chain | F → A |
| 3 | Next | G-03 — Review-due cadence | F → A |
| 4 | Next | G-06 — Training-record export + SuccessFactors target | C → A |
| 5 | Next | G-05 — Per-site rollout + per-site dashboards | C → A |
| 6 | Next | W-04 — Kiosk mode + sequence-enforced walkthrough | B → A |
| 7 | Next | W-05 — PIN/badge sign-off at shared workstations | B → A |
| 8 | Next | X-01 — Full-text + synonym search, offline-capable | C → A |
| 9 | Next | S-05 — Pinned PPE icon strip | B → A |
| 10 | Next | P-04 — CSP/HSTS hardening | F → A |
| 11 | Next | W-02 — Voice-annotated photos + GPS-tagged capture | B → A |
| 12 | Next | G-04 — Trade-level role granularity | B → A |

---

### 🔵 v5.0 — Conversational App (LATER)

**Theme:** The app stops being something you navigate and starts being something you talk to.

| # | Priority | Feature | Current → Target |
|---|---|---|---|
| 1 | Later | X-05 — AI assistant as primary interface | F → A |
| 2 | Later | A-06 — Image & diagram annotation (Konva) | F → A |
| 3 | Later | A-03 — AI draft learns house style + accepts multimodal input | B → A |
| 4 | Later | S-01 — Adversarial verifier learns from history + org context | B → A |
| 5 | Later | W-06 — Push notifications + email digest | C → B |
| 6 | Later | X-02 — Multi-language voice support | B → A |
| 7 | Later | X-03 — Cmd+K everywhere + recent-actions ranking | C → B |
| 8 | Later | P-02 — White-label splash/tab colour per org | B → A |
| 9 | Later | P-05 — Performance monitoring + LR-03 async errors | F → B |
| 10 | Later | I-04 — Industrial-floor transcription accuracy | B → A |
| 11 | Later | I-06 — Streamlined File→Video + TTS pronunciation dictionaries | B → A |

---

### ⚪ Maybe / Speculative

Features we've considered but won't commit to without customer signal. Logged so we don't re-debate them.

| Feature | Why it's "Maybe" |
|---|---|
| A-07 — Collaborative editing | No contention observed in single-admin pattern. Wait for first complaint. |
| I-05 — In-app video recording | iOS Safari MediaRecorder still unreliable. Defer until Apple ships. |
| I-03 advanced — Excel multi-row headers | Uncommon SOP source format. |
| G-07 — Bulk CSV team import + SSO | Premium-tier feature; tie to pricing milestone. |
| A-04 — Block usage analytics | Internal product instrumentation; not customer-facing. |
| P-01 — Per-customer encryption-at-rest | Enterprise sales requirement; tie to first enterprise deal. |

---

### 🔴 Cut

Features explicitly rejected. Documented so we don't re-debate.

| Feature | Why cut |
|---|---|
| ModelBlock (3D model embed in SOP step) | Considered in Phase 12.5, dropped. Adds bundle weight + UX complexity for niche use. |
| Vimeo URL pathway | API scope never confirmed; YouTube + upload cover the use case. |
| In-house OCR engine | tesseract.js + GPT-4o vision are sufficient. No advantage in rolling our own. |

---

## 5. Partner Communication Index

**One-line explanations** keyed to the codes above — for verbal use with partners.

- **A-01 Builder** — "Admins build SOPs in the browser by dragging blocks."
- **A-03 AI draft** — "Admin types a sentence; AI writes the SOP."
- **A-05 Templates** — "Library of ready-to-clone NZ industry SOPs."
- **W-01 Walkthrough** — "Worker taps through one step at a time on their phone."
- **W-03 Offline** — "Works on a job site with no signal."
- **S-02 Source viewer** — "When reviewing a parsed SOP, admin sees the original side-by-side."
- **S-03 AI reviewer** — "Five AI quality checks run automatically on every parsed SOP."
- **S-04 Verify checklist** — "Admin must tick 'verified' on every block before publish."
- **G-01 Version history** — "Every published version is saved; old versions never disappear."
- **G-02 Approval chain** — "SOPs route through configurable approvers before workers see them."
- **G-06 Training-record export** — "Completed SOPs become evidence in a worker's training record; exports to SuccessFactors."
- **X-02 Voice Q&A** — "Worker can ask the AI a question about the current SOP, hands-free."
- **X-06 Visual flow** — "Workers with low literacy complete SOPs through pictures and icons only."
- **X-05 AI assistant** — "Long-term: workers don't navigate, they talk to the AI."
- **P-04 Security hardening** — "Modern security headers — CSP, HSTS, no iframe embedding."

---

## 6. Open Questions for Partners

- **TAM positioning:** are we selling primarily into Australian / NZ industrial (Visy-shape), or also into trades-services SMB (electricians, plumbers, scaffolders)? The SMB segment has different acceptance criteria — pricing, branding, support tier.
- **Pricing tier definitions:** which features sit above which paywall? Enterprise (SuccessFactors integration), Pro (templates + approval chains), Free (basic walkthrough)?
- **Customer-acquisition channel:** is the primary channel direct sales to safety managers, partner-channel via NZ trade associations, or self-serve signup?
- **Compliance scope:** which certifications do we want — WorkSafe NZ general, AS/NZS 4801, ISO 45001? Cert-driven feature gaps are different from competitive-driven ones.

---

## 7. Maintenance

This document is the single source of truth for SOPstart's product roadmap. It evolves on:

- **Milestone completion** — feature grades update, completed phases move to "shipped," next milestone block becomes "v(X+1).0"
- **Customer interview** — new acceptance criteria added to relevant features
- **Quarterly review** — priorities re-shuffled based on actual customer signal

The previous milestone-by-milestone roadmap (`.planning/ROADMAP.md`) remains the execution document. This document is the strategic document.

---

*Last updated 2026-05-23 — Simon Scott + Claude*
