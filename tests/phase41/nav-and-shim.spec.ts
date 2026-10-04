/**
 * Phase 41 / Plan 41-06 — SUR-03 / SUR-04 + the legacy `/admin/sops` URL.
 * Flipped live (was a Wave-0 stub in 41-01). Repointed in 43-04 (Phase 43,
 * D-01): the page-level shim is deleted; the legacy URL is now a static
 * next.config.ts redirect.
 *
 * Source-contract idiom, not browser automation — normalises \r\n to \n
 * per CLAUDE.md 2026-07-18.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const NEXT_CONFIG = path.join(ROOT, 'next.config.ts')
// 57-09: the library table is gone; the Workshop's draft rows are the admin list -> builder chain.
const WORKSHOP = path.join(ROOT, 'src', 'components', 'shell', 'AdminRoomBodies.tsx')
// 57-08: the worker list is gone; the worker half of the one screen is the shell.
const WORKER_SHELL = ['OneScreen.tsx', 'WorkerShell.tsx', 'RoomBodies.tsx', 'SiteSummary.tsx', 'OfficeCard.tsx'].map(
  (f) => path.join(ROOT, 'src', 'components', 'shell', f),
)
const SOP_DETAIL_PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'sops', '[sopId]', 'page.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

test.describe('legacy /admin/sops — static next.config.ts redirect (Phase 43 D-01)', () => {
  test('redirects to /sops as a fixed same-origin destination (open-redirect hygiene, T-41-03/T-43-02)', () => {
    const config = read(NEXT_CONFIG)
    expect(config).toContain("source: '/admin/sops',")
    expect(config).toContain("destination: '/sops',")
    const destinations = [...config.matchAll(/destination:\s*'([^']*)'/g)].map((m) => m[1])
    expect(destinations.length).toBeGreaterThan(0)
    for (const d of destinations) {
      expect(d.startsWith('/')).toBe(true)
      expect(d.startsWith('//')).toBe(false)
      expect(d).not.toContain('http')
      expect(d).not.toContain('${')
    }
  })
})

test.describe('SUR-04 — one path from a SOP to its builder', () => {
  test('SUR-04: the Workshop (AdminRoomBodies) links /admin/sops/builder/; the worker shell does not', () => {
    const workshop = read(WORKSHOP)
    expect(workshop).toContain('/admin/sops/builder/')
    for (const f of WORKER_SHELL) expect(read(f), f).not.toContain('/admin/sops/builder')
  })

  test('SUR-04: the worker SOP detail page keeps its own "Edit in builder" DESTINATION (not a second list→builder chain)', () => {
    // The Workshop's draft rows are the only admin list that links directly
    // into the builder. The detail page's own Edit link is a
    // documented second destination (D-06), not a second chain.
    const detail = read(SOP_DETAIL_PAGE)
    expect(detail).toContain('/admin/sops/builder/')
  })
})
