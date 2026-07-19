---
phase: 32-visual-org-model-library-permissions
fixed_at: 2026-07-18T00:00:00Z
review_path: .planning/phases/32-visual-org-model-library-permissions/32-REVIEW.md
iteration: 1
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 32: Code Review Fix Report

**Fixed at:** 2026-07-18
**Source review:** 32-REVIEW.md (3 Critical, 5 Warning in scope; 5 Info skipped per fix_scope)
**Iteration:** 1

**Summary:**
- Findings in scope: 8 (CR-01..03, WR-01..05)
- Fixed: 8
- Skipped: 0

**Verification (all green):**
- `npx tsc --noEmit` — clean
- `npx playwright test --project=phase32 --project=phase32-unit` — 60 passed, 7 skipped (documented fixme/chromium-runtime items), incl. the live-Supabase RLS tests
- `npm run build` — clean, bundle-isolation postbuild checks pass

**⚠ Requires action before this is live:**

| # | Action |
|---|--------|
| 1 | `npx supabase db push` — migrations **00048** (WR-01 RLS scope) and **00049** (WR-04 unique index) are committed but NOT applied to the live DB (per review-fix constraints) |
| 2 | WR-02 product decision (see below) — 1 of 15 live SOPs diverges; run `npx tsx scripts/assert-phase32-day-one-equivalence.ts --diff-materialization` for the current picture |
| 3 | CR-01 runtime pass on sopstart.com — the corrected wire-up flow is pinned by source-contract specs only (chromium runtime items remain `test.fixme`, 32-09 scope) |

## Fixed Issues

### CR-01: Wire-up "✓ Done" passed a SOP id as collectionId — every grant failed, UI reported success

**Files modified:** `src/components/admin/wiring/WiringPatchBay.tsx`, `src/app/(protected)/admin/sops/page.tsx`, `tests/phase32/wire-up-mode.spec.ts`
**Commit:** `6b63405` *(fixed: requires human runtime verification — logic fix, specs are source-contract)*
**Applied fix:** `WiringNewSop` now carries server-resolved `collectionIds`; `handleDone` grants each pending subject × each collection, aborts on first error, surfaces it in a visible `role="alert"` banner, and KEEPS the pending toggles (no false "wired" state). If the SOP has no collection, Done errors instead of silently no-oping. The page resolves (and creates, via CR-02's `ensureSopCollections`) the pinned `?sop=`'s collections before the collections-list read so a fresh category collection renders. The spec now pins the corrected contract including `expect(src).not.toContain('collectionId: newSop.id')` — the green-suite-enshrines-the-bug trap ([2026-06-05] class) can't recur silently.

### CR-02: No runtime path ever wrote sop_collections — every post-migration SOP invisible to the grant system

**Files modified:** `src/lib/org-model/sop-collections.ts` (new), `src/lib/governance/publish-core.ts`, `src/actions/grants.ts`
**Commit:** `9266ac8`
**Applied fix:** New `ensureSopCollectionsForOrg(admin, orgId, sopId)` mirrors 00047 Steps A/B for one SOP (select-then-insert on the category collection so admin-customized colour/sort is never clobbered; 23505-race tolerant; junction upsert). Called from (a) `performPublish()` Step 3c — the ONE choke point where every publish path flips status, non-fatal like steps 3b/4 but loudly logged — and (b) the new `ensureSopCollections` server action (org self-enforced) used by the wire-up page as a second chance.
**Documented decision:** `materializeSopAccessForOrg` now early-returns for a SOP with zero collections, **preserving** its legacy `sop_departments` rows rather than wiping them — a collection-less SOP is *outside* the grant system and its pre-Phase-32 assignments stay authoritative until `ensureSopCollectionsForOrg` brings it in.

### CR-03: Access-mutating actions never re-materialized — removing a person from a role did not revoke access

**Files modified:** `src/actions/grants.ts`, `src/actions/org-model.ts`
**Commit:** `51b7fcb`
**Applied fix:** New `materializeOrgAccess()` in grants.ts re-materializes every collection-bearing SOP in the caller's org (sequential fanout — fine at 50-500 SOPs; per-role narrowing is an optimization, per the review). Called after successful `assignRoleMembers`, `archiveRole`, `setDepartmentArea`, and `archiveArea`; a materialization failure surfaces in the action's error result instead of leaving `sop_access_people`/`sop_departments` stale.

### WR-01: sop_access_people admin read arm not org-scoped — any admin of any org could read the whole table

**Files modified:** `supabase/migrations/00048_fix_sop_access_people_admin_read_org_scope.sql` (new)
**Commit:** `2695e4a` — **NOT pushed to the live DB** (needs `npx supabase db push`)
**Applied fix:** Recreates `sop_access_people_self_read` with the admin arm joined to the *target member's* org via `organisation_members`, exactly as the review specified — no `public.sops` reference (42P17 recursion trap). 00046 (applied) is untouched. The review's suggested sibling fix for 00035's `member_departments_self_read` (same inherited hole) is noted in the migration header as a follow-up, out of this phase's scope.

### WR-02: Day-one seed widens dept visibility to collection granularity on first re-materialization

**Files modified:** `scripts/assert-phase32-day-one-equivalence.ts`
**Commit:** `740aac9` *(fixed: mechanical part — the granularity decision itself is a product call, deferred)*
**Applied fix:** New `--diff-materialization` mode diffs resolver output vs live `sop_departments` for **every** collection-bearing SOP (the faithfulness spec samples one) and exits 1 on divergence, listing per-SOP GAIN/LOSE departments. Live run at fix time: **1 of 15 SOPs diverges** — SOP `95772b8e` ("Changing Plenum Chamber — IS Machine Forming Section") would GAIN department `4587a6ed` on first re-materialization. Decision needed: accept collection granularity as the new model (and re-materialize deliberately), or delete/narrow the offending Step C grant before further grant CRUD on that collection.

### WR-03: Blast-radius "Visible to N people" ignored member_departments members

**Files modified:** `src/app/(protected)/admin/sops/page.tsx`, `src/components/admin/wiring/WiringPatchBayShell.tsx`, `src/components/admin/wiring/WiringPatchBay.tsx`
**Commit:** `e6a5ca9`
**Applied fix:** The access view fetches `member_departments` server-side (in the existing parallel read block) and passes a `deptMembers` map through the shell; `peopleIndex` unions it with role members per department — areas/org totals derive from the dept union automatically. Foreign-org junction rows are inert: only department ids present in the caller's own tree are indexed.

### WR-04: No uniqueness on access_grants — duplicates made revoke unreliable

**Files modified:** `supabase/migrations/00049_access_grants_unique_subject_collection.sql` (new), `src/actions/grants.ts`
**Commit:** `3f67baa` — migration **NOT pushed to the live DB** (needs `npx supabase db push`)
**Applied fix:** 00049 dedupes existing duplicates (keeps earliest per key) then creates the review's unique index over `(organisation_id, subject_type, coalesce(subject_id, organisation_id), collection_id)`. `createGrant` treats 23505 as idempotent success: re-reads the existing row and still re-materializes.

### WR-05: Focused-collection banner counted derived edges as "grants"

**Files modified:** `src/components/admin/wiring/WiringPatchBay.tsx`, `tests/phase32/wire-up-mode.spec.ts`
**Commit:** `e01c24d`
**Applied fix:** New `focusGrantCount`: a focused collection counts distinct source grants (`grants.filter(g => g.collectionId === focus).length`); a focused left-side unit keeps the effective-collections edge count (defensible per the review). Spec updated to pin the new contract.

## Skipped Issues

None. (IN-01..IN-05 were out of fix scope — `critical_warning`.)

---

_Fixed: 2026-07-18_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
