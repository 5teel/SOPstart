import { test, expect } from '@playwright/test'

test.describe('Reusable block library (SB-BLOCK)', () => {
  test.fixme('SB-BLOCK-01 admin can save any hazard, PPE item, or step as a reusable block to the org library with name and optional category tags', async ({ page }) => {})
  test.fixme('SB-BLOCK-02 wizard surfaces "Pick from library (N matches)" alongside "Write new" at the right step (hazards → hazard blocks, PPE → PPE blocks, etc.)', async ({ page }) => {})
  test.fixme('SB-BLOCK-03 global NZ blocks (WorkSafe standards) are available to all orgs read-only; org-scoped blocks isolated per-org via RLS', async ({ page }) => {})
  test.fixme('SB-BLOCK-04 when admin adds a block, content is snapshotted into the junction row so SOP renders correctly even if block is later deleted or worker is offline', async ({ page }) => {})
  test.fixme('SB-BLOCK-05 admin can choose "pin to this version" (default) or "follow latest" (auto-update with publish gate)', async ({ page }) => {})
  test.fixme('SB-BLOCK-06 when a block is updated, all SOPs using it in follow-latest mode are marked with "update available" badge for review before publishing', async ({ page }) => {})
})
