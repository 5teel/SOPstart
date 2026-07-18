/**
 * D-13 person-grant RLS arm — a person-level grant makes an SOP visible via the new RLS arm.
 *
 * [2026-06-15]-MANDATED REAL RUNTIME INSERT — NOT a permanent test.fixme.
 * Same class as grants-org-isolation.spec.ts: this exercises a brand-new RLS
 * policy (sops_visible_by_person_grant) and SECURITY DEFINER helper
 * (sop_in_user_person_grants()) — a privilege-escalation/visibility-gap
 * surface. A source-contract grep cannot prove RLS actually grants/denies
 * correctly; only a real authenticated read against live Supabase can.
 *
 * Contract (32-02/32-05-PLAN must_haves):
 *   - Migration 00046 defines `sop_in_user_person_grants()` (SECURITY
 *     DEFINER, self-scopes via auth.uid() — never a caller-supplied
 *     parameter, per [2026-07-05] RPC cross-tenant learning) and the
 *     additive `sops_visible_by_person_grant` policy; shipped policies
 *     (sops_visible_by_sub_trade, sops_visible_by_department) stay
 *     byte-untouched.
 *   - `materializeSopAccess` (32-05) populates `sop_access_people` from
 *     role/person grants; a person-level grant makes the target SOP visible
 *     to that person WITHOUT widening their department's visibility.
 *
 * Flipped LIVE in: 32-05 (files_modified: tests/phase32/person-grant-rls.spec.ts)
 * — this Wave-0 version is a placeholder test.fixme ONLY until 32-05 lands;
 * do not treat it as done once 32-05 ships without confirming the fixme was removed.
 *
 * Registration: playwright.config.ts `phase32` project
 *   testDir: '.', testMatch: /tests\/phase32\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase32`
 */
import { test, expect } from '@playwright/test'

test.describe('D-13 person-grant RLS arm (Wave 0 stub — flips to REAL runtime read in 32-05)', () => {
  test.fixme(
    'a person-level access_grants row makes the target SOP visible to that specific person via sops_visible_by_person_grant, without widening their department',
    async ({ page }) => {
      /**
       * Real path constants this will assert against once built:
       *   - supabase/migrations/00046_org_model_schema.sql
       *     (sop_in_user_person_grants(), sops_visible_by_person_grant policy)
       *   - src/actions/grants.ts (materializeSopAccess populates sop_access_people)
       *
       * Steps (live Supabase, real authenticated read — not a grep):
       * 1. Seed a worker with NO department-level access to a target SOP.
       * 2. Create a person-level access_grants row for that worker + SOP's
       *    collection; run materializeSopAccess(sopId).
       * 3. Authenticate as that worker; confirm the SOP is now visible via
       *    a real SELECT (RLS-respecting client).
       * 4. Confirm a DIFFERENT SOP in the same department (not covered by
       *    the person grant) remains invisible — the grant did not widen
       *    department-level visibility.
       */
      void page
      expect(true).toBe(true)
    },
  )
})
