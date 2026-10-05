/**
 * Phase 41 / Plan 41-01 — SB-LINE-06 two-route bundle gate (LIVE).
 *
 * This spec is the "the gate is real" proof: it does not run `next build`
 * itself (that's `npm run build`'s job via postbuild), it asserts the gate
 * SCRIPTS and the committed baseline are shaped correctly so a later wave
 * cannot silently regress back to single-route gating (Pitfall 1,
 * 41-RESEARCH.md).
 *
 * Source-contract idiom (fs.readFileSync + toContain), not browser
 * automation — normalises \r\n to \n per CLAUDE.md 2026-07-18 (worktree
 * CRLF smudging breaks \n-literal source-contract specs).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8').replace(/\r\n/g, '\n')
}

test.describe('SB-LINE-06 -- bundle gate (the worker SOP route, plus / from Phase 57)', () => {
  test('check-bundle-size.ts is route-array shaped, gates the worker SOP route and no longer the list page', () => {
    const src = read('scripts/check-bundle-size.ts')
    expect(src).toContain('GATED_ROUTES')
    expect(src).toContain("'/sops/[sopId]/page'")
    expect(src).not.toContain("route: '/sops/page'")
    expect((src.match(/^\s*route: '/gm) ?? []).length).toBe(2)
  })

  test('capture-bundle-baseline.ts is route-array shaped and merges rather than replaces', () => {
    const src = read('scripts/capture-bundle-baseline.ts')
    expect(src).toContain('GATED_ROUTES')
    expect(src).not.toContain("'/sops/page'")
    // Merge-not-replace: reads the prior baseline's routes before writing.
    expect(src).toContain('priorRoutes')
  })

  test('.bundle-baseline.json carries exactly the two gated routes with positive values, the list route only in history', () => {
    const baseline = JSON.parse(read('.bundle-baseline.json')) as {
      routes: Record<string, number>
      history: Array<{ route: string; note: string }>
    }
    expect(Object.keys(baseline.routes).sort()).toEqual(['/page', '/sops/[sopId]/page'].sort())
    expect(baseline.routes['/page']).toBeGreaterThan(0)
    expect(baseline.routes['/sops/[sopId]/page']).toBeGreaterThan(0)
    expect(baseline.history.some((h) => h.route === '/sops/page' && h.note.includes('Phase 57-08'))).toBe(true)
  })

  test('/page entry (the one screen) keeps the site editor and heavy engines out', () => {
    const src = read('scripts/check-bundle-size.ts')
    expect(src).toContain("route: '/page'")
    expect(src).toContain("'Draw machine'")
    expect(src).toContain("'react-konva'")
    expect(src).toContain("'pdfjs-dist'")
    expect(src).toContain("'mammoth'")
    expect(src).toContain('page_client-reference-manifest.js')
  })

  test('the worker SOP route keeps the lazy focus editor out and the gate proves the chunk exists (58-13)', () => {
    const src = read('scripts/check-bundle-size.ts')
    expect(src).toContain("label: 'focus editor (lazy admin chunk, 58-13)'")
    expect(src).toContain("markers: ['I have checked this', 'Run the AI check']")
    // The positive half: the editor must be its own chunk and must not be in the route's set.
    expect(src).toContain('const EDITOR_LITERAL')
    expect(src).toContain('the focus editor chunk was not found')
    expect(src).toContain('workerSet.has(c)')
    // Both literals are authored in the editor (so the marker group is not vacuous).
    expect(read('src/components/focus/admin/StepCard.tsx')).toContain('I have checked this')
    expect(read('src/components/focus/admin/AiCheckBanner.tsx')).toContain('Run the AI check')
  })

  test('the worker SOP route still forbids the machine body and carries no library-table marker group', () => {
    const src = read('scripts/check-bundle-size.ts')
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\/\*|\*\/|\*)/.test(l))
      .join('\n')
    expect(src).toContain('No procedures for this machine yet.')
    expect(src).not.toContain('Reviewed within 12 months')
    expect(src).not.toContain('Owner role gone')
    expect(src).not.toContain('follows collection')
  })
})
