/**
 * UX-02 — One shared AdminNav (flipped live in 30-03).
 *
 * Contract (30-RESEARCH § Test Map + 30-03-PLAN must_haves):
 *   - A single shared <AdminNav> component exists with 5 items:
 *     SOPs · Governance · Blocks · Team · Settings.
 *   - Governance deep-links /admin/sops?view=attention (decision #1; the
 *     folded needs-attention view itself lands in 30-08).
 *   - Every admin page mounts AdminNav; the 5 copy-pasted inline sub-navs
 *     (admin/sops, admin/governance, admin/team,
 *     admin/departments — three different styling idioms) are deleted.
 *   - /admin/settings route exists and groups: AI Settings, Departments,
 *     and the /admin/agent link (the previous orphan). The approval-chain
 *     editor relocates here in 30-08, NOT in this plan.
 *   - T-30-03-01: consolidation must not weaken any check — every admin
 *     page keeps its own ['admin','safety_manager'] guard verbatim.
 *   - Phase 57: the header is gone; the admin links it carried live in the one screen.
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

// Phase 43 (D-01): the /admin/governance and /admin/sops page-level shims
// are deleted; both legacy URLs are now static next.config.ts redirects
// with no page of their own to read here.
const ADMIN_PAGES = ['team'].map(
  (dir) => path.join(ROOT, 'src', 'app', '(protected)', 'admin', dir, 'page.tsx'),
)
const PROXY = path.join(ROOT, 'src', 'lib', 'supabase', 'middleware.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('UX-02 — one shared admin nav', () => {
  // 2026-07-30 (sketch 004 variant A): AdminNav is DELETED — the app header
  // is the only admin nav tier. The /admin/sops rail carries the in-page
  // views (status tabs · Needs attention · Access).
  test('AdminNav component is deleted; the attention deep link still maps to governance', () => {
    expect(fs.existsSync(ADMIN_NAV)).toBe(false)
    // The attention view stays reachable — the session proxy maps the legacy
    // ?view=attention deep link onto the governance route (Phase 57).
    const proxy = read(PROXY)
    expect(proxy).toContain('officeRedirectFor(path, request.nextUrl.search)')
    expect(read(path.join(ROOT, 'src', 'lib', 'shell', 'place.ts'))).toContain("view === 'attention' ? '/?place=office'")
  })

  test('no admin page mounts AdminNav or an inline "Admin sections" sub-nav; guards survive', () => {
    for (const page of ADMIN_PAGES) {
      const src = read(page)
      expect(src).not.toContain('AdminNav')
      expect(src).not.toContain('aria-label="Admin sections"')
      // T-30-03-01: the per-page role gate survives the nav removal verbatim
      expect(src).toContain("['admin', 'safety_manager']")
    }
  })

  test('/admin/settings exists, keeps the admin guard, and homes AI Settings + Departments + agent layer', () => {
    const src = read(SETTINGS_PAGE)
    expect(src).toContain("['admin', 'safety_manager']")
    expect(src).toContain('/admin/ai-settings')
    expect(src).toContain('/?place=edit')
    expect(src).toContain('/admin/agent')
    // ApprovalChainPanel relocation is 30-08 scope (governance fold) — not asserted here.
  })

  test('journeys.ts maps the /admin/settings screen', () => {
    const journeys = read(path.join(ROOT, 'src', 'lib', 'journeys', 'journeys.ts'))
    expect(journeys).toContain("route: '/admin/settings'")
  })
})
