# Phase 25: Department as a First-Class Entity — Specification

**Created:** 2026-06-14
**Ambiguity score:** 0.175 (gate: ≤ 0.20)
**Requirements:** 9 locked

## Goal

Introduce an org-scoped `departments` table as a first-class entity and rewire blocks, SOPs, and members to reference it via many-to-many junctions — replacing the Phase 13 org-vs-global block model and the free-text SOP `category` with a single-org, department-organised model in which every department has a named owner.

## Background

SafeStart has no `departments` table today. The concept is currently approximated by three unrelated mechanisms:

- **SOP `category`** — a free-text string field on `sops`, surfaced via `CategoryBottomSheet`. No referential integrity, no ownership, inconsistent values.
- **Block org-vs-global model** (migration `00022_block_library_phase13.sql`, `00023` seed of 65 NZ globals, `00025` follow-latest tracking) — blocks are either org-owned or platform-curated globals, with a `/admin/global-blocks` + `/suggestions` platform-admin surface and pin-version/follow-latest semantics.
- **Sub-trades** (migrations `00030`/`00031`) — the only existing many-to-many "who sees what" mechanism: `member↔sub_trade` and `sop↔sub_trade` junctions gating SOP-library visibility via RLS. Sub-trade = skill (operator/fitter/sparky), conceptually orthogonal to an org unit.

The Visy field interview (2026-05-05) surfaced "**nobody owns SOPs**" as the #1 governance pain. The UX-simplification initiative (this conversation, 2026-06-13/14) produced three validated sketches — `sketches/departments`, `sketches/unified-block-library`, `sketches/team-departments` — that model departments as the organising spine across the admin surface, with a mandatory per-department **owner** and many-to-many tagging of blocks and people.

This phase builds the data entity and wires all three sketched surfaces plus the create-SOP wizard's department field. It deliberately leaves the sub-trade system in place and untouched.

## Requirements

1. **Departments table**: An org-scoped first-class entity.
   - Current: No `departments` table; SOP organisation is free-text `category`
   - Target: `departments` table with `id`, `organisation_id`, `name`, `code`, `colour`, `icon`, `owner_user_id` (nullable FK → org member), `archived` (bool), timestamps; RLS scopes all access to the member's organisation
   - Acceptance: Migration creates the table with org-scoped RLS; an admin can create a department and it is invisible to other orgs (cross-tenant isolation test passes)

2. **Block↔department junction (many-to-many)**: A block belongs to a set of departments, or is org-wide.
   - Current: Blocks carry org-vs-global scope, not department tags
   - Target: `block_departments(block_id, department_id)` junction + an `all_departments` boolean on the block; a block tagged to N departments appears under each; an `all_departments` block appears under every department filter
   - Acceptance: A block tagged to Forming + Maintenance returns in both department filters and not in Quality; an `all_departments` block returns in all filters

3. **SOP↔department junction (many-to-many) replacing free-text category**: SOP organisation moves from a string to department references.
   - Current: `sops.category` is a free-text string gating nothing
   - Target: `sop_departments(sop_id, department_id)` junction; the free-text `category` is retired from the create/edit surfaces (column may remain for back-compat read but is no longer the source of truth); a SOP's departments gate which workers see it in the library via RLS
   - Acceptance: A worker assigned only to Forming sees a Forming-tagged SOP and does NOT see a Cleaning-only SOP; the create-SOP wizard writes `sop_departments` rows, not a `category` string

4. **Member↔department junction (many-to-many)**: A person can belong to several departments.
   - Current: No person↔department link; only `member↔sub_trade` exists
   - Target: `member_departments(member_id, department_id)` junction; team management assigns a member to one or more departments
   - Acceptance: A member assigned to Forming + Cleaning appears under both department filters in `/admin/team`; removing one assignment removes them from that filter only

5. **Department ownership**: Each department names an accountable owner.
   - Current: No ownership concept anywhere — the Visy "nobody owns SOPs" gap
   - Target: `departments.owner_user_id` settable from both the departments page and the team member's department picker; the owner must be a member of the org
   - Acceptance: Setting an owner persists and renders as a "★ Owns {Dept}" badge on the team row and an "Owner" line on the department card; a department with no owner renders the explicit "No owner assigned" warning state

6. **Departments management page**: `/admin/departments` CRUD surface.
   - Current: No such route
   - Target: `/admin/departments` lists department cards (colour, code, owner, and live People/SOPs/Blocks counts), supports create/edit/archive, and sets the owner; matches `sketches/departments`
   - Acceptance: Page renders one card per department with correct counts; create adds a department; archive hides it from active filters without deleting its junction history; a department missing an owner is flagged red

7. **Block library department tagging + filter (replaces org/global UI)**: The single block library organised by department.
   - Current: `/admin/blocks` has My/Global scope tabs; `/admin/global-blocks` + `/admin/global-blocks/suggestions` are separate platform-admin routes
   - Target: `/admin/blocks` filters by department (All + per-department + counts), shows each block's department chips, and offers a multi-select department editor incl. "All departments"; the `/admin/global-blocks` and `/admin/global-blocks/suggestions` routes are removed; matches `sketches/unified-block-library`
   - Acceptance: The two `/admin/global-blocks*` routes return 404/are deleted; the block library filters and tags by department; no "My library / Global library" scope control remains in `src/`

8. **Global-block data migration**: The 65 NZ seed globals survive the model change.
   - Current: 65 platform-curated global blocks exist (`organisation_id = null`) from migration `00023`
   - Target: A migration converts existing global blocks to org-owned blocks tagged `all_departments = true` (or seeds them per-org as appropriate to the single-org model), so no block is orphaned and previously-global content remains available org-wide
   - Acceptance: After migration, zero blocks have `organisation_id = null`; every previously-global block is readable by the org and surfaces under the "All departments" filter; no block row is deleted by the migration

9. **Team + wizard department assignment**: Departments are selectable where people and SOPs are created/managed.
   - Current: `/admin/team` has role + sub-trade pickers only; the create-SOP entry has a free-text category field
   - Target: `/admin/team` adds a many-to-many department picker per member (with inline owner-set), per `sketches/team-departments`; the create-SOP flow exposes a department multi-select that writes `sop_departments`
   - Acceptance: Assigning a member to a department from `/admin/team` persists a `member_departments` row; creating a SOP with two departments selected persists two `sop_departments` rows

## Boundaries

**In scope:**
- `departments` table (org-scoped, owner_user_id, archived) + RLS
- Three junction tables: `block_departments`, `sop_departments`, `member_departments` + `blocks.all_departments` flag
- Migration retiring the org-vs-global block model and converting the 65 global seed blocks to org-owned
- Migration moving SOP organisation from free-text `category` to `sop_departments` (gating worker visibility)
- `/admin/departments` management page with owner accountability (per `sketches/departments`)
- Block library reworked to department tagging/filter; deletion of `/admin/global-blocks` + `/suggestions` routes (per `sketches/unified-block-library`)
- Team management department assignment + inline owner-set (per `sketches/team-departments`)
- Create-SOP department multi-select writing `sop_departments`
- `journeys.ts` updated to add the department-admin pathway and remove the deleted global-block routes

**Out of scope:**
- **Sub-trade ↔ department combination semantics** — sub-trades (00030/00031) are left untouched; whether dept-visibility and sub-trade-visibility AND-combine or OR-combine is explicitly deferred to a later phase (avoids reworking shipped RLS this phase)
- **The unified create-SOP wizard itself** (`sketches/admin-sop-new-wizard`) — only the department *field* is wired here; collapsing the 4 creation routes into one wizard is a separate phase
- **The unified Read/Walk/Edit SOP surface** (`sketches/unified-sop-surface`) — separate phase
- **Site/plant sub-tier of multi-tenancy** — the org-below-site tier from the Visy interview is a separate multi-tenancy phase; this phase is single-org with departments only
- **Cross-org / platform-admin global curation** — removed by this phase, not re-homed elsewhere; if a shared NZ library returns it is a future decision
- **Department-level approval chains / review-due governance** — ownership is named here, but multi-step approval workflows are a separate governance phase

## Constraints

- **Single migration discipline**: per the project learning (`00026` rename bug), any table rename or function body touching renamed objects must be followed by `CREATE OR REPLACE` and tested end-to-end; the global-block migration must not orphan blocks or break the `follow-latest` triggers it supersedes.
- **RLS recursion risk**: department visibility policies must not recurse across `sops`/junction tables (per the `00030/00031` recursion learning) — cross-table checks go in `SECURITY DEFINER` helpers or `using(true)` on non-sensitive junctions, with the real gate on the parent.
- **No destructive data loss**: the global→org migration and category→sop_departments migration must preserve existing content; `category` column may be retained read-only rather than dropped in the same migration.
- **Anon key name**: scripts use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not `ANON_KEY`).
- **Many-to-many everywhere**: blocks, SOPs, and members all use junction tables — no single-FK "one department per X" shortcut.
- **Owner must be an org member**: `owner_user_id` references a current `organisation_members` row; archiving/removing a member who owns a department must surface the now-ownerless state, not silently orphan it.

## Acceptance Criteria

- [ ] `departments` table exists, org-scoped via RLS; a department created in org A is invisible to org B
- [ ] `block_departments`, `sop_departments`, `member_departments` junctions exist; each supports a row's membership in multiple departments
- [ ] `blocks.all_departments = true` makes a block appear under every department filter
- [ ] A worker assigned only to Forming sees Forming SOPs and not Cleaning-only SOPs (RLS-gated)
- [ ] `/admin/departments` renders one card per department with People/SOPs/Blocks counts, supports create/edit/archive, and sets an owner
- [ ] A department with no owner renders the explicit "No owner assigned" warning; setting an owner clears it and shows "★ Owns {Dept}" on the team row
- [ ] `/admin/global-blocks` and `/admin/global-blocks/suggestions` routes no longer exist; no "My/Global library" scope control remains in `src/`
- [ ] After the global-block migration, zero blocks have `organisation_id = null` and every previously-global block surfaces under "All departments"; no block row deleted
- [ ] The create-SOP flow writes `sop_departments` rows (not a free-text `category`); `/admin/team` writes `member_departments` rows
- [ ] `src/lib/journeys/journeys.ts` adds the department-admin pathway and contains no references to the deleted global-block routes (`/pathways` "All screens" shows 0 not-mapped for new routes)

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                        |
|--------------------|-------|------|--------|--------------------------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | Entity + 3 junctions + 3 surfaces + SOP↔dept spine, all sketched |
| Boundary Clarity   | 0.80  | 0.70 | ✓      | Sub-trade interaction, wizard, unified surface, site-tier explicitly excluded |
| Constraint Clarity | 0.75  | 0.65 | ✓      | Migration discipline + RLS recursion + no-data-loss locked   |
| Acceptance Criteria| 0.80  | 0.70 | ✓      | 10 pass/fail criteria, all DB/route/RLS verifiable           |
| **Ambiguity**      | 0.175 | ≤0.20| ✓      | Gate passed in round 1                                       |

Status: ✓ = met minimum, ⚠ = below minimum (planner treats as assumption)

## Interview Log

| Round | Perspective    | Question summary                                  | Decision locked                                                      |
|-------|----------------|---------------------------------------------------|----------------------------------------------------------------------|
| 0     | Researcher     | What models departments today?                    | None — free-text `category`, org-vs-global blocks, sub-trades (orthogonal) |
| 1     | Boundary Keeper| Phase scope across surfaces?                      | Entity + all three surfaces (departments page, block lib, team) + wizard dept field |
| 1     | Boundary Keeper| Relationship to org-vs-global block model?        | Replace org/global with single-org + departments; migrate 65 globals to org-owned, "All departments" |
| 1     | Boundary Keeper| Do SOPs link to departments?                      | Yes — `sop_departments` replaces free-text category; gates worker visibility |
| 1     | Boundary Keeper| Coexistence with sub-trades?                      | Keep sub-trades untouched; dept↔sub-trade combination deferred (out of scope) |

---

*Phase: 25-department-first-class-entity*
*Spec created: 2026-06-14*
*Next step: /gsd-discuss-phase 25 — implementation decisions (junction schema details, migration sequencing, RLS helper design, UI wiring)*
