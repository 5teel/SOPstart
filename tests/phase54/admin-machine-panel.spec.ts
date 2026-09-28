/**
 * Phase 54 / Plan 54-03 -- ADM-02 admin machine panel contracts (D-05): pin
 * severity on PlantStage health mode, panel SOP rows with NO OWNER / REVIEW
 * DUE / DRAFT / OK badges, Open/Edit links, "Add one" empty state, no-site
 * "Draw your site" fallback (D-06).
 *
 * Wave-0 stub -- activates in 54-03.
 *
 * Registration: playwright.config.ts `phase54` project
 *   testDir: '.', testMatch: /tests\/phase54\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase54`
 */
import { test } from '@playwright/test'

test.describe('admin machine panel + floor health (54-03)', () => {
  test.fixme('PlantStage admin mode pins worst-of no-owner/overdue per machine', () => {})
  test.fixme('panel row order: NO OWNER, REVIEW DUE, DRAFT, OK, then title', () => {})
  test.fixme('panel Open links to the SOP page, Edit links to the builder', () => {})
  test.fixme('machine with zero linked SOPs shows "Add one"', () => {})
  test.fixme('org with no site shows the "Draw your site" card, never blank', () => {})
})
