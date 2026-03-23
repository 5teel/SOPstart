# Project Research Summary

**Project:** SOP Assistant
**Domain:** Multi-tenant SaaS PWA — industrial SOP management with AI document parsing
**Researched:** 2026-03-23
**Confidence:** HIGH

## Executive Summary

SOP Assistant is a multi-tenant SaaS progressive web app that ingests existing Word and PDF procedure documents, uses AI to parse them into structured, mobile-native procedures, and delivers them to industrial field workers via an offline-first PWA optimised for gloved-hand use. The market gap is real and uncontested: SafetyCulture, Dozuki, and MaintainX all require manual procedure authoring, whereas every industrial organisation already has 50–500 SOPs as legacy documents. The core value proposition is eliminating the digitisation barrier through AI parsing, not building a better procedure editor. This distinction must drive every prioritisation decision — the product is a document-ingestion and execution tool, not an authoring tool.

The recommended approach is Next.js 16 (App Router) + Supabase (auth, RLS, storage, realtime) + GPT-4o structured outputs for parsing, with Dexie.js + TanStack Query providing the offline-first data layer. This stack was verified against live npm registries on 2026-03-23 and is a high-confidence, coherent set of choices. Supabase's JWT-embedded tenant context + PostgreSQL RLS is the multi-tenancy mechanism — it must be implemented from the first migration, not retrofitted. The service worker layer (@serwist/next) handles PWA caching and must treat the Background Sync API as unreliable on iOS; instead, the app syncs on the online event and TanStack Query reconnect.

The two existential risks are: (1) the AI parser silently producing wrong or misordered SOP steps — mitigated only by requiring every parsed document to pass an admin review gate before it can ever be seen by workers; and (2) multi-tenant data leakage — mitigated by RLS as defence-in-depth combined with mandatory application-layer tenant_id filtering and an automated two-tenant cross-access test on every release. Both risks must be addressed in Phase 1, before any worker-facing feature is built.

---

## Key Findings

### Recommended Stack

The stack forms a coherent, mutually-reinforcing whole. Supabase replaces four separate services (auth, database, file storage, realtime) with a single BaaS, which is the appropriate choice for a v1 SaaS product. Next.js App Router with Server Actions handles file uploads and AI calls server-side without requiring a separate API service. The offline layer (Dexie + @serwist/next + TanStack Query `offlineFirst`) is the most complex part of the stack, and all three libraries must be used together — they are not independently interchangeable.

**Core technologies:**
- **Next.js 16 (App Router):** Full-stack framework + PWA host — Server Components reduce payload on slow industrial WiFi; Turbopack default in v16
- **Supabase:** Single BaaS covering auth, multi-tenant RLS, Postgres, file storage — eliminates auth, ORM, and file server services
- **GPT-4o + OpenAI SDK 6.x (Structured Outputs):** AI document parsing with 100% schema reliability via JSON Schema response_format
- **Dexie.js 4.x:** IndexedDB abstraction for offline SOP and completion storage — required for offline-first worker model
- **@serwist/next 9.5.7:** Service worker + PWA (maintained Workbox fork) — replaces abandoned next-pwa
- **TanStack Query 5.x (offlineFirst mode):** Server state with IndexedDB persistence across page reloads
- **mammoth + unpdf:** .docx and PDF text/image extraction feeding the parsing pipeline
- **Zod 4.x:** Central schema definition used simultaneously in OpenAI response_format, API validation, and form validation
- **sharp:** Server-side photo compression before Supabase Storage — prevents 5–10 MB evidence photos breaking offline sync quotas

**Critical version constraints:** @serwist/next@9.x requires Next.js 15+; @hookform/resolvers@5.x required for Zod v4; do not use shadowwalker/next-pwa (abandoned), pdf-parse (unmaintained), next-auth (JWT conflict with Supabase), or Prisma (serverless pooler incompatibility).

### Expected Features

AI parsing of legacy Word/PDF documents is the keystone feature — it is both the core differentiator and the highest-risk technical dependency. If parsing quality is low, no other feature has value. Every other feature in the product depends on the parsed SOP content being correct.

**Must have for launch (v1):**
- Document upload + AI parsing with confidence scoring and admin review queue — blocks all other content
- Structured SOP display (hazards, PPE, steps, emergency sections as native mobile UI, not PDF display)
- Step-by-step walkthrough mode — primary worker experience, must work offline
- Quick reference mode (tabbed: Safety / PPE / Steps / Emergency) — safety-critical, no competitor offers this
- Offline caching of assigned SOPs — non-negotiable for factory floors
- SOP library with full-text search — workers need to find SOPs quickly
- Photo capture tied to specific walkthrough step — standard in the market
- Completion tracking with server-side timestamp — supervisor visibility + audit foundation
- Supervisor sign-off (single-role) — digitises existing competency sign-off
- Role-based access (Worker / Supervisor / Admin)
- Multi-tenant organisation management — cannot be retrofitted
- SOP assignment to roles — workers see relevant SOPs first
- Image/figure rendering within steps — parsed SOPs without figures are incomplete

**Should have after v1 validation (v1.x):**
- SOP versioning with worker re-acknowledgement
- Worker notification on SOP updates (tightly coupled to versioning)
- Competency assessment multi-role sign-off chain (extends single sign-off)
- Audit report export (PDF/CSV)
- Bulk CSV user import

**Defer to v2+:**
- SSO / SCIM integration (enterprise; high cost)
- Acknowledgement tracking / read receipts (requires versioning + notifications stable first)
- Analytics dashboard (requires completion data volume)
- Skills matrix / training assignment
- IoT / sensor integration
- Multi-language support

**Do not build:** In-app SOP authoring, real-time chat, video step content, AI-generated SOP creation from scratch, conditional branching logic, public SOP marketplace.

### Architecture Approach

The architecture has four layers: a PWA client with role-specific views, an offline-first data layer (IndexedDB + service worker + sync queue), a server API layer with tenant context middleware, and an async document parsing pipeline decoupled from the HTTP request cycle. The critical constraint is that the offline layer must be designed as write-local-first from day one — retrofitting offline onto a server-write-first model is effectively a full rewrite. The document parsing pipeline must be asynchronous (job queue pattern), because LLM parsing takes 30–120 seconds and HTTP requests time out at 30 seconds.

**Major components:**
1. **Offline-First Data Layer (Dexie + Service Worker + Sync Queue)** — workers read from IndexedDB always; writes go to IndexedDB first, flush to API on reconnect
2. **Tenant Context Middleware** — extracts tenant_id from JWT, sets Postgres session variable before every query; RLS policies enforce isolation as last line of defence
3. **Async Document Parsing Pipeline** — upload → job queue → text/image extraction → GPT-4o structured output → confidence scoring → admin draft → publish
4. **Completion FSM** — not_started → in_progress → pending_sign_off → signed_off / rejected; completion records are append-only, never mutable
5. **SOP Normalised Data Model** — sops → sop_sections → sop_steps with explicit type fields; images as foreign-keyed records pointing to object storage; never store content as a blob

**Build order the architecture dictates:** Data layer + RLS → Auth + tenant context → SOP data model + API → Parsing pipeline → Worker mobile UI + offline layer → Completion tracking → Sign-off workflow → Assignment + RBAC enforcement.

### Critical Pitfalls

1. **AI parser silently produces wrong SOP steps** — Never auto-publish. Every parse is a draft. Build a structured diff view (original alongside parsed output). Confidence scoring per section. Block SOP activation until all low-confidence flags are cleared by an admin. Store original documents permanently — they are the source of truth, not the extraction.

2. **Multi-tenant data leakage** — RLS is defence-in-depth, not the only control. Explicit tenant_id filter in every application query. Cache keys must include tenant_id namespace. Background jobs must carry tenant_id in their payload explicitly. Automated two-tenant cross-access test on every release.

3. **Stale SOP version served after safety update** — SOP version integer on every record. Worker client diffs cached version numbers against server manifest on every sync. Force-update banner for safety-flagged SOPs. Never cache SOP data via HTTP headers (use the app's own sync layer). Implement skipWaiting() with a UI prompt.

4. **iOS Safari destroys offline data and camera state** — Apple evicts PWA storage after ~7 days inactivity. Surface explicit "Download for offline use" per SOP with a readiness indicator. Always fallback from getUserMedia to `<input type="file" capture="environment">` for camera. Document iOS limitations in admin onboarding.

5. **Glove-hostile UI kills worker adoption** — Primary actions (Next, Complete, Photo) must be 72×72px minimum, in the bottom third of the screen, one-handed reachable. Full-screen card interface for walkthrough — no navbar during procedure execution. Validate on real gloved hardware on a mid-range Android before any user testing. No modals or confirmation dialogs in the primary flow.

6. **Completion records not legally defensible** — Completion records are append-only (no UPDATE/DELETE). On completion, snapshot: SOP version number, content hash, worker user ID, server-side timestamp, photo evidence references. Supervisor sign-off creates a second immutable record. Never hard-delete SOP versions.

7. **Photo storage bloats IndexedDB and crashes the app** — Compress client-side before IndexedDB write (Canvas resize to 1200px, ~200KB target). Store Blobs as unindexed fields only. Implement upload queue that flushes on reconnect. Monitor via navigator.storage.estimate().

---

## Implications for Roadmap

Based on the combined research — particularly the feature dependency graph, the architecture build order, and the pitfall-to-phase mapping — a 6-phase structure is appropriate.

### Phase 1: Foundation — Data Model, Auth, Multi-Tenancy

**Rationale:** Everything depends on this. The multi-tenant RLS model cannot be retrofitted; if tenant isolation is built incorrectly in Phase 1, every subsequent phase inherits the flaw. Auth + JWT claims must be working before any data endpoint can be built safely. The FEATURES.md dependency graph shows multi-tenant isolation as "underlies all features."
**Delivers:** Postgres schema with RLS policies, organisations/users/roles tables, Supabase Auth with JWT custom claims (tenant_id + role), withTenantContext DB wrapper, automated cross-tenant isolation test.
**Addresses:** Multi-tenant data isolation (table stakes), role-based access control foundation.
**Avoids:** Pitfall 4 (multi-tenant data leakage) — must be addressed here, not during a later sprint.

### Phase 2: SOP Data Model and Document Parsing Pipeline

**Rationale:** The SOP data model is the central content model all worker and admin features depend on. The parsing pipeline is the core product differentiator and the highest-risk technical component — risk must be resolved before worker features are built on top of it. Using test fixture SOPs, the mobile UI can begin development in parallel against a stable schema.
**Delivers:** sops / sop_sections / sop_steps / sop_images normalised schema; document upload flow (presigned URL → object storage); async job queue (parse jobs table); GPT-4o structured output parser with mammoth + unpdf extraction; per-section confidence scoring; admin review UI (diff view: original vs. parsed); SOP publish workflow (draft → admin_review → published).
**Addresses:** Document upload + AI parsing (P1 table stakes), admin review queue (P1 differentiator), structured section data model.
**Avoids:** Pitfall 1 (AI parser produces wrong steps) — admin review gate and confidence scoring must ship here; Pitfall AP1 (synchronous parsing) — async pipeline from the start.

### Phase 3: Worker Mobile UI and Offline-First Layer

**Rationale:** The worker experience is the primary value delivery for end users. The offline layer must be designed before completion tracking — if completion records are server-write-first and offline is bolted on later, it is a rewrite. The FEATURES.md dependency graph shows offline caching and the SOP data model as prerequisites to the walkthrough.
**Delivers:** PWA shell (@serwist/next + Tailwind design system with 72px+ touch targets); IndexedDB schema (Dexie — SOPs, steps, completion states, photo queue); SOP sync engine (version diff → fetch stale → cache images); SOP library with full-text search; step-by-step walkthrough (full-screen card interface, glove-friendly); quick reference mode (tabbed Safety / PPE / Steps / Emergency); offline status indicator; per-SOP cache readiness indicator.
**Addresses:** Step-by-step walkthrough (P1), quick reference mode (P1 differentiator), offline caching (P1), SOP library + search (P1), structured section rendering (P1 differentiator), glove-friendly UX (P1 differentiator).
**Avoids:** Pitfall 3 (iOS storage eviction), Pitfall 5 (glove-hostile UI), Pitfall AP3 (online-required writes), Performance trap (pre-caching entire library on install).
**Research flag:** Needs `/gsd:research-phase` — offline sync engine details, iOS-specific PWA behaviours, and Dexie + TanStack Query integration patterns have enough platform-specific edge cases to warrant targeted research before implementation.

### Phase 4: Completion Tracking, Photo Evidence, and Sign-off

**Rationale:** Completion tracking requires the offline layer (Phase 3) and the SOP data model (Phase 2) to be stable. Photo evidence and supervisor sign-off build on completion records. The FSM (not_started → in_progress → pending_sign_off → signed_off) must be designed before the first completion record is written — retrofitting the state machine later requires a data migration.
**Delivers:** Completion FSM with append-only records; step completion recording (offline-first via sync queue); photo capture tied to specific step (camera fallback for iOS); server-side timestamp on sync; SOP version hash snapshotted at completion time; photo compression + upload queue (Canvas resize, Dexie queue, flush on reconnect); supervisor sign-off UI; push notification to supervisor on pending sign-off; completion status visible to supervisors.
**Addresses:** Photo capture (P1), completion tracking (P1), supervisor sign-off (P1), image rendering in steps (P1).
**Avoids:** Pitfall 6 (completion records not legally defensible), Pitfall 7 (photo storage bloats IndexedDB), Pitfall 8 (offline sync conflict blindness — append-only + idempotency keys), Security mistake (completion records deletable by admins).

### Phase 5: SOP Assignment, Versioning, and Notifications

**Rationale:** SOP assignment to roles can be layered on after the core walkthrough loop is validated. Versioning and worker notifications are tightly coupled — building them together is more efficient than two separate sprints. Versioning is a P2 feature per the prioritisation matrix but is a prerequisite for acknowledgement tracking (v2) and competency chains (v1.x).
**Delivers:** SOP assignment to roles/workers (admin UI); worker sees only assigned SOPs first; SOP versioning (version integer, history retained, re-acknowledgement required); worker in-app notification on SOP update (force-update banner for safety-flagged SOPs); bulk CSV user import; audit report export (PDF/CSV).
**Addresses:** SOP assignment (P1), SOP versioning (P2), worker notification on updates (P2), audit report export (P2), bulk CSV user import (P2).
**Avoids:** Pitfall 2 (stale SOP version served after safety update).

### Phase 6: Competency Assessment and Compliance Enhancements

**Rationale:** Multi-role sign-off chain extends the single-role supervisor sign-off built in Phase 4. It is a P2 differentiator that requires single sign-off to be stable first. Acknowledgement tracking (read receipts) requires versioning + notifications (Phase 5) to be stable. These features target the compliance buyer persona and are appropriate once early adopters validate the core parsing + walkthrough loop.
**Delivers:** Multi-role competency sign-off chain (worker completes → trainer observes → verifier confirms → manager reviews); acknowledgement tracking with exportable audit trail; competency records linked to specific SOP version.
**Addresses:** Competency assessment multi-role sign-off (P2 differentiator), acknowledgement tracking (P2).
**Avoids:** Building multi-role sign-off before single sign-off is validated in production.

---

### Phase Ordering Rationale

- **Phases 1 → 2 are strictly sequential** because the data model and auth must exist before any feature can be safely built.
- **Phases 2 → 3 can partially overlap** — worker UI development can begin against fixture SOPs while the parsing pipeline is being refined.
- **Phase 4 depends on Phase 3** because the offline write queue must exist before completion records can be written.
- **Phase 5 depends on Phase 2 (versioning requires the SOP model) and Phase 3 (assignment requires the worker view).**
- **Phase 6 depends on Phase 4 (single sign-off must work first) and Phase 5 (versioning must be stable for acknowledgement tracking).**

### Research Flags

Phases likely needing `/gsd:research-phase` during planning:

- **Phase 2 (Document Parsing Pipeline):** GPT-4o structured outputs with variable-quality legacy document inputs, confidence scoring strategies, and the Supabase Edge Function vs. Vercel job runner trade-off for async parsing jobs — needs targeted research before implementation planning.
- **Phase 3 (Offline-First Layer):** iOS-specific PWA storage eviction behaviour, Dexie + TanStack Query + @serwist/next integration patterns, and Background Sync API limitations on iOS — complex enough that dedicated research before sprint planning is warranted.
- **Phase 4 (Offline Sync Conflict Resolution):** Append-only completion log + idempotency key design and the specific Supabase Realtime reconnect + TanStack Query refetchOnReconnect integration — worth verifying against current library APIs before designing the sync engine.

Phases with well-documented patterns (can skip research-phase):

- **Phase 1 (Foundation):** Supabase RLS + JWT custom claims multi-tenancy is a documented, high-confidence pattern. Standard implementation, no research needed.
- **Phase 5 (Versioning + Notifications):** SOP versioning and push notification patterns are well-established. No novel integration required.
- **Phase 6 (Competency Assessment):** Extends the sign-off FSM built in Phase 4 using the same patterns. Standard CRUD + workflow state machine.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified against live npm registry 2026-03-23. Official docs consulted for Supabase RLS, Serwist, OpenAI Structured Outputs, TanStack Query network modes. |
| Features | HIGH | Competitor analysis across SafetyCulture, Dozuki, MaintainX, Fabrico. Multiple industry sources on field worker mobile app adoption patterns. Market gap clearly identified. |
| Architecture | HIGH | Core patterns (RLS multi-tenancy, offline-first write queue, async parsing pipeline, completion FSM) drawn from official docs and multiple authoritative architectural sources. |
| Pitfalls | HIGH | Pitfalls drawn from documented production incidents, official platform limitation docs (Apple WebKit, MDN), peer-reviewed AI hallucination benchmarks, and community incident post-mortems. |

**Overall confidence:** HIGH

### Gaps to Address

- **Document parsing quality on real customer legacy SOPs:** Research used described patterns and benchmarks, not actual samples from the target customer base. First customer pilot SOPs should be tested against the parser before Phase 2 is declared complete. Identify 10 real-world .docx and .pdf SOPs from a friendly industrial contact early.
- **Job queue infrastructure for v1:** The architecture recommends async parsing via a job queue, but the specific job queue implementation (Supabase Edge Function triggered by Storage events vs. a separate BullMQ worker process on Vercel) was not resolved in research. This trade-off needs a decision at the start of Phase 2 planning.
- **Push notification delivery on iOS PWA:** Web Push on iOS requires the PWA to be added to the home screen and iOS 16.4+. Worker adoption rate for home screen installation needs to be considered in the Phase 5 notification design — in-app polling fallback may be necessary for workers who do not install the PWA.
- **Printing / PDF export of completion records:** Some regulated industries require a signed PDF completion artefact. This was flagged in PITFALLS.md but not sized. Defer to Phase 6 or treat as a v2 feature pending customer demand signal.

---

## Sources

### Primary (HIGH confidence)

- npm registry (live 2026-03-23) — all package versions verified
- [Next.js 16 release blog](https://nextjs.org/blog/next-16) — Turbopack stable, App Router
- [Supabase RLS docs](https://supabase.com/docs/guides/database/postgres/row-level-security) — multi-tenant isolation patterns
- [Supabase Custom Claims RBAC docs](https://supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac) — JWT claims for roles
- [Serwist Next.js docs](https://serwist.pages.dev/docs/next/getting-started) — service worker integration
- [OpenAI Structured Outputs docs](https://platform.openai.com/docs/guides/structured-outputs) — JSON Schema response format reliability
- [MDN: Offline and background operation (PWA)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) — Background Sync browser support
- [TanStack Query network mode docs](https://tanstack.com/query/v4/docs/react/guides/network-mode) — offlineFirst mode
- [From hallucinations to hazards — ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0925753525002814) — LLM hallucination rates on safety-critical content
- [PWA iOS limitations — MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide) — iOS storage eviction behaviour
- [IndexedDB max storage limit — RxDB](https://rxdb.info/articles/indexeddb-max-storage-limit.html) — photo bloat risk
- [Building offline-friendly image upload — Smashing Magazine](https://www.smashingmagazine.com/2025/04/building-offline-friendly-image-upload-system/)
- [Multi-tenant data isolation with PostgreSQL RLS — AWS](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)

### Secondary (MEDIUM confidence)

- [SafetyCulture SOP Software](https://safetyculture.com/apps/sop-software) — competitor feature analysis
- [Dozuki Platform Features](https://www.dozuki.com/features) — competitor feature analysis
- [MaintainX blog](https://www.getmaintainx.com/blog/standard-operating-procedure-program) — competitor and pitfall analysis
- [Fabrico — Best SOP Software for Manufacturing 2026](https://www.fabrico.io/blog/best-sop-software-manufacturing/) — competitor landscape
- [The CTO Club — Best Connected Worker Platforms 2026](https://thectoclub.com/tools/best-connected-worker-platforms/)
- [AntStack multi-tenant RLS guide](https://www.antstack.com/blog/multi-tenant-applications-with-rls-on-supabase-postgress/) — organization_id + JWT claims pattern
- [Supabase multi-tenancy discussion](https://github.com/orgs/supabase/discussions/1615) — RLS performance patterns
- [OrcaLean — Why operators struggle with SOP compliance](https://www.orcalean.com/article/why-u.s.-operators-struggle-with-sop-complianceand-how-to-fix-it-digitally)
- [EHS Careers — Mobile safety app features used by field workers](https://ehscareers.com/employer-blog/mobile-safety-apps-which-features-actually-get-used-by-field-workers/)

### Tertiary (LOW confidence)

- [PkgPulse — unpdf vs pdf-parse vs pdfjs-dist comparison 2026](https://www.pkgpulse.com/blog/unpdf-vs-pdf-parse-vs-pdfjs-dist-pdf-parsing-extraction-nodejs-2026) — community source; consistent with npm download data

---

*Research completed: 2026-03-23*
*Ready for roadmap: yes*
