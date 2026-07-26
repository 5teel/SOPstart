# Phase 36: Refresher Cadence + Version-Currency - Context

**Gathered:** 2026-07-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Two derived, informational layers on top of the Phase 35 competency system: (1) **version-currency** — after a SOP supersede, workers who trained on a prior version are surfaced as "trained on outdated version" instead of having their competency history reset or orphaned (CMP-03), with an admin breakdown of who completed the current vs a prior version (TRN-03); (2) **refresher cadence** — per-SOP refresher intervals produce due/overdue re-walkthrough signals for workers and supervisors, computed from last completion + cadence using the existing governance cadence math (REF-01, REF-02). Everything is derived live (no stored state), and nothing ever blocks worker access — the CMP-04 locked north star extends to every new surface in this phase. Promotes backlog 999.7. Also ships the folded matrix axis-swap toggle.

**Locked north star (regression-guarded):** refresher/version state NEVER gates worker read/walkthrough access — extend the existing CMP-04 / D28-07 guard pattern (source-contract test) to the new chips and views.

</domain>

<decisions>
## Implementation Decisions

### Refresher cadence (REF-01/02)
- **D-01: Separate per-SOP refresher interval — NOT the document-review cadence.** The Phase 28 review cadence is the document's clock; the refresher interval is the worker's clock. New per-SOP setting; reuse the pure cadence MATH (`resolveCadenceMonths`-style resolution + `computeReviewDueDate`) but not the value.
- **D-02: Unset = no refresher.** No org default, no category default. Admins opt in per SOP where re-walkthroughs matter (high-risk SOPs). A SOP without an interval produces no due-date, no chip, no rollup contribution — zero noise from day one.
- **D-03: Any completed walkthrough resets the clock.** Next due = last completion (submitted_at) + interval. Sign-off NOT required to reset — a worker can self-serve their refresher; being "overdue awaiting sign-off" through no fault of their own must not happen.

### Version-currency (CMP-03/TRN-03)
- **D-04: Badge beside the pill; state and history unchanged.** A superseded SOP renders an "outdated version" chip next to the worker's existing competency pill. The pill itself never changes, demotes, or mutes — CMP-03's "never reset or orphan" is literal. Coaching framing, same family as the needs-support flag.
- **D-05: Rollups count old-version evidence at full value, plus an outdated tally.** Matrix rollups read like "4/6 signed off · 2 on outdated version" — competency counts unchanged, staleness surfaced as its own number. CSV export gains an `on_current_version` column (and refresher due-date columns per D-07).
- **D-06: Version currency resolves via lineage.** A worker's evidence is "current" when their latest completion's version/lineage matches the SOP's current published version (Phase 23 `parent_sop_id` root + `version` int, `superseded_by` on sops). Classifier evidence rows already carry version stamps (35 D-05) — no classifier refactor, this is a comparison layered on its output.

### Surfacing (REF-01)
- **D-07: Supervisors/admins — matrix chips + rollups only.** Due/overdue renders as a chip on matrix cells and rollup counts per row/column. No governance-queue injection (document governance stays separate from people training), no dedicated due-list view. CSV gains due-date columns so the export remains the audit artifact.
- **D-08: Workers — profile + SOP library chip.** Due/overdue chip on the profile "Your training" rows AND a small chip on that SOP's card in the worker library — visible where the worker would act. No dashboard nudges, no notifications this phase.
- **D-09: TRN-03 breakdown lives on `/admin/sops/[sopId]/versions`.** A panel on the existing versions page (supersede history already lives there): completion counts per version + expandable worker list, current version distinguished.

### Claude's Discretion
- Where the per-SOP refresher interval is edited (versions page, builder settings, library row — pick the least-new-surface option) and its input shape (months number vs preset options).
- "Due soon" window semantics (e.g. chip turns amber within N days of due, red when overdue) and exact chip styling — declare any new CSS tokens (2026-07-14 undefined-token learning).
- Storage shape for the interval (column on `sops` vs a sibling settings table) — favour the smallest migration that survives version supersede (interval should carry forward to the new version row).
- Axis-swap toggle placement and interaction (matrix header control; transpose before render; verify ResizeObserver compaction handles the transposed shape — 35 D-07).
- Whether the worker library chip needs a bundle-size check (worker route — keep the gate flat).

### Folded Todos
- `2026-07-26-matrix-axis-swap.md` — matrix axis-swap toggle (workers as columns / SOPs as rows), raised during Phase 35 UAT. Small header toggle; state derivation unchanged (symmetric); fold into the matrix work this phase touches anyway. Move to done when this phase completes.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product rationale & requirements
- `.planning/REQUIREMENTS.md` §v7.0 — CMP-03, TRN-03, REF-01, REF-02 exact wording.
- `.planning/ROADMAP.md` §Phase 36 — goal + 4 success criteria (incl. the never-blocking criterion).
- `.planning/todos/pending/2026-07-26-matrix-axis-swap.md` — the folded axis-swap todo.

### Prior phase contracts (build directly on these)
- `.planning/phases/35-competency-classifier-training-matrix-records/35-CONTEXT.md` — D-05 explicitly reserved version-currency for this phase and kept version stamps in classifier output; pill vocabulary and coaching framing locked there.
- `src/lib/competency/classify.ts` — pure classifier (`CompetencyEvidence` → `CompetencyResult`); this phase layers comparisons on its output, never refactors its ladder.
- `src/lib/competency/matrix.ts` — `MatrixCell` already carries `latestCompletionAt` + `latestCompletionVersion`; the version-currency comparison and refresher due-date computation slot in here.
- `src/lib/competency/csv.ts` — one generator behind both export entry points (35 D-16); new columns land here once. Formula-injection neutralization is in place — keep it for any new columns.
- `src/lib/governance/cadences.ts` — the pure cadence math to reuse (`computeReviewDueDate` pattern); do NOT couple to `sop_review_cadences` values (D-01).
- `src/lib/builder/version-lineage.ts` + `src/actions/versioning.ts` — lineage rules: all versions share root `parent_sop_id`, supersede sets `superseded_by`; `getVersionHistory` is the versions-page data source the TRN-03 panel joins.

### Pattern precedents
- `src/components/admin/competency/` (StatePill, matrix components) — chips join the established pill system; new tokens must be declared (CLAUDE.md 2026-07-14).
- `src/components/profile/CompetencySection.tsx` — worker "Your training" rows the due/overdue chip joins (titles now link to `/sops/[sopId]`).
- `tests/phase35/no-competency-gate.spec.ts` — the CMP-04 guard to EXTEND (new chips/surfaces must stay inside it or get a sibling guard).
- `tests/phase35/competency-rls-probe.spec.ts` — live RLS probe harness (ephemeral orgs + minted sessions) to copy for any new per-role read path.
- Phase 28 D28-07 guard — overdue badges stay out of worker gating; worker chips here are informational-only by the same mechanism.
- `src/lib/journeys/journeys.ts` + `src/lib/uat/tests.ts` — update in the same change as new surfaces (versions-page panel, chips).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MatrixCell.latestCompletionVersion` — the version-currency comparison input already flows through the matrix fetch; likely zero new evidence queries for CMP-03.
- `computeReviewDueDate(baseIso, months)` — pure, unit-tested due-date math; refresher due = same function, different base (last completion) and months (per-SOP interval).
- `/admin/sops/[sopId]/versions` page + `getVersionHistory` — TRN-03 panel host with lineage data already fetched.
- Matrix rollup rendering (row/column counts with needs-support tallies) — the outdated/due tallies extend the same rollup strings.

### Established Patterns
- Pure derivation modules outside `src/actions/` (2026-06-27); server actions stay thin async wrappers using `getSessionContext()`.
- Admin-client reads on behalf of other workers self-enforce org-scope (matrix already does this — new reads follow `getTrainingMatrix`'s shape).
- Migrations numbered sequentially; new sops column needs `database.types.ts` extension.
- Worker `/sops/[sopId]` bundle gate stays flat — refresher chip on the library card must be lightweight; version/cadence math is admin-side or server-side.

### Integration Points
- `getTrainingMatrix` / `exportTrainingCsv` / `getMyCompetencyStates` in `src/actions/competency.ts` — all three grow version-currency + refresher fields.
- Worker SOP library card (chip), `CompetencySection` rows (chip), matrix cells/rollups (chips + tallies), versions page (panel).
- Supersede flow (`uploadNewVersion` / publish of a new version) — no write-path changes needed; currency is derived at read time (D-06).

</code_context>

<specifics>
## Specific Ideas

- Rollup copy pattern locked by example: "4/6 signed off · 2 on outdated version" — staleness is an appended tally, never a subtraction from the competency count.
- The outdated-version chip and the refresher due/overdue chip are siblings of the needs-support flag: coaching, not discipline; no red-alarm styling on worker-facing surfaces.
- Refresher opt-in is deliberate product shaping: orgs start with zero refresher noise and turn it on per high-risk SOP — matches the ease-of-use north star.

</specifics>

<deferred>
## Deferred Ideas

- Org-level or category-level refresher defaults — revisit if per-SOP opt-in proves tedious at 50+ SOPs.
- Refresher notifications (email/digest/push) — v7.0 requirements already defer notifications; chips only this phase.
- Governance-queue integration of people-training items — rejected this phase (keeps document governance separate); revisit on customer pull.
- Employee-ID / SuccessFactors API — unchanged from Phase 35 deferrals.

</deferred>

---

*Phase: 36-Refresher Cadence + Version-Currency*
*Context gathered: 2026-07-26*
