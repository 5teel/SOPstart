# Phase 35: Competency Classifier + Training Matrix + Records - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-23
**Phase:** 35-competency-classifier-training-matrix-records
**Areas discussed:** Classifier state rules, Matrix UX at scale, Training record view, CSV export shape

---

## Classifier state rules

| Option | Description | Selected |
|--------|-------------|----------|
| Highest-evidence-wins | read = completion · supervised = performed_to_sop observation · competent = sign-off; state = highest rung, no prerequisite ordering | ✓ |
| Strict ladder | Each state requires rungs below (competent needs observation AND sign-off) — would demote existing signed-off workers | |
| You decide | Claude picks | |

| Option | Description | Selected |
|--------|-------------|----------|
| Reset to read + flag | needs_support newer than latest positive evidence drops state to read + flags cell; re-advances on later positive evidence | ✓ |
| Flag only, no demotion | State never goes down; badge only — matrix would overstate competence | |
| You decide | Claude picks | |

| Option | Description | Selected |
|--------|-------------|----------|
| Completion only | 'Read' = completed walkthrough; no new tracking | ✓ |
| Also track SOP opens | New 'viewed' event table on worker hot path | |

| Option | Description | Selected |
|--------|-------------|----------|
| Admin-only this phase | Matrix/record are admin surfaces; workers see states later if pulled | |
| Show on worker /profile too | Extend Phase 34 transparency — worker sees own states, read-only | ✓ |

**Notes:** Worker-facing states are informational only — CMP-04 never-gates guard applies to this surface.

---

## Matrix UX at scale

| Option | Description | Selected |
|--------|-------------|----------|
| Department-first | Opens on one dept (people × dept-required SOPs) with switcher — sketch 05 shape | ✓ |
| Whole org, filter down | Full grid + filters; needs virtualization at 500 SOPs | |

| Option | Description | Selected |
|--------|-------------|----------|
| Pills, compact past threshold | Sketch-05 labelled pills at dept scale; compact cells + legend when columns overflow | ✓ |
| Always compact dots + legend | Densest, loses self-explanatory pills at common scale | |

| Option | Description | Selected |
|--------|-------------|----------|
| Rollups, both axes | Per-person and per-SOP counts + needs-support flags in rollups | ✓ |
| No rollups | Cells only | |

| Option | Description | Selected |
|--------|-------------|----------|
| Open PersonPanel evidence | Cell click opens Phase 34 PersonPanel scrolled to that SOP's evidence trail | ✓ |
| Inline popover | Second evidence renderer | |

---

## Training record view

| Option | Description | Selected |
|--------|-------------|----------|
| PersonPanel only | Grow the Phase 34 panel; CSV covers auditor hand-off | ✓ |
| Panel + full page | Printable per-worker page; two surfaces rendering same evidence | |

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped by SOP | One block per required SOP with state pill header + evidence beneath | ✓ |
| Flat chronological | Single timeline; auditor reassembles per-SOP standing | |

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, separate section | 'Other completed SOPs' below required set; excluded from matrix/rollups | ✓ |
| Required-only | Record mirrors matrix; real evidence invisible | |

---

## CSV export shape

| Option | Description | Selected |
|--------|-------------|----------|
| One row per completion | Learning-event rows, SuccessFactors Learning History shape | ✓ |
| Events + state snapshot | Second matrix-snapshot CSV as well | |
| You decide | Claude picks from SF ingest format | |

| Option | Description | Selected |
|--------|-------------|----------|
| Email + full name | Email = SF join key; no new fields | ✓ |
| Add employee-ID field now | New schema + admin UI this phase | |

| Option | Description | Selected |
|--------|-------------|----------|
| Matrix header + PersonPanel | Filtered-cut export + per-worker export, one generator | ✓ |
| Matrix header only | Single entry point | |

---

## Claude's Discretion

- Classifier module placement/naming (pure function, unit-testable, `resolveEffectiveAccess` precedent)
- Matrix data-fetch strategy, skeletons, empty states, compact-threshold column count
- MTX-03 filter widget design
- CSV SOP identifier column (`sop_number` today; document codes are Phase 38)
- Worker /profile own-states presentation
- Date-range filter semantics
- Whether "Awaiting sign-off" renders as a distinct pill or folds into `read`

## Deferred Ideas

- Version-currency surfacing (CMP-03/TRN-03) — Phase 36
- Refresher cadence — Phase 36
- Assessor gating — Phase 37
- Document codes — Phase 38
- Employee-ID field — future on customer pull
- "Viewed SOP" read-tracking — rejected; revisit on customer pull
