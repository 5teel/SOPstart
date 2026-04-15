import { test, expect } from '@playwright/test'

test.describe('Layout editor (SB-LAYOUT)', () => {
  test.fixme('SB-LAYOUT-01 admin can drag blocks (text, photo, heading, callout, step, hazard card, PPE card, diagram hotspot) onto a page and rearrange in linear or 2-column grid on wide screens', async ({ page }) => {})
  test.fixme('SB-LAYOUT-02 each block component is shared between admin editor and worker walkthrough (single component tree)', async ({ page }) => {})
  test.fixme('SB-LAYOUT-03 layouts reflow correctly on a 5.5" phone screen via Tailwind breakpoints without a separate mobile variant', async ({ page }) => {})
  test.fixme('SB-LAYOUT-04 layout persists as JSONB on sop_sections.layout_data with layout_version pin', async ({ page }) => {})
  test.fixme('SB-LAYOUT-05 admin can add a DiagramHotspotBlock, drop a machine diagram image, and place numbered hotspot callouts at freeform x/y positions', async ({ page }) => {})
  test.fixme('SB-LAYOUT-06 worker walkthrough falls back to linear step-list renderer for SOPs with no layout_data or unsupported layout_version', async ({ page }) => {})
})
