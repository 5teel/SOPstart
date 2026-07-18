# Phase 32: Visual Org Model & Library Permissions - Research

**Researched:** 2026-07-18
**Domain:** Supabase/Postgres schema design (RLS junction pattern) + Next.js admin surface extension + hand-rolled SVG/CSS org-chart & wiring UI (no graph library)
**Confidence:** MEDIUM-HIGH — schema/materialization patterns are HIGH confidence (direct precedent in this codebase); the role/person-level grant enforcement mechanism is a genuine open architectural question flagged below (do not let the planner silently paper over it)

## Summary

This phase is a schema + surface build against an already-locked visual design (sketches 001/002/003, folded into `sketch-findings-SOPstart`). The codebase gives a nearly identical precedent to copy: **Phase 25's departments/junction pattern** (migration 00035, `src/actions/departments.ts`) is the exact shape this phase's `areas`/`roles`/`collections`/`access_grants` tables should follow — org-scoped table + `SELECT using(true)` junctions + admin-client writes with caller-side org self-enforcement + replace-semantics assigner functions. No new npm packages, no graph-rendering library — the sketches are literal reference implementations (absolutely-positioned nodes + one SVG bezier underlay) meant to be translated into React, not redesigned.

The one real unknown is NOT chrome or schema shape — it's **how role-level and person-level grants (D-06, newly in scope) actually enforce**, given D-02's constraint of materializing only onto the existing `sop_departments` junction (which has no `person_id`/`role_id` column) and "no new RLS policies on the read path." Department/area/org-level grants map cleanly onto `sop_departments` (all three levels ultimately resolve to a department-id set). Role/person-level grants do not — the flagship sketch scenario itself (Priya gets personal access to Chemical Handling beyond her department's access) cannot be enforced without either broadening to her whole department (wrong) or adding one new narrow RLS arm (which reads as "new RLS" that D-02 forbids). This is flagged as Open Question #1 and needs an explicit planner/Simon call before Wave 1 schema work locks in — see Architecture Patterns → Materialization for the concrete recommendation.

**Primary recommendation:** Copy the Phase 25 junction pattern verbatim for the new entities; implement grant resolution as ONE pure `resolveEffectiveAccess()` function shared by every view (Node Chart, Columns, Wiring, Matrix, Illuminate, wire-up mode); materialize via a server-action-callable `materializeSopAccess(sopId)` function (not a DB trigger) invoked on both grant writes and SOP↔collection changes; get an explicit decision on the role/person-grant enforcement gap before building the wiring surface's write path.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Org chart drawing/editing (areas → depts → roles → people) | API / Backend (server actions) | Frontend Server (SSR page) | Writes need org self-enforcement server-side (Phase 25 precedent); page.tsx server-fetches the full tree in one shot |
| Node Chart / Columns rendering + auto-layout | Browser / Client | — | Pure presentational computation over server-fetched data, same as FlowGraphCanvas (Phase 24) |
| Grant CRUD (org/area/dept/role/person × collection) | API / Backend (server actions) | Database / Storage (`access_grants` junction) | Mirrors `assignSopDepartments` replace-semantics + admin-client pattern |
| Effective-access resolution (union-up-chain) | API / Backend (pure resolver fn) | Browser / Client (reuses same fn client-side for instant UI feedback in wire-up mode) | Must be ONE implementation reused by every view per the sketch's "no view-private state" rule |
| Grant materialization → `sop_departments` | API / Backend (server-action sync) | Database / Storage (derived rows) | Trigger vs server-action decision — see recommendation below; server-action wins on this codebase's precedent |
| Worker SOP visibility enforcement (read path) | Database / Storage (RLS) | — | UNTOUCHED this phase per D-02 for the department/area/org arms; open question for role/person arms |
| Wiring / Patch-Bay / connect-mode UI (SVG wires, trace-on-click, blast radius) | Browser / Client | API / Backend (grant read/write on toggle) | Client-side interaction per sketch 002/003 reference JS; writes still go through server actions |
| Library-as-filter deep link (`/admin/sops?departments=…`) | Frontend Server (SSR, existing `?view=` idiom) | Browser / Client (URL nav from the viz) | `/admin/sops/page.tsx` already server-filters by query params; this is a new filter arm on the same pattern |
| Post-publish "Wire up access" CTA | Frontend Server (PublishStage.tsx) | API / Backend (marks SOP `NEW · UNWIRED` state) | Extends existing `performPublish()` / `PublishStage` component, does not fork the publish pipeline |

## Standard Stack

### Core (all already installed — zero new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase JS / Postgres RLS | existing | New tables + junctions | Every other multi-tenant entity in this codebase uses this pattern (departments, blocks, sub-trades) |
| React 19 / Next.js 16 App Router | existing | Org chart + wiring pages | `/admin/team` and `/admin/sops` already server components with `?view=` fold idiom |
| Zod | existing | Input validation on new server actions | Matches `DEPT_COLOURS` enum pattern in `src/actions/departments.ts` |
| Plain SVG + CSS (no library) | n/a | Node Chart connectors, Patch-Bay wires | Sketches 001/002/003 ARE the reference implementation — absolutely-positioned `.node` divs + one `<svg>` underlay with bezier paths computed from `getBoundingClientRect()` at runtime. This is the spec, not a starting point. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled SVG wires (recommended) | react-flow, d3, dagre/elk auto-layout | Explicitly rejected per CONTEXT instructions ("Do NOT propose adding a graph library unless the sketches' approach genuinely cannot translate"). At ~700 lines of vanilla JS for the hardest case (sketch 003, 15×20 scale), the reference implementation already proves the approach scales without a library. Adding one would also fight the sketch's exact visual spec (node/jack CSS, bezier curve math, focus/dim states) rather than reuse it. |
| Server-action-driven materialization (recommended) | Postgres trigger on `access_grants`/`sop_collections` INSERT/UPDATE/DELETE | A trigger can't perform org-self-enforcement checks the way a server action can, and this codebase has zero precedent for using triggers to sync derived junctions (every existing derived-write — `assignSopDepartments`, `assignBlockDepartments` — is a server action). Triggers also hit the [2026-05-08] "SQL function body references table by NAME, breaks on rename" class of risk for no benefit here. |
| Single polymorphic `access_grants` table (recommended) | Five separate tables (`org_grants`, `area_grants`, `dept_grants`, `role_grants`, `person_grants`) | Five tables means five near-identical CRUD paths and five places the union-up-chain resolver has to query; a polymorphic `(subject_type, subject_id, collection_id)` table is one table, one resolver query (`WHERE (subject_type, subject_id) IN (...)`), and matches how the sketch's own `GRANTS[unit]` / `CHAIN[unit]` JS model already thinks about it. |

**Installation:** none — no new packages for this phase.

## Package Legitimacy Audit

Not applicable — this phase adds zero new npm/pip/cargo dependencies. All work is new Postgres schema + React components built from already-installed libraries and the sketch reference implementations. If the planner ever considers a graph-layout package mid-phase, treat that as a scope deviation requiring re-research (CONTEXT explicitly locks "no graph library unless the sketches' approach genuinely cannot translate").

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser (admin)                                                     │
│                                                                        │
│  /admin/team              /admin/sops?view=access                    │
│  ┌──────────────────┐     ┌──────────────────────────────────┐      │
│  │ Node Chart ⊞      │     │ Wiring ⌇ / Matrix ▦ / Illuminate ◉│     │
│  │ (default)          │     │ (default: grouped D-hybrid)       │      │
│  │  area → dept →     │     │  org units ↔ collections          │      │
│  │  role → person      │     │  trace-on-click, focus, wire-up   │      │
│  │ Columns ▤ (alt)     │     │                                    │      │
│  └─────────┬──────────┘     └───────────────┬────────────────────┘      │
│            │  resolveEffectiveAccess() (SAME fn, both surfaces)         │
└────────────┼───────────────────────────────┼─────────────────────────┘
             │ server action calls            │ server action calls
             ▼                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Next.js server actions (src/actions/org-model.ts, grants.ts)        │
│                                                                        │
│  listOrgTree()        createGrant()/revokeGrant()                    │
│  createArea/Role/etc   materializeSopAccess(sopId) ◄── called on:    │
│  role_members writes                 · grant create/delete           │
│                                       · sop↔collection change         │
│                                       · wire-up "✓ Done" confirm      │
│         (admin client + org self-enforcement, mirrors                │
│          src/actions/departments.ts pattern exactly)                 │
└────────────┬──────────────────────────────────┬──────────────────────┘
             │ writes                             │ writes (derived)
             ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Postgres                                                             │
│                                                                        │
│  areas · departments(+area_id) · roles · role_members                │
│  collections · sop_collections · access_grants (polymorphic)         │
│                        │                                              │
│                        │ materializeSopAccess() writes into ──────►  │
│                        ▼                                              │
│              sop_departments (UNCHANGED table/RLS from Phase 25)     │
│                        │                                              │
│                        ▼                                              │
│         sops_visible_by_department policy (UNTOUCHED, D-02)          │
│                        │                                              │
└────────────────────────┼──────────────────────────────────────────────┘
                          ▼
              Worker read path (/sops) — zero code changes this phase
```

### Recommended Project Structure

```
supabase/migrations/
├── 00046_org_model_schema.sql        # areas, departments.area_id, roles, role_members,
│                                      #   collections, sop_collections, access_grants
├── 00047_org_model_data.sql          # collections seeded from sops.category;
│                                      #   sop_collections backfilled; access_grants
│                                      #   seeded from sop_departments (day-one equivalence)
src/actions/
├── org-model.ts                      # areas/roles/role_members CRUD (mirrors departments.ts)
├── grants.ts                         # access_grants CRUD + materializeSopAccess()
src/lib/org-model/
├── resolve-access.ts                 # resolveEffectiveAccess() — pure, shared by every view
├── auto-layout.ts                    # deterministic layered layout (reuse FlowGraphCanvas's
│                                      #   bounding-box approach, src/components/sop/flow/FlowGraphCanvas.tsx)
src/components/admin/org-model/
├── OrgChartCanvas.tsx                # Node Chart view (absolutely-positioned nodes + SVG underlay)
├── OrgColumnsBoard.tsx               # Columns alt view
├── ViewToggle.tsx                    # shared ⊞/▤ and ⌇/▦/◉ segmented control (org-model-views.md CSS)
src/components/admin/wiring/
├── WiringPatchBay.tsx                # default D-hybrid view (grouped, focus, wire-up mode)
├── AccessMatrix.tsx / Illuminate.tsx # alt views
├── SelectionStrip.tsx                # fixed-height banner slot (idle/selection/wiring states)
src/app/(protected)/admin/team/page.tsx        # becomes org chart (D-08)
src/app/(protected)/admin/sops/page.tsx        # gains ?view=access arm (D-09)
```

### Pattern 1: Polymorphic junction + replace-semantics assigner (grants CRUD)

**What:** `access_grants(id, organisation_id, subject_type, subject_id, collection_id, granted_by, created_at)` — `subject_type` is a Postgres enum `'org'|'area'|'department'|'role'|'person'`, `subject_id` is `null` for `'org'` and a real FK-shaped uuid otherwise (no single FK column — enforce referential integrity in the server action, exactly like `orgScopedDeptIds()` does for department ids today).

**When to use:** Every grant write (create or, per D-11 additive-only v1, delete-only — no partial-edit UI).

**Example (adapted from `src/actions/departments.ts` `assignSopDepartments`):**
```typescript
// Source: pattern lifted from src/actions/departments.ts assignBlockDepartments/assignSopDepartments
export async function createGrant(input: {
  subjectType: 'org' | 'area' | 'department' | 'role' | 'person'
  subjectId: string | null   // null only when subjectType === 'org'
  collectionId: string
}) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const admin = createAdminClient()
  const orgId = await callerOrgId(admin, ctx)
  if (!orgId) return { error: 'No organisation' }

  // Verify subject belongs to caller's org (mirrors orgScopedDeptIds — never trust client subject_id).
  if (input.subjectType !== 'org') {
    const table = { area: 'areas', department: 'departments', role: 'roles', person: 'organisation_members' }[input.subjectType]
    // org-scope check per table (roles need a join through departments.organisation_id)
  }

  const { data, error } = await admin.from('access_grants').insert({
    organisation_id: orgId,
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    collection_id: input.collectionId,
    granted_by: ctx.user.id,
  }).select('*').single()
  if (error) return { error: error.message }

  // Recompute every SOP in this collection's materialized department set.
  await materializeCollectionAccess(input.collectionId, orgId)
  return { grant: data }
}
```

### Pattern 2: ONE resolver function shared by every view

**What:** `resolveEffectiveAccess(orgTree, grants)` — pure function implementing the sketch's own `direct`/`inherited`/`personal` vocabulary (permission-wiring-views.md's `Inheritance resolution` JS block is the literal reference algorithm — translate it, don't reinvent it).

**When to use:** Node Chart badges, Columns view, Wiring/Matrix/Illuminate views, wire-up mode's live blast-radius banner, and the library-filter deep-link count — ALL of these need the identical union-up-the-chain computation. Computing it five different times in five components is exactly the kind of drift this phase's own design docs warn against ("no view-private state").

**Example:**
```javascript
// Source: .claude/skills/sketch-findings-SOPstart/references/permission-wiring-views.md
// (Inheritance resolution block) — translate directly, extend CHAIN to 5 levels
// (org, area, department, role, person) per D-06.
const direct = new Set(GRANTS[unit])
const inherited = {}
CHAIN[unit].slice(0, -1).forEach(anc =>
  GRANTS[anc].forEach(g => { if (!direct.has(g)) inherited[g] = anc })
)
```

### Anti-Patterns to Avoid

- **Mount-on-select banners:** the selection/wiring strip is a permanently-reserved fixed-height slot (48px) that swaps content, never mounts/unmounts (sketch 003 finding, restated as CONTEXT success criterion 6). Any component that conditionally renders the banner div itself (rather than always rendering it and swapping inner content/class) will jump the graph on click.
- **Computing effective access differently per view** — see Pattern 2. If Matrix and Wiring ever disagree on whether a unit "has" a collection, that's a resolver bug, not a display bug.
- **Materializing grants with a DB trigger** — no precedent in this codebase for this class of derived-write; server actions are the established pattern and the only place org self-enforcement can run.
- **Reusing `sop_assignments` as a visibility gate** — confirmed in this research (see Pitfall 1) that `sop_assignments` (MGMT-01/02, "assigned SOPs first") is a sort/highlight table, NOT an RLS gate. `workers_can_view_own_assignments` only lets a worker read their own assignment ROWS — it does not restrict which `sops` rows are visible. Do not assume it can be repurposed as the person-level grant enforcement mechanism without adding a new policy on `sops` (which is itself Open Question #1 below).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Org-chart node auto-layout | A generic force-directed / graph-layout algorithm | Reuse the deterministic bounding-box layered layout from `src/components/sop/flow/FlowGraphCanvas.tsx` (Phase 24-02's `layoutFromPositions`) — position by depth-level columns, siblings evenly spaced | Same visual language cited by org-model-views.md ("the same visual language as the shipped SOP Flow tab"); this codebase already solved "deterministic layout for a hand-drawn-feeling chart" once, do not re-solve it |
| Bezier wire drawing between DOM nodes | A canvas/WebGL renderer | Runtime `getBoundingClientRect()` + cubic bezier `path.setAttribute('d', ...)`, redrawn on resize/view-switch | Sketch 002/003's proven approach at real (15×20) scale; adding a rendering engine for this is the definition of over-engineering here |
| Effective-access ("who can see what") logic | Bespoke per-view calculation | ONE `resolveEffectiveAccess()` (Pattern 2) | Multiple implementations WILL drift; this is exactly what the [2026-07-13] ReviewStation learning class warns about (a UI surface that looks correct but computes something different from what it displays) |
| Grant → visibility sync | Manual "remember to re-run this after every write" convention | A single `materializeSopAccess(sopId)` / `materializeCollectionAccess(collectionId)` pair called from every grant-write and collection-membership-write call site | Same failure class as the [2026-07-05] best-effort-pipeline learning — an un-called sync path silently produces stale `sop_departments` rows that LOOK fine (no error) but are wrong |

**Key insight:** This phase's biggest risk is not "how do I build a chart" (the sketches solved that) — it's "how do I keep five different views and one derived junction table in agreement." Centralize the two hard computations (effective access, materialization) into single functions and every view/CTA calls them.

## Runtime State Inventory

Not applicable — this is a greenfield schema addition (new tables + new derived-write path), not a rename/refactor/migration of existing identifiers. Skipping per the greenfield-phase exemption.

## Common Pitfalls

### Pitfall 1: Role/person-level grants have no enforcement mechanism under the locked constraints (THE key open question)

**What goes wrong:** D-06 puts role-level and person-level grants in scope, with "effective access = union up the chain" across all 5 levels (org → area → department → role → person). D-02 locks enforcement to "materialize onto the existing `sop_departments` junction" and "no new RLS policies on the read path." `sop_departments` is `(sop_id, department_id)` — it cannot express "visible to this ONE person" or "visible to this ONE role" without also making the SOP visible to that person/role's entire department (over-broad) or leaving the grant unenforced (under-broad, silently wrong).

**Why it happens:** The two locked decisions (D-02, D-06) were made in the same CONTEXT session but don't fully reconcile — D-02 predates the D-06 upgrade-from-roadmap note ("user upgraded from the roadmap's 'roles later'"). The sketch's own flagship demo scenario (Priya gets personal access to Chemical Handling, which her department does NOT otherwise have) is precisely the case this gap breaks.

**How to avoid:** This needs an explicit decision BEFORE the wiring surface's write path is built — presenting it as a plan-time or discuss-phase decision is safer than the planner silently picking one. Three real options, ranked:
1. **(Recommended default if a decision is needed fast)** Add ONE new, narrow, additive RLS arm mirroring the exact 00035 template: a `sop_person_grants`-style resolution — OR more precisely, extend `sops_visible_by_department`'s SECURITY-DEFINER helper family with a `sop_visible_by_person_grant(sop_id)` function reading a new junction populated by `materializeSopAccess`. This is additive (does not touch or modify any shipped policy — same non-destructive spirit as 00035's own department policy addition) but is, in the letter, "one new policy." Confirm with Simon that "no new RLS policies" meant "don't touch the shipped policies," not "zero net-new policies ever."
2. Ship v1 with role/person-level grants **recorded and correctly visualized** (grants table is the source of truth for the wiring UI's wires, badges, and blast-radius banner) but **enforcement rounds up to the owning department** — i.e., granting Priya personal access to Chemical Handling actually materializes as adding Priya's department to Chemical Handling's `sop_departments` rows. This keeps D-02 literal but means the blast-radius banner copy ("Visible to 104 people via 3 grants") MUST reflect the rounded-up reach, not the naive count, or the UI actively lies about what publish does.
3. Treat role/person-level enforcement as a fast-follow: the UI supports drawing the grant and shows it in every view, but a banner/badge marks it "not yet enforced — reaches department level only" until a follow-up phase adds the RLS arm.

Do not let this get resolved implicitly inside a plan file — it changes what "done" means for success criterion 2.

### Pitfall 2: `roles` (new, dept-scoped job role table) name-collides with existing `app_role` enum

**What goes wrong:** The codebase already has a `role` concept everywhere — `organisation_members.role` / `app_role` enum (`worker`, `supervisor`, `admin`, `safety_manager`), used throughout `requireAdminContext()`, RLS policies, `sop_assignments.role`. Phase 32's new `roles` table (D-05: dept-scoped job-title role like "Operator — night shift") is a COMPLETELY different concept. A careless `ctx.role` vs `role.id` mixup, or a query/variable named generically `role`, will silently mix these two systems.

**Why it happens:** Same English word, two different domain concepts introduced 6 months apart.

**How to avoid:** Never name a variable/type bare `role` in Phase 32 code — use `orgRole` (existing `app_role`) vs `jobRole` / `deptRole` (new `roles` table) consistently in code and in any new type names (`Role` type name is already free in `src/types/sop.ts` — grep before claiming it, but pick an unambiguous name like `DeptRole` regardless).

### Pitfall 3: Collections are NOT the same object as `sops.category`

**What goes wrong:** D-01/CONTEXT explicitly says collections are seeded FROM `sops.category` but are a distinct, richer entity (colour, sort, org-scoped, many-to-many via `sop_collections`) and `sops.category` is explicitly retained ("governance cadence key") — Phase 28's `resolveCadenceMonths` reads `sops.category` directly for review-cadence resolution. A future edit to a SOP's collections must NOT silently change its category (which would change its review cadence), and vice versa.

**Why it happens:** They start byte-identical at seed time (one collection per distinct category value), so it's easy to conflate them as "the same field, renamed."

**How to avoid:** Treat `sop_collections` as fully independent of `sops.category` after the seed migration runs. Do not wire any UI control that edits one and expects the other to follow.

### Pitfall 4: Junction-write runtime tests, not just source-contract greps (recurring project-wide risk)

**What goes wrong:** CLAUDE.md's [2026-06-15] learning: three prior junction tables (`member_departments`, `block_departments`, `sop_departments`) shipped with green source-contract tests but a real `42501 RLS violation` at runtime, because the write used the session client instead of the admin client. The exact same trap applies to every new junction this phase (`role_members`, `sop_collections`, `access_grants`).

**Why it happens:** Source-contract tests (`toContain('createAdminClient')`) prove the CODE MENTIONS the right client, not that the write actually succeeds against a real RLS-enabled table.

**How to avoid:** At least one runtime test per new junction table that actually performs the insert as an authenticated admin (not `test.fixme`), per the CLAUDE.md-mandated fix pattern.

### Pitfall 5: PostgREST schema-cache staleness right after `db push`

**What goes wrong:** CLAUDE.md's [2026-06-15] learning: `db push` can succeed while PostgREST's schema cache hasn't reloaded yet, producing false "table not found" (`PGRST205`) in any post-migration assertion script that runs immediately after.

**How to avoid:** Any migration-verification script for this phase's 7 new tables should either wait/retry, call `NOTIFY pgrst, 'reload schema'` via the Management API, or check existence via `to_regclass()` raw SQL instead of the PostgREST REST client.

## Code Examples

### Grant seed from existing `sop_departments` (day-one equivalence, D-03)

```sql
-- Source: pattern from supabase/migrations/00036_departments_data.sql
-- (idempotent per-org loop, ON CONFLICT DO NOTHING, RAISE EXCEPTION assertion)
-- Step A: seed one collection per distinct sops.category per org.
INSERT INTO public.collections (organisation_id, name, colour, sort)
SELECT DISTINCT s.organisation_id, s.category, '#3b82f6', 0
FROM public.sops s
WHERE s.category IS NOT NULL
ON CONFLICT DO NOTHING;  -- requires a unique (organisation_id, name) constraint

-- Step B: sop_collections — every SOP joins its category's collection.
INSERT INTO public.sop_collections (sop_id, collection_id)
SELECT s.id, c.id
FROM public.sops s
JOIN public.collections c ON c.organisation_id = s.organisation_id AND c.name = s.category
ON CONFLICT DO NOTHING;

-- Step C: access_grants — one department-level grant per (department, collection)
-- pair that ALREADY exists via sop_departments today. This is the "day-one
-- equivalence" guarantee (D-03): nothing a worker can see changes at cutover,
-- because materializeSopAccess() run against these grants must reproduce the
-- existing sop_departments rows exactly.
INSERT INTO public.access_grants (organisation_id, subject_type, subject_id, collection_id, granted_by)
SELECT DISTINCT sd.department_id::text::uuid, 'department', sd.department_id, sc.collection_id, NULL
FROM public.sop_departments sd
JOIN public.sop_collections sc ON sc.sop_id = sd.sop_id
ON CONFLICT DO NOTHING;

-- Final assertion (mirrors 00036's RAISE EXCEPTION pattern): after running
-- materializeSopAccess() for every affected SOP, assert the resulting
-- sop_departments row COUNT and CONTENT is byte-identical to pre-migration.
```

### Fixed-height banner slot (never mount/unmount)

```tsx
// Source: .claude/skills/sketch-findings-SOPstart/references/permission-wiring-views.md
// "Layout stability rule" — applies to the selection/wiring strip AND any
// future contextual banner in the app.
<div className="h-[48px] overflow-hidden" data-state={bannerState /* 'idle' | 'selection' | 'wiring' */}>
  {bannerState === 'idle' && <p className="mono ...">Select anything to trace who it reaches · click the NEW SOP to wire it up.</p>}
  {bannerState === 'selection' && <p className="truncate ...">Visible to <b>{count}</b> people via {grantCount} grants</p>}
  {/* NEVER: {bannerState === 'idle' ? null : <div>...</div>} — that's mount/unmount, the exact bug this rule exists to prevent */}
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Department-only SOP visibility gate (`sop_departments`, Phase 25) | Grant-driven materialization onto the same table, plus (pending Open Question #1) a possible new person-level arm | This phase | Existing worker read path stays functionally identical at cutover (D-03); admin authoring surface changes substantially |
| Flat member list (`/admin/team`) | Org chart IS the Team tab (D-08) | This phase | `RoleAssignmentTable` list becomes the Columns alt view, not deleted |
| `sops.category` as the sole grouping/cadence key | `collections` (many-to-many) as the wiring unit, `category` retained separately for cadence | This phase | Two parallel taxonomies now exist on purpose — see Pitfall 3 |

**Deprecated/outdated:** None — this is additive; nothing from Phase 25/28/29/30 is removed or replaced.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `sop_assignments` does not gate SOP visibility (only surfaces "assigned to me" sort order) — verified by reading `src/actions/assignments.ts` and the RLS policy in `00007_sop_assignments.sql`, so this is CITED from source, not assumed | Common Pitfalls / Anti-Patterns | Low — this was directly read from the codebase, not inferred, but flagging since it contradicts an intuitive assumption a planner might make |
| A2 | A single new RLS arm for person-level grants would satisfy the "spirit" of D-02 even though it is technically a new policy | Pitfall 1 recommendation | Medium — if Simon intended "zero new RLS policies, full stop," Option 1 is off the table and the phase must ship with Option 2 or 3's rounding/deferred-enforcement tradeoff instead |
| A3 | `collections` needs a `unique(organisation_id, name)` constraint for the seed migration's `ON CONFLICT DO NOTHING` to be idempotent — not yet confirmed against a written migration | Code Examples | Low — straightforward to add; flagging so the planner doesn't omit the constraint and get duplicate collections on a migration re-run |

**If this table is empty:** N/A — see above.

## Open Questions

1. **How do role-level and person-level grants actually enforce, given D-02's "materialize onto `sop_departments`, no new RLS" constraint?**
   - What we know: department/area/org-level grants map cleanly; role/person-level do not (see Pitfall 1).
   - What's unclear: whether "no new RLS policies" is a hard zero-net-new-policies rule or specifically protects the SHIPPED policies from modification.
   - Recommendation: surface to Simon explicitly before Wave 1 (schema) locks the `access_grants` write path — this changes what "success criterion 2" (union-up-the-chain across all 5 levels) actually means in practice.

2. **Should `roles` (D-05, dept-scoped job title) also drive `member_departments`, or stay fully independent per D-07?**
   - What we know: D-07 locks `member_departments` as unchanged, `role_members` sits alongside it, a person's dept membership is NOT derived from roles this phase.
   - What's unclear: nothing — this is a locked decision, listed here only so the planner doesn't accidentally "helpfully" derive one from the other.
   - Recommendation: no action needed; just don't build a sync between the two.

3. **Auto-layout algorithm for the Node Chart at Visy scale (15 depts × ~20 roles/people) — reuse FlowGraphCanvas's approach, or does org-chart's tree shape (strict depth levels vs FlowGraphCanvas's freer step-graph) need a different layered layout?**
   - What we know: FlowGraphCanvas already solved bounding-box-based deterministic layout for a similar hand-drawn aesthetic.
   - What's unclear: FlowGraphCanvas lays out a step-flow graph (branching, not strictly leveled); the org chart is a strict 4-level tree (org→area→dept→role, plus person chips inside role nodes) which is a simpler, more constrained layout problem (classic layered/Sugiyama-lite).
   - Recommendation: don't force-reuse FlowGraphCanvas's exact function — reuse its PATTERN (pure TS, bounding-box sizing, no library) but write a dedicated leveled-tree layout (depth = column or row, siblings evenly spaced) since the org chart's constraints are simpler and a dedicated function will be shorter than adapting a step-graph layout.

## Environment Availability

Not applicable — no new external dependencies, services, or CLIs. All work uses the already-configured Supabase project and already-installed npm packages.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Playwright (existing project-wide convention) |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test --project=phase32-stubs` (new project to add, mirrors `phase26`/`phase28`/`phase29`/`phase30`'s "DELIBERATELY BROAD testMatch" pattern: `testMatch: /tests\/phase32\/.*\.(spec\|test)\.ts$/`) |
| Full suite command | `npm run test` |

### Phase Requirement → Test Map

Phase 32 has no formal `REQ-ID`s yet (ROADMAP.md marks them "TBD (formalize at plan time)"); mapping instead to the roadmap's 6 numbered success criteria (SC-1..SC-6).

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 | Admin draws depts→roles→people on Node Chart; Columns alt view toggle; vacancies render as dashed chips with capacity counts | runtime (Playwright) | `npx playwright test tests/phase32/org-chart-build.spec.ts` | ❌ Wave 0 |
| SC-2 | Access assigned at all 5 levels; effective access unions up the chain with direct/inherited/personal vocabulary | unit (pure resolver) + runtime | `npx playwright test tests/phase32/resolve-access.spec.ts` (unit-style via source-contract or a tsx-subprocess harness per the [2026-07-13] pattern) | ❌ Wave 0 |
| SC-3 | Grouped structure survives ~15×20 scale with expand-in-place, focus, count badges | runtime, seeded-fixture-driven | `npx playwright test tests/phase32/wiring-at-scale.spec.ts` | ❌ Wave 0 |
| SC-4 | Focusing a unit deep-links `/admin/sops?departments=…|collection=…` with "Open in library (N)" | runtime (assert URL + server-filtered result count) | `npx playwright test tests/phase32/library-filter-deeplink.spec.ts` | ❌ Wave 0 |
| SC-5 | Newly published SOP wires up: connect mode, live wires, blast-radius banner before confirm | runtime | `npx playwright test tests/phase32/wire-up-mode.spec.ts` | ❌ Wave 0 |
| SC-6 | Contextual banners never reflow the graph (fixed-height slot, `getBoundingClientRect().top` pixel-identical across state transitions) | runtime, pixel-position assertion | `npx playwright test tests/phase32/banner-slot-stability.spec.ts` (mirrors the exact verification method sketch 003 itself used) | ❌ Wave 0 |
| Junction-write org-isolation (all new tables) | Cross-tenant write blocked | runtime, real insert as authenticated admin (not `test.fixme`, per [2026-06-15] learning) | `npx playwright test tests/phase32/grants-org-isolation.spec.ts` | ❌ Wave 0 |
| Day-one equivalence (D-03) | Post-migration `sop_departments` content byte-identical to pre-migration | migration assertion script | `npx tsx scripts/assert-phase32-day-one-equivalence.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** relevant `tests/phase32/*.spec.ts` file(s) for the task
- **Per wave merge:** `npx playwright test --project=phase32-stubs`
- **Phase gate:** `npm run test` full suite green + `npx tsc --noEmit` + `npm run build` (next build — per [2026-06-27] learning, `tsc` alone does not enforce Next.js server-action/build constraints) + `/pathways` shows 0 not-mapped for `/admin/team` (semantic change) and `/admin/sops?view=access`.

### Wave 0 Gaps

- [ ] Register `phase32` project in `playwright.config.ts` with the broad `tests/phase32/**` testMatch pattern (verify discoverable via `npx playwright test --list --project=phase32-stubs` per the [2026-05-25] unregistered-spec learning)
- [ ] `tests/phase32/` directory + stub spec files (test.fixme, real path constants) for each SC-1..SC-6 row above
- [ ] `scripts/assert-phase32-day-one-equivalence.ts` — new script, mirrors the pattern of prior post-migration assertion scripts, must handle PostgREST schema-cache staleness (Pitfall 5)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No | No new auth surface — reuses `getSessionContext()`/`requireAdminContext()` |
| V3 Session Management | No | Unchanged |
| V4 Access Control | Yes | Every new server action self-enforces org scope on `subject_id`/`sop_id`/`collection_id` before write, mirroring `orgScopedDeptIds()` + `callerOrgId()` in `src/actions/departments.ts`. Admin-only role gate (`admin`/`safety_manager`) on every write action. |
| V5 Input Validation | Yes | Zod schemas for every new server action input, mirroring `CreateDepartmentInput`/`DEPT_COLOURS` enum pattern — especially `subject_type` as a strict `z.enum(['org','area','department','role','person'])`, never a free string |
| V6 Cryptography | No | No new secrets/crypto surface |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Cross-tenant grant write (attacker passes another org's `subject_id`/`collection_id`) | Tampering / Elevation of Privilege | Same class as CLAUDE.md [2026-06-15] and [2026-07-05] learnings — every write verifies the referenced row belongs to `callerOrgId()` BEFORE insert, exactly like `orgScopedDeptIds()`. Do not trust client-supplied IDs. |
| SECURITY DEFINER helper exposed via PostgREST with a caller-supplied org parameter | Elevation of Privilege | If any new SQL helper function is added for the (possible, per Open Question #1) new RLS arm, it must derive identity from `auth.uid()` internally — never accept an org/subject id as a parameter and trust it (CLAUDE.md [2026-07-05] rule) |
| RLS policy recursion (junction referencing parent table in its own SELECT policy) | Denial of Service (42P17 breaks ALL queries on the parent table) | Every new junction (`role_members`, `sop_collections`, `access_grants`) uses `SELECT using(true)` — never reference `sops`/`departments`/`roles` from within a junction's own policy (00030/00031 lesson, restated in every subsequent junction migration) |
| Privilege escalation via role-assignment write path (writer sets themselves/another user into a higher-privilege role) | Elevation of Privilege | `role_members` (new dept-scoped job role) is NOT the same as `organisation_members.role` (org privilege role) — see Pitfall 2. Confirm no code path lets a `role_members` write influence `organisation_members.role` or JWT claims. |

## Sources

### Primary (HIGH confidence — direct codebase reads)
- `.planning/phases/32-visual-org-model-library-permissions/32-CONTEXT.md` — locked decisions D-01..D-12
- `.claude/skills/sketch-findings-SOPstart/references/org-model-views.md` — Node Chart/Columns design contract
- `.claude/skills/sketch-findings-SOPstart/references/permission-wiring-views.md` — Wiring/Matrix/Illuminate + D-hybrid-at-scale contract
- `supabase/migrations/00035_departments_schema.sql`, `00036_departments_data.sql`, `00037_departments_rls_cleanup.sql` — the exact junction/seed/cleanup pattern to replicate
- `src/actions/departments.ts` — replace-semantics assigner + admin-client org self-enforcement pattern
- `supabase/migrations/00007_sop_assignments.sql` + `src/actions/assignments.ts` — confirmed `sop_assignments` does NOT gate visibility (source of Pitfall 1's grounding)
- `src/lib/governance/publish-core.ts`, `src/app/(protected)/admin/sops/builder/[sopId]/PublishStage.tsx` — publish-flow hook point for the wire-up CTA
- `src/app/(protected)/admin/sops/page.tsx`, `src/components/admin/AdminNav.tsx` — `?view=` fold idiom and 5-tab nav to extend
- `src/app/(protected)/admin/team/page.tsx` — current Team page to become the org chart
- `playwright.config.ts` — phase-broad testMatch registration convention (phase26/28/29/30 precedent)
- `.planning/sketches/003-wiring-at-scale/index.html` (711 lines), `.planning/sketches/001-org-model-canvas/index.html` (484 lines) — reference implementations
- `CLAUDE.md` §Learnings — [2026-06-15], [2026-05-13], [2026-07-05] ×2, [2026-06-27], [2026-05-25], [2026-05-08]

### Secondary (MEDIUM confidence)
- None — this research relied entirely on direct codebase/document reads (no external library research needed, per the CONTEXT scope constraint)

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack / no-new-deps: HIGH — directly confirmed, phase scope explicitly locks out new libraries
- Schema/materialization pattern: HIGH — direct precedent (Phase 25) read in full
- Role/person-grant enforcement mechanism: LOW/OPEN — this is a genuine unresolved tension between two locked decisions, not a research gap; flagged prominently rather than guessed at
- Chart rendering approach: HIGH — sketches are literal reference implementations, read in full
- Auto-layout algorithm: MEDIUM — precedent exists (FlowGraphCanvas) but the org-chart's tree shape differs enough that a dedicated implementation is recommended over direct reuse

**Research date:** 2026-07-18
**Valid until:** 30 days (stable internal codebase pattern, no external API/library drift risk)
