/**
 * Phase 52 -- HOM-04. Worker-variant machine panel stub for MachinePanel.
 * Activated by Plan 52-02.
 *
 * Registration: playwright.config.ts `phase52` project
 *   testDir: '.', testMatch: /tests\/phase52\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase52`
 */
import { test } from '@playwright/test'

test.describe('MachinePanel (worker variant)', () => {
  test.fixme('the close control calls onClose', () => {})
  test.fixme('SOP rows render to-do first, sorted by compareToDoFirst', () => {})
  test.fixme('each to-do row uses the shared RelBadge', () => {})
  test.fixme('the Walk › link points to /sops/<id>?tab=walk', () => {})
  test.fixme('the plain Read link points to /sops/<id>', () => {})
  test.fixme('a machine with no sprite_path shows "no photo yet"', () => {})
  test.fixme('a machine with no linked SOPs shows "No procedures for this machine yet."', () => {})
  test.fixme('the panel width matches PLANT_PANEL_WIDTH (380px)', () => {})
  test.fixme('the panel renders no admin controls (no owner/rev lines, no edit affordance)', () => {})
})
