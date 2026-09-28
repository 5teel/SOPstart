/**
 * Phase 54 / Plan 54-01 -- ADM-02/T-54-01 source-contract tests for the new
 * data layer: `listSiteHealthForOrg` (src/actions/site.ts) and the check
 * inputs added to `listAdminSopRows` (src/actions/admin-sop-list.ts).
 *
 * Wave-0 stub -- flipped live later in this same plan (Task 3).
 *
 * Registration: playwright.config.ts `phase54` project
 *   testDir: '.', testMatch: /tests\/phase54\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase54`
 */
import { test } from '@playwright/test'

test.fixme('listSiteHealthForOrg + listAdminSopRows check inputs are admin-gated and org-scoped (54-01)', () => {})
