/**
 * Phase 63 -- the start merge wiring (FUSE-01, FUSE-02, GATE-01), re-cut by ADR-0012: the merge plays
 * centred in the SOP's pane on the home, at the moment a run opens, and settles into the run bar.
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

test.describe('fuse wiring (ADR-0012)', () => {
  test('the engine reads every duration, the easing, the short scale and the hero size from tokens, with no literals', () => {
    const e = code('src/lib/brand/fuse-engine.ts')
    for (const n of ['fade', 'gather', 'tape', 'hold', 'rise']) expect(e, n).toContain(`--dur-fuse-${n}`)
    for (const t of ['--ease-fuse', '--fuse-short-scale', '--fuse-hero-max']) expect(e, t).toContain(t)
    const css = src('src/styles/blueprint-theme.css')
    for (const t of ['--dur-fuse-gather:', '--dur-fuse-hold:', '--fuse-hero-max:']) expect(css, t).toContain(t)
    expect(e).not.toMatch(/duration:\s*\d/)
    expect(e).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(e).not.toContain('rgb(')
    expect(e).toContain('[data-wm-target]')
    expect(e).toContain('pointer-events:none')
  })

  test('the merge plays in the pane, centred, and any press or key skips it', () => {
    const e = code('src/lib/brand/fuse-engine.ts')
    expect(e).toContain('pane.left + pane.width / 2')
    expect(e).toContain('pane.top + pane.height / 2')
    expect(e).toContain("addEventListener('pointerdown', skip, true)")
    expect(e).toContain("addEventListener('keydown', skip, true)")
    expect(e).toContain('a.finish()')
    // The caption is the full merge's only words (ADR-0012 stage 4).
    expect(e).toContain("CAPTION = 'Every tick is saved to your record'")
    expect(e).toContain('if (!short) layer.append(caption)')
  })

  test('motionMode checks reduced motion first and the slow flag is session-scoped', () => {
    const f = code('src/lib/brand/fuse.ts')
    expect(f).toContain('prefers-reduced-motion: reduce')
    expect(f.indexOf('matchMedia(')).toBeLessThan(f.indexOf('getItem(DAY_KEY)'))
    expect(f).toContain('sessionStorage')
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

  test('start opens the run under the merge: the server start runs at the press and the run bar shows only once it answers', () => {
    const r = code('src/components/home/ReadView.tsx')
    expect(r).toContain('playFuse(')
    expect(r).toMatch(/if \(await \(over \? run\.startOver\(\) : run\.begin\(\)\)\) run\.setRunning\(true\)/)
    // Full on the first start of the day only; a Resume or Begin again is always short.
    expect(r).toContain("motion === 'full' && resumeAt === null && !over ? 'full' : 'short'")
    expect(r).toContain("closest('[data-testid=\"home-reader\"]')")
    // The run bar carries the settle target, and the chip leaves while running.
    expect(r).toContain('<Wordmark size="bar" target />')
    expect(r).toContain('{!running && <Wordmark variant="chip" size="merge" data-fuse="sop" />}')
    // The font check reads the first family only: next/font's unloaded fallback face made check() false on the deploy.
    expect(r).toContain("split(',')[0]")
    // playFuse calls onCovered exactly once, even if the engine fails or stalls.
    const f = code('src/lib/brand/fuse.ts')
    expect(f).toContain('once ??= onCovered()')
    expect(f).toContain('setTimeout(cover, COVER_MAX_MS)')
  })

  test('the SOP page no longer starts anything: no go or fresh flag survives', () => {
    for (const p of ['src/app/(protected)/sops/[sopId]/page.tsx', 'src/lib/sop/focus-path.ts', 'src/components/focus/FocusWalker.tsx']) {
      const c = code(p)
      expect(c, p).not.toMatch(/\bautostart\b|askStartOver|go=1|fresh=1/)
    }
  })

  test('the view speaks the new words', () => {
    const r = code('src/components/home/ReadView.tsx')
    expect(r).toContain('or begin from step 1')
    expect(r).toContain('Picks up at step')
    expect(r).toContain('Keep going')
    expect(r).toContain('aria-label="start"')
    expect(r).toContain('Send for sign-off')
    expect(r).not.toMatch(/Resume where you left off|Keep walking|Start walking/)
  })
})
