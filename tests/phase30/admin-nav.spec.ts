/**
 * UX-02 — One shared AdminNav (Phase 30 Wave-0 stub).
 *
 * Eventual contract (30-RESEARCH § Test Map + § Current Wiring 2):
 *   - A single shared <AdminNav> component exists with 5 items:
 *     SOPs · Governance · Blocks · Team · Settings.
 *   - Every admin page mounts AdminNav; the 5 copy-pasted inline sub-navs
 *     (admin/sops, admin/governance, admin/blocks, admin/team,
 *     admin/departments — three different styling idioms) are deleted.
 *   - /admin/settings route exists and groups: AI Settings, relocated
 *     ApprovalChainEditor, /admin/agent link (the current orphan).
 *   - Account menu (TopHeader ADMIN_LINKS) collapses to ONE "Admin" link
 *     to /admin/sops (admin/safety_manager only).
 *   - Retargeted auth guards keep the ['admin','safety_manager'] gate on
 *     every page (ASVS V4 — consolidation must not weaken any check).
 *
 * Source-contract idiom mirrors tests/phase28/governance-queue.spec.ts.
 * This file starts as test.fixme — the UX-02 plan flips it live.
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

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('UX-02 — one shared admin nav', () => {
  test.fixme('AdminNav component exists with the 5 canonical items', () => {
    const src = read(ADMIN_NAV)
    for (const item of ['SOPs', 'Governance', 'Blocks', 'Team', 'Settings']) {
      expect(src).toContain(item)
    }
  })

  test.fixme('every admin page mounts AdminNav; zero inline "Admin sections" sub-navs remain', () => {
    // Eventual sweep: grep each admin page.tsx for <AdminNav and assert the
    // old inline nav idioms (className="tab" link rows) are gone.
    const sopsPage = read(
      path.join(ROOT, 'src', 'app', '(protected)', 'admin', 'sops', 'page.tsx'),
    )
    expect(sopsPage).toContain('AdminNav')
  })

  test.fixme('/admin/settings exists and groups AI Settings + approval chains + agent layer', () => {
    const src = read(SETTINGS_PAGE)
    expect(src).toContain('/admin/ai-settings')
    expect(src).toContain('ApprovalChainEditor')
    expect(src).toContain('/admin/agent')
  })

  test.fixme('account menu collapses to one Admin link (to /admin/sops)', () => {
    const src = read(TOP_HEADER)
    expect(src).toContain("'/admin/sops'")
    expect(src).not.toContain("'/admin/ai-settings'")
  })
})
