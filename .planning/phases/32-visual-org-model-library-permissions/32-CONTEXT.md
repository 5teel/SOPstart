# Phase 32: Visual Org Model & Library Permissions - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning

<domain>
## Phase Boundary

A business (Visy first) draws its org structure visually — areas → departments → roles → people (named or role-descriptor vacancies) — and wires SOP-library access onto that model across every arity, with the visualization doubling as a library filter and as the surface where permissions are CREATED (wire-up mode for newly published SOPs). The full interaction/visual design is pre-validated by sketches 001–003 and locked in the `sketch-findings-SOPstart` skill; this phase is the schema + real-surface build of that design.

</domain>

<decisions>
## Implementation Decisions

### Collections & enforcement
- **D-01:** "Collections" become a NEW org-scoped `collections` entity (name, colour, sort), seeded by migration from distinct `sops.category` values. SOPs belong to 1+ collections.
- **D-02:** Grants (org-unit × collection) are the new SOURCE OF TRUTH for access, but enforcement is by **materialization**: the grant layer writes/derives the existing `sop_departments` junction rows. Shipped worker RLS (00030/Phase-25 class), offline sync, and every existing visibility read path stay UNTOUCHED this phase. No new RLS policies on the read path.
- **D-03:** Migration seeds grants from existing `sop_departments` rows (dept-level grants on the collections their SOPs belong to) so day-one state matches current reality; nothing a worker can see changes at cutover.

### Roles & areas layer (full-fat)
- **D-04:** New `areas` table (org-scoped: name, colour, sort) + `departments.area_id` nullable FK. Areas are real (grantable) — they group the rail and the org chart.
- **D-05:** New `roles` table (dept-scoped: name, budgeted_count) + `role_members` junction. Vacancies = budgeted_count − filled; rendered as first-class dashed chips with capacity counts (per sketch 001).
- **D-06:** **Role-level grants ARE in scope this phase** (user upgraded from the roadmap's "roles later"). The inheritance chain is org → area → department → role → person; all five levels are grantable, effective access = union up the chain. Roadmap success criterion 2 is amended accordingly.
- **D-07:** `member_departments` stays as-is; `role_members` sits alongside it (a person's dept membership is not derived from roles this phase).

### Placement & navigation
- **D-08:** The org model surface BECOMES `/admin/team` — the Team tab IS the org (Node Chart default, ⊞ Chart / ▤ Columns toggle; the current member list is absorbed into the Columns view). AdminNav stays at 5 tabs (UX-02 preserved).
- **D-09:** The wiring surface is `/admin/sops?view=access` — a third view beside "Needs attention", same fold idiom as governance (UX-03 precedent). Library deep-links ("Open in library (N)") are therefore same-page filter switches.
- **D-10:** `src/lib/journeys/journeys.ts` and (if team-review-worthy) `src/lib/uat/tests.ts` must be updated in the same change as the route/flow changes (project rule — /pathways must show 0 not-mapped).

### Grant semantics v1 + wire-up entry
- **D-11:** Grants are **additive-only** in v1. No "exclude from broadcast" carve-outs; revoking an inherited grant happens at its source (as sketch 003-D enforced). Exclude affordance is a deferred follow-up.
- **D-12:** Wire-up mode triggers from BOTH: (a) a post-publish "Wire up access" CTA that lands on `?view=access` with the SOP pinned `NEW · UNWIRED`, and (b) organically from the access view for any unwired or existing SOP.

### Claude's Discretion
- Grants table shape (single polymorphic subject_type/subject_id vs per-level columns), materialization mechanics (trigger vs server-action sync vs on-write fanout), chart auto-layout algorithm, and all component structure — planner/researcher decide within the locked decisions above.
- Blast-radius people count derivation (distinct people across granted units) — implementation detail, but the UNIT is people, not SOPs (locked by sketch findings).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Validated design (the contract for both surfaces)
- `.claude/skills/sketch-findings-SOPstart/SKILL.md` — index; auto-loads at build time
- `.claude/skills/sketch-findings-SOPstart/references/org-model-views.md` — Node Chart + Columns views, vacancy treatment, capacity counts, view-toggle CSS, data-model implications
- `.claude/skills/sketch-findings-SOPstart/references/permission-wiring-views.md` — access vocabulary (direct/inherited-via/personal), trace-on-click, inheritance resolution JS, AND the "At Scale: the D Hybrid" section (grouped structure, focus interaction, viz-as-filter URL contract, wire-up mode, fixed-height banner-slot layout rule)
- `.planning/sketches/003-wiring-at-scale/index.html` — live winner (variant D) with working reference implementation of grouping/focus/wire-up/slot-stability
- `.planning/sketches/001-org-model-canvas/index.html` — live winner (variant B chart + A columns)

### Existing model this phase extends (do not break)
- `supabase/migrations/00035`–`00037` — Phase 25 departments + junction tables (member_departments, sop_departments, block_departments; SELECT using(true) pattern; writes via admin client with org self-enforcement)
- `.planning/phases/25-department-first-class-entity/25-SPEC.md` — the departments model's original contract
- `CLAUDE.md` §Learnings — the [2026-06-15] junction-write/admin-client rule, [2026-05-13] RLS-recursion rule, [2026-07-05] SECURITY DEFINER RPC rule: all three apply directly to the grants schema

### Placement precedents
- `src/app/(protected)/admin/sops/page.tsx` — the `?view=` fold idiom (`view=attention`) that `view=access` must follow
- `src/components/admin/AdminNav.tsx` — 5-tab lock (UX-02); Team tab semantics change to "org"

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `departments` table + `DepartmentPicker`/`DepartmentCard` components (Phase 25) — dept colour/icon/owner carry straight into chart nodes and rail dots
- `getTeamMembersWithEmails()` (src/actions/auth) — the people data source the Columns view absorbs
- `GovernanceFilterChips` / `?view=` switching on the sops page — the pattern `view=access` clones
- `getSessionContext()` + `requireAdminContext()` (src/lib/auth) — mandatory auth idiom for all new server surfaces
- Paper/ink tokens in `src/styles/blueprint-theme.css` — sketch CSS maps 1:1 (tokens already defined, incl. the accent set fixed 2026-07-14)

### Established Patterns
- Junction tables with `SELECT using(true)` + NO authenticated write policy; writes via `createAdminClient()` with caller-side org enforcement — the grants + role_members + areas tables MUST follow this (CLAUDE.md 2026-06-15)
- Any new SECURITY DEFINER helper must be self-scoping via auth.uid() or REVOKEd to service_role (CLAUDE.md 2026-07-05)
- New routes are not "done" until journeys.ts reflects them (0 not-mapped on /pathways)
- Contextual banners: permanently-reserved fixed-height slots (sketch 003 finding — applies to the selection/wiring strips)

### Integration Points
- Materialization writes into `sop_departments` — the exact junction the worker library RLS reads; day-one equivalence migration is the cutover safety
- Post-publish CTA hooks into the existing publish flow (`performPublish` / builder PublishStage)
- `sops.category` remains (governance cadence key) — collections are seeded FROM it but do not replace it this phase

</code_context>

<specifics>
## Specific Ideas

- The sketches ARE the spec for look/feel/interaction — build to them, not to fresh invention. Sketch 003 variant D is a working reference implementation (grouping, focus, wire-up, slot stability) in ~700 lines of vanilla JS; the production build translates it, doesn't redesign it.
- Wire-up blast-radius banner copy pattern: "Visible to **104 people** via 3 grants" — people is the unit.
- Idle strip copy doubles as onboarding: "Select anything to trace who it reaches · click the NEW SOP to wire it up."

</specifics>

<deferred>
## Deferred Ideas

- **Exclude/inherited-revoke affordance** — carve a unit out of a broadcast grant (negative grants). Deferred from v1 (D-11); revisit with real usage data.
- **Per-SOP grant exceptions** — collections are the wiring unit this phase; individual-SOP grants are a later refinement.
- **Bus-routing "audit/wall-display" mode** — sketch 003 variant C proved always-on orthogonal routing works; parked unless an audit-print/wall-screen need appears.
- **Sub-trade tags ↔ dept/role semantics** — 00030 sub-trades remain untouched (carried from Phase 25); combining them with the new model is still open.
- **Org empty states / first-run onboarding + person effective-access drill-in** — frontier sketch candidates 006/007, worth sketching before or during build if time allows.

</deferred>

---

*Phase: 32-visual-org-model-library-permissions*
*Context gathered: 2026-07-18*
