/**
 * Phase 51 -- SIT-04. Source-contract assertions for the builder's
 * "Manage machines" ToolsMenu row + SopMachinePicker modal.
 *
 * Wave-0 stub. Activated by Plan 51-06.
 *
 * Registration: playwright.config.ts `phase51` project
 *   testDir: '.', testMatch: /tests\/phase51\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase51`
 */
import { test } from '@playwright/test'

test.describe('modal', () => {
  // activated by plan 51-06
  test.fixme('SopMachinePicker lists org-scoped machines grouped by department, with search', () => {})

  // activated by plan 51-06
  test.fixme('toggling a machine in the picker writes through setSopMachines(sopId, ids), not a bespoke insert', () => {})

  // activated by plan 51-06
  test.fixme('modal follows the BuilderFlowButton portaled-modal pattern (createPortal to document.body, Escape closes)', () => {})
})

test.describe('tools menu', () => {
  // activated by plan 51-06
  test.fixme('BuilderStageShell ToolsMenu renders a "Manage machines" row alongside the flow-diagram row', () => {})

  // activated by plan 51-06
  test.fixme('the row opens SopMachinePicker, not a route navigation', () => {})
})
