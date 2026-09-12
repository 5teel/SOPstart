/**
 * Phase 41 / Plan 41-01 — Wave-0 stub guarding that legacy source-contract
 * specs get REPOINTED off `src/app/(protected)/admin/sops/page.tsx` once
 * it becomes a redirect shim, rather than going stale-red silently
 * (CLAUDE.md 2026-07-13 — the exact failure class this guards against).
 * Flipped live by 41-08.
 *
 * Allowlist: tests/phase41/nav-and-shim.spec.ts and
 * tests/phase30/admin-nav.spec.ts assert the shim itself and are
 * deliberately exempt.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const TESTS_DIR = path.join(ROOT, 'tests')
const SHIM_PATH_FRAGMENT = "app', '(protected)', 'admin', 'sops', 'page.tsx"
const ALLOWLIST = [
  path.join('tests', 'phase41', 'nav-and-shim.spec.ts'),
  path.join('tests', 'phase30', 'admin-nav.spec.ts'),
]

function walk(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(full, out)
    } else if (entry.isFile() && (entry.name.endsWith('.spec.ts') || entry.name.endsWith('.test.ts'))) {
      out.push(full)
    }
  }
}

test.describe('spec-repoint inventory — no stray reference to the pre-shim admin/sops page path', () => {
  test.fixme(true, 'flipped live by 41-08')

  test('every spec file referencing admin/sops/page.tsx is on the allowlist', () => {
    const files: string[] = []
    walk(TESTS_DIR, files)
    const offenders: string[] = []
    for (const file of files) {
      const rel = path.relative(ROOT, file)
      if (ALLOWLIST.includes(rel)) continue
      const text = fs.readFileSync(file, 'utf-8').replace(/\r\n/g, '\n')
      const lines = text.split('\n')
      lines.forEach((line, i) => {
        if (line.includes(SHIM_PATH_FRAGMENT) || line.includes('admin/sops/page.tsx')) {
          offenders.push(`${rel}:${i + 1}`)
        }
      })
    }
    expect(offenders, `Offending files:line: ${offenders.join(', ')}`).toEqual([])
  })
})
