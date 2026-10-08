/**
 * Phase 63 -- the Start merge wiring. Requirements FUSE-01, FUSE-02, GATE-01. Owner: 63-15.
 * Registration: playwright.config.ts `phase63`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const src = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n')
/** Comments stripped, so a comment describing a banned pattern cannot trip a guard (CLAUDE.md 2026-09-28). */
const code = (p: string) => src(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const walk = (dir: string): string[] =>
  fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`
    return e.isDirectory() ? walk(rel) : /\.(tsx?|css)$/.test(e.name) ? [rel] : []
  })

test.describe('fuse wiring', () => {
  test('the engine reads every duration, the easing and the short scale from tokens, with no literals', () => {
    const e = code('src/lib/brand/fuse-engine.ts')
    for (const n of ['fade', 'drop', 'shift', 'tape', 'hold', 'rise']) expect(e, n).toContain(`--dur-fuse-${n}`)
    expect(e).toContain('--ease-fuse')
    expect(e).toContain('--fuse-short-scale')
    expect(e).not.toMatch(/duration:\s*\d/)
    expect(e).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(e).not.toContain('rgb(')
    expect(e).toContain('[data-wm-target]')
    expect(e).toContain('pointer-events:none')
  })

  test('motionMode checks reduced motion first and the slow flag is session-scoped', () => {
    const f = code('src/lib/brand/fuse.ts')
    expect(f).toContain('prefers-reduced-motion: reduce')
    expect(f.indexOf('matchMedia(')).toBeLessThan(f.indexOf('getItem(DAY_KEY)'))
    expect(f).toContain('sessionStorage')
    expect(f).toContain('whenQueriesIdle')
  })

  test('nothing imports the engine statically; only fuse.ts reaches it, through import()', () => {
    const hits = walk('src').filter((f) => /from ['"](@\/lib\/brand\/fuse-engine|\.\/fuse-engine)['"]/.test(src(f)))
    expect(hits).toEqual([])
    expect(code('src/lib/brand/fuse.ts')).toContain("import('./fuse-engine')")
  })

  test('the root layout keeps an empty layer and imports nothing from the brand lib; the route fade yields to a running merge', () => {
    const layout = src('src/app/layout.tsx')
    expect(layout).toContain('id="fuse-layer"')
    expect(layout).not.toContain('@/lib/brand')
    expect(code('src/components/layout/RouteTransition.tsx')).toContain("dataset.fuse === 'on'")
  })
})
