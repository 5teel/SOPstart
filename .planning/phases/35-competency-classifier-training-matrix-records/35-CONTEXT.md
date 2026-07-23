# Phase 35: Competency Classifier + Training Matrix + Records - Context

**Gathered:** 2026-07-23
**Status:** Ready for planning

<domain>
## Phase Boundary

One pure classifier function derives a live competency state per person × required-SOP from evidence SOPstart already stores — access grants (who must know what, Phases 32/33), walkthrough completions + sign-off chains (Phases 4/23), and supervisor observations (Phase 34). Three surfaces render it: a training matrix as a third view mode on `/admin/team`, a per-worker training record inside the existing PersonPanel, and a SuccessFactors-shaped CSV export. Zero stored/stale state — everything is computed live from existing tables. Requirements: CMP-01, CMP-02, CMP-04, MTX-01, MTX-02, MTX-03, TRN-01, TRN-02.

**Locked north star (regression-guarded):** competency state NEVER gates worker read/walkthrough access (CMP-04) — mirror the Phase 28 D28-07 guard pattern with a source-contract test.

</domain>

<decisions>
## Implementation Decisions

### Classifier state rules (CMP-01/02)
- **D-01: Highest-evidence-wins ladder.** `not_started` = no evidence · `read` = ≥1 completed walkthrough of the SOP · `supervised` = ≥1 `performed_to_sop` observation · `competent_signed_off` = ≥1 supervisor sign-off on a completion. State = the highest rung any evidence reaches; **no prerequisite ordering** (a sign-off without an observation still = competent — existing signed-off workers are never demoted on day one).
- **D-02: `needs_support` resets to `read` + flag.** A `needs_support` observation NEWER than the latest positive evidence (sign-off, `performed_to_sop` observation) drops the derived state back to `read` and flags the cell/record. A later positive observation or sign-off re-advances it. This is the complacency-reset mechanism from the phase seed — a real reset, not just a badge. Never demotes below `read` (the completion happened).
- **D-03: "Read" = completion only.** No new view/open tracking. Merely opening a SOP leaves no trace and counts as `not_started` — honest for an audit artifact, zero new write paths on the worker hot path.
- **D-04: Workers see their own states.** Extend the Phase 34 transparency principle: worker's own `/profile` shows their competency state per required SOP, same trust framing as observations. **Read-only, informational, never gating** (CMP-04 guard applies to this surface too — no lock icons, no blocked CTAs, no "you can't do this yet" copy anywhere worker-facing).
- **D-05: Version-staleness is Phase 36 scope.** The classifier v1 treats evidence on any version as valid; trained-on-outdated-version surfacing (CMP-03/TRN-03) layers on later. Do not build version-currency logic now (but the evidence rows already carry version stamps — keep them in classifier output shape so Phase 36 doesn't refactor).

### Training matrix (MTX-01..03)
- **D-06: Department-first default cut.** Matrix opens on one department (its people × the SOPs required of that dept), with a department switcher — as sketch 05 shows. Whole-org-at-once is not the default. MTX-03 filters (department, worker, SOP) narrow from there.
- **D-07: Labelled state pills, auto-compact past threshold.** Keep the approved sketch-05 pills at normal dept scale; switch to compact colored cells + legend when columns exceed what fits, horizontal scroll as backup. Sketch tokens/styles throughout.
- **D-08: Rollups on both axes.** Per-person ("4/6 competent") and per-SOP ("3/5 signed off") counts, with needs-support flags surfaced in the rollups — the pre-audit scan view.
- **D-09: Cell click opens PersonPanel** (Phase 34's panel) focused on that person, scrolled to that SOP's evidence trail. No second evidence renderer.
- **D-10: Matrix scope = required SOPs only.** Rows are people with ≥1 required SOP; columns derive from access grants (materialized junctions per MTX-02). Extra-curricular completions never appear in the matrix or rollups (see D-13).

### Per-worker training record (TRN-01)
- **D-11: PersonPanel only — no dedicated page.** Grow the Phase 34 panel with a training-record section; it was built as this feature's home. CSV export covers the "hand it to an auditor" need.
- **D-12: Grouped by SOP.** One block per required SOP headed by its state pill, evidence trail beneath (completions with version + date + sign-off chain, observations chronologically). Not a flat timeline.
- **D-13: "Other completed SOPs" section.** Completions of SOPs outside the worker's grants render in a separate section below the required set — still training evidence — but are excluded from matrix cells and rollups.

### CSV export (TRN-02)
- **D-14: One row per completion event** (SuccessFactors Learning History shape — learning events, not state snapshots). Columns include worker identity, SOP identifier + title + version, completion date, sign-off status/signer/date. Researcher pins the exact SF Learning History column names/order.
- **D-15: Worker identity = email + full name.** Email is the join key an HR admin maps to their SF user ID. No employee-ID field this phase.
- **D-16: Two export entry points, one generator.** Matrix header exports the current filtered cut (dept/worker/SOP/date-range filters applied); PersonPanel exports that one worker. Same server-side generator behind both.

### Claude's Discretion
- Classifier module placement and naming — must be a pure function (evidence rows in → states out), unit-testable without DB, following the `resolveEffectiveAccess` precedent (one resolver, every view calls it, never recomputed per-view).
- Matrix data-fetch strategy (single batched query vs per-axis queries), loading skeletons, empty states, and the exact compact-threshold column count.
- Filter widget design for MTX-03 (reuse existing department-filter idioms from /admin/team).
- SOP identifier column in CSV (`sop_number` exists today; Phase 38 adds document codes — don't build codes now).
- Exact worker /profile presentation of own states (keep it lean; observations section is the neighbor).
- Date-range filter semantics (filter on completion date).

### Folded Todos
- `2026-07-19-phase-seed-competency-layer.md` (tagged `resolves_phase: 35`) — the competency-layer seed defining the matrix/states rationale: completion ≠ competence; the matrix is the one artifact auditors/ACC ask for; grants encode the left side, completions the right; observations unlock the middle state. Its "assessor capability" item stays Phase 37; its observation item shipped in Phase 34. Move to done when this phase completes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product rationale & requirements
- `.planning/todos/pending/2026-07-19-phase-seed-competency-layer.md` — the folded phase seed (problem framing + solution direction).
- `.planning/REQUIREMENTS.md` §v7.0 — CMP-01/02/04, MTX-01..03, TRN-01/02 exact wording.
- `.planning/ROADMAP.md` §Phase 35 — goal + 4 success criteria (incl. the CMP-04 locked guard).
- `.planning/research/customer-interviews/` — Visy 2026-05-05: SuccessFactors/training-record ask, desktop-first admin usage.

### Design (validated)
- `sketches/supervisor-observations/index.html` §05 — the approved matrix preview (per-dept table, state pills: Signed off / Observed ✓ / Awaiting sign-off / Read only / Not started). Phase 35's design anchor.
- `.claude/skills/sketch-findings-SOPstart/SKILL.md` + `references/design-tokens.md`, `references/layout-primitives.md`, `references/org-model-views.md` — tokens, pills/frames, and the /admin/team surface the matrix mode joins.

### Prior phase contracts (evidence sources)
- `.planning/phases/34-supervisor-observations/34-CONTEXT.md` — canonical observation verdicts `performed_to_sop`/`needs_support` (D-01/D-02 there; classifier reads canonical values, never org labels), version auto-stamp (D-10 there).
- `supabase/migrations/00052`–`00054` — `sop_observations` schema + RLS (incl. 00054 recorder-role fix; classifier server reads must respect whose rows RLS returns per the 2026-07-20 learning).
- `src/actions/grants.ts` — `resolveEffectiveAccess` is THE pure 5-level union resolver for "required SOPs per person" (Phase 32-04 decision: every view calls it, never recompute inheritance per-view); materialized junctions per Phase 32-05/33.
- `src/actions/completions.ts` + `sop_completions` / `completion_sign_offs` tables — completion + sign-off chain evidence (append-only, D-17).
- `src/actions/observations.ts` — Phase 34 read actions; note the 34-10 lesson: `sop_assignments` RLS only exposes the caller's own rows — evidence reads on behalf of OTHER workers need the admin client with self-enforced org-scope.

### Pattern precedents
- `src/components/admin/org-model/TeamViewShell.tsx` + `ViewToggle.tsx` — the `'chart' | 'columns'` toggle the matrix joins as a third mode.
- `src/components/admin/org-model/PersonPanel.tsx` — the training record's home (built to grow, Phase 34 D-03).
- Phase 28 D28-07 guard (`tests/` regex source-contract test keeping overdue badges out of worker surfaces) — the pattern for the CMP-04 never-gates guard.
- `src/lib/auth/session-context.ts` + `src/lib/auth/guards.ts` — all new server entrypoints use `getSessionContext()` / `requireAdminContext()`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TeamViewShell` (`useState<'chart' | 'columns'>`) + `ViewToggle` — add `'matrix'` as third value; page-level data already loads members.
- `PersonPanel` — observation history + record CTA already render there; training-record section slots in.
- `resolveEffectiveAccess` + materialized `sop_departments`/person grants — the "required SOPs" left side of the matrix with zero new derivation logic (MTX-02).
- Blueprint state-pill styling from sketch 05 + `blueprint-theme.css` additions from Phase 32-06 — declare any new CSS tokens (2026-07-14 undefined-token learning).

### Established Patterns
- Pure derivation modules live outside `src/actions/` (no `'use server'` on sync exports — 2026-06-27 learning); server actions stay thin async wrappers.
- Admin-client reads on behalf of other users must self-enforce org-scope on every path (2026-06-15/26 class); runtime cross-org probes per RLS branch × role (Phase 34 learning).
- `journeys.ts` + `src/lib/uat/tests.ts` updated in the same change as new flows; UAT items in layman click-path language.
- Bundle gate: worker `/sops/[sopId]` bundle must stay flat — matrix/classifier code is admin-route-only.

### Integration Points
- `/admin/team` page (`src/app/(protected)/admin/team/page.tsx`) — matrix mode + export button.
- Worker `/profile` — own-states section next to the Phase 34 observations section.
- CSV generator — server route or action shared by matrix header + PersonPanel exports.
- Phase 36 consumer: classifier output should expose latest-completion + version per pair so refresher/version-currency math can build on it without refactoring.

</code_context>

<specifics>
## Specific Ideas

- Sketch 05's pill vocabulary is the approved rendering: "Signed off" (green), "Observed ✓" (blue), "Awaiting sign-off" (amber), "Read only" / "Not started" (muted). Map: `competent_signed_off` → Signed off, `supervised` → Observed ✓, `read` → Read only, `not_started` → Not started. "Awaiting sign-off" in the sketch is a presentation nuance of `read` (completion exists, no sign-off yet) — Claude's discretion whether to render it as a distinct pill or fold into `read`.
- The needs-support flag should read as coaching, not discipline — consistent with Phase 34's "needs support" framing and the no-disciplinary-workflow anti-goal.

</specifics>

<deferred>
## Deferred Ideas

- Version-currency / trained-on-outdated-version surfacing (CMP-03, TRN-03) — Phase 36.
- Refresher cadence due/overdue — Phase 36.
- Assessor gating on competence-advancing observations — Phase 37.
- Document codes on SOPs (better CSV identifier) — Phase 38 DOC-01/02.
- Employee-ID field on org members for cleaner SF import — future, if a customer needs it.
- "Viewed SOP" lightweight read-tracking as lower-grade evidence — rejected this phase (weak evidence, worker hot-path write); revisit only on customer pull.

</deferred>

---

*Phase: 35-Competency Classifier + Training Matrix + Records*
*Context gathered: 2026-07-23*
