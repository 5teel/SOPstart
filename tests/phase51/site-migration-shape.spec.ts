/**
 * Phase 51 -- SIT-01. Source-contract shape assertions for the site model
 * migration (`supabase/migrations/00067_site_model.sql`).
 *
 * Wave-0 stub. Activated by Plan 51-02.
 *
 * Registration: playwright.config.ts `phase51` project
 *   testDir: '.', testMatch: /tests\/phase51\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase51`
 */
import { test } from '@playwright/test'

test.describe('SIT-01 -- site model migration shape (source-contract)', () => {
  // activated by plan 51-02
  test.fixme('site_layouts, site_machines, sop_machines tables all exist in the migration', () => {})

  // activated by plan 51-02
  test.fixme('every policy on all three tables conjoins organisation_id = current_organisation_id()', () => {})

  // activated by plan 51-02
  test.fixme('every WITH CHECK present restates the full USING predicate (D-03)', () => {})

  // activated by plan 51-02
  test.fixme('FK cascades match D-13: sop_id/machine_id ON DELETE CASCADE on sop_machines, department_id ON DELETE SET NULL on site_machines', () => {})

  // activated by plan 51-02
  test.fixme('site-scenes storage bucket is private, 15728640 bytes, jpeg/png only', () => {})

  // activated by plan 51-02
  test.fixme('site_machines.code column constraint pattern equals MACHINE_CODE_PATTERN from src/lib/site/scene.ts', () => {})
})
