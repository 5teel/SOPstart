/**
 * UX-05 — Worker SOP detail 6 tabs → 3 (Phase 30 Wave-0 stub).
 *
 * Eventual contract (30-RESEARCH § Test Map + § Current Wiring 5):
 *   - SOP_TABS === ['read', 'walk', 'flow'] (SopTabNav.tsx).
 *   - Legacy ?tab= mapping inside useActiveTab/isSopTabId — ALL 6 old values
 *     land: overview|tools|hazards|model → read, walkthrough → walk,
 *     flow → flow. Old params accepted forever (bookmarks/shared links;
 *     printed QR codes encode bare /sops/{id} so QR risk is nil).
 *   - Merged Read tab renders PPE ONCE (single isPpeSection usage),
 *     equipment once, keeps the "Current as of" caption (phase28 spec) and
 *     the D28-07 no-governance-gate invariant on worker routes.
 *   - ModelTab deleted entirely.
 *   - Bundle gate: /sops/[sopId] First Load JS ≤ baseline +2 KB (pre-merge
 *     baseline 1057 KB per .bundle-baseline.json — recorded in 30-01-SUMMARY);
 *     merge expected to REDUCE it. Re-baseline via
 *     scripts/capture-bundle-baseline.ts, never hand-edit.
 *   - Read tab must NOT statically import from components/sop/walkthrough/
 *     (all walkthrough mounting stays behind WalkthroughSwitcher).
 *
 * This file starts as test.fixme — the UX-05 plan flips it live.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const TAB_NAV = path.join(ROOT, 'src', 'components', 'sop', 'SopTabNav.tsx')
const TABS_DIR = path.join(ROOT, 'src', 'components', 'sop', 'tabs')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('UX-05 — worker tab merge (6 → 3)', () => {
  test.fixme('SOP_TABS is exactly [read, walk, flow]', () => {
    const src = read(TAB_NAV)
    expect(src).toMatch(/SOP_TABS\s*=\s*\[\s*'read',\s*'walk',\s*'flow',?\s*\]/)
  })

  test.fixme('legacy tab params all map: overview/tools/hazards/model → read, walkthrough → walk', () => {
    const src = read(TAB_NAV)
    for (const legacy of ['overview', 'tools', 'hazards', 'model', 'walkthrough']) {
      expect(src).toContain(`'${legacy}'`)
    }
  })

  test.fixme('ModelTab is deleted', () => {
    expect(fs.existsSync(path.join(TABS_DIR, 'ModelTab.tsx'))).toBe(false)
  })

  test.fixme('PPE renders once — isPpeSection no longer copy-pasted across ToolsTab + HazardsTab', () => {
    // After the merge only the merged Read tab defines/uses isPpeSection.
    expect(fs.existsSync(path.join(TABS_DIR, 'ToolsTab.tsx'))).toBe(false)
    expect(fs.existsSync(path.join(TABS_DIR, 'HazardsTab.tsx'))).toBe(false)
  })

  test.fixme('Read tab keeps the "Current as of" caption (phase28 contract)', () => {
    // Repointed from OverviewTab.tsx to the merged Read tab component.
    const readTab = read(path.join(TABS_DIR, 'ReadTab.tsx'))
    expect(readTab).toContain('Current as of')
  })
})
