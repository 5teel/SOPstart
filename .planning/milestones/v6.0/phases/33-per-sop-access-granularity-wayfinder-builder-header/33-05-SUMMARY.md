---
phase: 33-per-sop-access-granularity-wayfinder-builder-header
plan: 05
subsystem: auth
tags: [supabase, rls, access-control, zod, playwright]

# Dependency graph
requires:
  - phase: 33-03
    provides: "migration 00050 (access_grants nullable-arm sop_id + XOR check + uq_access_grants_subject_target), applied+verified live"
provides:
  - "createGrant/revokeGrant SOP-target arm (collectionId XOR sopId), org-scoped guard mirroring the collection guard"
  - "Narrowing-override rule: a SOP with any direct SOP-target grant (any subject tier) stops following its collection, implemented entirely in materialization"
  - "src/lib/org-model/resolve-sop-access.ts — pure, unit-tested override-decision helper (final dept/person sets given collection-derived + SOP-target grants + org shape)"
  - "materializeOrgAccess includes SOP-target-bearing SOPs so role-membership/chain changes propagate revocation to overridden SOPs"
  - "Live ephemeral-org runtime proof: override, sibling-SOP isolation, revoke re-follow, cross-tenant rejection, junction truth + D-13 RPC"
affects: [33-06, 33-07, 33-08, 33-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure override-decision helper outside 'use server' files (Pitfall 4 / 2026-06-27 sync-export trap) — grants.ts stays I/O-only, resolve-sop-access.ts owns the decision logic and is directly unit-testable without DB"
    - "Faithful stand-in live-runtime testing for 'use server' actions unreachable from Playwright's Node runner: import the REAL pure module, drive it against real DB-fetched data, perform the SAME replace-write the action performs (established by tests/phase32/person-grant-rls.spec.ts, reused here)"

key-files:
  created:
    - src/lib/org-model/resolve-sop-access.ts
  modified:
    - src/actions/grants.ts
    - src/types/org-model.ts
    - src/lib/org-model/__tests__/resolve-sop-access.test.ts
    - tests/phase33/sop-grant-schema.spec.ts
    - tests/phase33/sop-grant-materialization.spec.ts

key-decisions:
  - "Override trigger = existence of ANY direct SOP-target grant on a SOP, from any subject tier — not just person-subject (locked 2026-07-19)"
  - "resolveEffectiveAccess() stays byte-unchanged — resolve-sop-access.ts calls it a second time per org unit, keyed by a sentinel marker instead of a real collection id, so org/area/department/role-subject SOP-target grants inherit down the chain exactly like collection grants (D-11 survives WITHIN the SOP-target tier only)"
  - "Override forces sops.all_departments=false (closes the 00035 bypass that would otherwise make the override cosmetic)"
  - "CR-02 guard relaxed: a SOP is only skipped by materialization when it has NEITHER a collection membership NOR a SOP-target grant — a collection-less/draft SOP can now be wired by name"
  - "GrantRow.collectionId / AccessGrant.collectionId left as required `string` (not widened to nullable) — WiringPatchBay.tsx (out of scope this plan, consumes these types) already assumes every grant it renders has a collection; only sopId was added, matching the plan's explicit must_have and avoiding an out-of-scope breaking change"

requirements-completed: [SC-3, SC-4]

# Metrics
duration: ~35min
completed: 2026-07-19
---

# Phase 33 Plan 05: SOP-target grants + narrowing override Summary

**Grants can now target a single SOP from any subject tier (org/area/department/role/person); a SOP with any such grant stops following its collection entirely, enforced purely in materialization with zero RLS changes and proven against live Supabase with ephemeral orgs.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-07-19
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments
- `createGrant`/`revokeGrant` accept a `sopId` target (XOR with `collectionId`), org-scoped before insert, idempotent on 23505, and branch materialization/re-materialization by target type
- `materializeSopAccessForOrg` implements the narrowing override end-to-end: SOP-target grants replace collection-derived `sop_departments`/`sop_access_people`, force `all_departments=false`, and re-follow the collection automatically once the last override grant is revoked (no stored flag)
- New pure module `src/lib/org-model/resolve-sop-access.ts` extracts the override-decision logic so it's unit-testable without a DB — 7 behavioural test cases cover trigger-on-any-tier, org/area inheritance, ancestors-only role isolation, and emergent re-follow
- `materializeOrgAccess` now also re-materializes SOP-target-bearing SOPs, closing the same retained-access-after-revocation class CR-03 fixed for collection grants
- Live ephemeral-org test proves the full lifecycle against real Supabase: department-collection materialize → person-subject override (junction rows flip, `all_departments` forced false, sibling SOP untouched) → revoke → re-follow, plus a real cross-tenant SOP-target insert rejection and D-13 RPC / junction-truth assertions (never raw-select denial, per Pitfall 6)

## Task Commits

1. **Task 1: SOP-target arm + override materialization in grants.ts** - `1c89fc0` (feat)
2. **Task 2: Unit tests + LIVE ephemeral-org runtime tests (SC-4)** - `3094d3d` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/lib/org-model/resolve-sop-access.ts` - Pure override-decision helper: given org shape (depts/roles/membersByRole), collection-derived grant data, and SOP-target grants, returns `{overridden, deptSet, personSet}`
- `src/actions/grants.ts` - `CreateGrantInput` XOR schema, `createGrant`/`revokeGrant` SOP-target arms, rewritten `materializeSopAccessForOrg` (delegates to `resolveSopAccess`), `materializeOrgAccess` SOP-target inclusion
- `src/types/org-model.ts` - `AccessGrant.sopId: string | null`
- `src/lib/org-model/__tests__/resolve-sop-access.test.ts` - Flipped live: 7 behavioural cases for `resolveSopAccess`
- `tests/phase33/sop-grant-schema.spec.ts` - Flipped live: source-contract on the new arm/guards + live pg introspection of migration 00050 + cross-tenant SOP-target insert rejection
- `tests/phase33/sop-grant-materialization.spec.ts` - Flipped live: ephemeral-org override/revoke/isolation/cross-tenant runtime proof

## Decisions Made
See `key-decisions` in frontmatter. Most consequential: the pure helper computes the **entire** final dept/person set (not just a trigger flag), so `materializeSopAccessForOrg` is now a thin DB-I/O wrapper around one real, unit-tested decision function — matching the plan's explicit ask to extract "collection-derived sets + SOP-target sets + overridden flag → final dept/person sets" as a standalone module.

## Deviations from Plan

None — plan executed exactly as written. One pre-existing item resolved as a side effect: the deferred CRLF-driven red test in `tests/phase32/grants-org-isolation.spec.ts` (logged in `deferred-items.md` from plan 33-01) now passes clean against the edited file — no repoint was needed since the file was rewritten in-place on the main tree (not a worktree checkout), so no CRLF drift was introduced.

## Issues Encountered
None.

## User Setup Required
None — migration 00050 was already live (applied and verified by plan 33-03); no new external service configuration.

## Next Phase Readiness
- `createGrant`/`revokeGrant`/materialization fully support SOP-target grants; the access-map UI (33-06/33-08) can now call `createGrant({..., sopId})` to wire a single SOP by name from any tier
- `resolve-sop-access.ts` is a stable, tested contract for any future view needing to know whether a SOP is overridden and what it resolves to
- 33-07's dual-write closure (rewiring `assignSopDepartments`/`createSopFromWizard` through SOP-target grants) can build directly on this plan's `createGrant`/materialization surface — no further schema or resolver changes needed
- Full sample green: `npx tsc --noEmit`, `npm run build` (bundle Δ within tolerance), `phase32` (9/9), `phase32-unit` (18/18), `phase33` (18 real passing + 10 skipped stubs owned by sibling plans)

---
*Phase: 33-per-sop-access-granularity-wayfinder-builder-header*
*Completed: 2026-07-19*

## Self-Check: PASSED

All 6 files_modified paths confirmed present on disk; both task commit hashes (`1c89fc0`, `3094d3d`) confirmed in `git log`.
