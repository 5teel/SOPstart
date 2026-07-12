/**
 * UX-05 — Worker SOP detail 6 tabs → 3 (LIVE — flipped in 30-06).
 *
 * Contract (30-RESEARCH § Test Map + § Current Wiring 5):
 *   - SOP_TABS === ['read', 'walk', 'flow'] (SopTabNav.tsx).
 *   - Legacy ?tab= mapping inside SopTabNav — ALL 6 old values land:
 *     overview|tools|hazards|model → read, walkthrough → walk, flow → flow.
 *     Old params accepted forever (bookmarks/shared links; printed QR codes
 *     encode bare /sops/{id} so QR risk is nil).
 *   - Merged Read tab renders PPE ONCE (single isPpeSection definition),
 *     equipment once, keeps the "Current as of" caption (phase28 spec) and
 *     the D28-07 no-governance-gate invariant on worker routes.
 *   - ModelTab deleted entirely; ToolsTab/HazardsTab superseded by ReadTab.
 *   - Bundle trap: ReadTab must NOT statically import from
 *     components/sop/walkthrough/ — all walkthrough mounting stays behind
 *     WalkthroughSwitcher (chunk gate enforced by postbuild
 *     check-bundle-size.ts + tests/lint/no-static-desktop-import.spec.ts;
 *     First Load JS ≤ baseline +2 KB via .bundle-baseline.json).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const TAB_NAV = path.join(ROOT, 'src', 'components', 'sop', 'SopTabNav.tsx')
const TABS_DIR = path.join(ROOT, 'src', 'components', 'sop', 'tabs')
const DETAIL_PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'sops', '[sopId]', 'page.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('UX-05 — worker tab merge (6 → 3)', () => {
  test('SOP_TABS is exactly [read, walk, flow]', () => {
    const src = read(TAB_NAV)
    expect(src).toMatch(/SOP_TABS\s*=\s*\[\s*'read',\s*'walk',\s*'flow',?\s*\]/)
  })

  test('legacy tab params all map: overview/tools/hazards/model → read, walkthrough → walk', () => {
    const src = read(TAB_NAV)
    // Every legacy id maps to its correct target in LEGACY_TAB_MAP, and the
    // map is applied BEFORE the isSopTabId guard (resolveTab).
    expect(src).toMatch(/overview:\s*'read'/)
    expect(src).toMatch(/tools:\s*'read'/)
    expect(src).toMatch(/hazards:\s*'read'/)
    expect(src).toMatch(/model:\s*'read'/)
    expect(src).toMatch(/walkthrough:\s*'walk'/)
    expect(src).toContain('LEGACY_TAB_MAP')
  })

  test('ModelTab is deleted', () => {
    expect(fs.existsSync(path.join(TABS_DIR, 'ModelTab.tsx'))).toBe(false)
  })

  test('PPE renders once — isPpeSection no longer copy-pasted across ToolsTab + HazardsTab', () => {
    // After the merge only the merged Read tab defines/uses isPpeSection.
    expect(fs.existsSync(path.join(TABS_DIR, 'ToolsTab.tsx'))).toBe(false)
    expect(fs.existsSync(path.join(TABS_DIR, 'HazardsTab.tsx'))).toBe(false)
    const readTab = read(path.join(TABS_DIR, 'ReadTab.tsx'))
    expect(readTab.match(/function isPpeSection/g)?.length).toBe(1)
  })

  test('Read tab keeps the "Current as of" caption (phase28 contract)', () => {
    // Repointed from OverviewTab.tsx to the merged Read tab component.
    const readTab = read(path.join(TABS_DIR, 'ReadTab.tsx'))
    expect(readTab).toContain('Current as of')
  })

  test('bundle trap: ReadTab has no static walkthrough import; page mounts walkthrough only via WalkthroughSwitcher', () => {
    const readTab = read(path.join(TABS_DIR, 'ReadTab.tsx'))
    expect(readTab).not.toContain('components/sop/walkthrough')
    const page = read(DETAIL_PAGE)
    expect(page).toContain("=== 'walk' && <WalkthroughSwitcher")
    // No direct Desktop/Mobile walkthrough mount on the worker detail page.
    expect(page).not.toContain('DesktopWalkthrough')
    expect(page).not.toContain('MobileWalkthrough')
  })

  test('bundle baseline exists and covers the worker route (regenerated, never hand-edited)', () => {
    const baseline = JSON.parse(read(path.join(ROOT, '.bundle-baseline.json')))
    expect(typeof baseline.routes['/sops/[sopId]/page']).toBe('number')
    expect(baseline.routes['/sops/[sopId]/page']).toBeGreaterThan(0)
  })
})
