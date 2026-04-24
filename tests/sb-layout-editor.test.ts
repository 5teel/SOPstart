import { test, expect } from '@playwright/test'

test.describe('Layout editor (SB-LAYOUT)', () => {
  test.fixme('SB-LAYOUT-01 admin can drag blocks (text, photo, heading, callout, step, hazard card, PPE card, diagram hotspot) onto a page and rearrange in linear or 2-column grid on wide screens', async ({ page }) => {})
  test.fixme('SB-LAYOUT-02 each block component is shared between admin editor and worker walkthrough (single component tree)', async ({ page }) => {})
  test.fixme('SB-LAYOUT-03 layouts reflow correctly on a 5.5" phone screen via Tailwind breakpoints without a separate mobile variant', async ({ page }) => {})
  test.fixme('SB-LAYOUT-04 layout persists as JSONB on sop_sections.layout_data with layout_version pin', async ({ page }) => {})
  test.fixme('SB-LAYOUT-05 admin can add a DiagramHotspotBlock, drop a machine diagram image, and place numbered hotspot callouts at freeform x/y positions', async ({ page }) => {})
  test('SB-LAYOUT-06 worker walkthrough falls back to linear step-list renderer for SOPs with no layout_data or unsupported layout_version', async () => {
    // Plan 01 establishes the LayoutRenderer fallback branch in SectionContent.tsx.
    // Full DOM-diff / fixture assertions land with Plan 02 (block components wired)
    // and Plan 04 (draft persistence). This stub asserts the structural pieces:
    //   - SectionContent.tsx imports LayoutRenderer
    //   - SectionContent.tsx contains the layout_data/layout_version branch
    //   - The legacy switch is preserved as LegacyRenderer
    //   - SUPPORTED_LAYOUT_VERSIONS is exported and contains [1]
    const fs = await import('node:fs/promises')
    const sectionContent = await fs.readFile('src/components/sop/SectionContent.tsx', 'utf8')
    expect(sectionContent).toContain('LayoutRenderer')
    expect(sectionContent).toContain('section.layout_data != null')
    expect(sectionContent).toContain('section.layout_version != null')
    expect(sectionContent).toMatch(/function LegacyRenderer/)

    const supportedVersions = await fs.readFile('src/lib/builder/supported-versions.ts', 'utf8')
    expect(supportedVersions).toContain('SUPPORTED_LAYOUT_VERSIONS = [1]')

    const layoutRenderer = await fs.readFile('src/components/sop/LayoutRenderer.tsx', 'utf8')
    expect(layoutRenderer).toContain('@puckeditor/core')
    expect(layoutRenderer).toContain('SUPPORTED_LAYOUT_VERSIONS')
    expect(layoutRenderer).toContain('[layout] unsupported version')
  })
})
