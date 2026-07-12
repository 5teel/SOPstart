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

  test.fixme('ModelTab + WalkthroughTab shim are deleted with their tab entries', () => {
    expect(fs.existsSync(path.join(TABS_DIR, 'ModelTab.tsx'))).toBe(false)
    expect(fs.existsSync(path.join(TABS_DIR, 'WalkthroughTab.tsx'))).toBe(false)
  })

  test.fixme('/sops/[sopId]/walkthrough route (page + orphan layout) is deleted', () => {
    const routeDir = path.join(ROOT, 'src', 'app', '(protected)', 'sops', '[sopId]', 'walkthrough')
    expect(fs.existsSync(routeDir)).toBe(false)
  })

  // LIVE from 30-04 Task 1: the fake bell (linked to /sops, no notifications screen) is gone.
  test('fake notifications bell removed from TopHeader (NotificationBadge stays in BottomTabBar)', () => {
    const header = fs.readFileSync(
      path.join(ROOT, 'src', 'components', 'layout', 'TopHeader.tsx'), 'utf-8',
    )
    expect(header).not.toContain('NotificationBadge')
    expect(header).not.toContain('aria-label="Notifications"')
    const tabBar = fs.readFileSync(
      path.join(ROOT, 'src', 'components', 'layout', 'BottomTabBar.tsx'), 'utf-8',
    )
    expect(tabBar).toContain('NotificationBadge')
  })

  test.fixme('worker /sops department filter is fixed or removed (no placebo return true)', () => {
    const src = fs.readFileSync(
      path.join(ROOT, 'src', 'app', '(protected)', 'sops', 'page.tsx'), 'utf-8',
    )
    expect(src).not.toMatch(/\/\/ TODO.*useAssignedSops/)
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

  // LIVE from 30-04 Task 1: nav landing model (UX-01) + one admin door (UX-02).
  test('TopHeader has no /dashboard, brand resolves via roleHome, exactly one admin href wired', () => {
    const header = fs.readFileSync(
      path.join(ROOT, 'src', 'components', 'layout', 'TopHeader.tsx'), 'utf-8',
    )
    expect(header).not.toContain('/dashboard')
    // Brand link WIRED to the role-home dispatcher, not a hardcoded route.
    expect(header).toContain("from '@/lib/auth/role-home'")
    expect(header).toContain('href={roleHome(role)}')
    // Every /admin/* string in the file is /admin/sops, and the single
    // Admin link's href is wired to it via ADMIN_LINK.
    const adminHrefs = header.match(/\/admin\/[a-z-]+/g) ?? []
    expect(adminHrefs.length).toBeGreaterThan(0)
    expect(adminHrefs.every((h) => h === '/admin/sops')).toBe(true)
    expect(header).toMatch(/const ADMIN_LINK[^\n]*'\/admin\/sops'/)
    expect(header).toContain('href={ADMIN_LINK.href}')
    // Visibility gate preserved (T-30-04-01): the link renders inside isAdmin.
    expect(header).toContain('isAdminRole(role)')
  })

  test.fixme('journeys.ts contains no removed routes (/pathways shows 0 not-mapped)', () => {
    const journeys = fs.readFileSync(
      path.join(ROOT, 'src', 'lib', 'journeys', 'journeys.ts'), 'utf-8',
    )
    expect(journeys).not.toContain("'/sops/[sopId]/walkthrough'")
  })
})
