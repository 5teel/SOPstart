# Phase 56: A Simpler SOP & the Decision Ledger - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-04
**Phase:** 56-a-simpler-sop-the-decision-ledger
**Areas discussed:** Conversion rules (SOP-01), Ledger history & shape (DEC), Placement & department (SOP-03), Standards (SOP-02)

---

## Conversion rules (SOP-01)

| Option | Description | Selected |
|--------|-------------|----------|
| New rows beside the old | Add `kind` to sop_steps; write converted steps as NEW rows tagged with the run; layout_data untouched; re-runnable at the Phase 58 cutover | ✓ |
| Convert layout_data in place | Rewrite block JSON into the four kinds now; re-run becomes a merge | |
| You decide | | |

**User's choice:** New rows beside the old (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Check = anything you verify | Measurement/Inspect/Decision/SignOff → check; Callout/Text/Heading/Zone/Escalate/Model/Photo → step (photo blocks ask for a photo) | ✓ |
| Check = only Inspect/Measurement | Decision and SignOff become plain steps | |
| You decide | | |

**User's choice:** Check = anything you verify (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Warning/caution become a hazard step before it | Each non-empty warning/caution emitted as its own hazard step immediately before the parent; tip stays a note | ✓ |
| Keep them as notes on the step | No new rows; shown inline | |
| You decide | | |

**User's choice:** Warning/caution become a hazard step before it (recommended)

---

## Ledger history & shape (DEC)

| Option | Description | Selected |
|--------|-------------|----------|
| Backfill history | One migration writes a row per existing approval / sign-off / observation / review event / block-update decision, original timestamp + actor, `source: backfill` | ✓ |
| Start empty | Only post-cutover decisions | |

**User's choice:** Backfill history (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Trigger blocks everyone, incl. service role | RLS INSERT+SELECT only AND a BEFORE UPDATE/DELETE trigger raising for every role; correction = new decision referring to the old | ✓ |
| RLS only | Service role keeps an escape hatch | |

**User's choice:** Trigger blocks everyone, incl. service role (recommended)
**Notes:** "Beside, not replacing" the five existing decision tables was pre-decided by the milestone's no-drop rule and not re-asked.

---

## Placement & department (SOP-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Derived for display; wiring stays the access gate | Shown department = machines' departments; sop_departments / all_departments / access_grants untouched | ✓ |
| Derived AND synced into sop_departments | Placement rewrites visibility tags | |
| You decide | | |

**User's choice:** Derived for display; wiring stays the access gate (recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit flag, defaulted by the conversion | `sops.placement = 'machine' | 'site'`; conversion sets site for zero-machine SOPs | ✓ |
| Implicit: no machines = site-wide | No new column | |

**User's choice:** Explicit flag, defaulted by the conversion (recommended)

---

## Standards (SOP-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Seed a short NZ/AU industrial starter list; label visible to everyone | LOTO, Hot Work, Confined Space, Working at Height, Manual Handling, Electrical Isolation; label in the worker walk rail too | ✓ |
| Start empty; label visible to everyone | | |
| Seeded; admin-only label | | |

**User's choice:** Seed a short starter list; label visible to everyone (recommended)

---

## Claude's Discretion

- Converter input precedence (layout_data first, sop_steps fallback) and re-run mechanics
- Ledger column shape (kind enum, actor_kind person|agent, subject_kind/subject_id, summary, details, source, supersedes_decision_id)
- Standards storage (one polymorphic attachment table vs three junctions)
- Whether "… · logged in the decision ledger" copy lands on existing screens this phase

## Deferred Ideas

- Office ledger view (DEC-02) — Phase 59
- Standards manager mounted in the Workshop — Phase 61
- Walk/editor reading the new kind rows — Phase 58
- Assignment → request — Phase 60 (ledger hook made here)
- Syncing sop_departments from placement — only if the wiring screen is ever retired
