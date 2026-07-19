/**
 * SC-3 — Grant can target an individual SOP from any subject tier; schema
 * enforces the XOR (a grant targets a collection OR a SOP, never both/neither).
 *
 * Contract (33-05-PLAN must_haves, RESEARCH Pattern 1):
 *   - Migration `supabase/migrations/00050_access_grants_sop_target.sql`
 *     adds a nullable `sop_id` arm to `access_grants` + an XOR CHECK
 *     constraint (exactly one of collection_id/sop_id set) + replaces
 *     00049's `uq_access_grants_subject_collection` with
 *     `uq_access_grants_subject_target` (covers both target types).
 *   - `src/actions/grants.ts` `createGrant` gains a `sopId` target arm,
 *     verifying the SOP row's `organisation_id === orgId` BEFORE insert
 *     (Pitfall 1 — mirrors the existing collRow guard).
 *   - Choosing a SOP-target grant is the trigger for the narrowing
 *     override (a chosen-by-name SOP stops following its collection).
 *
 * Flipped LIVE in: 33-05 (files_modified: tests/phase33/sop-grant-schema.spec.ts)
 * — this Wave-0 version is a placeholder test.fixme ONLY until 33-05 lands;
 * do not treat it as done once 33-05 ships without confirming the fixme was
 * removed.
 *
 * Registration: playwright.config.ts `phase33` project
 *   testDir: '.', testMatch: /tests\/phase33\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase33`
 */
import { test, expect } from '@playwright/test'

test.describe('SC-3 — SOP-target grant schema + XOR constraint (Wave 0 stub — flips live in 33-05)', () => {
  test.fixme(
    'access_grants XOR-enforces collection_id/sop_id; createGrant accepts a sopId target arm org-scoped before insert; a SOP-target grant marks the SOP as overridden',
    async ({ page }) => {
      /**
       * Real path constants this will assert against once built:
       *   - supabase/migrations/00050_access_grants_sop_target.sql
       *   - src/actions/grants.ts (createGrant sopId arm)
       *   - scripts/assert-phase33-sop-target-schema.ts (live pg introspection)
       *
       * Steps (once flipped live, live pg introspection via Management API,
       * mirroring scripts/assert-phase32-day-one-equivalence.ts):
       * 1. Confirm `access_grants` has a nullable `sop_id` column + an XOR
       *    CHECK constraint (exactly one of collection_id/sop_id non-null).
       * 2. Confirm `uq_access_grants_subject_target` replaced
       *    `uq_access_grants_subject_collection` (00049 index dropped).
       * 3. Call createGrant with a sopId target belonging to a different
       *    org; confirm rejection BEFORE any insert (org self-enforcement,
       *    mirrors the existing collRow guard).
       * 4. Call createGrant with a valid same-org sopId target; confirm the
       *    row is written and the SOP is now derivable as "overridden"
       *    (any grant row with sop_id === this SOP, any subject tier).
       */
      void page
      expect(true).toBe(true)
    },
  )
})
