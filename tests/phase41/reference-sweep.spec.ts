/**
 * Phase 41 / Plan 41-01 — Wave-0 stub for the SUR-03/SUR-04 `/admin/sops`
 * reference sweep. Flipped live by 41-07.
 *
 * Pattern: tests/phase30/dead-weight.spec.ts — pair a deletion/rewrite with
 * a src/-wide reference sweep, per CLAUDE.md 2026-08-04 ("a deletion guard
 * must assert the absence of REFERENCES, not just the absence of the
 * file"). Every regex here is anchored so `/admin/sops/new`,
 * `/admin/sops/builder/`, `/admin/sops/pipeline/`, `/admin/sops/[sopId]/...`
 * sub-routes are NOT false positives — only the exact list-route reference
 * (`/admin/sops` followed by end-of-string, a quote, or `?`) counts.
 *
 * Enumerated known sites (41-RESEARCH.md Wave-0 gap):
 *   src/actions/ai-fields.ts, src/components/admin/ParseJobStatus.tsx,
 *   src/components/admin/UploadDropzone.tsx,
 *   src/components/admin/wiring/WiringPatchBay.tsx,
 *   src/lib/auth/role-home.ts, src/lib/journeys/roles.ts,
 *   src/lib/uat/tests.ts
 *
 * The shim itself (src/app/(protected)/admin/sops/page.tsx) and
 * src/lib/journeys/ (which documents the shim) are exempt.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

// Exact list-route reference: `/admin/sops` NOT followed by another path
// segment character (`/`, letter, digit, `-`, `[`). `?` or end-of-literal
// (quote, backtick, whitespace) after it counts as a hit.
const EXACT_ADMIN_SOPS_REF = /\/admin\/sops(?![\w/\[-])/g

const KNOWN_SITES = [
  'src/actions/ai-fields.ts',
  'src/components/admin/ParseJobStatus.tsx',
  'src/components/admin/UploadDropzone.tsx',
  'src/components/admin/wiring/WiringPatchBay.tsx',
  'src/lib/auth/role-home.ts',
  'src/lib/journeys/roles.ts',
  'src/lib/uat/tests.ts',
]

const EXEMPT = [
  path.join('src', 'app', '(protected)', 'admin', 'sops', 'page.tsx'),
  path.join('src', 'lib', 'journeys'), // prefix match — journeys.ts documents the shim
]

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8').replace(/\r\n/g, '\n')
}

test.describe('SUR-03/SUR-04 reference sweep — /admin/sops list route is fully repointed', () => {
  test.fixme(true, 'flipped live by 41-07')

  test('every known site no longer contains an exact /admin/sops list-route reference', () => {
    for (const site of KNOWN_SITES) {
      const src = read(site)
      const hits = src.match(EXACT_ADMIN_SOPS_REF) ?? []
      expect(hits, `${site} still references /admin/sops as a list route`).toEqual([])
    }
  })

  test('no other src/ file (outside the shim + journeys) references /admin/sops as a list route', () => {
    const offenders: string[] = []
    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        const rel = path.relative(ROOT, full)
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name === '.next') continue
          walk(full)
        } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
          if (EXEMPT.some((ex) => rel.startsWith(ex))) continue
          const src = fs.readFileSync(full, 'utf-8').replace(/\r\n/g, '\n')
          // Global regex .test() carries lastIndex state across calls in a
          // loop — reset it (or use a fresh instance) before each test.
          EXACT_ADMIN_SOPS_REF.lastIndex = 0
          if (EXACT_ADMIN_SOPS_REF.test(src)) offenders.push(rel)
        }
      }
    }
    walk(path.join(ROOT, 'src'))
    expect(offenders).toEqual([])
  })
})
