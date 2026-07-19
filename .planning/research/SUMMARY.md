# Project Research Summary

> **Covers milestone v7.0 (Competency & Training Layer).** Supersedes the stale v2.0-era (video-pathways) SUMMARY.md that previously lived at this path — that content is preserved in git history if ever needed.

**Project:** SafeStart (SOPstart)
**Domain:** Competency/training-record layer added to an existing Next.js 16 + Supabase multi-tenant SOP PWA
**Researched:** 2026-07-19
**Confidence:** HIGH

## Executive Summary

v7.0 is not a new product surface — it's a read-model layer on data SafeStart already owns. Access grants (Phases 32-33) define who must know what; completions and the immutable sign-off chain (Phases 4/23) define what's been evidenced. The entire milestone reduces to: derive competency state from those two evidence streams, add one new append-only evidence table (`sop_observations`) for supervisor-witnessed competence, and expose it all as a training matrix + CSV export. No new npm dependencies, no new AI provider, no new cron mechanism — every piece extends a pattern already proven in production (governance queue's composed-read shape, the `synthesis-sweep` cron+bearer pattern, `cadences.ts` date math, the append-only evidence-table convention used three times already).

The recommended approach is deliberately conservative: **derive competency state at read time via a pure function** (mirroring `classifyGovernanceRow`) rather than storing it in a `competency_states` table with sync triggers. This sidesteps an entire class of bug this codebase has already been burned by twice (derived data going stale because a write path forgot to re-materialize it). The one genuinely new table, `sop_observations`, is independent of everything else and can ship first as a standalone win.

The dominant risk is not technical novelty — it's this codebase's own repeated incident class: cross-tenant service-role write holes (three prior incidents) and RLS cross-table recursion (two prior incidents). Every new write path in this milestone (`sop_observations` insert, matrix RPC, cadence upserts) sits exactly in that danger zone by construction (admin/supervisor-gated writes with no plausible authenticated RLS policy). The second-largest risk is a product/scope risk: it is easy to accidentally build a rigid 5-rung certification ladder, a quiz engine, or worker-facing access gating — all explicitly locked anti-goals — because they're the "obvious" next feature once competency data exists.

## Key Findings

### Recommended Stack

No new core technology or libraries. Training matrix rendering, competency states, observations, CSV export, and refresher scheduling are all data-modeling + UI-composition problems solved by infrastructure already in production: Postgres tables + RLS, Next.js Route Handlers, native `Response` for CSV, `src/lib/governance/cadences.ts` for date math, and Railway Cron + bearer-secret auth (copy `synthesis-sweep/route.ts` exactly). A department-scoped plain `<table>` handles the matrix at real scale (tens of workers x tens-to-~100 SOPs per view); virtualization (`@tanstack/react-virtual`) is a cheap later add, not a day-one need. A hand-rolled ~15-line RFC 4180 CSV writer beats adding `papaparse`/`csv-stringify` for a write-only, own-format export.

**Core technologies:**
- Postgres + Supabase RLS — new tables (`sop_observations`) and additive columns (`sops.document_code`, `sops.risk_priority`), same conventions as every prior migration
- Next.js Route Handlers + native `Response` — CSV export, no library
- `src/lib/governance/cadences.ts` (extended, not replaced) — refresher due-date math reuses existing UTC month-add functions with a different anchor date
- Railway Cron + `CRON_SECRET` bearer auth (copied pattern) — refresher sweep and AI maintenance schedule folded into the existing `synthesis-sweep` cron rather than a second endpoint

### Expected Features

**Must have (table stakes / P1 — v7.0 core slice):**
- Training matrix (people x required-SOPs x status, per-department/per-worker cuts) — the single audit artifact every stakeholder asks for
- Competency states (3-4: not started / read / supervised / competent) — makes the matrix status column meaningful beyond raw "completed"
- Supervisor observation records — tamper-evident evidence layer, directly fixes the #1 named customer pain point (fraudulent/shared sign-offs)
- Per-worker training record view + CSV export — near-free once matrix exists, is the honest MVP answer to the SuccessFactors integration ask
- Trained-on-outdated-version surfacing — cheap derived flag, closes an audit gap now visible because version supersede already exists

**Should have (P2, add after spine is proven):**
- Assessor capability governance (trainer must itself be signed off) — needs states/observations proven first, touches backlog role work (G-04)
- Refresher/recertification cadence + due-date surfacing — reuse Phase 28's governance-queue pattern
- AI-prioritized maintenance schedule (Phase 30 rollforward) — reuses existing AI adapter, no new infra
- AI-reviewer completeness rubric (LOTO-vs-E-stop check, quality outcomes, length flag) — 6th job on the existing reviewer orchestrator
- Document codes + register-style export, risk/priority triage — additive columns, orthogonal to the matrix/states/observations spine

**Defer (explicitly out of scope for v7.0, locked anti-goals):**
- Live SuccessFactors/HRIS API integration — CSV export only until a real customer is signed
- Formal quiz/assessment engine — supervisor observation substitutes for it; worse UX fit for a low-literacy, glove-handed workforce
- Rigid 5-rung competency ladder — adopt the guidance-notes' *spirit* (staged/observed/evidenced), not the letter
- Disciplinary/HR workflow tied to competency gaps — data is exportable, enforcement stays human
- Competency status gating worker read/walkthrough access — locked north star, never connect the two

### Architecture Approach

Everything hangs off two existing evidence streams joined by one new pure classifier function. `classifyCompetencyState()` (new, `src/lib/competency/classify.ts`) takes required-access + latest completion + latest sign-off + latest observation + version comparison, and returns a derived state — no stored `competency_states` table, no invalidation surface, computed live exactly like `classifyGovernanceRow`. `getTrainingMatrix()` mirrors `listGovernanceQueue()`'s shape: ~7 bulk reads via `Promise.all`, reduced in one `.map()` pass, never per-cell queries and never re-running the 5-tier grant resolution graph (read the already-materialized `sop_departments`/`sop_access_people` junctions instead).

**Major components:**
1. `sop_observations` table (new, append-only, RLS mirrors `completion_sign_offs`/`sop_completion_signatures`) — the one genuinely new source of truth; independent of everything else, ships first
2. `classifyCompetencyState()` pure function + `latest_completions_for_org` SECURITY DEFINER RPC (service-role only) — the load-bearing piece everything else consumes
3. `getTrainingMatrix()` composed read + UI — hosted as a third view mode on the existing `TeamViewShell` (`/admin/team`), not a new nav tab (Phase 30 already made the "fold in, don't grow nav" call)
4. Per-worker record + CSV export — drill-down from a roster row, reuses one `toCsv()` helper for both training records and the SOP register export
5. Refresher due-dates + AI maintenance schedule — extend `cadences.ts` and the existing `synthesis-sweep` cron, surfaced as a rollup chip on the SOP-level governance queue (`/admin/sops?view=attention`), not duplicated into person-level detail there

### Critical Pitfalls

1. **A fourth cross-org service-role write hole** — every new admin/supervisor-gated write (observations, matrix RPC, cadence upserts) has no plausible authenticated RLS policy and must self-derive `organisation_id` from session context on every role branch; this exact mistake has already shipped to prod three times in this codebase. Mitigate with a runtime cross-org rejection test per new write path, not just an existence test.
2. **RLS cross-table recursion on new tables** — any new SELECT policy that does `EXISTS (... from sops ...)` or `EXISTS (... from sop_completions ...)` risks `42P17`, which surfaces as a broad 500 on *unrelated* queries. Denormalize `organisation_id` onto every new table and use same-table/self-scoped policies, never cross-table joins in the policy body.
3. **Competency state anchored to the wrong `sop_id` after version supersede** — the versioning model creates a new row on republish; a naive FK makes "competent" state point at a dead row. Always resolve lineage root and store `sop_version` on the competency computation, with an explicit `trained_on_outdated_version` flag rather than a silent downgrade.
4. **Training matrix as an unbounded live cross-join or a third stale materialization layer** — read the already-materialized `sop_access_people`/`sop_departments` fanout directly, default-scope by department, never render all-people x all-SOPs unfiltered, and don't build a second derivation layer on top of the Phase 32/33 materialization pipeline.
5. **Feature-creep into locked anti-goals** — competency status gating worker access, a rigid certification ladder, a quiz engine, or a disciplinary workflow are all "obvious" next steps once the data exists, and all four are explicitly locked out. Treat every new competency-adjacent feature request against the north star before building.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Supervisor Observations (foundation, standalone)
**Rationale:** Zero dependencies on new work — pure append using a pattern already proven three times (`completion_sign_offs`, `sop_completion_signatures`, `sop_review_events`). Fast, low-risk, ships the RLS/append-only shape the rest of the milestone leans on, and directly fixes the #1 customer pain point independent of everything else.
**Delivers:** `sop_observations` table + `recordObservation` server action + "Log observation" UI on `/activity`.
**Addresses:** Supervisor observation records (table stakes)
**Avoids:** Pitfall 20 (RLS recursion) and Pitfall 21 (cross-org write hole) — get the append-only/org-scoped pattern right here since every later table copies it.

### Phase 2: Competency Classifier + Matrix Data Plumbing
**Rationale:** Load-bearing piece everything downstream consumes — must be correct once, not iterated on per-UI. Depends on Phase 1 (observations feed the classifier) plus already-shipped grants/completions.
**Delivers:** `classifyCompetencyState()` pure function, `latest_completions_for_org` locked-down RPC, bulk-read plumbing mirroring `listGovernanceQueue()`.
**Uses:** `src/lib/governance/classify.ts` pattern, `createAdminClient()` + `requireAdminContext()` conventions from STACK/ARCHITECTURE research.
**Implements:** Derived-not-stored competency state (Architecture component 2).

### Phase 3: Training Matrix UI + Per-Worker Record + CSV Export
**Rationale:** Both are just different groupings of the same evidence fetch from Phase 2 — can build in parallel once the classifier exists.
**Delivers:** Third view mode on `TeamViewShell` (`/admin/team`), per-worker drill-down route, CSV export action.
**Addresses:** Training matrix, per-worker training record view, CSV export (all table stakes)
**Avoids:** Pitfall 22 (unbounded cross-join) — department-scoped default view built in from the start.

### Phase 4: Refresher Cadence + Version-Currency Surfacing
**Rationale:** Needs Phase 2's "latest completion date" output plus the cadence-config trade-off decision made explicit (shared vs. split cadence table). Bundle with or immediately after Phase 3 since it's a rollup chip on top of the same data.
**Delivers:** Refresher due-date computation via extended `cadences.ts`, trained-on-outdated-version flag, rollup chip on `/admin/sops?view=attention`.
**Addresses:** Refresher/recertification cadence, trained-on-outdated-version surfacing
**Avoids:** Pitfall 19 (competency anchored to superseded SOP row).

### Phase 5: Assessor Capability Governance
**Rationale:** Needs competency states to exist as the mechanism ("is this supervisor competent-signed-off") — sequence after Phase 2-3, folds into backlog G-04 role work rather than a new gate mechanism.
**Delivers:** Trainer-must-be-signed-off check at observation/sign-off insert time.
**Addresses:** Assessor capability (should-have)

### Phase 6: Guidance-Notes Adoptions (parallel-safe filler)
**Rationale:** Fully independent of Phases 1-5 — additive columns and a 6th AI-reviewer job. Good parallel workstream, low risk.
**Delivers:** `sops.document_code`/`risk_priority` columns + register export, AI-reviewer completeness rubric (LOTO/E-stop check, quality outcomes, length flag).
**Addresses:** Document codes + register export, risk/priority triage, completeness rubric (all P2/P3)

### Phase 7: AI-Prioritized Maintenance Schedule
**Rationale:** Lowest urgency per north star (prioritization aid, not a blocker) and benefits from competency rollups existing (a "many workers overdue" signal is stronger once Phases 2-4 shipped). Extends the existing `synthesis-sweep` cron rather than adding a new endpoint.
**Delivers:** AI-scored priority sort on governance queue rows.
**Addresses:** AI-prioritized maintenance schedule (Phase 30 rollforward)

### Phase Ordering Rationale

- Observations-first because it's the only genuinely new table and has zero cross-feature dependencies — de-risks the RLS/service-role pattern before three more tables/RPCs copy it.
- Classifier before any UI because every surface (matrix, per-worker view, refresher chip, assessor gate) consumes its output — get the derived-state trade-off locked before building on top of it.
- Matrix UI and CSV export grouped together since architecture research explicitly calls them "different groupings of the same evidence fetch."
- Refresher cadence sequenced after the matrix because the cadence-config trade-off (shared vs. split table) should be decided with the matrix's per-worker data already visible, not speculatively.
- AI maintenance schedule last because it's explicitly the lowest-priority item per the locked north star (ease-of-use over process/analytics), and it's strictly enhanced by having competency data to score against.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (classifier + matrix plumbing):** the RPC lockdown pattern (SECURITY DEFINER + REVOKE/GRANT service_role) and the derived-vs-stored trade-off are subtle enough to warrant a focused plan-time review against the three prior cross-org incidents — treat as the highest-scrutiny phase.
- **Phase 4 (refresher cadence):** the cadence-config decision (share `sop_review_cadences` vs. split into a new `training_refresher_cadences` table) is a real design fork flagged but not resolved by research — needs an explicit call during planning, not silent default.

Phases with standard patterns (skip research-phase):
- **Phase 1 (observations):** copies an existing pattern (append-only evidence table) proven three times already — no new research needed.
- **Phase 3 (matrix UI/export):** extends `TeamViewShell`'s existing mode-toggle and reuses `listGovernanceQueue()`'s composed-read shape verbatim.
- **Phase 6 (guidance-notes adoptions):** additive columns + one more AI-reviewer job, same shape as prior reviewer jobs.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Verified directly against this repo's `package.json` and existing cron/cadence code — not a greenfield survey; conclusion is "nothing new needed," which is itself low-risk. |
| Features | MEDIUM | NZ-specific regulator detail (WorkSafe/ACC) is not machine-readable; synthesized from NZ H&S-vendor guidance and one strong primary source (Visy customer interview). SuccessFactors field-level mapping is MEDIUM (SAP docs partially blocked on fetch). |
| Architecture | HIGH | Every recommendation anchored to a specific existing file/table/pattern in this codebase, verified by direct source reads, not inference. |
| Pitfalls | HIGH | v7.0 pitfalls grounded directly in this codebase's own migration history and CLAUDE.md incident log (three prior cross-org holes, two prior RLS recursion incidents) — not generic training-software advice. |

**Overall confidence:** HIGH

### Gaps to Address

- SuccessFactors Learning History Connector exact field mapping is best-effort, not confirmed — validate against a real Visy export sample before treating the CSV shape as "integration-ready" (Feature research, differentiator section).
- Refresher-cadence config trade-off (shared vs. split cadence table) is explicitly unresolved — decide at Phase 4 planning time, not silently defaulted.
- Assessor-capability governance depends on backlog G-04 role work whose own scope isn't finalized — confirm G-04's shape before Phase 5 planning.

## Sources

### Primary (HIGH confidence)
- Direct repo inspection — `package.json`, `src/app/api/agent-layer/synthesis-sweep/route.ts`, `src/lib/supabase/middleware.ts`, `src/lib/governance/cadences.ts`, `src/actions/grants.ts`, `src/actions/completions.ts`, `src/actions/governance.ts`, `supabase/migrations/*` — confirmed no new dependency needed, confirmed all reusable patterns
- `.planning/PROJECT.md` — v7.0 milestone scope, locked north star and anti-goals, build-on list
- `CLAUDE.md` Learnings section — three prior cross-org service-role incidents, two prior RLS recursion incidents, materialization-staleness incidents directly informing Pitfalls 19-22

### Secondary (MEDIUM confidence)
- `.planning/research/customer-interviews/2026-05-05-visy-findings.md` — primary customer source, HIGH confidence for the interview itself, drives fraudulent-sign-off and SuccessFactors findings
- ACC WSMP audit-guideline pattern via tribalhabits.com NZ vendor guidance — evidence-layer structure (completion/competence/currency)
- SAP SuccessFactors Learning History Connector docs — partially blocked fetch, corroborated via support-KB snippets

### Tertiary (LOW confidence)
- Generic (non-NZ) manufacturing competency-matrix vendor content (AG5, SafetyCulture, Azumuta) — used only for state-model/matrix-usage conventions, not regulatory claims

---
*Research completed: 2026-07-19*
*Ready for roadmap: yes*
