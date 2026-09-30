/**
 * Phase 41 / Plan 41-01 — Wave-0 stub guarding that legacy source-contract
 * specs get REPOINTED off `src/app/(protected)/admin/sops/page.tsx` once
 * it becomes a redirect shim, rather than going stale-red silently
 * (CLAUDE.md 2026-07-13 — the exact failure class this guards against).
 * Flipped live by 41-08.
 *
 * Comment lines are stripped before matching (same idiom as
 * tests/phase41/reference-sweep.spec.ts, CLAUDE.md 2026-08-04
 * self-invalidating-header class) — every repointed spec in this phase
 * carries an explanatory comment naming the old admin/sops/page.tsx path in
 * prose, and that prose must not trip this guard. Only an actual CODE
 * reference (a `path.join(...)` call building the shim's path, or the
 * shim path used as a literal string in code) counts as a hit.
 *
 * Allowlist — empty as of 43-04 (Phase 43, D-01): admin/sops/page.tsx is
 * DELETED, not a live redirect shim any more (the legacy URL moved to a
 * static next.config.ts redirect), so no spec may legitimately read its
 * path as code. tests/phase43/route-truth.spec.ts proves the file's
 * absence directly, using segment arrays rather than a literal path
 * fragment (so it never trips this sweep either).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const TESTS_DIR = path.join(ROOT, 'tests')
const SELF = path.join('tests', 'phase41', 'spec-repoint-inventory.spec.ts')
const SHIM_PATH_FRAGMENT = "app', '(protected)', 'admin', 'sops', 'page.tsx"
const ALLOWLIST: string[] = []

// Strips full-line comments (//, /*, */, and JSDoc * continuation lines) so
// a file's own explanatory prose about where an assertion moved FROM cannot
// trip this guard — only real code referencing the shim's path counts.
function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => (/^\s*(\/\/|\/\*|\*\/|\*)/.test(line) ? '' : line))
    .join('\n')
}

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
  test('every spec file referencing admin/sops/page.tsx as CODE (not prose) is on the allowlist', () => {
    const files: string[] = []
    walk(TESTS_DIR, files)
    const offenders: string[] = []
    for (const file of files) {
      const rel = path.relative(ROOT, file)
      // The guard's own source necessarily spells out the fragment/literal
      // it searches for (as a const and in its own test name) — exclude it
      // from the walk rather than the allowlist, since it isn't "a spec
      // asserting the shim", it's the sweep itself.
      if (rel === SELF) continue
      if (ALLOWLIST.includes(rel)) continue
      const raw = fs.readFileSync(file, 'utf-8').replace(/\r\n/g, '\n')
      const stripped = stripComments(raw)
      const lines = stripped.split('\n')
      lines.forEach((line, i) => {
        if (line.includes(SHIM_PATH_FRAGMENT) || line.includes('admin/sops/page.tsx')) {
          offenders.push(`${rel}:${i + 1}`)
        }
      })
    }
    expect(offenders, `Offending files:line: ${offenders.join(', ')}`).toEqual([])
  })
})
