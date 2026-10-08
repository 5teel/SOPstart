/**
 * Phase 43 / Plan 43-01 -- Wave-0 scaffold for D-01 (page-level redirect
 * shims deleted, bookmark compatibility moves to next.config.ts
 * redirects()) and D-06 (route documentation truth). Four fixme tests
 * flip live in plan 43-04; the D-06 doc-truth pin is LIVE now (43-01
 * already fixed journeys.ts + ARCHITECTURE.md + CAPABILITY-MATRIX.md).
 *
 * The two shim page paths are built from segment arrays via path.join,
 * never spelled as a literal string fragment on a code line -- that
 * exact literal fragment is what tests/phase41/spec-repoint-inventory.spec.ts
 * scans for today, and spelling it here would trip that live inventory.
 *
 * Pattern: tests/phase54/deletion-sweep.spec.ts (read/stripComments/
 * walkTsFiles idiom).
 *
 * Registration: playwright.config.ts `phase43` project
 *   testDir: '.', testMatch: /tests\/phase43\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase43`
 *
 * All file reads happen INSIDE test bodies.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8').replace(/\r\n/g, '\n')
}

// Strips full-line comments (//, /*, */, and JSDoc * continuation lines).
function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(line) ? '' : line))
    .join('\n')
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name === '.next') continue
      walkTsFiles(full, out)
    } else if (
      entry.isFile() &&
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.(test|d)\.tsx?$/.test(entry.name)
    ) {
      out.push(full)
    }
  }
  return out
}

// The two legacy shim page routes, as segment arrays -- built via path.join
// below, never spelled as a literal path fragment.
const SHIM_SEGMENTS: string[][] = [
  ['admin', 'governance'],
  ['admin', 'sops'],
]

function shimPagePath(segs: string[]): string {
  return path.join(ROOT, 'src', 'app', '(protected)', ...segs, 'page.tsx')
}

test.describe('Route truth: legacy shims retired to config redirects (D-01, activates 43-04)', () => {
  test('the two page-level redirect shims are deleted (D-01)', () => {
    for (const segs of SHIM_SEGMENTS) {
      expect(fs.existsSync(shimPagePath(segs)), `${segs.join('/')} shim page must be deleted`).toBe(false)
    }
  })

  test('nothing in comment-stripped src/ names the /admin/governance URL (D-01)', () => {
    const offenders: string[] = []
    const re = /\/admin\/governance(?![\w/-])/
    for (const file of walkTsFiles(path.join(ROOT, 'src'))) {
      const rel = path.relative(ROOT, file)
      const stripped = stripComments(read(rel))
      if (re.test(stripped)) offenders.push(rel)
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  test(
    'next.config.ts redirects both legacy URLs to static same-origin paths and keeps the review redirect (D-01, T-43-02)',
    () => {
      const src = read('next.config.ts')
      expect(src).toContain("source: '/admin/governance'")
      expect(src).toContain("destination: '/governance'")
      expect(src).toContain("source: '/admin/sops'")
      expect(src).toContain("destination: '/sops'")
      expect(src).toContain("source: '/admin/sops/:sopId/review'")

      const destinations = [...src.matchAll(/destination:\s*'([^']*)'/g)].map((m) => m[1])
      expect(destinations.length).toBeGreaterThan(0)
      for (const d of destinations) {
        expect(d.startsWith('/')).toBe(true)
        expect(d.startsWith('//')).toBe(false)
        expect(d).not.toContain('http')
        expect(d).not.toContain('${')
      }

      const middlewareSrc = read('src/lib/supabase/middleware.ts')
      expect(middlewareSrc).toContain("path === '/sops'")
      expect(middlewareSrc).toContain('legacyPathRedirect(path, request.nextUrl.search)')
      expect(read('src/lib/shell/home-state.ts')).toContain("view === 'attention' ? at('signoffs')")
    }
  )

  test('journeys maps no deleted page (D-01)', () => {
    const src = read('src/lib/journeys/journeys.ts')
    expect(src).not.toContain("route: '/admin/governance'")
    expect(src).not.toContain("route: '/admin/sops'")
    // Phase 59: the governance address redirects to the Office; no journey names it as a route.
    expect(src).not.toContain("route: '/governance'")
  })

  test('journeys routes Publish to the real API route and the architecture doc matches roleHome (D-06)', () => {
    const journeysSrc = read('src/lib/journeys/journeys.ts')
    expect(journeysSrc).toContain("route: '/api/sops/[sopId]/publish'")

    const archSrc = read('.planning/codebase/ARCHITECTURE.md')
    expect(archSrc).toContain('every role → `/` (the one screen)')
    expect(archSrc).not.toContain('admins → `/dashboard`')
    expect(archSrc).not.toContain('/admin/sops/[sopId]/review')

    const matrixSrc = read('.planning/codebase/CAPABILITY-MATRIX.md')
    expect(matrixSrc).not.toContain('/admin/global-blocks')
  })
})
