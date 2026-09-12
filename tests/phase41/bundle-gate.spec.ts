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

test.describe('SB-LINE-06 — two-route bundle gate', () => {
  test('check-bundle-size.ts is route-array shaped and gates /sops/page', () => {
    const src = read('scripts/check-bundle-size.ts')
    expect(src).toContain('GATED_ROUTES')
    expect(src).toContain("'/sops/page'")
    expect(src).toContain("'/sops/[sopId]/page'")
  })

  test('capture-bundle-baseline.ts is route-array shaped and merges rather than replaces', () => {
    const src = read('scripts/capture-bundle-baseline.ts')
    expect(src).toContain('GATED_ROUTES')
    expect(src).toContain("'/sops/page'")
    // Merge-not-replace: reads the prior baseline's routes before writing.
    expect(src).toContain('priorRoutes')
  })

  test('.bundle-baseline.json carries both route keys with positive values', () => {
    const baseline = JSON.parse(read('.bundle-baseline.json')) as {
      routes: Record<string, number>
    }
    expect(Object.keys(baseline.routes).sort()).toEqual(
      ['/sops/[sopId]/page', '/sops/page'].sort()
    )
    expect(baseline.routes['/sops/[sopId]/page']).toBeGreaterThan(0)
    expect(baseline.routes['/sops/page']).toBeGreaterThan(0)
  })

  test('/sops/page entry declares at least one forbidden marker per admin lens', () => {
    const src = read('scripts/check-bundle-size.ts')
    // One literal per lens, verified against the lens source at plan time
    // (SopMillerBrowser.tsx, GovernanceQueueRow.tsx, WiringPatchBay.tsx).
    expect(src).toContain('Pick another scope on the left.')
    expect(src).toContain('Owner role gone')
    expect(src).toContain('follows collection')
  })
})
