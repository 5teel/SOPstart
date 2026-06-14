# Phase 25: department-first-class-entity - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Introduce an org-scoped `departments` table as a first-class entity with many-to-many junctions to blocks, SOPs, and members; replace the Phase 13 org-vs-global block model and the free-text SOP `category` with a single-org, department-organised model in which every department has a named owner. Delivers all three sketched surfaces (departments management page, block-library tagging/filter, team assignment) plus the create-SOP wizard department field.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**9 requirements are locked.** See `25-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `25-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
- `departments` table (org-scoped, owner_user_id, archived) + RLS
- Three junction tables: `block_departments`, `sop_departments`, `member_departments` + `blocks.all_departments` flag
- Migration retiring the org-vs-global block model and converting the 65 global seed blocks to org-owned
- Migration moving SOP organisation from free-text `category` to `sop_departments` (gating worker visibility)
- `/admin/departments` management page with owner accountability
- Block library reworked to department tagging/filter; deletion of `/admin/global-blocks` + `/suggestions` routes
- Team management department assignment + inline owner-set
- Create-SOP department multi-select writing `sop_departments`
- `journeys.ts` updated to add the department-admin pathway and remove deleted global-block routes

**Out of scope (from SPEC.md):**
- Sub-trade ↔ department combination semantics (sub-trades left untouched; AND/OR combination deferred) — **NOTE: superseded in part by D-02 below, which DOES define the composition as additive/OR for this phase**
- The unified create-SOP wizard itself (only the department field is wired here)
- The unified Read/Walk/Edit SOP surface
- Site/plant sub-tier of multi-tenancy
- Cross-org / platform-admin global curation (removed, not re-homed)
- Department-level approval chains / review-due governance

</spec_lock>

<decisions>
## Implementation Decisions

### Migration & back-compat (D-01)
- **D-01:** On migration, **auto-create one `General` department per org** and assign all existing SOPs and org-owned blocks to it. The 65 previously-global blocks convert to org-owned with `all_departments = true`. Nothing disappears from worker view on migration day; admins reorganise into real departments afterward. This is the chosen back-compat strategy (over "tag all as All departments" or "leave untagged"). The migration must be non-destructive: zero blocks deleted, `category` column retained read-only rather than dropped in the same migration.

### Visibility / RLS composition (D-02)
- **D-02:** Department-based SOP visibility is **additive / OR** with the existing assignment and sub-trade gates: a worker sees a SOP if it is assigned to them **OR** matches one of their departments **OR** matches one of their sub-trades **OR** is org-wide (`all_departments`). Untagged dimensions do not restrict (fail-open, consistent with how sub-trade RLS already behaves). This resolves the SPEC's deferred dept↔sub-trade question **for visibility composition only** — the richer skill×org-unit semantics remain deferred.
- **D-02a (constraint):** The RLS gate MUST avoid the `00030`/`00031` recursion trap — cross-table existence checks go in `SECURITY DEFINER` helper functions (or `using(true)` on non-sensitive junction tables with the real gate on the parent), never as direct cross-policy `EXISTS` chains.

### Owner model (D-03)
- **D-03:** A department owner is an **accountability label only** for this phase — `owner_user_id` is a single org member, rendered as the "★ Owns {Dept}" badge / department-card owner line, and drives the "No owner assigned" warning state. Owning a department grants **no new permissions** (no edit/approve rights beyond the member's existing role). Single owner per department (not multiple). Owner must reference a current `organisation_members` row; if that member is removed, the department surfaces the ownerless warning rather than silently orphaning.

### SOP scope (D-04)
- **D-04:** SOPs support an **org-wide "All departments" option** mirroring blocks — a SOP can be tagged to specific departments OR marked org-wide (visible to everyone). Good for site-wide procedures (evacuation, induction). Implies an `all_departments`-equivalent flag on the SOP (or a sentinel), parallel to `blocks.all_departments`.

### Claude's Discretion
- Exact junction-table column design, migration file count/sequencing, and which existing UI components to extend vs build new (researcher reads the code: `BlockListTable`, `SubTradePicker`, `RoleAssignmentTable`, `CategoryBottomSheet` are the obvious reuse candidates).
- Whether the SOP org-wide flag is a boolean column or a sentinel row in `sop_departments` — planner's call, as long as it parallels the block model.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked requirements
- `.planning/phases/25-department-first-class-entity/25-SPEC.md` — Locked requirements, boundaries, acceptance criteria. MUST read before planning.

### Validated design sketches (the target surfaces)
- `sketches/departments/index.html` — Department management page: cards with colour/code/owner + People/SOPs/Blocks counts, "No owner assigned" warning state.
- `sketches/unified-block-library/index.html` — Block library reworked to department filter + per-block multi-select department editor incl. "All departments".
- `sketches/team-departments/index.html` — Team page: many-to-many member↔department picker with inline owner-set; role dropdown orthogonal.

### Existing models being replaced / preserved
- `supabase/migrations/00022_block_library_phase13.sql` — the org-vs-global block model being **replaced**.
- `supabase/migrations/00023_phase13_nz_global_block_seed.sql` — the 65 global seed blocks to **migrate** to org-owned / all_departments.
- `supabase/migrations/00025_phase13_follow_latest_tracking.sql` — follow-latest triggers superseded by this phase; ensure the migration doesn't leave them dangling.
- `supabase/migrations/00030_sub_trades.sql` + `00031_fix_sops_sub_trades_rls_recursion.sql` — the visibility-gating pattern to **emulate and compose with** (and the recursion trap to avoid).

### Maintenance contract
- `CLAUDE.md` § "Pathways Map Maintenance" — `src/lib/journeys/journeys.ts` MUST be updated in the same change (add department-admin pathway; remove deleted global-block routes).
- `src/lib/journeys/journeys.ts` — current pathway source of truth (contains the `reusable-blocks`, `curate-globals` journeys that change here).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/admin/blocks/BlockListTable.tsx` — already shared across `/admin/blocks` and `/admin/global-blocks`; extend with a department-chips column + dept filter rather than rebuild.
- `src/components/admin/SubTradePicker.tsx` — the multi-select pill picker pattern; the member↔department picker should mirror it (and the block↔department editor too).
- `src/components/admin/RoleAssignmentTable.tsx` — the team table to extend with a department column + owner-set.
- `src/components/sop/CategoryBottomSheet.tsx` — the free-text category surface being replaced by department selection.
- `src/actions/blocks.ts` — `listBlocks({ includeGlobal, globalOnly, ... })` signature changes when org/global collapses to department filtering.

### Established Patterns
- RLS visibility gating via junction tables (sub-trades) — the precedent for department gating; reuse the `SECURITY DEFINER` / `using(true)`-on-junction approach from `00031`.
- Numbered sequential migrations in `supabase/migrations/` — next is `00035`.
- Anon key env var is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (not `ANON_KEY`).

### Integration Points
- Worker SOP library visibility (RLS on `sops` + assignment + sub-trade joins) — department gate composes here (D-02).
- Create-SOP flow (`/admin/sops/new/*`, parse pipeline) — writes `sop_departments` instead of `category`.
- `/pathways` coverage check — new `/admin/departments` route must be mapped in `journeys.ts`.

</code_context>

<specifics>
## Specific Ideas

- Department identity carries a **colour + icon** used consistently across all three surfaces (chips in library, swatch on team rows, stripe on department cards) — established in the sketches.
- "All departments" renders as a distinct cyan chip, visually separate from real-department chips (per `sketches/unified-block-library`).
- The "No owner assigned" warning is a **red** state on the department card (per `sketches/departments`) — it's a feature, surfacing the Visy governance gap, not an error.

</specifics>

<deferred>
## Deferred Ideas

- **Dept ↔ sub-trade richer semantics** — beyond the OR-composition for visibility (D-02), modelling a fitter-in-Forming intersection or replacing sub-trades entirely is a later phase.
- **Owner edit/approve permissions** — granting department owners actual rights over their dept's content (rejected for this phase per D-03; revisit with the governance/approval-chain phase).
- **Multiple owners per department** — considered and rejected for this phase (D-03) to preserve single-point accountability.
- **Unified create-SOP wizard** (`sketches/admin-sop-new-wizard`) — only the department field is wired here; collapsing the 4 creation routes is its own phase.
- **Unified Read/Walk/Edit SOP surface** (`sketches/unified-sop-surface`) — its own phase.
- **Site/plant multi-tenancy sub-tier** — separate phase.

</deferred>

---

*Phase: 25-department-first-class-entity*
*Context gathered: 2026-06-15*
