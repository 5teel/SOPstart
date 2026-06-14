# Phase 25: department-first-class-entity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-15
**Phase:** 25-department-first-class-entity
**Areas discussed:** Migration back-compat, Visibility/RLS composition, Owner model, SOP scope

---

## Migration back-compat

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-create 'General' dept + tag everything | Seed one General dept per org, assign all existing SOPs + org blocks to it; globals → all_departments | ✓ |
| Tag all existing as 'All departments' | No General dept; existing content gets org-wide flag until curated | |
| Leave untagged + visible by default | Untagged = no gate; only newly-tagged content is department-gated | |

**User's choice:** Auto-create 'General' dept + tag everything
**Notes:** Safest back-compat — nothing disappears from worker view on migration day; non-destructive (no block deleted, `category` retained read-only).

---

## Visibility / RLS composition

| Option | Description | Selected |
|--------|-------------|----------|
| Additive/OR — any gate grants | See SOP if assigned OR dept-match OR sub-trade-match OR org-wide; untagged doesn't restrict | ✓ |
| Department AND sub-trade both match | Stricter; both dimensions required when both tagged | |
| You decide (researcher proposes) | Planner designs composition; OR noted as default lean | |

**User's choice:** Additive/OR — see if ANY gate grants it
**Notes:** Fail-open, consistent with existing sub-trade RLS. Hard constraint carried: must use SECURITY DEFINER helpers to avoid the 00030/00031 recursion trap (D-02a). Resolves the SPEC's deferred dept↔sub-trade question for *visibility composition only*.

---

## Owner model

| Option | Description | Selected |
|--------|-------------|----------|
| Accountability label only (this phase) | Single named member, badge + 'no owner' warning, no new permissions | ✓ |
| Label + edit rights over dept content | Owner gains edit/approve rights over dept SOPs/blocks | |
| Multiple owners per department | A set of owners rather than one | |

**User's choice:** Accountability label only (this phase)
**Notes:** Addresses the Visy "who's accountable" ask with minimal surface. Edit-rights and multi-owner explicitly deferred.

---

## SOP scope

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — SOPs can be 'All departments' too | SOP tagged to specific depts OR marked org-wide; mirrors block model | ✓ |
| No — SOPs must name explicit departments | Every SOP belongs to one+ real depts; no org-wide shortcut | |

**User's choice:** Yes — SOPs can be 'All departments' too
**Notes:** Good for site-wide procedures (evacuation, induction). Parallels `blocks.all_departments`.

## Claude's Discretion

- Exact junction-table column design, migration file count/sequencing.
- Which existing UI components to extend vs build (BlockListTable, SubTradePicker, RoleAssignmentTable, CategoryBottomSheet are reuse candidates).
- Whether the SOP org-wide flag is a boolean column or a sentinel — planner's call.

## Deferred Ideas

- Dept↔sub-trade richer (skill×org-unit) semantics beyond OR-visibility.
- Owner edit/approve permissions; multiple owners per department.
- Unified create-SOP wizard; unified Read/Walk/Edit surface; site/plant multi-tenancy sub-tier.
