# Phase 36: Refresher Cadence + Version-Currency - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-26
**Phase:** 36-refresher-cadence-version-currency
**Areas discussed:** Refresher cadence source, Outdated-version display, Refresher surfacing, Admin version breakdown (+ folded todo review)

---

## Folded todo review

| Option | Description | Selected |
|--------|-------------|----------|
| Keep in backlog | Phase 36 stays focused; axis swap waits for a UI polish pass | |
| Fold into Phase 36 | Small toggle, matrix components open on the bench anyway | ✓ |

**User's choice:** Fold matrix axis-swap toggle into Phase 36.
(The other match, `2026-07-19-phase-seed-competency-layer.md`, was already folded/resolved by Phase 35 — not re-presented.)

---

## Refresher cadence source

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse review cadence (Recommended) | Document-review cadence doubles as refresher interval; zero new config | |
| Separate refresher setting | New per-SOP interval, independent of document review | ✓ |
| Shared default + per-SOP override | Defaults to review cadence, overridable | |

**User's choice:** Separate refresher setting — document review and worker refresh are different clocks.

Follow-up — granularity/default:

| Option | Description | Selected |
|--------|-------------|----------|
| Per-SOP, unset = no refresher (Recommended) | Opt-in per SOP; unset SOPs have no due-date | ✓ |
| Per-SOP with org default | Org default applies everywhere, per-SOP override | |
| Per-category + per-SOP override | Category-keyed config mirroring Phase 28 | |

Follow-up — clock reset:

| Option | Description | Selected |
|--------|-------------|----------|
| Any completed walkthrough (Recommended) | Last completion + cadence = next due | ✓ |
| Signed-off completion only | Stricter, but worker can be overdue awaiting sign-off | |

---

## Outdated-version display

| Option | Description | Selected |
|--------|-------------|----------|
| Badge, state unchanged (Recommended) | Chip beside the pill; history never resets (CMP-03 literal) | ✓ |
| State demotes visually | Pill mutes/hollows on old-version evidence | |

Rollup math:

| Option | Description | Selected |
|--------|-------------|----------|
| Counts + outdated tally (Recommended) | "4/6 signed off · 2 on outdated version"; CSV `on_current_version` column | ✓ |
| Split counts | Only current-version evidence counts as competent | |

---

## Refresher surfacing

Workers:

| Option | Description | Selected |
|--------|-------------|----------|
| Profile + SOP list chip (Recommended) | Chips on "Your training" rows + worker library card | ✓ |
| Profile only | Quietest; worker must go looking | |
| Profile + list + dashboard | Adds dashboard strip | |

Supervisors/admins:

| Option | Description | Selected |
|--------|-------------|----------|
| Matrix chips + rollups (Recommended) | Matrix stays the one competency surface; CSV gains due-date columns | ✓ |
| Matrix + governance queue | Injects people-training into document governance queue | |
| Dedicated due list | New list view on /admin/team | |

---

## Admin version breakdown (TRN-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Versions page panel (Recommended) | Panel on /admin/sops/[sopId]/versions next to supersede history | ✓ |
| Matrix column popover | Split behind a column-header click | |
| Both | Panel + compact matrix count | |

---

## Claude's Discretion

- Refresher-interval edit surface + input shape; storage shape (survives supersede).
- Due-soon window semantics and chip styling (declare tokens).
- Axis-swap toggle placement; transposed-compaction verification.
- Worker library chip bundle impact.

## Deferred Ideas

- Org/category refresher defaults; refresher notifications; governance-queue people items; SF API / employee-ID.
