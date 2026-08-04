/**
 * UX-08 — Dead-weight sweep (Phase 30 Wave-0 stub).
 *
 * Eventual contract (30-RESEARCH § Current Wiring 7 + § Dead-Href Inventory):
 *   - Deleted: ModelTab.tsx + tab entry, /sops/[sopId]/walkthrough route
 *     (page.tsx + layout.tsx — hrefs become ?tab=walk), WalkthroughTab.tsx
 *     shim, BuilderWithSourceViewer.tsx (this plan, 30-01), fake
 *     notifications bell (TopHeader — NotificationBadge itself stays for
 *     BottomTabBar), AdminDashboard/PendingDashboard UI (UX-01).
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

  // 2026-07-30: BottomTabBar deleted (redundant with TopHeader); its
  // NotificationBadge moved onto the TopHeader SOPs link. The fake bell
  // (aria-label="Notifications", linked to /sops) stays gone.
  test('BottomTabBar deleted; NotificationBadge lives on the TopHeader SOPs link', () => {
    const header = fs.readFileSync(
      path.join(ROOT, 'src', 'components', 'layout', 'TopHeader.tsx'), 'utf-8',
    )
    expect(header).toContain('NotificationBadge')
    expect(header).not.toContain('aria-label="Notifications"')
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
    expect(src).not.toMatch(/\/\/ TODO.*useAssignedSops/)
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

  // LIVE from 30-04 Task 1: header consolidated (UX-01/02/08 slice).
  test('/pathways + /uat links live in the account menu, not primary nav', () => {
    const header = fs.readFileSync(
      path.join(ROOT, 'src', 'components', 'layout', 'TopHeader.tsx'), 'utf-8',
    )
    // BASE_LINKS (primary nav) no longer carries them — the account-menu
    // TOOLING_LINKS block does, and it is actually rendered (wiring, not
    // token presence — CLAUDE.md 2026-06-05).
    const baseLinks = header.match(/const BASE_LINKS[\s\S]*?\n\]/)?.[0] ?? ''
    expect(baseLinks.length).toBeGreaterThan(0)
    expect(baseLinks).not.toContain('/pathways')
    expect(baseLinks).not.toContain('/uat')
    const tooling = header.match(/const TOOLING_LINKS[\s\S]*?\n\]/)?.[0] ?? ''
    expect(tooling).toContain('/pathways')
    expect(tooling).toContain('/uat')
    expect(header).toContain('TOOLING_LINKS.map')
  })

  // 2026-07-30 direction: admin links promoted into the primary header
  // (Create New SOP · Team · Settings), supersedes UX-02's account-menu door.
  test('TopHeader has no /dashboard, brand resolves via roleHome, ADMIN_LINKS wired behind isAdmin', () => {
    const header = fs.readFileSync(
      path.join(ROOT, 'src', 'components', 'layout', 'TopHeader.tsx'), 'utf-8',
    )
    expect(header).not.toContain('/dashboard')
    // Brand link WIRED to the role-home dispatcher, not a hardcoded route.
    expect(header).toContain("from '@/lib/auth/role-home'")
    expect(header).toContain('href={roleHome(role)}')
    // ADMIN_LINKS carries exactly the three promoted surfaces.
    const adminLinks = header.match(/const ADMIN_LINKS[\s\S]*?\n\]/)?.[0] ?? ''
    expect(adminLinks).toContain("'/admin/sops/new'")
    expect(adminLinks).toContain("'/admin/team'")
    expect(adminLinks).toContain("'/admin/settings'")
    expect(adminLinks).toContain('Create New SOP')
    // Wiring, not token presence: links render only for admin roles.
    expect(header).toMatch(/isAdmin \? \[\.\.\.BASE_LINKS, \.\.\.ADMIN_LINKS\] : BASE_LINKS/)
    expect(header).toContain('isAdminRole(role)')
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
