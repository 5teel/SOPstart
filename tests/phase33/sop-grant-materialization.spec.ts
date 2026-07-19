/**
 * SC-4 — Narrowing override + org-isolation + revoke-propagation against LIVE
 * materialized junctions (sop_departments / sop_access_people).
 *
 * [2026-06-15]-MANDATED REAL RUNTIME INSERT — NOT a permanent test.fixme.
 * Phase 25's junction-write cross-tenant hole shipped green because its
 * runtime DB-write tests were test.fixme stubs — the source-contract tests
 * only asserted the action EXISTS, never exercised the insert. This spec is
 * the same class of write (new SOP-target grant + override materialization)
 * and MUST be flipped to REAL live-Supabase inserts in 33-05, not left as a
 * fixme. 33-07 extends this spec's coverage (dual-write closure via
 * assignSopDepartments rewired through SOP-target grants, per RESEARCH
 * Pattern 2 #7).
 *
 * Contract (33-05/33-07-PLAN must_haves, RESEARCH Pattern 2 + Ephemeral-org
 * runtime test skeleton):
 *   - A SOP-target grant on any subject tier (org/area/department/role/
 *     person) triggers the narrowing override: the SOP's materialized
 *     `sop_departments` rows from its collection are REPLACED by rows
 *     derived from the SOP-target grant alone.
 *   - Revoking the LAST SOP-target grant on an overridden SOP re-follows
 *     its collection (emergent — derived from grant rows, no stored
 *     `overridden` boolean, per Anti-Patterns).
 *   - Cross-tenant SOP-target grant writes are rejected — proven by a REAL
 *     insert attempt (Org A caller, Org B sop_id) against live Supabase.
 *   - Sibling SOPs in the same collection are unaffected by one SOP's
 *     override (no widening/narrowing bleed).
 *
 * Flipped LIVE in: 33-05 (files_modified: tests/phase33/sop-grant-materialization.spec.ts),
 * extended in: 33-07 (dual-write closure coverage)
 * — this Wave-0 version is a placeholder test.fixme ONLY until 33-05 lands;
 * do not treat it as done once 33-05 ships without confirming the fixme was
 * removed.
 *
 * Registration: playwright.config.ts `phase33` project
 *   testDir: '.', testMatch: /tests\/phase33\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase33`
 */
import { test, expect } from '@playwright/test'

test.describe('SC-4 — SOP-target override materialization (Wave 0 stub — flips live in 33-05, extended in 33-07)', () => {
  test.fixme(
    'a SOP-target grant overrides the collection, materializes into sop_departments/sop_access_people, revoking the last override re-follows the collection, cross-tenant writes rejected, sibling SOPs unaffected',
    async ({ page }) => {
      /**
       * Real path constants this will assert against once built:
       *   - src/actions/grants.ts (createGrant sopId arm, materializeSopAccess
       *     override-rule application)
       *   - src/lib/org-model/resolve-sop-access.ts (pure override-rule helper)
       *
       * Steps (live Supabase, ephemeral-org fixture per the skeleton in
       * tests/phase32/grants-org-isolation.spec.ts — createEphemeralOrg/Admin,
       * mintAccessToken, managementSql, cascade cleanup):
       * 1. Seed a department + collection + 2 SOPs, both in the collection;
       *    grant the collection to the department; materialize; confirm
       *    both SOPs' sop_departments rows reflect the department.
       * 2. Add a person-subject SOP-target grant on SOP-1; re-materialize;
       *    confirm SOP-1's sop_departments is now EMPTY and
       *    sop_access_people contains exactly the granted person (override).
       *    Confirm SOP-2 is unchanged (still follows the collection).
       * 3. Revoke the SOP-1 override grant; re-materialize; confirm SOP-1
       *    re-follows the collection (sop_departments repopulated,
       *    sop_access_people empty for SOP-1) — emergent, no stored flag.
       * 4. Real insert ATTEMPT — Org A admin session, Org B sop_id target;
       *    confirm rejection and zero rows written (mirrors
       *    grants-org-isolation.spec.ts's cross-tenant pattern).
       */
      void page
      expect(true).toBe(true)
    },
  )
})
