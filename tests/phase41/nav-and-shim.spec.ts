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
const TOP_HEADER = path.join(ROOT, 'src', 'components', 'layout', 'TopHeader.tsx')
const NEXT_CONFIG = path.join(ROOT, 'next.config.ts')
const LIBRARY_TABLE = path.join(ROOT, 'src', 'components', 'admin', 'AdminLibraryTable.tsx')
const WORKER_LIST = path.join(ROOT, 'src', 'components', 'sop', 'WorkerSimpleList.tsx')
const SOP_DETAIL_PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'sops', '[sopId]', 'page.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

test.describe('SUR-03 — one top-level "SOPs" entry', () => {
  test('SUR-03: ADMIN_LINKS drops Manage SOPs / the /admin/sops href; BASE_LINKS keeps exactly one /sops entry', () => {
    const header = read(TOP_HEADER)
    expect(header).not.toContain("label: 'Manage SOPs'")
    expect(header).not.toContain("href: '/admin/sops'")
    const sopsMatches = header.match(/href:\s*'\/sops'/g) ?? []
    expect(sopsMatches.length).toBe(1)
  })

  test('SUR-03/Phase 54: the Governance entry points at /governance', () => {
    const header = read(TOP_HEADER)
    expect(header).toContain("label: 'Governance', href: '/governance'")
    expect(header).not.toContain("'/sops?view=attention'")
  })
})

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
  test('SUR-04: AdminLibraryTable contains /admin/sops/builder/; WorkerSimpleList does not', () => {
    const table = read(LIBRARY_TABLE)
    expect(table).toContain('/admin/sops/builder/')
    const workerList = read(WORKER_LIST)
    expect(workerList).not.toContain('/admin/sops/builder')
  })

  test('SUR-04: the worker SOP detail page keeps its own "Edit in builder" DESTINATION (not a second list→builder chain)', () => {
    // AdminLibraryTable is the only component reachable from a SOP LIST that
    // links directly into the builder. The detail page's own Edit link is a
    // documented second destination (D-06), not a second chain.
    const detail = read(SOP_DETAIL_PAGE)
    expect(detail).toContain('/admin/sops/builder/')
  })
})
