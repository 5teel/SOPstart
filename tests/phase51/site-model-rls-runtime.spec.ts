/**
 * Phase 51 -- SIT-01. Runtime RLS probes for the site model tables
 * (role x own/other-row x same/cross-org matrix, 2026-07-20 pattern).
 *
 * Wave-0 stub. Activated by Plan 51-02.
 *
 * Registration: playwright.config.ts `phase51` project
 *   testDir: '.', testMatch: /tests\/phase51\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase51`
 */
import { test } from '@playwright/test'

test.describe('SIT-01 -- site model RLS runtime probes', () => {
  // activated by plan 51-02
  test.fixme('same-org worker can read site_layouts/site_machines/sop_machines rows', () => {})

  // activated by plan 51-02
  test.fixme('same-org worker write to site_layouts/site_machines/sop_machines is denied', () => {})

  // activated by plan 51-02
  test.fixme('foreign-org session reads all three tables and gets zero rows', () => {})

  // activated by plan 51-02
  test.fixme('foreign-org session write to any of the three tables is denied', () => {})

  // activated by plan 51-02
  test.fixme('cross-org FK links (machine in org A linked to sop in org B) are rejected', () => {})

  // activated by plan 51-02
  test.fixme('deleting a machine cascades sop_machines; deleting a SOP cascades sop_machines; deleting a department sets site_machines.department_id null', () => {})

  // activated by plan 51-02
  test.fixme('storage.objects for site-scenes is scoped to the caller org prefix', () => {})
})
