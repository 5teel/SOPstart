/**
 * Phase 63 (63-16, WORD-01) -- the Start-word guard. A person reads Read, start, Stop, Next,
 * Back a step and Done; the old verb for a run of a SOP never appears on a screen. Internal
 * identifiers (useWalk, FocusMode 'walk', sop_walks, walk-* test ids) are not text a person
 * reads and are not flagged: only JSX text and quoted strings that contain whitespace (or
 * are exactly the bare word) are.
 *
 * Comments are stripped before matching (CLAUDE.md 2026-09-28) so a comment may quote the
 * word. The scanner proves itself on inline fixtures, so a finder that finds nothing cannot
 * pass vacuously (CLAUDE.md 2026-05-25).
 *
 * Registered in playwright.config.ts under the phase15-stubs project regex.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const DIRS = ['src/components', 'src/app', 'src/actions', 'src/hooks', 'src/lib/journeys', 'src/lib/uat']

// Path prefixes (posix, from the repo root) the scan skips.
const ALLOW = [
  'src/actions/introspection.ts', // agent descriptions, never shown to a worker
  'src/components/focus/admin/AiCheckBanner.tsx', // "Show me" jumps to a finding in the editor: a different control
]

const WORD = /\b[Ww]alk(?:s|ed|ing|through|throughs)?\b/
const BARE = /^(?:Walk|Walking|Walk it|Walkthrough)$/
const SHOW_ME = /\bShow me\b/

export function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join('\n')
}

/** Returns each user-visible hit as `kind: text`. */
export function scan(raw: string): string[] {
  const src = stripComments(raw)
    .replace(/\$\{[^}\n]*\}/g, '') // template expressions are code, not text
    .replace(/console\.\w+\(\s*(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g, 'console.x(') // developer log lines never reach a screen
  const hits: string[] = []
  // (a) + (d) JSX text between > and <
  for (const m of src.matchAll(/(?<![=-])>([^<>{}]*)</g)) {
    const t = m[1].trim()
    if (t && (WORD.test(t) || SHOW_ME.test(t))) hits.push(`jsx: ${t}`)
  }
  // (b) + (c) + (d) quoted literals
  for (const m of src.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g)) {
    const t = m[2]
    if (BARE.test(t)) hits.push(`literal: ${t}`)
    else if (/\s/.test(t) && (WORD.test(t) || SHOW_ME.test(t))) hits.push(`string: ${t}`)
  }
  return hits
}

function files(dir: string, out: string[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) files(p, out)
    else if (/\.tsx?$/.test(e.name) && !/\.(test|d)\.tsx?$/.test(e.name)) out.push(p)
  }
}

test.describe('no walk words on a screen', () => {
  test('no component, route, action or hook shows a walk word or "Show me"', () => {
    const all: string[] = []
    for (const d of DIRS) files(path.join(ROOT, d), all)
    const scanned = all.filter((f) => !ALLOW.some((a) => path.relative(ROOT, f).replace(/\\/g, '/').startsWith(a)))
    expect(scanned.length).toBeGreaterThan(200)
    const hits: string[] = []
    for (const f of scanned) {
      for (const h of scan(fs.readFileSync(f, 'utf-8'))) hits.push(`${path.relative(ROOT, f).replace(/\\/g, '/')} -> ${h}`)
    }
    expect(hits, hits.join('\n')).toEqual([])
  })

  test('the scanner flags what a person reads and ignores internals and comments', () => {
    expect(scan('<button>Walk it</button>')).toHaveLength(1)
    expect(scan("return { error: 'Could not start the walk. Try again.' }")).toHaveLength(1)
    expect(scan("const label = 'Walk'")).toHaveLength(1)
    expect(scan('<a>\n  Show me\n</a>')).toHaveLength(1)
    expect(scan("<div data-testid=\"walk-step\" />")).toEqual([])
    expect(scan("const mode = 'walk'")).toEqual([])
    expect(scan("const x = () => a.walk < 3; const y = 'sop_walks'")).toEqual([])
    expect(scan("const k = `${t.id}:${walk?.id ?? 'none'}`; console.error('submit walk update error:', e)")).toEqual([])
    expect(scan("// 'Could not start the walk' was the old line\n/* Walk it */ const z = 1")).toEqual([])
  })

  test('the allowlist holds two reasoned entries and the guard is registered', () => {
    expect(ALLOW).toHaveLength(2)
    const cfg = fs.readFileSync(path.join(ROOT, 'playwright.config.ts'), 'utf-8')
    expect(cfg).toContain('no-walk-words')
  })
})
