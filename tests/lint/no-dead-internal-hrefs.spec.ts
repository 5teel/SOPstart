/**
 * Repo-wide dead internal-link guard (Phase 43 D-07 / DED-01).
 *
 * Internal links are not type-checked, so the build stays green with dead
 * URLs (CLAUDE.md 2026-06-08). This guard derives the live route set the
 * same way `src/lib/journeys/routes.ts` walks `src/app` for `/pathways`,
 * folds in `next.config.ts`'s `redirects()` sources as valid targets, and
 * fails on any internal href / router.push / router.replace / redirect /
 * location target in comment-stripped `src/` that resolves to none of them.
 *
 * Describes the patterns it scans in WORDS below, never as a quoted dead
 * URL literal (CLAUDE.md 2026-09-28: a comment quoting a forbidden literal
 * trips the very guard it documents).
 *
 * Scans for string-literal targets immediately following any of: an href
 * attribute (bare or brace-wrapped), a `route:` object field, a
 * `router.push`/`router.replace` call, a `redirect`/`permanentRedirect`
 * call, or a `location.href` assignment / `location.assign` / and
 * `location.replace` call.
 *
 * A target containing a reserved word as its own path segment (the create/
 * edit-form collision class — a segment textually matches a `[param]`
 * dynamic route shape at the ROUTING layer but the destination page treats
 * that literal specially and can still runtime-404, e.g. a `/new` form route
 * resolving into a sibling `[id]` route) is a DIFFERENT bug class this mechanical sweep
 * cannot catch by design — see the fixme test below, which activates once
 * 43-02 gives that reserved segment its own static route.
 *
 * Registration: playwright.config.ts `phase15-stubs` project testMatch
 * alternation. Verify: `npx playwright test --list --project=phase15-stubs
 * | grep no-dead-internal-hrefs`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')

function read(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf-8').replace(/\r\n/g, '\n')
}

// Strips full-line comments (//, /*, */, and JSDoc * continuation lines) so
// a file's own explanatory prose cannot satisfy or break this guard
// (mirrors tests/phase54/deletion-sweep.spec.ts, tests/phase41/reference-sweep.spec.ts).
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

// ---------------------------------------------------------------------------
// Route shapes
// ---------------------------------------------------------------------------

type Shape = string[]

function isDynamicSeg(seg: string): boolean {
  return seg.startsWith('[') && seg.endsWith(']')
}

/** Walk src/app: every dir directly holding page.tsx or route.ts contributes
 * its segment list. Route-group dirs `(x)` add no segment; `_`/`@` dirs are
 * skipped. src/app itself (segs=[]) counts if it directly holds a page. */
function buildPageShapes(): Shape[] {
  const shapes: Shape[] = []
  const appDir = path.join(ROOT, 'src', 'app')

  function walk(dir: string, segs: string[]) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const hasPage = entries.some(
      (e) => e.isFile() && (e.name === 'page.tsx' || e.name === 'route.ts')
    )
    if (hasPage) shapes.push([...segs])

    for (const e of entries) {
      if (!e.isDirectory()) continue
      const name = e.name
      if (name.startsWith('_') || name.startsWith('@')) continue
      const isGroup = name.startsWith('(') && name.endsWith(')')
      const nextSegs = isGroup ? segs : [...segs, name]
      walk(path.join(dir, name), nextSegs)
    }
  }

  walk(appDir, [])
  return shapes
}

/** next.config.ts redirects() `source:` strings, `:name` -> `[name]`. */
function buildRedirectShapes(): Shape[] {
  const src = read('next.config.ts')
  const shapes: Shape[] = []
  const re = /source:\s*(['"`])((?:(?!\1)[^\n])*)\1/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src))) {
    const segs = m[2]
      .split('/')
      .filter(Boolean)
      .map((seg) => (seg.startsWith(':') ? `[${seg.slice(1)}]` : seg))
    shapes.push(segs)
  }
  return shapes
}

const PAGE_SHAPES = buildPageShapes()
const REDIRECT_SHAPES = buildRedirectShapes()
const ALL_SHAPES = [...PAGE_SHAPES, ...REDIRECT_SHAPES]

// ---------------------------------------------------------------------------
// Target extraction
// ---------------------------------------------------------------------------

// Prefixes that precede a string-literal internal target we care about.
const TARGET_RE =
  /(?:href=\{|href=|href:|route:|router\.push\(|router\.replace\(|redirect\(|permanentRedirect\(|location\.href\s*=|location\.assign\(|location\.replace\()\s*(['"`])((?:(?!\1)[^\n])*)\1/g

interface Target {
  file: string
  line: number
  raw: string
  segs: string[]
}

function normalizeTarget(raw: string): string[] {
  const holesReplaced = raw.replace(/\$\{[^}]*\}/g, '*')
  const cut = holesReplaced.split(/[?#]/)[0]
  return cut.split('/').filter(Boolean)
}

function extractTargets(relPath: string): Target[] {
  const stripped = stripComments(read(relPath))
  const out: Target[] = []
  stripped.split('\n').forEach((line, i) => {
    TARGET_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = TARGET_RE.exec(line))) {
      const raw = m[2]
      if (raw.startsWith('/') && !raw.startsWith('//')) {
        out.push({ file: relPath, line: i + 1, raw, segs: normalizeTarget(raw) })
      }
    }
  })
  return out
}

function collectAllSrcTargets(): Target[] {
  const out: Target[] = []
  for (const file of walkTsFiles(path.join(ROOT, 'src'))) {
    out.push(...extractTargets(path.relative(ROOT, file)))
  }
  return out
}

// ---------------------------------------------------------------------------
// Match rule
// ---------------------------------------------------------------------------

/** `*` matches anything; a `[x]` target segment matches ONLY a dynamic shape
 * segment; any other target segment matches a dynamic shape segment or an
 * identical static one. */
function resolves(segs: string[], shapes: Shape[]): boolean {
  return shapes.some((shape) => {
    if (shape.length !== segs.length) return false
    return shape.every((shapeSeg, i) => {
      const t = segs[i]
      if (t === '*') return true
      if (isDynamicSeg(t)) return isDynamicSeg(shapeSeg)
      return isDynamicSeg(shapeSeg) || shapeSeg === t
    })
  })
}

// The reserved-segment rule (fixme, activates 43-02): the reserved segment
// itself must land on a STATIC shape segment somewhere, not merely inside a
// shape that happens to match by length/dynamic-fallback.
const RESERVED = new Set(['new', 'create', 'add', 'edit'])
function resolvesWithReservedStatic(segs: string[], shapes: Shape[]): boolean {
  return shapes.some((shape) => {
    if (shape.length !== segs.length) return false
    return shape.every((shapeSeg, i) => {
      const t = segs[i]
      if (RESERVED.has(t)) return !isDynamicSeg(shapeSeg) && shapeSeg === t
      if (t === '*') return true
      if (isDynamicSeg(t)) return isDynamicSeg(shapeSeg)
      return isDynamicSeg(shapeSeg) || shapeSeg === t
    })
  })
}

test.describe('no dead internal hrefs — route truth (D-07)', () => {
  test('every internal link, route and redirect target in src/ resolves to a page, route handler or next.config.ts redirect', () => {
    const offenders = collectAllSrcTargets()
      .filter((t) => !resolves(t.segs, ALL_SHAPES))
      .map((t) => `${t.file}:${t.line}  ${t.raw}`)
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  // Generic guard: a create/edit-style segment must never be served only by a
  // sibling dynamic route (no such target exists today, so it passes vacuously
  // until one appears).
  test(
    'a reserved segment (new, create, add, edit) resolves to a static route segment, never only through a dynamic one',
    () => {
      const offenders = collectAllSrcTargets()
        .filter((t) => t.segs.some((s) => RESERVED.has(s)))
        .filter((t) => !resolvesWithReservedStatic(t.segs, ALL_SHAPES))
        .map((t) => `${t.file}:${t.line}  ${t.raw}`)
      expect(offenders, offenders.join('\n')).toEqual([])
    }
  )

  test('the route docs name only routes that exist (D-06)', () => {
    const offenders: string[] = []
    for (const docPath of ['.planning/codebase/ARCHITECTURE.md', '.planning/codebase/STRUCTURE.md']) {
      const src = read(docPath)
      const re = /`(\/[a-z~[][^`]*)`/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src))) {
        const token = m[1].split(/[?#]/)[0]
        const segs = token.split('/').filter(Boolean)
        if (segs.length === 0) continue
        if (segs[0].startsWith('gsd-')) continue
        if (segs[segs.length - 1].includes('.')) continue
        if (!resolves(segs, PAGE_SHAPES)) offenders.push(`${docPath}: ${token}`)
      }
    }
    expect(offenders, offenders.join('\n')).toEqual([])
  })

  test('the sweep is not vacuous', () => {
    const allTargets = collectAllSrcTargets()
    // Floors guard against a broken walker, not a route count; recalibrated for the Phase 55 cut.
    expect(allTargets.length).toBeGreaterThanOrEqual(150)
    expect(PAGE_SHAPES.length).toBeGreaterThanOrEqual(40)
    expect(PAGE_SHAPES.some((s) => s.join('/') === 'sops/[sopId]')).toBe(true)
    expect(PAGE_SHAPES.some((s) => s.join('/') === 'api/sops/[sopId]/publish')).toBe(true)

    let docRouteCount = 0
    for (const docPath of ['.planning/codebase/ARCHITECTURE.md', '.planning/codebase/STRUCTURE.md']) {
      const src = read(docPath)
      const re = /`(\/[a-z~[][^`]*)`/g
      docRouteCount += [...src.matchAll(re)].length
    }
    expect(docRouteCount).toBeGreaterThanOrEqual(8)
  })
})
