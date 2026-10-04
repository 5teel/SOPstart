/**
 * UX-08 — Dead-weight sweep (Phase 30 Wave-0 stub).
 *
 * Eventual contract (30-RESEARCH § Current Wiring 7 + § Dead-Href Inventory):
 *   - Deleted: ModelTab.tsx + tab entry, /sops/[sopId]/walkthrough route
 *     (page.tsx + layout.tsx — hrefs become ?tab=walk), WalkthroughTab.tsx
 *     shim, BuilderWithSourceViewer.tsx (this plan, 30-01), fake
 *     notifications bell (the whole header went in Phase 57), AdminDashboard/PendingDashboard UI (UX-01).
 *   - No-op worker department filter fixed or removed (decision #3 —
 *     executor checks the sop_departments SELECT policy at edit time).
 *   - /pathways + /uat links move from primary nav to the account menu.
 *   - Zero dead-href strings per removal (CLAUDE.md 2026-06-08); journeys.ts
 *     contains no removed routes; /pathways "All screens" → 0 not-mapped.
 *
 * BuilderWithSourceViewer deletion happens IN this plan (30-01 Task 2), so
 * that assertion runs LIVE. The rest flip in the UX-08 sweep plan.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const BUILDER_DIR = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'builder', '[sopId]',
)
const TABS_DIR = path.join(ROOT, 'src', 'components', 'sop', 'tabs')

test.describe('UX-08 — dead-weight sweep', () => {
  // LIVE from 30-01 Task 2: the legacy Phase-21 builder shell is gone.
  test('BuilderWithSourceViewer.tsx is deleted (superseded by BuilderStageShell, Phase 26)', () => {
    expect(fs.existsSync(path.join(BUILDER_DIR, 'BuilderWithSourceViewer.tsx'))).toBe(false)
  })

  // LIVE from 30-06: UX-05 tab merge deletions.
  test('ModelTab + WalkthroughTab shim are deleted with their tab entries', () => {
    expect(fs.existsSync(path.join(TABS_DIR, 'ModelTab.tsx'))).toBe(false)
    expect(fs.existsSync(path.join(TABS_DIR, 'WalkthroughTab.tsx'))).toBe(false)
    // Their exports are gone from the tabs barrel too.
    const barrel = fs.readFileSync(path.join(TABS_DIR, 'index.ts'), 'utf-8')
    expect(barrel).not.toContain('ModelTab')
    expect(barrel).not.toContain('WalkthroughTab')
  })

  test('/sops/[sopId]/walkthrough route (page + orphan layout) is deleted', () => {
    const routeDir = path.join(ROOT, 'src', 'app', '(protected)', 'sops', '[sopId]', 'walkthrough')
    expect(fs.existsSync(routeDir)).toBe(false)
  })

  // Phase 57: the whole header is deleted, so its badge and fake bell went with it.
  test('BottomTabBar stays deleted', () => {
    expect(
      fs.existsSync(path.join(ROOT, 'src', 'components', 'layout', 'BottomTabBar.tsx')),
    ).toBe(false)
  })

  // LIVE from 30-06: decision #3 — sop_departments SELECT using(true) verified
  // live, so the filter was FIXED (real junction fetch), not removed.
  test('worker /sops department filter is fixed or removed (no placebo return true)', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src', 'app', '(protected)', 'sops', 'page.tsx'), 'utf-8',
    )
    // The fix is WIRED: junction fetch feeds the filter predicate.
    expect(src).toContain("from('sop_departments')")
    // Repointed 2026-08-04: the predicate moved into deptMatches(sopId) when
    // the library tab merged into the Miller scopes. Assert the junction feeds
    // it AND that the list actually applies it (wiring, not token presence).
    expect(src).toMatch(/sopDeptMap\[sop(\.id|Id)\]/)
    expect(src).toContain('deptMatches(s.id)')
    // UX-04: no worker-side Create SOP tab either.
    expect(src).not.toContain('Create SOP')
  })

  // LIVE from 30-06: walkthrough journeys repointed to /sops/[sopId] Walk tab.
  test('journeys.ts contains no removed routes (/pathways shows 0 not-mapped)', () => {
    const journeys = fs.readFileSync(
      path.join(ROOT, 'src', 'lib', 'journeys', 'journeys.ts'), 'utf-8',
    )
    expect(journeys).not.toContain("'/sops/[sopId]/walkthrough'")
  })

  /**
   * The route deletion above only proves the directory is gone — a link TO it
   * still builds green and 404s at runtime (CLAUDE.md 2026-06-08: internal
   * hrefs are not type-checked). SopWorkerBrowser resurrected exactly that
   * href in the 2026-08 Miller-columns work and shipped it. Sweep src/.
   */
  test('no src file links to the deleted /walkthrough route', () => {
    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) walk(p)
        // Anchor on /sops/ so `@/stores/walkthrough` imports aren't offenders.
        else if (/\.tsx?$/.test(e.name) && /\/sops\/[^'"`\n]*\/walkthrough/.test(fs.readFileSync(p, 'utf-8'))) {
          offenders.push(path.relative(ROOT, p))
        }
      }
    }
    walk(path.join(ROOT, 'src'))
    expect(offenders).toEqual([])
  })
})
