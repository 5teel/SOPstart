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
  test('AdminNav component exists with the 5 canonical items', () => {
    const src = read(ADMIN_NAV)
    for (const item of ['SOPs', 'Needs attention', 'Blocks', 'Team', 'Settings']) {
      expect(src).toContain(item)
    }
    // The 5 canonical hrefs, incl. the Governance deep-link (decision #1)
    for (const href of [
      "'/admin/sops'",
      "'/admin/sops?view=attention'",
      "'/admin/blocks'",
      "'/admin/team'",
      "'/admin/settings'",
    ]) {
      expect(src).toContain(href)
    }
  })

  test('every admin page mounts AdminNav; zero inline "Admin sections" sub-navs remain', () => {
    for (const page of ADMIN_PAGES) {
      const src = read(page)
      // Handler-wiring, not token presence: the component is imported AND rendered
      expect(src).toContain("from '@/components/admin/AdminNav'")
      // active is a string literal on most pages; /admin/sops computes it
      // (governance when ?view=attention, sops otherwise).
      expect(src).toMatch(/<AdminNav active=["{]/)
      // The old copy-pasted inline nav idiom is gone from every page
      expect(src).not.toContain('aria-label="Admin sections"')
      // T-30-03-01: the per-page role gate survives the nav swap verbatim
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

  // Flipped live in 30-04: TopHeader ADMIN_LINKS collapsed to one Admin link.
  test('account menu collapses to one Admin link (to /admin/sops)', () => {
    const src = read(TOP_HEADER)
    expect(src).toContain("'/admin/sops'")
    expect(src).not.toContain("'/admin/ai-settings'")
    expect(src).not.toContain("'/admin/blocks'")
    expect(src).not.toContain("'/admin/team'")
  })
})
