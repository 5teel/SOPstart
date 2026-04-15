import { test, expect } from '@playwright/test'

test.describe('SOP Builder authoring entry points (SB-AUTH)', () => {
  test.fixme('SB-AUTH-01 admin can start a new SOP from a blank-page wizard (title → sections → review → draft save) with no source document', async ({ page }) => {})
  test.fixme('SB-AUTH-02 admin can type a natural-language prompt and receive a structured draft with hazards, PPE, steps, emergency pre-filled for review', async ({ page }) => {})
  test.fixme('SB-AUTH-03 admin can pick a template from the NZ template library as a starting point for a new SOP', async ({ page }) => {})
  test.fixme('SB-AUTH-04 blank / AI draft / template entry points all converge on a single builder UI', async ({ page }) => {})
  test.fixme('SB-AUTH-05 a builder-authored draft is visually distinguishable from an uploaded draft in the admin SOP library but publishes through the same Phase 2 review+publish flow', async ({ page }) => {})
})
