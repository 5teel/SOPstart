/**
 * UX-02 — One shared AdminNav (flipped live in 30-03).
 *
 * Contract (30-RESEARCH § Test Map + 30-03-PLAN must_haves):
 *   - A single shared <AdminNav> component exists with 5 items:
 *     SOPs · Governance · Blocks · Team · Settings.
 *   - Governance deep-links /admin/sops?view=attention (decision #1; the
 *     folded needs-attention view itself lands in 30-08).
 *   - Every admin page mounts AdminNav; the 5 copy-pasted inline sub-navs
 *     (admin/sops, admin/governance, admin/blocks, admin/team,
 *     admin/departments — three different styling idioms) are deleted.
 *   - /admin/settings route exists and groups: AI Settings, Departments,
 *     and the /admin/agent link (the previous orphan). The approval-chain
 *     editor relocates here in 30-08, NOT in this plan.
 *   - T-30-03-01: consolidation must not weaken any check — every admin
 *     page keeps its own ['admin','safety_manager'] guard verbatim.
 *   - Account menu (TopHeader) collapse is 30-04 scope — stays fixme here.
 *
 * Source-contract idiom mirrors tests/phase28/governance-queue.spec.ts.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const ADMIN_NAV = path.join(ROOT, 'src', 'components', 'admin', 'AdminNav.tsx')
const SETTINGS_PAGE = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'settings', 'page.tsx',
)
const TOP_HEADER = path.join(ROOT, 'src', 'components', 'layout', 'TopHeader.tsx')

// 30-08: admin/governance became a redirect shim (no UI, no nav) — it keeps
// its guard but no longer mounts AdminNav.
const ADMIN_PAGES = ['sops', 'blocks', 'team', 'departments'].map(
  (dir) => path.join(ROOT, 'src', 'app', '(protected)', 'admin', dir, 'page.tsx'),
)
const GOVERNANCE_SHIM = path.join(
  ROOT, 'src', 'app', '(protected)', 'admin', 'governance', 'page.tsx',
)

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('UX-02 — one shared admin nav', () => {
  // 2026-07-30 (sketch 004 variant A): AdminNav is DELETED — the app header
  // is the only admin nav tier. The /admin/sops rail carries the in-page
  // views (status tabs · Needs attention · Access).
  test('AdminNav component is deleted; header carries the admin links', () => {
    expect(fs.existsSync(ADMIN_NAV)).toBe(false)
    const header = read(TOP_HEADER)
    for (const item of ['Manage SOPs', 'Create New SOP', 'Content', 'Team', 'Settings']) {
      expect(header).toContain(item)
    }
    for (const href of [
      "'/admin/sops'",
      "'/admin/sops/new'",
      "'/admin/blocks'",
      "'/admin/team'",
      "'/admin/settings'",
    ]) {
      expect(header).toContain(href)
    }
    // The attention view stays reachable from the /admin/sops rail.
    const sopsPage = read(ADMIN_PAGES[0])
    expect(sopsPage).toContain('/admin/sops?view=attention')
  })

  test('no admin page mounts AdminNav or an inline "Admin sections" sub-nav; guards survive', () => {
    for (const page of ADMIN_PAGES) {
      const src = read(page)
      expect(src).not.toContain('AdminNav')
      expect(src).not.toContain('aria-label="Admin sections"')
      // T-30-03-01: the per-page role gate survives the nav removal verbatim
      expect(src).toContain("['admin', 'safety_manager']")
    }
    // The governance shim keeps its guard but renders nothing (30-08).
    const shim = read(GOVERNANCE_SHIM)
    expect(shim).toContain("['admin', 'safety_manager']")
    expect(shim).not.toContain('aria-label="Admin sections"')
    expect(shim).not.toContain('<AdminNav')
  })

  test('/admin/settings exists, keeps the admin guard, and homes AI Settings + Departments + agent layer', () => {
    const src = read(SETTINGS_PAGE)
    expect(src).toContain("['admin', 'safety_manager']")
    expect(src).toContain('/admin/ai-settings')
    expect(src).toContain('/admin/departments')
    expect(src).toContain('/admin/agent')
    // ApprovalChainPanel relocation is 30-08 scope (governance fold) — not asserted here.
  })

  test('journeys.ts maps the /admin/settings screen', () => {
    const journeys = read(path.join(ROOT, 'src', 'lib', 'journeys', 'journeys.ts'))
    expect(journeys).toContain("route: '/admin/settings'")
  })

  // 2026-07-30: account-menu Admin door removed — admin links (Create New
  // SOP · Team · Settings) live in the primary header, gated on isAdmin.
  test('primary header carries Create New SOP / Team / Settings; no account-menu Admin link', () => {
    const src = read(TOP_HEADER)
    expect(src).toContain("'/admin/sops/new'")
    expect(src).toContain("'/admin/team'")
    expect(src).toContain("'/admin/settings'")
    expect(src).not.toContain('ADMIN_LINK.href')
    expect(src).not.toContain("'/admin/ai-settings'")
  })
})
