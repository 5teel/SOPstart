/**
 * Phase 51 -- SIT-02/SIT-03/SIT-04. Source-contract assertions for
 * `SiteWorkspace.tsx` and `src/app/(protected)/admin/site/page.tsx`.
 *
 * Wave-0 stub. Activated by Plan 51-05.
 *
 * Registration: playwright.config.ts `phase51` project
 *   testDir: '.', testMatch: /tests\/phase51\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase51`
 */
import { test } from '@playwright/test'

test.describe('workspace', () => {
  // activated by plan 51-05
  test.fixme('Draw / Delete / rename / department-select / link / unlink handlers are wired to src/actions/site.ts, not stubs', () => {})

  // activated by plan 51-05
  test.fixme('machine list right panel shows name, department, linked-SOP count, and a Show SOPs affordance', () => {})

  // activated by plan 51-05
  test.fixme('empty state (no layout) offers Generate-from-description and Upload as the only two choices', () => {})

  // activated by plan 51-05
  test.fixme('SiteWorkspace imports SiteEditor only via SiteEditorLoader, never directly', () => {})
})

test.describe('route', () => {
  // activated by plan 51-05
  test.fixme('/admin/site is guarded by requireAdminContext() server-side and redirects non-admins', () => {})

  // activated by plan 51-05
  test.fixme('TopHeader ADMIN_LINKS includes a Site entry pointing at /admin/site', () => {})

  // activated by plan 51-05
  test.fixme('journeys.ts maps a journey step with route /admin/site', () => {})
})
