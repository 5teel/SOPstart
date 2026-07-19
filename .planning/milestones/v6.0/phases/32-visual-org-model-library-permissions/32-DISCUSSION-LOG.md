# Phase 32: Visual Org Model & Library Permissions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-18
**Phase:** 32-visual-org-model-library-permissions
**Areas discussed:** Collections & enforcement, Roles & areas layer, Placement & navigation, Grant semantics v1

All four proposed gray areas were selected for discussion. Visual/interaction design was NOT discussed — it is pre-locked by sketches 001–003 (`sketch-findings-SOPstart`).

---

## Collections & enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| New entity, sync to junctions (Recommended) | New org-scoped `collections` table seeded from sops.category; grants are source of truth, MATERIALIZED into existing sop_departments rows; shipped RLS untouched | ✓ |
| Grants replace dept RLS | New RLS policies read the grants table directly; sop_departments retired — riskiest schema change since Phase 25 | |
| Visual-only this phase | Wiring reads/writes sop_departments at dept level only; no collections entity yet | |

**User's choice:** New entity, sync to junctions.

---

## Roles & areas layer

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal real tables (Recommended) | areas + departments.area_id; roles + role_members + budgeted_count; NO role-level grants this phase | |
| Areas real, roles render-only | roles as JSON on departments | |
| Both full-fat now | Everything from minimal PLUS role-level grants → 5-level inheritance chain | ✓ |

**User's choice:** Both full-fat now — role-level grants land this phase (upgrades the roadmap's "roles when the layer lands"; success criterion 2 amended).

---

## Placement & navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Team=org, access on SOPs page (Recommended) | /admin/team BECOMES the org model (chart default, columns absorbs member list); wiring = /admin/sops?view=access (governance-fold idiom); library deep-links become same-page filter switches | ✓ |
| Both under Team | /admin/team + sibling /admin/team/access | |
| New Settings pages | Both under the /admin/settings hub | |

**User's choice:** Team=org, access on SOPs page.

---

## Grant semantics v1

| Option | Description | Selected |
|--------|-------------|----------|
| Additive-only; both entries (Recommended) | No exclude carve-outs in v1; wire-up triggers from post-publish CTA AND organically from the access view | ✓ |
| Additive-only; publish CTA only | Wire-up only from the publish flow | |
| Build exclude now | Negative-grant resolution in v1 | |

**User's choice:** Additive-only; both entries.

---

## Claude's Discretion

- Grants table shape (polymorphic subject vs per-level columns)
- Materialization mechanics (trigger vs server-action sync vs on-write fanout)
- Chart auto-layout algorithm; component structure
- Blast-radius derivation (unit locked as PEOPLE by sketch findings)

## Deferred Ideas

- Exclude/inherited-revoke affordance (negative grants)
- Per-SOP grant exceptions (collections are the v1 wiring unit)
- Bus-routing audit/wall-display mode (sketch 003-C, parked)
- Sub-trade ↔ dept/role combination semantics (carried from Phase 25)
- Org empty states + person effective-access drill-in (frontier sketch candidates 006/007)
