/**
 * UX-08 — Dead-weight sweep (Phase 30 Wave-0 stub).
 *
 * Eventual contract (30-RESEARCH § Current Wiring 7 + § Dead-Href Inventory):
 *   - Deleted: ModelTab.tsx + tab entry, /sops/[sopId]/walkthrough route
 *     (page.tsx + layout.tsx — hrefs moved to the tab address, now the focus screen), WalkthroughTab.tsx
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

// 58-15: the builder and tabs directories are retired wholesale (58-16), so a
// deletion guard that read a file INSIDE them would throw or pass vacuously.
// Each guard now walks src/ for the file name and for any reference to it.
function srcFiles(dir = path.join(ROOT, 'src'), out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) srcFiles(p, out)
    else if (/\.tsx?$/.test(e.name)) out.push(p)
  }
  return out
}
function stripComments(src: string): string {
  return src.split('\n').map((l) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(l) ? '' : l)).join('\n')
}
/** Absence of the file anywhere in src/ AND of any code reference to its symbol. */
function expectGone(symbol: string) {
  const files = srcFiles()
  expect(files.filter((p) => path.basename(p) === `${symbol}.tsx`).map((p) => path.relative(ROOT, p))).toEqual([])
  const refs = files.filter((p) => stripComments(fs.readFileSync(p, 'utf-8')).includes(symbol)).map((p) => path.relative(ROOT, p))
  expect(refs, `${symbol} is still referenced`).toEqual([])
}

test.describe('UX-08 — dead-weight sweep', () => {
  // LIVE from 30-01 Task 2: the legacy Phase-21 builder shell is gone.
  test('BuilderWithSourceViewer.tsx is deleted and nothing references it (superseded in Phase 26, then by the focus editor)', () => {
    expectGone('BuilderWithSourceViewer')
  })

  // LIVE from 30-06: UX-05 tab merge deletions.
  test('ModelTab + WalkthroughTab shim are deleted with their tab entries', () => {
    expectGone('ModelTab')
    expectGone('WalkthroughTab')
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

  // UX-04: no worker-side Create SOP entry. The department-filter half of this
  // guard went with the worker list page (57-08): the list is retired, so the
  // placebo filter it pinned no longer exists to be placebo.
  test('the worker shell offers no Create SOP entry', () => {
    const shellDir = path.join(ROOT, 'src', 'components', 'shell')
    for (const f of ['WorkerShell.tsx', 'RoomBodies.tsx', 'SiteSummary.tsx', 'OfficeCard.tsx']) {
      expect(fs.readFileSync(path.join(shellDir, f), 'utf-8'), f).not.toContain('Create SOP')
    }
    // 63-11: the home replaced OneScreen
    expect(fs.readFileSync(path.join(ROOT, 'src', 'components', 'home', 'HomeShell.tsx'), 'utf-8')).not.toContain('Create SOP')
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
