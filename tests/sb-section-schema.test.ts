import { test, expect } from '@playwright/test'

test.describe('Extensible section schema (SB-SECT)', () => {
  test.fixme('SB-SECT-01 admin can add two "Hazards" sections to the same SOP scoped to different machine states and both render in the worker walkthrough', async ({ page }) => {})
  test.fixme('SB-SECT-02 admin can define a custom section with an admin-provided title (e.g. "Pre-flight check") and it renders in the worker walkthrough', async ({ page }) => {})
  test.fixme('SB-SECT-03 section_kinds catalog is seeded with canonical kinds (hazards, ppe, steps, emergency, sign-off) plus rendering metadata (icon, color, priority)', async ({ page }) => {})
  test.fixme('SB-SECT-04 v1/v2 SOPs render identically — legacy section_type strings fall through to substring-matched renderer when section_kind_id is NULL', async ({ page }) => {})
  test.fixme('SB-SECT-05 admin can reorder sections via drag-and-drop and sort_order persists', async ({ page }) => {})
})
