---
phase: 32-visual-org-model-library-permissions
reviewed: 2026-07-18T00:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - playwright.config.ts
  - scripts/assert-phase32-day-one-equivalence.ts
  - src/actions/grants.ts
  - src/actions/org-model.ts
  - src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx
  - src/app/(protected)/admin/sops/builder/[sopId]/PublishStage.tsx
  - src/app/(protected)/admin/sops/page.tsx
  - src/app/(protected)/admin/team/page.tsx
  - src/components/admin/org-model/OrgChartCanvas.tsx
  - src/components/admin/org-model/OrgColumnsBoard.tsx
  - src/components/admin/org-model/TeamViewShell.tsx
  - src/components/admin/org-model/ViewToggle.tsx
  - src/components/admin/wiring/SelectionStrip.tsx
  - src/components/admin/wiring/WiringPatchBay.tsx
  - src/components/admin/wiring/WiringPatchBayShell.tsx
  - src/lib/journeys/journeys.ts
  - src/lib/org-model/__tests__/auto-layout.test.ts
  - src/lib/org-model/__tests__/resolve-access.test.ts
  - src/lib/org-model/auto-layout.ts
  - src/lib/org-model/resolve-access.ts
  - src/lib/uat/tests.ts
  - src/styles/blueprint-theme.css
  - src/types/org-model.ts
  - supabase/migrations/00046_org_model_schema.sql
  - supabase/migrations/00047_org_model_data.sql
  - tests/phase32/banner-slot-stability.spec.ts
  - tests/phase32/grants-org-isolation.spec.ts
  - tests/phase32/library-filter-deeplink.spec.ts
  - tests/phase32/org-chart-build.spec.ts
  - tests/phase32/person-grant-rls.spec.ts
  - tests/phase32/resolve-access.spec.ts
  - tests/phase32/wire-up-mode.spec.ts
  - tests/phase32/wiring-at-scale.spec.ts
findings:
  critical: 3
  warning: 5
  info: 5
  total: 13
status: issues_found
---

# Phase 32: Code Review Report

**Reviewed:** 2026-07-18
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

Phase 32 ships an org-model surface (areas/roles/people chart), a 5-level grant resolver, a wiring/permissions surface, and two migrations. Much of it is genuinely solid: `resolveEffectiveAccess` is correct against its unit tests; `createGrant`/`revokeGrant` self-enforce org scope on every write path (the recurring 2026-06-15 class is NOT present in grants.ts); the D-13 person-grant RLS arm is self-scoping via `auth.uid()` with real live-Supabase tests; all new CSS custom properties are declared (no bare-`var()` regression); `journeys.ts`/`uat/tests.ts` are updated; all specs are registered in `playwright.config.ts`.

However, the phase's flagship user flow — wire up a new SOP's access — is **entirely non-functional end to end**: the Done handler passes a **SOP id where a collection id is required**, every `createGrant` call fails its own guard, the errors are swallowed, and the UI reports success (CR-01). Compounding it, **no runtime code path ever inserts `sop_collections` rows**, so every SOP created after migration 00047 is permanently unreachable by the entire grant system (CR-02). And role-membership / org-structure mutations never re-materialize access, so removing a person from a role does **not** revoke their materialized SOP visibility (CR-03). The wire-up source-contract spec (`wire-up-mode.spec.ts`) pins the buggy call as the contract — the exact 2026-06-05 "token presence ≠ correct wiring" trap the specs elsewhere warn about.

## Critical Issues

### CR-01: Wire-up "✓ Done" passes a SOP id as `collectionId` — every grant write fails, and the UI reports success

**File:** `src/components/admin/wiring/WiringPatchBay.tsx:328` (with `src/app/(protected)/admin/sops/page.tsx:165-167`, `tests/phase32/wire-up-mode.spec.ts:87`)
**Issue:** `newSop` is built from `supabase.from('sops').select('id, title').eq('id', params.sop)` — `newSop.id` is a **SOP id**. `handleDone` then calls:
```ts
const result = await createGrant({ subjectType: grant.subjectType, subjectId: grant.subjectId, collectionId: newSop.id })
```
`createGrant` (grants.ts:169) validates `collectionId` against the `collections` table: `admin.from('collections').select('id').eq('id', collectionId).eq('organisation_id', orgId)` — a SOP id can never match, so **every call returns `{ error: 'Collection not found in this organisation' }`**. The loop only does `console.error` on error, then unconditionally runs `setConnecting(false)`, `setPending(new Map())`, `onWireUpComplete?.()` — the NEW·UNWIRED pill flips to "NEW", the surface refreshes, and the admin believes access is wired while **zero grants were written and zero workers can see the SOP**. The D-12 flow (the phase's "most important job" per the component's own header) never worked; `wire-up-mode.spec.ts` asserts the buggy call verbatim (`collectionId=newSop.id`), so the green suite enshrines the defect ([2026-06-05] class).
**Fix:** The wire-up flow must grant a real collection that contains the SOP. Two-part fix:
```ts
// 1. Page (server): resolve the SOP's collection(s), pass them on newSop —
//    and if the SOP has none, create/attach its category collection first.
const { data: sc } = await supabase.from('sop_collections').select('collection_id').eq('sop_id', params.sop)
newSop = { id: row.id, title: ..., collectionIds: sc.map(r => r.collection_id) }

// 2. handleDone: grant the SOP's collection(s), not the SOP id, and STOP on error:
for (const grant of pending.values()) {
  for (const collectionId of newSop.collectionIds) {
    const result = await createGrant({ ...grant, collectionId })
    if ('error' in result) { setSaveError(result.error); return } // do not clear pending / do not report success
  }
}
```
Also update `wire-up-mode.spec.ts` to assert the corrected contract.

### CR-02: No runtime path ever writes `sop_collections` — every post-migration SOP is invisible to the whole grant system

**File:** `supabase/migrations/00047_org_model_data.sql:33-40` (gap is codebase-wide; grep `sop_collections` in `src/` — only reads exist: `src/actions/grants.ts:294,316`, `src/app/(protected)/admin/sops/page.tsx:107,187`)
**Issue:** 00047 backfills `sop_collections` for SOPs that existed at migration time. No server action, API route, publish handler, or upload pipeline inserts `sop_collections` for SOPs created afterwards. Consequences: (a) a new SOP belongs to no collection, so no grant — org, area, department, role, or person — can ever reach it (`materializeSopAccessForOrg` computes `sopCollectionIds = ∅` → `deptSet`/`personSet` empty); (b) worse, if `materializeSopAccess(sopId)` is ever invoked on such a SOP, the replace-write **deletes all its existing `sop_departments` rows and inserts nothing** — silently revoking live worker visibility; (c) the Access view's collection `sopCount`s permanently exclude new SOPs. This is the same shape as the [2026-07-07] "route inserts sections without layout_data" learning: a mandatory companion write missing from the insert path.
**Fix:** On SOP creation/publish (wherever `sops.category` is set), upsert the category's collection and the `sop_collections` row — mirroring 00047 Steps A/B — e.g. in the publish route or a shared helper called by all SOP-creating paths:
```ts
const { data: coll } = await admin.from('collections')
  .upsert({ organisation_id: orgId, name: sop.category, colour: '#3b82f6', sort: 0 }, { onConflict: 'organisation_id,name' })
  .select('id').single()
await admin.from('sop_collections').upsert({ sop_id: sop.id, collection_id: coll.id })
```
And make `materializeSopAccessForOrg` refuse (or no-op with a distinct status) when `sopCollectionIds` is empty, instead of wiping `sop_departments`.

### CR-03: Access-mutating actions never re-materialize — removing a person from a role does NOT revoke their SOP access

**File:** `src/actions/org-model.ts:440-499` (`assignRoleMembers`), also `archiveRole` (407), `setDepartmentArea` (505), `archiveArea` (287)
**Issue:** Materialization runs **only** from `createGrant`/`revokeGrant`. But resolved access also changes when: a person is added to / removed from a role (`assignRoleMembers`), a role is deleted (`archiveRole` — `role_members` cascade), a department moves into/out of an area (`setDepartmentArea` — changes the inheritance chain, so area-level grants start/stop applying), or an area is deleted (`archiveArea` — `departments.area_id` set null). None of these re-run materialization, so `sop_access_people`/`sop_departments` go stale until some unrelated grant CRUD happens to touch the same collection. The dangerous direction is **retained access after revocation**: remove Priya from the "Furnace Operator" role and her materialized `sop_access_people` rows persist indefinitely — she keeps seeing role-gated SOPs via the `sops_visible_by_person_grant` RLS arm. This directly contradicts grants.ts's own header claim ("no orphan write path that could leave sop_departments/sop_access_people stale", T-32-05-03) and is the same "revocation doesn't propagate" family as the repo's recurring admin-client scoping bugs.
**Fix:** After every successful mutation that changes chains or role membership, re-materialize the affected scope. Minimal correct version — export a `materializeOrgAccess(admin, orgId)` from grants.ts that runs `materializeSopAccessForOrg` for every SOP with a `sop_collections` row in the org, and call it at the end of `assignRoleMembers`, `archiveRole`, `setDepartmentArea`, and `archiveArea`. (Per-role/per-dept narrowing is an optimization, not a correctness requirement.)

## Warnings

### WR-01: `sop_access_people_self_read` admin arm is not org-scoped — any admin of any org can read the entire table

**File:** `supabase/migrations/00046_org_model_schema.sql:334-343`
**Issue:** The policy's second arm checks only that the caller is an admin/safety_manager **somewhere**: `exists (select 1 from organisation_members om where om.user_id = auth.uid() and om.role in ('admin','safety_manager'))` — no linkage between the caller's org and the row. The comment says "admins/safety_managers **in same org** see all", but the SQL grants a tenant-A admin SELECT over every tenant's (sop_id, member_id) access map. It faithfully mirrors 00035's `member_departments_self_read`, so the hole is inherited, not new-in-kind — but this migration extends it to a new who-can-see-what table whose sibling (`access_grants`) was deliberately given a *tighter* org-scoped SELECT for exactly this disclosure reason (T-32-02-03).
**Fix:** Scope the admin arm to the target member's org without touching `sops` (which would recurse via `sops_visible_by_person_grant` → 42P17):
```sql
or exists (
  select 1 from public.organisation_members om
  join public.organisation_members target
    on target.organisation_id = om.organisation_id
  where om.user_id = auth.uid()
    and om.role in ('admin', 'safety_manager')
    and target.user_id = sop_access_people.member_id
)
```
Consider the same follow-up fix for 00035's `member_departments_self_read`.

### WR-02: Day-one seed widens department visibility to collection granularity; first materialization rewrites `sop_departments` to the widened set

**File:** `supabase/migrations/00047_org_model_data.sql:47-52` (with `src/actions/grants.ts:315-394`)
**Issue:** Step C seeds one `(department, collection)` grant for every `sop_departments` × `sop_collections` pair. A department that previously saw **one** SOP in category X gets a grant to the **whole X collection**. Nothing changes at migration time (00047 doesn't touch `sop_departments`), but the first grant CRUD on that collection replace-writes `sop_departments` for **every SOP in the collection** — silently granting the department every other X SOP. The "materialize faithfulness" test (`person-grant-rls.spec.ts:224-264`) samples exactly **one** SOP, so it can pass on a uniform SOP while other SOPs in the same collection diverge. If per-SOP dept assignment within a category is real in prod data (it is the pre-32 model), this is an unreviewed access widening.
**Fix:** Either document/accept collection-granularity as the intended new model in the phase decision log AND run the equivalence check over **all** SOPs (extend `assert-phase32-day-one-equivalence.ts` to diff resolver output vs `sop_departments` per SOP before enabling any materialization), or seed per-SOP-consistent grants only where the department already saw *every* SOP in the collection.

### WR-03: Blast-radius "Visible to N people" counts only `role_members` — members reached via `member_departments` are ignored

**File:** `src/components/admin/wiring/WiringPatchBay.tsx:92-94, 126-138, 317-321`
**Issue:** `deptPeopleIds` derives people exclusively from `dept.roles[].people` (role_members). But department-level grants materialize into `sop_departments`, and workers see those SOPs via the Phase 25 `member_departments` junction — which this surface never reads. An org that hasn't adopted job roles yet (all of them, on day one) shows "Visible to **0** people" while wiring a grant that actually reaches every member of the department. The banner is the safety affordance the whole wire-up mode is built around ("the whole point of wire-up mode", per the code comment), and it materially under-reports.
**Fix:** Fetch `member_departments` (dept → member ids) server-side in the access view and union it into `peopleIndex` per department/area/org alongside role members.

### WR-04: No uniqueness constraint on `access_grants` — duplicate grants accumulate and make revoke unreliable

**File:** `supabase/migrations/00046_org_model_schema.sql:296-304` (with `src/components/admin/wiring/WiringPatchBay.tsx:323-337`)
**Issue:** `access_grants` has no unique constraint over `(organisation_id, subject_type, subject_id, collection_id)`. Wiring the same unit twice (double-click Done, re-entering wire-up mode later, or two admins) inserts duplicate rows. `revokeGrant` deletes one row by id — the duplicate silently keeps the access alive, so an admin who "revoked" a grant sees it still in effect after re-materialization. Additive-only semantics (D-11) make duplicates pure liability.
**Fix:**
```sql
create unique index uq_access_grants_subject_collection
  on public.access_grants (organisation_id, subject_type, coalesce(subject_id, organisation_id), collection_id);
```
and make `createGrant` treat a unique-violation as success (idempotent upsert).

### WR-05: Focused-collection banner "via M grants" counts derived edges, not grants

**File:** `src/components/admin/wiring/WiringPatchBay.tsx:191-207, 426-427`
**Issue:** `grantCount={... : visibleRawEdges.length}`. When a **collection** is focused, `visibleRawEdges` contains one edge per unit that resolves access (org + each area + each department + each person all get separate `inherited` edges from a single org-level grant). One real grant renders as "via 12 grants" in the SelectionStrip. For a focused left-side unit the number is also "effective collections", not grants (defensible), but for collections it is plainly wrong.
**Fix:** For a focused collection, count distinct source grants: filter the `grants` prop by `collectionId === focus` and use that length (or dedupe edges by `inherited[c]` source unit).

## Info

### IN-01: `listGrants` scopes by JWT-claim org while every write path uses the live membership row

**File:** `src/actions/grants.ts:113-121` vs `:57-64`
**Issue:** Writes derive org from `callerOrgId()` (live `organisation_members` read, per the [2026-06-26] staleness rule); `listGrants` uses `ctx.organisationId` (JWT claim). A stale claim shows an empty/mismatched grants list against writes that succeed.
**Fix:** Use `callerOrgId` in `listGrants` too (RLS still bounds the read).

### IN-02: `listOrgTree` resolves person names via project-wide `auth.admin.listUsers({ perPage: 1000 })`

**File:** `src/actions/org-model.ts:152-160`
**Issue:** Lists users across **all** tenants and filters client-side with `memberIds.includes(u.id)`; beyond 1000 total users, unmatched members render as raw UUID chips (`memberNames[id] ?? id`). Also displays emails as "names". Mirrors the departments.ts idiom, so noted, not blocking.
**Fix:** Paginate `listUsers` or resolve emails per-id via `admin.auth.admin.getUserById` for the (small) member set.

### IN-03: Add-affordance failures are silent (console.error only)

**File:** `src/components/admin/org-model/OrgChartCanvas.tsx:105-120`, `OrgColumnsBoard.tsx:54-81`
**Issue:** `createRole`/`createDepartment`/`assignRoleMembers` errors log to console and the prompt-driven UI gives the admin no feedback — the click just does nothing.
**Fix:** Surface the error (inline banner or `window.alert`, consistent with the prompt-based interim UX).

### IN-04: Materialization replace-write is non-transactional

**File:** `src/actions/grants.ts:387-403`
**Issue:** `delete` then `insert` on `sop_departments`/`sop_access_people` leaves a window where workers momentarily lose visibility, and two concurrent materializations can interleave (PK conflict → error return mid-fanout, partial state).
**Fix:** Move the replace-write into a single SQL function (RPC, service-role-only per [2026-07-05]) or use upsert + targeted delete of stale rows.

### IN-05: `handleApproveStep`/`handleRequestChanges` lack a catch — network failure becomes an unhandled rejection

**File:** `src/app/(protected)/admin/sops/builder/[sopId]/BuilderStageShell.tsx:239-273`
**Issue:** `try { await approveStep(...) } finally {...}` — a thrown (network) error escapes through the `onApprove` prop with no `setApprovalError`, unlike `handlePublish` which catches. Pre-existing Phase 29 pattern, listed for the fix pass since the file was touched this phase.
**Fix:** Add `catch (err) { setApprovalError(err instanceof Error ? err.message : 'Action failed') }` to both.

---

_Reviewed: 2026-07-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
