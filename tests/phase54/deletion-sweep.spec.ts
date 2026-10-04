/**
 * Phase 54 / Plan 54-05 -- ADM-04 / D-09 deletion sweep, final shape.
 *
 * Written in Wave 0 (54-01) as a fixme-gated scaffold so its shape is
 * pinned before the deletion wave runs; every test flips live in 54-05
 * (CLAUDE.md 2026-08-04: "a deletion guard must assert the absence of
 * REFERENCES, not just the absence of the file").
 *
 * Pattern: tests/phase41/reference-sweep.spec.ts (read/stripComments/
 * walkTsFiles helpers) + tests/phase30/dead-weight.spec.ts (pair a
 * deletion with a src/-wide reference sweep).
 *
 * This spec's own path is excluded from the tests/ scan below -- its
 * header comments and constant literals necessarily NAME the forbidden
 * symbols/params (CLAUDE.md 2026-09-28: a guard must not trip on its own
 * documentation of what it forbids).
 *
 * Registration: playwright.config.ts `phase54` project
 *   testDir: '.', testMatch: /tests\/phase54\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase54`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SELF = path.join('tests', 'phase54', 'deletion-sweep.spec.ts')

// D-09: the seven files the Miller/scope-column admin surface is replaced
// by the inbox + floor + plain library table.
const DELETED_FILES = [
  path.join('src', 'components', 'sop', 'AdminSopSurface.tsx'),
  path.join('src', 'components', 'sop', 'lenses', 'AdminAttentionLens.tsx'),
  path.join('src', 'components', 'sop', 'lenses', 'AdminStatusLens.tsx'),
  path.join('src', 'components', 'sop', 'MillerPrimitives.tsx'),
  path.join('src', 'components', 'sop', 'SopWorkerBrowser.tsx'),
  path.join('src', 'components', 'admin', 'SopMillerBrowser.tsx'),
  path.join('src', 'components', 'sop', 'sops-nav-types.ts'),
]

// The Access lens survives (scope: Access wiring stays where it is, D-09).
const SURVIVOR = path.join('src', 'components', 'sop', 'lenses', 'AdminAccessLens.tsx')

// Any surviving symbol/module reference to the deleted surface.
const DEAD_NAMES =
  /\b(AdminSopSurface|AdminAttentionLens|AdminStatusLens|MillerPrimitives|MillerColumnHeader|MillerGroupLabel|MillerItem|SopWorkerBrowser|SopMillerBrowser|AdminRenderProps|EMPTY_ADMIN)\b|sops-nav-types|worker-miller-(row|scope)/g

// The old `?view=attention` deep link and the admin-scope id string literals
// the deleted lenses switched on. Closing quote required on the scope-id arm
// so `admin-access-view` (the survivor) is never a false positive.
const DEAD_PARAMS = /view=attention|['"]admin-(all|draft|published|failed|attention|access)['"]/g

// The `status === 'attention'` legacy comparison. Only the middleware's
// server-side legacy redirect may still spell it (57-09: the table's
// deep-link resolver, the last other home, is deleted).
const ATTENTION_COMPARE = /===\s*'attention'/g
const PERMITTED_ATTENTION_FILES = [
  // 2026-09-29: the /sops?view=attention -> /governance redirect is server-side.
  path.join('src', 'lib', 'supabase', 'middleware.ts'),
]
const EXPECTED_ATTENTION_COUNT = 1

// 54-06 rewrote every eval that named the retired surface (governance.eval.ts,
// sop-surface.eval.ts, plant-home.eval.ts) -- the scan now covers tests/evals too.
const TESTS_EXCLUDED_DIRS = [] as string[]

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8').replace(/\r\n/g, '\n')
}

// Strips full-line comments (//, /*, */, and JSDoc * continuation lines) so
// a file's own explanatory prose cannot satisfy or break a count-based
// assertion (mirrors tests/phase41/reference-sweep.spec.ts).
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
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      walkTsFiles(full, out)
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      out.push(full)
    }
  }
  return out
}

function findMatches(relPath: string, re: RegExp): string[] {
  const stripped = stripComments(read(relPath))
  const hits: string[] = []
  stripped.split('\n').forEach((line, i) => {
    re.lastIndex = 0
    if (re.test(line)) hits.push(`${relPath}:${i + 1}  ${line.trim()}`)
  })
  return hits
}

test.describe('D-09 deletion sweep -- Miller/scope-column admin surface is fully removed (54-05)', () => {
  test('the seven deleted files are gone; the Access lens survives', () => {
    const missing = DELETED_FILES.filter((f) => !fs.existsSync(path.join(ROOT, f)))
    expect(missing, `Still present (should be deleted): ${missing.join(', ')}`).toEqual(DELETED_FILES)
    expect(fs.existsSync(path.join(ROOT, SURVIVOR)), `${SURVIVOR} must survive`).toBe(true)
  })

  test('no comment-stripped src/ file references a deleted symbol/module', () => {
    const offenders: string[] = []
    for (const file of walkTsFiles(path.join(ROOT, 'src'))) {
      offenders.push(...findMatches(path.relative(ROOT, file), DEAD_NAMES))
    }
    expect(offenders, `Dead-name references:\n${offenders.join('\n')}`).toEqual([])
  })

  test('no comment-stripped src/ file references the old attention deep link or scope-id params; the attention comparison survives only in its one permitted home (the proxy)', () => {
    const paramOffenders: string[] = []
    let attentionTotal = 0
    const attentionBreakdown: string[] = []
    for (const file of walkTsFiles(path.join(ROOT, 'src'))) {
      const rel = path.relative(ROOT, file)
      paramOffenders.push(...findMatches(rel, DEAD_PARAMS))
      const hits = findMatches(rel, ATTENTION_COMPARE)
      if (hits.length === 0) continue
      if (!PERMITTED_ATTENTION_FILES.includes(rel)) {
        paramOffenders.push(...hits.map((h) => `(unexpected attention-compare) ${h}`))
        continue
      }
      attentionTotal += hits.length
      attentionBreakdown.push(...hits)
    }
    expect(paramOffenders, `Dead-param / unexpected attention-compare references:\n${paramOffenders.join('\n')}`).toEqual([])
    expect(attentionTotal, `Attention-compare breakdown:\n${attentionBreakdown.join('\n')}`).toBe(EXPECTED_ATTENTION_COUNT)
  })

  test('no comment-stripped tests/**/*.ts(x) file outside the exclusions references a deleted symbol/module', () => {
    const offenders: string[] = []
    for (const file of walkTsFiles(path.join(ROOT, 'tests'))) {
      const rel = path.relative(ROOT, file)
      if (rel === SELF) continue
      if (TESTS_EXCLUDED_DIRS.some((d) => rel.startsWith(d + path.sep))) continue
      offenders.push(...findMatches(rel, DEAD_NAMES))
    }
    expect(offenders, `Dead-name references in tests/:\n${offenders.join('\n')}`).toEqual([])
  })

  test('scripts/check-bundle-size.ts forbidden markers repointed to surviving admin modules', () => {
    const src = read(path.join('scripts', 'check-bundle-size.ts'))
    expect(src).not.toContain('SopMillerBrowser')
    expect(src).not.toContain('Pick another scope on the left.')
    // 57-08: the list page left the gate, and the library-table marker group with it.
    expect(src).not.toContain('library table (Admin' + 'LibraryTable.tsx)')
    expect(src).toContain("route: '/page'")
  })
})
