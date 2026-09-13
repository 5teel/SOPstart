/**
 * Phase 41 / Plan 41-07 — SUR-03/SUR-04/SUR-06 `/admin/sops` reference sweep.
 * Flipped live from the 41-01 Wave-0 stub.
 *
 * Pattern: tests/phase30/dead-weight.spec.ts — pair a deletion/rewrite with
 * a src/-wide reference sweep, per CLAUDE.md 2026-08-04 ("a deletion guard
 * must assert the absence of REFERENCES, not just the absence of the
 * file"). Every regex here is anchored so `/admin/sops/new`,
 * `/admin/sops/builder/`, `/admin/sops/pipeline/`, `/admin/sops/[sopId]/...`
 * sub-routes are NOT false positives — only the exact list-route reference
 * (`/admin/sops` followed by end-of-string, a quote, a backtick, `?`, etc.)
 * counts.
 *
 * Comment lines are stripped before every assertion below (CLAUDE.md
 * self-invalidating-header class) so a file's own explanatory prose about
 * the old route/label cannot satisfy or break either sweep.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

// Exact list-route reference: `/admin/sops` NOT followed by another path
// segment character (`/`, letter, digit, `-`, `[`). A quote, backtick, `?`,
// comma, space, or `)` after it counts as a hit (end of the route literal).
const EXACT_ADMIN_SOPS_REF = /\/admin\/sops(?![\w/[-])/g

// The only two files allowed to still reference the list route: the redirect
// shim itself (never references its own destination as a literal, so this
// is expected to contribute 0 hits) and journeys.ts's shim-documenting step
// (contributes the legacy-URL id + label + route + detail matches).
const PERMITTED_FILES = new Set([
  path.join('src', 'app', '(protected)', 'admin', 'sops', 'page.tsx'),
  path.join('src', 'lib', 'journeys', 'journeys.ts'),
])

// Pinned so a NEW /admin/sops reference added to a permitted file later must
// be a deliberate, reviewed decision, not silent drift. Counted per LINE
// (journeys.ts:213 the activity-redirect detail string, journeys.ts:569 the
// shim-documenting step — which itself carries two occurrences on one line,
// counted once here since hits are tallied per matching line).
const EXPECTED_PERMITTED_COUNT = 2

// `label:`/`route:`/`href:` key whose string value contains the word
// "Library" — a nav/route label naming a destination. Free prose in
// `summary`/`background`/`tryIt`/`can`/`cannot`/`who`/`gates` fields is not
// matched by this pattern (SUR-06 only forbids Library as a destination
// name, not as a description of an unrelated feature like "block library").
const LIBRARY_LABEL_RE = /\b(?:label|route|href)\s*:\s*(['"`])(?:(?!\1).)*Library(?:(?!\1).)*\1/g

const SUR06_CHECKED_FILES = [
  path.join('src', 'components', 'layout', 'TopHeader.tsx'),
  path.join('src', 'lib', 'journeys', 'roles.ts'),
  path.join('src', 'lib', 'uat', 'tests.ts'),
]

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8').replace(/\r\n/g, '\n')
}

// Strips full-line comments (//, /*, */, and JSDoc * continuation lines) so
// a file's own explanatory prose cannot satisfy or break a count-based
// assertion. Equivalent to `grep -v '^\s*[*/]'`.
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

/** Every exact /admin/sops list-route hit in a file, as "line N  <text>". */
function findAdminSopsHits(absPath: string): string[] {
  const stripped = stripComments(read(path.relative(ROOT, absPath)))
  const hits: string[] = []
  stripped.split('\n').forEach((line, i) => {
    EXACT_ADMIN_SOPS_REF.lastIndex = 0
    if (EXACT_ADMIN_SOPS_REF.test(line)) {
      hits.push(`line ${i + 1}  ${line.trim()}`)
    }
  })
  return hits
}

test.describe('SUR-03/SUR-04/SUR-06 reference sweep — /admin/sops list route is fully repointed', () => {
  test('no src/ file outside the shim + journeys.ts references /admin/sops as a list route', () => {
    const files = walkTsFiles(path.join(ROOT, 'src'))
    const offenders: string[] = []
    for (const file of files) {
      const rel = path.relative(ROOT, file)
      if (PERMITTED_FILES.has(rel)) continue
      const hits = findAdminSopsHits(file)
      for (const hit of hits) offenders.push(`${rel}:${hit}`)
    }
    expect(offenders, `Unexpected /admin/sops list-route references:\n${offenders.join('\n')}`).toEqual([])
  })

  test('the permitted files carry exactly the pinned number of /admin/sops references', () => {
    let total = 0
    const breakdown: string[] = []
    for (const rel of PERMITTED_FILES) {
      const hits = findAdminSopsHits(path.join(ROOT, rel))
      total += hits.length
      if (hits.length > 0) breakdown.push(`${rel}: ${hits.length} (${hits.join(' | ')})`)
    }
    expect(total, `Permitted-reference breakdown:\n${breakdown.join('\n')}`).toBe(EXPECTED_PERMITTED_COUNT)
  })

  test('the four live /admin/sops sub-routes survived the sweep', () => {
    const uploadDropzone = read(path.join('src', 'components', 'admin', 'UploadDropzone.tsx'))
    expect(uploadDropzone).toContain('/admin/sops/builder/')

    const sopDetail = read(path.join('src', 'app', '(protected)', 'sops', '[sopId]', 'page.tsx'))
    expect(sopDetail).toContain('/admin/sops/builder/')

    const sopMillerBrowser = read(path.join('src', 'components', 'admin', 'SopMillerBrowser.tsx'))
    expect(sopMillerBrowser).toContain('/admin/sops/builder/')

    const topHeader = read(path.join('src', 'components', 'layout', 'TopHeader.tsx'))
    expect(topHeader).toContain('/admin/sops/new')
  })

  test('SUR-06: "Library" names no destination label in TopHeader, roles.ts or uat/tests.ts', () => {
    const offenders: string[] = []
    for (const rel of SUR06_CHECKED_FILES) {
      const stripped = stripComments(read(rel))
      LIBRARY_LABEL_RE.lastIndex = 0
      const matches = stripped.match(LIBRARY_LABEL_RE) ?? []
      for (const m of matches) offenders.push(`${rel}: ${m}`)
    }
    expect(offenders, `"Library" found naming a destination:\n${offenders.join('\n')}`).toEqual([])
  })
})
