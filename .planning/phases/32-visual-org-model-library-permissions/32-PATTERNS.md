# Phase 32: Visual Org Model & Library Permissions - Pattern Map

**Mapped:** 2026-07-18
**Files analyzed:** ~20 new/modified files (per RESEARCH.md Recommended Project Structure)
**Analogs found:** 18 / 20 (2 have no direct analog — hand-rolled chart/wiring canvases)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `supabase/migrations/00046_org_model_schema.sql` | migration | CRUD (schema) | `supabase/migrations/00035_departments_schema.sql` | exact |
| `supabase/migrations/00047_org_model_data.sql` | migration | batch (seed) | `supabase/migrations/00036_departments_data.sql` | exact |
| new SECURITY DEFINER helper + RLS arm (D-13) | migration | request-response (RLS gate) | `00035` §5–7 (`current_user_department_ids`, `sop_in_user_departments`, `sops_visible_by_department` policy) | exact |
| `src/actions/org-model.ts` (areas/roles/role_members CRUD) | service/server-action | CRUD | `src/actions/departments.ts` (`createDepartment`/`updateDepartment`/`archiveDepartment`) | exact |
| `src/actions/grants.ts` (`createGrant`/`revokeGrant`/`materializeSopAccess`) | service/server-action | CRUD + event-driven (fanout on write) | `src/actions/departments.ts` (`assignSopDepartments`/`assignBlockDepartments` replace-semantics junction writers) | exact |
| `src/lib/org-model/resolve-access.ts` | utility | transform (pure fn) | none direct — nearest is `src/lib/governance/publish-core.ts` (pure gate-checking module pattern) | role-match |
| `src/lib/org-model/auto-layout.ts` | utility | transform | `src/components/sop/flow/FlowGraphCanvas.tsx` (`layoutFromPositions`, bounding-box layered layout) | role-match |
| `src/components/admin/org-model/OrgChartCanvas.tsx` | component | streaming/render (client canvas) | `FlowGraphCanvas.tsx` (absolutely-positioned nodes + SVG bezier underlay) | role-match |
| `src/components/admin/org-model/OrgColumnsBoard.tsx` | component | CRUD (list/table) | `src/components/admin/team/RoleAssignmentTable.tsx` (or equivalent list view — see `admin/team/page.tsx`) | role-match |
| `src/components/admin/org-model/ViewToggle.tsx` | component | request-response (URL toggle) | `GovernanceFilterChips` (chip-style `?view=`/`?filter=` toggle) | exact |
| `src/components/admin/wiring/WiringPatchBay.tsx` | component | event-driven (client interaction) | none direct — sketch `.planning/sketches/003-wiring-at-scale/index.html` is the literal reference impl | no analog |
| `src/components/admin/wiring/SelectionStrip.tsx` | component | event-driven (fixed-slot banner) | sketch 003 "Layout stability rule" block (see Shared Patterns) | no analog |
| `src/app/(protected)/admin/team/page.tsx` (rewritten) | route (server page) | request-response | itself (current version) + `src/app/(protected)/admin/sops/page.tsx` for the `?view=` idiom | exact |
| `src/app/(protected)/admin/sops/page.tsx` (`?view=access` arm added) | route (server page) | request-response | itself — extends the existing `isAttentionView` idiom | exact |
| Post-publish "Wire up access" CTA | component/hook | event-driven | `src/lib/governance/publish-core.ts` + `PublishStage.tsx` | exact |
| `src/lib/journeys/journeys.ts` updates | config | transform (static map) | itself — existing `Journey` entries for `/admin/team`, `/admin/sops` | exact |
| `playwright.config.ts` (`phase32` project) | config | n/a | phase28/29/30 project blocks | exact |
| `tests/phase32/*.spec.ts` (stubs) | test | n/a | `tests/phase30/*.spec.ts` stub shape | exact |
| `scripts/assert-phase32-day-one-equivalence.ts` | utility/script | batch (assertion) | prior post-migration assertion scripts (00036-class idempotent RAISE EXCEPTION pattern) | role-match |

## Pattern Assignments

### `supabase/migrations/00046_org_model_schema.sql` (migration)

**Analog:** `supabase/migrations/00035_departments_schema.sql`

**Junction table shape** (lines 97–143, `block_departments`/`sop_departments`):
```sql
create table if not exists public.sop_departments (
  sop_id         uuid not null references public.sops(id) on delete cascade,
  department_id  uuid not null references public.departments(id) on delete cascade,
  primary key (sop_id, department_id)
);
alter table public.sop_departments enable row level security;
-- CRITICAL: using(true) — NOT a reference to public.sops. Recursion trap avoided.
create policy "sop_departments_read_all_auth" on public.sop_departments
  for select to authenticated using (true);
-- Writes: admin server actions only — no authenticated INSERT/UPDATE/DELETE policy.
```
Apply verbatim to `areas`, `roles`, `role_members`, `collections`, `sop_collections`, `access_grants` — all new junctions get `using(true)` SELECT + zero authenticated write policy. Org-scoped entity tables (`areas`, `roles`, `collections`) instead follow the `departments` table shape (lines 27–90): org-scoped FK, `departments_org_read`/`_admin_insert`/`_admin_update`/`_admin_delete` policies gated on `role in ('admin','safety_manager')`.

### New SECURITY DEFINER RLS arm (D-13)

**Analog:** `supabase/migrations/00035_departments_schema.sql` lines 179–251 (`current_user_department_ids`, `sop_in_user_departments`, `sops_visible_by_department` policy)

```sql
create or replace function public.current_user_department_ids() returns setof uuid
  language sql stable security definer set search_path = public
as $$
  select department_id from public.member_departments where member_id = auth.uid();
$$;

create or replace function public.sop_in_user_departments(p_sop_id uuid) returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.sop_departments sd
    where sd.sop_id = p_sop_id
      and sd.department_id in (select * from public.current_user_department_ids())
  );
$$;

create policy "sops_visible_by_department" on public.sops
  for select to authenticated
  using (
    sops.all_departments = true
    or not exists (select 1 from public.sop_departments sd where sd.sop_id = sops.id)
    or sop_in_user_departments(sops.id)
  );
```
Copy this exact template for the new person/role-grant arm per D-13: `current_user_person_role_sop_ids()` (self-scoping via `auth.uid()`, NEVER a parameter — CLAUDE.md 2026-07-05 rule) + `sop_in_user_person_role_grants(p_sop_id)` + one additional **additive OR** permissive policy on `sops`. Do not touch or modify `sops_visible_by_department` or `sops_visible_by_sub_trade`.

### `src/actions/org-model.ts` / `src/actions/grants.ts`

**Analog:** `src/actions/departments.ts` (full file read, 541 lines)

**Auth + admin-context pattern** (lines 34–46):
```typescript
type AdminCtx = { supabase: any; user: { id: string }; role: string; organisationId: string | null }
async function requireAdmin(): Promise<AdminCtx | { error: string }> {
  return requireAdminContext()
}
```

**Zod enum-validated input** (lines 56–73):
```typescript
const DEPT_COLOURS = ['#f97316', '#3b82f6', ...] as const
const CreateDepartmentInput = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(6).transform(v => v.toUpperCase()),
  colour: z.enum(DEPT_COLOURS),
})
```
For `access_grants`, use `z.enum(['org','area','department','role','person'])` for `subject_type` per RESEARCH V5 control — never a free string.

**Org self-enforcement helpers** (lines 335–361, `orgScopedDeptIds` + `callerOrgId`) — reuse verbatim pattern (rename to `orgScopedIds`/generalize) for `access_grants.subject_id` validation:
```typescript
async function orgScopedDeptIds(admin: any, organisationId: string, ids: string[]): Promise<string[]> {
  if (!ids || ids.length === 0) return []
  const { data } = await admin.from('departments').select('id')
    .eq('organisation_id', organisationId).in('id', ids)
  return ((data ?? []) as Array<{ id: string }>).map(d => d.id)
}
async function callerOrgId(admin: any, ctx: AdminCtx): Promise<string | null> {
  const { data } = await admin.from('organisation_members').select('organisation_id')
    .eq('user_id', ctx.user.id).maybeSingle()
  return (data?.organisation_id as string | undefined) ?? ctx.organisationId
}
```

**Replace-semantics junction writer** (lines 484–540, `assignSopDepartments` — the exact template for `createGrant`/`revokeGrant` and `materializeSopAccess`):
```typescript
export async function assignSopDepartments(sopId: string, departmentIds: string[], allDepartments = false) {
  const ctx = await requireAdmin()
  if ('error' in ctx) return { error: ctx.error }
  const admin: any = createAdminClient()
  const orgId = await callerOrgId(admin, ctx)
  if (!orgId) return { error: 'No organisation' }
  const { data: sopRow } = await admin.from('sops').select('id, organisation_id').eq('id', sopId).maybeSingle()
  if (!sopRow) return { error: 'SOP not found' }
  if (sopRow.organisation_id && sopRow.organisation_id !== orgId) return { error: 'SOP belongs to another organisation' }
  const { error: delErr } = await admin.from('sop_departments').delete().eq('sop_id', sopId)
  if (delErr) return { error: delErr.message }
  if (!allDepartments) {
    const validIds = await orgScopedDeptIds(admin, orgId, departmentIds)
    if (validIds.length > 0) {
      const rows = validIds.map((department_id: string) => ({ sop_id: sopId, department_id }))
      const { error: insErr } = await admin.from('sop_departments').insert(rows)
      if (insErr) return { error: insErr.message }
    }
  }
  return { success: true }
}
```
`materializeSopAccess(sopId)` / `materializeCollectionAccess(collectionId)` should call `resolveEffectiveAccess()` then call this same delete+insert replace-semantics against `sop_departments` (and the new person/role grant junction from D-13).

**Discriminated-union error return convention** — every action returns `{ data } | { error: string }`, never throws. Apply to all new `org-model.ts`/`grants.ts` exports.

### `src/lib/org-model/resolve-access.ts`

**Analog:** literal source is `.claude/skills/sketch-findings-SOPstart/references/permission-wiring-views.md` "Inheritance resolution" JS block (cited directly in RESEARCH.md lines 181–190) — translate to TS, extend `CHAIN` to 5 levels (org, area, department, role, person) per D-06. No in-repo TS analog; nearest structural precedent for "one pure resolver shared by every view" is `src/lib/governance/publish-core.ts` (`assertPublishGates`) — a single exported pure function multiple callers (route + chain-gate) invoke identically, never reimplemented per-caller.

### `src/components/admin/org-model/OrgChartCanvas.tsx`

**Analog:** `src/components/sop/flow/FlowGraphCanvas.tsx`

Pattern to copy: absolutely-positioned `.node` divs sized via `getBoundingClientRect()` at runtime + one `<svg>` underlay with bezier paths recomputed on resize, driven by a pure TS layout function (`layoutFromPositions`) that takes structured data and returns `{ x, y, width, height }` per node — no canvas/WebGL, no layout library. RESEARCH.md explicitly recommends NOT reusing `layoutFromPositions` directly (org chart is a strict leveled tree, not a step-flow graph) — write a dedicated leveled-tree layout in `auto-layout.ts` following the same "pure TS, bounding-box sizing" pattern instead.

### `src/app/(protected)/admin/sops/page.tsx` — `?view=access` arm

**Analog:** itself, existing `?view=attention` idiom (lines 61–133)

```typescript
const params = await searchParams
const isAttentionView = params.view === 'attention'
// ... query built conditionally on activeStatus/activeFilter, then:
const [{ data: sops }, govResult, teamResult] = await Promise.all([
  query, listGovernanceQueue(), getTeamMembersWithEmails(),
])
```
Add `const isAccessView = params.view === 'access'` following the identical branch style; deep-link filters follow the `?view=attention&filter=overdue` href pattern (lines 154–178) → `?view=access&departments=…` / `?view=access&collection=…`. Independent server-fetches already run via `Promise.all` here — extend with `resolveEffectiveAccess()`/grants fetch, not a serial await (per [2026-07-13] learning cited in RESEARCH).

### `src/app/(protected)/admin/team/page.tsx` (becomes org chart, D-08)

**Analog:** itself (current structure) — read current file before rewriting; the existing member list becomes the Columns alt view (absorbed, not deleted), `getTeamMembersWithEmails()` stays the people data source per RESEARCH.md Reusable Assets.

### `playwright.config.ts` — `phase32` project

**Analog:** `phase30` project block (lines 300–319)

```typescript
{
  name: 'phase32',
  testDir: '.',
  testMatch: /tests\/phase32\/.*\.(spec|test)\.ts$/,
  use: { browserName: 'chromium' },
},
```
Verify with `npx playwright test --list --project=phase32` after adding (per [2026-05-25] learning — unregistered specs never run).

### `src/lib/journeys/journeys.ts`

**Analog:** itself — existing `Journey` entries referencing `/admin/team` and `/admin/sops`. D-10 requires updating in the SAME change as the route/flow change; grep `journeys.ts` for `/admin/team` and `/admin/sops` before editing to find the exact entries to extend (new `?view=access` route, org-chart semantics change).

---

## Shared Patterns

### Org self-enforcement on every grant/junction write
**Source:** `src/actions/departments.ts` (`orgScopedDeptIds` + `callerOrgId`, lines 335–361)
**Apply to:** `org-model.ts`, `grants.ts` — every write action must verify `subject_id`/`sop_id`/`collection_id` belongs to `callerOrgId()` before insert. Never trust client-supplied IDs (CLAUDE.md 2026-06-15 / 2026-07-05).

### Junction table RLS shape
**Source:** `supabase/migrations/00035_departments_schema.sql`
**Apply to:** `role_members`, `sop_collections`, `access_grants` — `SELECT using(true)`, NO authenticated write policy, writes via `createAdminClient()` only. Never reference a parent table (`sops`/`departments`/`roles`) inside a junction's own SELECT policy (00030/00031 recursion trap).

### SECURITY DEFINER helper self-scoping
**Source:** `00035` §5 (`current_user_department_ids`)
**Apply to:** the new D-13 helper — must derive identity from `auth.uid()` internally, never accept an org/subject id as a parameter (CLAUDE.md 2026-07-05).

### `?view=` URL-fold idiom
**Source:** `src/app/(protected)/admin/sops/page.tsx` lines 61–69, 154–178
**Apply to:** `?view=access` arm — `const isXView = params.view === 'x'`, filter chips as `<Link href="/admin/sops?view=access&filter=...">`.

### Fixed-height banner slot (never mount/unmount)
**Source:** `.claude/skills/sketch-findings-SOPstart/references/permission-wiring-views.md` "Layout stability rule"
**Apply to:** `SelectionStrip.tsx` and any contextual banner in the new surfaces:
```tsx
<div className="h-[48px] overflow-hidden" data-state={bannerState}>
  {bannerState === 'idle' && <p>...</p>}
  {bannerState === 'selection' && <p>Visible to <b>{count}</b> people via {grantCount} grants</p>}
  {/* NEVER: {bannerState === 'idle' ? null : <div>...</div>} */}
</div>
```

### Discriminated-union server action returns
**Source:** `src/actions/departments.ts` (every export)
**Apply to:** all new `org-model.ts`/`grants.ts` exports — `{ data } | { error: string }`, never throw.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/components/admin/wiring/WiringPatchBay.tsx` | component | event-driven | No prior hand-rolled SVG connect-mode UI in this codebase; build directly from `.planning/sketches/003-wiring-at-scale/index.html` (711-line working reference impl) per RESEARCH.md — this sketch file IS the pattern source, not a repo analog |
| `src/lib/org-model/resolve-access.ts` | utility | transform | No pure "union up an N-level chain" resolver exists yet; translate the JS block in `permission-wiring-views.md` directly |

## Metadata

**Analog search scope:** `src/actions/`, `supabase/migrations/`, `src/app/(protected)/admin/`, `src/components/sop/flow/`, `src/lib/governance/`, `playwright.config.ts`, `src/lib/journeys/journeys.ts`
**Files scanned:** ~12 read in full or targeted section, plus RESEARCH.md's own citations (Sources §Primary) which were verified rather than re-derived
**Pattern extraction date:** 2026-07-18
