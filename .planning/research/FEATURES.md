# Feature Research

**Domain:** Competency management / training-matrix layer for an industrial SOP PWA (AU/NZ manufacturing, blue-collar workforce)
**Researched:** 2026-07-19
**Confidence:** MEDIUM — NZ-specific regulator text (WorkSafe/ACC) is not published as a machine-readable checklist; findings are synthesized from ACC's Workplace Safety Management Practices (WSMP) audit-guideline pattern, NZ H&S-software vendor guidance (tribalhabits.com, NZ-focused), and generic manufacturing competency-matrix practice, cross-checked against the Visy interview (primary source, AU/NZ 100-site manufacturer). SAP SuccessFactors field-level detail is MEDIUM (help.sap.com fetch was blocked by JS rendering; corroborated via SAP support-KB snippets instead of the full connector doc).

> Supersedes the prior FEATURES.md (2026-03-29, v2.0 SOP-creation-pathways research). That research is stale and not needed for this milestone; see git history if it's needed for reference.

## Feature Landscape

### Table Stakes (Users Expect These)

Auditors and site managers ask for one artifact first: "who is required to know X, and what's their status." Everything here exists to answer that in under a minute.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Training matrix (people × required-SOPs × status grid) | This is THE audit artifact — ACC/WorkSafe auditors and site managers ask "who is compliant for X right now" and "what's overdue." A folder of PDFs or a spreadsheet is the status quo it replaces. | MEDIUM | Pure read-model: join existing access grants (Phase 32-33 = "required") to completions/sign-offs (Phase 4/23 = "evidenced"). No new source-of-truth table needed for the base grid — only the competency-state column is new data. |
| Per-worker training record view | "Show me one worker's full training history" is a standard audit question (tribalhabits NZ guidance, ACC WSMP pattern). Visy explicitly wants this ("this SOP thing will form a sort of training record for new employees" [00:32:34]). | LOW | Already scoped as Phase 31 rollforward (TRN-01). Filter the matrix by one worker; reuse completions + sign-off chain data. |
| CSV export of training records | Every NZ H&S-software audit guide and the Visy interview converge on "exportable" as the baseline evidence format — auditors want to take the record away, not just view it on-screen. | LOW | Flat file: worker, role, site/dept, SOP + doc code, version, completion date, assessor, status. This is also the de facto SuccessFactors import shape (see Differentiators). |
| Competency state per person-per-SOP (3-4 states) | "Completed" alone isn't enough for higher-risk tasks — ACC WSMP audit guidance explicitly separates "proof of completion" from "proof of competence." Binary complete/incomplete undersells what the org actually needs to defend. | MEDIUM | New data: a state column per (worker, SOP) beyond raw completion rows. Keep it to 3-4 states (not-started / read / supervised-in-progress / competent-signed-off) — do NOT import the guidance notes' rigid 5-rung NYC-ladder (locked decision, see Anti-Features). |
| Supervisor observation record ("watched X do Y — consistent / needs reset") | ACC WSMP's "practical demonstration" / "signed evidence of achievement" evidence class requires more than a worker ticking a walkthrough — someone else has to have watched them. Also the direct fix for Visy's #1 pain point: fraudulent/shared sign-offs (a supervisor's own record can't be shared). | MEDIUM | New table: supervisor_id, worker_id, sop_id, verdict, optional note, timestamp. 30-second capture — must not become a form. Feeds the matrix as evidence, not as a gate. |
| Refresher/recertification due-date surfacing | NZ H&S guidance frames refreshers as risk-tiered (12/24/36 months) with reminder windows (30/14/7 days). WorkSafe's "suitable and adequate training" duty is an ongoing, not one-time, obligation — a record with no expiry can't demonstrate currency. | LOW-MEDIUM | Reuses Phase 28's governance-queue due/overdue pattern (already built for SOP review cadence) — apply the same pattern to per-worker-per-SOP refresher dates instead of building a second cadence engine. |
| Trained-on-outdated-version surfacing | When an SOP supersedes, workers trained on the old version are no longer evidence of current competency — auditors specifically ask "what version were they trained on, and is that still current" (tribalhabits: "version control so you can show what someone was trained on at the time"). SafeStart already has version supersede (Phase 23) so this gap is now visible and cheap to close. | LOW | Compare completion's `sop_version` to the SOP's current published version; flag on the matrix and in governance queue. No new capture — pure derived state. |

### Differentiators (Competitive Advantage)

Where SafeStart can win over a bolt-on LMS or a spreadsheet, by leaning on data it already uniquely has (grants = who-must-know, immutable sign-off chain = tamper-evident evidence).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Matrix derived from access grants, not manually maintained | Most competency-matrix tools (AG5, Qualmark-style, spreadsheets) require someone to manually populate "who needs what." SafeStart already knows this from Phase 32-33 grants — the matrix is nearly free and never drifts out of sync with actual assignments. | LOW (given Phase 32-33 exists) | This is the actual moat vs. generic training-matrix SaaS: zero double-entry. |
| Export shaped for SuccessFactors import (not a live API) | Visy's explicit ask is Success Factors integration, but a live HRIS API is out of scope by decision. SuccessFactors' own "Learning History Connector" ingests external completions via a flat file (employee ID, course/item ID, completion date, completion status pass/fail/incomplete, score) — so a well-shaped CSV with those columns IS effectively "integration" from the customer's perspective, at a fraction of the build cost. | LOW | Map SafeStart's export columns (worker external-ID field, SOP doc-code as course-ID, completion date, status, assessor) 1:1 to the connector's expected shape. Confirm exact field names with a real Visy SuccessFactors export sample when the deal progresses — treat current mapping as best-effort, not guaranteed-compatible. |
| AI-prioritized maintenance schedule (staleness + usage + flags → review queue) | Turns governance from reactive ("someone remembered to check") to proactive — reuses the existing AI adapter (Phase 26.5/27) and governance queue (Phase 28) rather than building a new scheduling engine. Differentiator because most competency tools require a human to run the prioritization manually. | MEDIUM | Already scoped (v6.0 Phase 30 rollforward). Inputs: SOP staleness (review-due age), usage (completion volume), AI-reviewer flag count. |
| Assessor-governance ("who may sign off is itself governed") | Directly answers ACC WSMP's "signed evidence of achievement by competent people" — an org can prove not just that a worker was assessed, but that the assessor was themselves qualified to assess. Rare in competency tools, which usually treat "supervisor" as a fixed role rather than a competency itself. | MEDIUM | Fold into Phase 25/28 role work — a supervisor's own competency-signed-off state on a "trainer" capability (or per relevant SOP) gates whether their observation counts as assessor-grade evidence. Keep minimal: a flag, not a parallel certification system. |
| Document-code + register-style export (999.5) | Real NZ/AU industrial orgs navigate SOPs by document code (e.g. `ENF4-03-031`, matches Visy's own example SOP and the Raw SOPs corpus), not by title. A register export (code, title, version, status, issue date, change history) is the exact shape ISO/audit reviewers expect — and ties the training matrix's "SOP" column to something auditors already recognize. | LOW-MEDIUM | Add a `document_code` field to SOPs; export is a formatted view of existing library + version data, not new tracking. |
| Risk/priority rating for SOP triage (999.6) | Orgs with 50-500 SOPs currently treat all uploads/verifications as equal priority. A lightweight risk rating (manual or AI-suggested from parsed hazard density) lets an admin/governance queue sort "digitize the ones that can kill someone first" — directly serves the ACC/WorkSafe liability narrative Visy leads with ("millions... jail time"). | LOW-MEDIUM | AI-suggested from existing hazard-parsing output (no new extraction pipeline) with manual override. |
| AI-reviewer completeness rubric (hazards/controls/LOTO, named "E-stops ≠ isolation" check, quality outcomes, too-long flag) (999.4) | Extends the existing AI reviewer (Phase 21) rather than building a new one — cheapest of the guidance-notes adoptions. Makes SOPs better training modules by construction, which is the actual point of a competency layer (garbage SOP in = garbage competency evidence out). | LOW (extends existing job) | Builds on `job-b-omission` which already checks lockout — add named LOTO-vs-E-stop distinction, quality-outcome check, and a length/complexity flag. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Rigid 5-rung competency ladder (guidance-notes' NYC→Competent choreography) | The safety-org guidance notes this milestone draws on prescribe a formal staged ladder (e.g. Not Yet Competent → various intermediate rungs → Competent), and it's tempting to copy it 1:1 as "the proper way." | Over-choreographs a blue-collar workforce that the north star explicitly protects from friction; more states = more admin data-entry burden, more stale/inconsistent data, no evidence Visy or similar orgs actually track 5 distinct states in practice (they don't even own SOPs today — Visy: "I can't give you one person that's in charge of SOPs" [00:52:23]). | 3-4 minimal states (not started / read / supervised / competent-signed-off) — adopt the *spirit* (staged, observed, evidenced) not the letter (rigid rung count). Already the locked decision in PROJECT.md. |
| Competency status gating worker's read/walkthrough access | Feels like "obviously we should stop an unqualified worker from even opening the SOP" — a natural extension of an access-control mindset. | Directly violates the north star: "a worker's read/walkthrough access is never gated by competency status." A worker who's genuinely unsure NEEDS to be able to open the SOP and read it (that's the whole product); gating it turns a training tool into a lockout tool and creates exactly the "I can't get in, I'll just wing it" shortcut-taking Visy already flagged as a top pain point [00:22:09]. | Competency state is a read-only overlay on top of unrestricted access — surfaced to supervisors/admins in the matrix, never enforced against the worker's own UI. |
| Disciplinary workflow (write-ups, escalation, HR case tracking) tied to competency gaps | Natural next step once you have "who's non-compliant" data — looks like a small addition. | Explicit anti-goal (locked in PROJECT.md): "records exportable, enforcement stays human." Productizing discipline turns SafeStart into a surveillance/HR tool, which contradicts Visy's own stated sensitivity ("I don't want to sell the worker out" [00:43:57]) and adds legal/HR-policy surface area SafeStart has no business owning. | Export the record; let the org's own HR/management process consume it. Never build an in-app escalation state machine. |
| Live SuccessFactors (or other HRIS) API integration | Visy explicitly asked for Success Factors integration, and "integration" sounds like the premium answer to their ask. | Locked out of scope for this milestone (PROJECT.md: "no HRIS API integration yet... SuccessFactors is a Later target"). API integration means auth/credential management per org, schema-version fragility against SAP's own connector changes, and a support burden disproportionate to a still-unsigned deal. | CSV export shaped to match SuccessFactors' Learning History Connector import format — gets Visy 90% of the value at near-zero integration risk, and is the honest MVP to validate the ask before building a real integration. |
| Quiz/assessment engine (formal pass/fail knowledge tests per SOP) | Common LMS-lite pattern — "competency" often implies a quiz score, and ACC WSMP guidance does list "assessment results (quiz)" as one evidence type. | Adds authoring burden (every SOP needs quiz questions maintained in parallel with content) and worker-facing friction (a low-literacy, glove-handed workforce doing multiple-choice on a phone is a bad UX fit — contradicts the literacy/voice-first findings from Visy). Supervisor observation already covers the "practical demonstration" evidence class ACC guidance treats as sufficient for higher-risk tasks. | Supervisor observation record (verdict + note) substitutes for a quiz as the competence-evidence layer; the walkthrough completion substitutes for "proof of completion." No formal quiz engine. |
| Automatic competency expiry that silently downgrades a worker's state with no notice | Feels like the "correct" behavior for a refresher-cadence system — if the due date passes, flip the state back. | Silent downgrades without visibility create exactly the audit gap the feature exists to prevent (a worker looks "not competent" with no record of why or when it happened), and can feel punitive/opaque to the worker if ever surfaced to them. | Governance-queue style surfacing (Phase 28 pattern): flag as "refresher due/overdue" alongside the still-valid last-competent record, don't erase or silently change history. Supervisor/admin acts on it explicitly. |

## Feature Dependencies

```
Access grants (Phase 32-33)
    └──requires for──> Training matrix (people × required-SOPs grid)

Completions + immutable sign-off chain (Phase 4/23)
    └──requires for──> Training matrix (status column)
    └──requires for──> Per-worker training record view
    └──requires for──> CSV export

Training matrix
    └──requires for──> Competency states (states are the extra column on the matrix)
    └──enhances──> CSV export (export = matrix, flattened)

Competency states
    └──requires for──> Supervisor observation records (observation is the evidence that advances a state)

Departments (Phase 25) + role work (G-04 backlog)
    └──requires for──> Assessor capability governance (who may observe/sign off)

Version supersede (Phase 23)
    └──requires for──> Trained-on-outdated-version surfacing

Governance queue (Phase 28)
    └──enhances──> Refresher/recertification due-date surfacing (reuse due/overdue pattern)
    └──enhances──> AI-prioritized maintenance schedule (Phase 30 rollforward)

Agent metadata + AI adapter (Phase 26.5/27)
    └──requires for──> AI-prioritized maintenance schedule
    └──requires for──> Risk/priority AI-suggestion (999.6)

AI reviewer jobs (Phase 21)
    └──requires for──> AI-reviewer completeness rubric (999.4)

Document code field (999.5) ──enhances──> Training matrix + CSV export (SOP identified by code, not just title)
Risk/priority rating (999.6) ──enhances──> Governance queue + AI maintenance schedule (sort input)

Competency states ──conflicts──> Worker-facing access gating (explicitly must NOT connect — north star)
```

### Dependency Notes

- **Training matrix requires access grants + completions:** both halves already exist (Phases 32-33 and 4/23) — this is why PROJECT.md calls the matrix "nearly free." No new source-of-truth capture needed for the base grid, only new read/aggregation logic.
- **Competency states require the training matrix to exist first:** states are meaningless without the required-SOPs × person context to hang them on — build the matrix's join logic before adding the state column.
- **Supervisor observations require competency states:** an observation's purpose is to move a person's state forward (e.g. supervised → competent-signed-off) — building observations before states exist gives you data with nowhere to attach.
- **Assessor governance requires department/role infrastructure (Phase 25 + G-04):** "is this supervisor qualified to assess" is a role/competency question about the supervisor themselves — reuses the same competency-state mechanism recursively rather than a parallel certification system.
- **CSV export enhances (doesn't require) every other feature:** export can ship as soon as the matrix + states exist; observations and version-flagging make the export richer but aren't blocking.
- **Competency states conflicts with worker-facing access gating:** this is a deliberate architectural boundary, not a technical dependency — flagging it here so no future phase accidentally wires competency status into the walkthrough/read access checks.

## MVP Definition

Given this is a milestone within an existing product (not a greenfield v1), "MVP" = smallest slice that gives an org one honest audit answer; "later" = enrichment once the shape is validated.

### Launch With (v7.0 core slice)

- [ ] Training matrix (people × required-SOPs × status grid, per-dept/per-worker cuts) — the single artifact every stakeholder (auditor, ACC reviewer, site manager) asks for; everything else is enrichment on top of it
- [ ] Competency states (3-4 states, not started/read/supervised/competent) — makes the matrix's status column meaningful beyond raw "completed"
- [ ] Supervisor observation records — the tamper-evident, non-shareable evidence layer that directly fixes Visy's #1 named pain point (fraudulent/shared sign-offs)
- [ ] Per-worker training record view + CSV export — Phase 31 rollforward, near-free once the matrix exists, is the concrete (low-risk) answer to the SuccessFactors ask
- [ ] Trained-on-outdated-version surfacing — cheap derived flag, closes an audit gap now visible because version supersede already exists

### Add After Validation (rest of v7.0)

- [ ] Assessor capability governance (trainer must be signed off) — needs the states/observations mechanism proven first, and touches role infrastructure (G-04) that's still backlog
- [ ] Refresher/recertification cadence + due-date surfacing — reuse Phase 28's governance-queue pattern once it's clear which SOPs actually need risk-tiered refresh (don't guess tiers before real data exists)
- [ ] AI-prioritized maintenance schedule — Phase 30 rollforward, depends on staleness/usage/flag signals accumulating post-launch
- [ ] AI-reviewer completeness rubric (999.4), document codes + register export (999.5), risk/priority triage (999.6) — guidance-notes adoptions that make individual SOPs better training modules; valuable but orthogonal to the matrix/states/observations spine, can land in any order after it

### Future Consideration (post-v7.0)

- [ ] Live SuccessFactors/HRIS API integration — defer until a real customer (Visy or similar) is signed and the CSV export has proven the field mapping is actually right
- [ ] Formal quiz/assessment engine — only reconsider if supervisor-observation evidence proves insufficient for a specific regulator/auditor pushback; default answer is no

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Training matrix | HIGH | MEDIUM | P1 |
| Competency states (3-4) | HIGH | MEDIUM | P1 |
| Supervisor observation records | HIGH | MEDIUM | P1 |
| Per-worker training record + CSV export | HIGH | LOW | P1 |
| Trained-on-outdated-version flag | MEDIUM | LOW | P1 |
| Assessor capability governance | MEDIUM | MEDIUM | P2 |
| Refresher/recertification cadence | MEDIUM | LOW-MEDIUM | P2 |
| AI-prioritized maintenance schedule | MEDIUM | MEDIUM | P2 |
| AI-reviewer completeness rubric (999.4) | MEDIUM | LOW | P2 |
| Document codes + register export (999.5) | LOW-MEDIUM | LOW-MEDIUM | P3 |
| Risk/priority triage rating (999.6) | LOW-MEDIUM | LOW-MEDIUM | P3 |
| Live HRIS API integration | MEDIUM (one customer) | HIGH | P3 (deferred) |
| Formal quiz engine | LOW | MEDIUM | Not planned |

**Priority key:**
- P1: Must have for v7.0 — the matrix/states/observations spine + its export
- P2: Should have, add once spine is proven — governance/cadence/AI enrichment
- P3: Nice to have, likely later phases (999.x backlog) or explicitly deferred (HRIS API)

## Competitor Feature Analysis

Direct competitors in this exact niche (SOP-execution PWA + competency layer, AU/NZ industrial) are not publicly documented in detail; comparison instead draws on the adjacent categories orgs like Visy would otherwise buy from.

| Feature | Generic competency-matrix SaaS (AG5-style) | Enterprise LMS (SuccessFactors Learning) | SafeStart's approach |
|---------|---------------------------------------------|-------------------------------------------|------------------------|
| "Who needs what" data | Manually entered/maintained matrix | Manually assigned learning plans | Derived from existing access grants — zero double-entry |
| Evidence of competence | Often just a completion tick or manual matrix cell edit | Formal assessment/quiz completion status (pass/fail) | Supervisor observation record — tamper-evident, no shared-login exposure |
| Evidence of currency | Manual expiry tracking, often spreadsheet-driven | Certification expiry rules, recert workflows | Reuses existing governance-queue due/overdue pattern (Phase 28), applied per-worker-per-SOP |
| Worker-facing friction | Varies; many gate task assignment on matrix status | Learning plans/assignments can block access to work systems | Explicitly never gates worker read/walkthrough access — locked north star |
| Export/integration | Often exports to Excel; some have HRIS connectors | Native import/export via Learning History Connector (flat file: employee ID, item ID, completion date, status, score) | CSV shaped to match the SuccessFactors import format as a de facto integration, without building the live API |
| SOP-to-competency linkage | None — matrix is a separate system from the procedure content | Loose — courses reference content, not living procedures | Tight — the SOP IS the training content, walkthrough completion IS the training event |

## Sources

- ACC Workplace Safety Management Practices (WSMP) audit-guideline pattern — evidence-layer structure (completion/competence/currency) cross-referenced via [Employee Training Records NZ: Template + Simple System](https://tribalhabits.com/employee-training-records-nz/) and [Health & Safety Training Software NZ: What to Track](https://tribalhabits.com/health-safety-training-software-nz/) (NZ-focused vendor guidance, MEDIUM confidence — not the raw ACC PDF, which was unreadable/garbled on fetch)
- [What Regulators Expect From Your Training Records](https://tribalhabits.com/what-regulators-expect/) — evidence fields, refresher cadence examples (LOW-MEDIUM confidence; article is AU-regulator-weighted with only light NZ coverage)
- [WorkSafe NZ — Registers](https://www.worksafe.govt.nz/tools-registers-resources/registers/) and hazardous-substances record-keeping duty (training record retention/inspector access) — official source, HIGH confidence for the general duty, not fully detailed for competency specifics
- SAP SuccessFactors Learning — [Adding Course Completion Status](https://help.sap.com/docs/SAP_SUCCESSFACTORS_LEARNING/5fae31b1299d4033b665edabea7b9087/5921a6b0bf194d9893a15e6a76306b09.html) and Learning History Connector support-KB references (pass/fail/incomplete completion-status model, employee/item/date/status/score import shape) — MEDIUM confidence, official SAP docs but full connector field list not directly readable during this research pass
- General manufacturing competency-matrix practice — [AG5: What is Competency Management?](https://www.ag5.com/competency-management/), [SC Training: Competency Matrices](https://training.safetyculture.com/blog/competency-matrices/), [Azumuta: Skills Matrix & Training](https://www.azumuta.com/blog/the-ultimate-guide-to-skills-matrix-and-training/) — LOW-MEDIUM confidence, generic (non-NZ) manufacturing pattern, used only for state-model and matrix-usage conventions, not for regulatory claims
- Primary source: `.planning/research/customer-interviews/2026-05-05-visy-findings.md` — Visy Packaging (~100 AU/NZ industrial sites), HIGH confidence, direct customer signal on training-record ask, fraudulent sign-off pain, SuccessFactors integration target, literacy/UX constraints
- Project source: `.planning/PROJECT.md` (v7.0 milestone scope, locked north star and anti-goals), `.planning/ROADMAP.md` (Phase 999.4-999.7 guidance-notes adoption specs), `.planning/todos/pending/2026-07-19-phase-seed-competency-layer.md` (phase-seed problem/solution framing)

---
*Feature research for: Competency & Training Layer (SafeStart v7.0)*
*Researched: 2026-07-19*
