/**
 * Design-token guard (2026-09-28).
 *
 * `src/styles/blueprint-theme.css` is the ONE place colours are defined. Every
 * component reaches them as a Tailwind utility (`text-accent-escalate`,
 * `bg-accent-signoff/10`, `border-ink-200`) or as `var(--token)`. Two things
 * are banned in src:
 *
 *   1. Raw Tailwind palette classes (`text-red-400`, `bg-amber-50`, …). 435 of
 *      them existed before the sweep, in 40+ shade/opacity combinations, most
 *      of them dark-theme leftovers that rendered low-contrast on paper.
 *   2. Bare hex colours in component/app code, except where a literal is the
 *      correct thing: data palettes (department colours stored in the DB),
 *      canvas / SVG-to-PNG / three.js / QR rendering. `var(--x, #hex)`
 *      fallbacks are fine — they self-heal (CLAUDE.md 2026-07-14).
 *
 * Registered in playwright.config.ts under the `phase15-stubs` project regex
 * (CLAUDE.md 2026-05-25: an unregistered lint spec never runs).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const SRC = path.join(ROOT, 'src')

const HEX_ALLOW = [
  'src/components/admin/departments/',
  'src/components/admin/source-viewer/',
  'src/components/sop/flow/FlowGraphCanvas.tsx',
  'src/components/sop/blocks/ModelBlock.tsx',
  'src/components/admin/org-model/',
  'src/components/admin/builder-v2/visual/annotation-tools.ts', // Konva stroke colours baked into PNGs
  'src/app/manifest.ts', // PWA manifest theme/background colours must be literal
]

const PALETTE = /(?<![\w\-\[])(?:[a-z0-9-]+:)*(?:text|bg|border|ring|outline|divide|from|to|via|fill|stroke|placeholder|shadow)-(?:red|rose|green|emerald|lime|amber|pink|yellow|blue|sky|indigo|orange|purple|violet|cyan|teal|gray|zinc|slate|neutral|stone)-\d{2,3}(?:\/(?:\[[0-9.]+\]|[0-9]{1,3}))?(?![\w\-])/g
const HEX6 = /#[0-9a-fA-F]{6}\b/g
const FALLBACK = /var\(--[a-z0-9-]+,\s*#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\)/g

function walk(dir: string, out: string[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p, out) }
    else if (/\.tsx?$/.test(e.name) && !/\.(test|d)\.tsx?$/.test(e.name)) out.push(p)
  }
}
const rel = (p: string) => path.relative(ROOT, p).replace(/\\/g, '/')

test.describe('design tokens — one source of truth', () => {
  test('no raw Tailwind palette colour classes anywhere in src', () => {
    const files: string[] = []
    walk(SRC, files)
    const hits: string[] = []
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf-8')
      for (const m of src.matchAll(PALETTE)) hits.push(`${rel(f)}: ${m[0]}`)
    }
    expect(hits, hits.slice(0, 20).join('\n')).toEqual([])
  })

  test('no bare hex colours in component/app code outside the canvas/data allowlist', () => {
    const files: string[] = []
    walk(path.join(SRC, 'components'), files)
    walk(path.join(SRC, 'app'), files)
    const hits: string[] = []
    for (const f of files) {
      const r = rel(f)
      if (HEX_ALLOW.some((a) => r.startsWith(a))) continue
      const src = fs.readFileSync(f, 'utf-8').replace(FALLBACK, '')
      for (const m of src.matchAll(HEX6)) hits.push(`${r}: ${m[0]}`)
    }
    expect(hits, hits.slice(0, 20).join('\n')).toEqual([])
  })

  test('the theme file reaches Tailwind through the globals.css entry, never as a plain stylesheet import', () => {
    // Tailwind only reads `@theme` from CSS it processes. Imported from
    // layout.tsx as a separate stylesheet, the block was plain CSS and every
    // token utility (text-accent-escalate …) silently generated NOTHING —
    // shipped to production for ~40 minutes on 2026-09-28.
    const globals = fs.readFileSync(path.join(SRC, 'app', 'globals.css'), 'utf-8')
    expect(globals).toMatch(/@import "tailwindcss";[\s\S]*@import "\.\.\/styles\/blueprint-theme\.css";/)
    const layout = fs.readFileSync(path.join(SRC, 'app', 'layout.tsx'), 'utf-8')
    expect(layout).not.toContain('blueprint-theme.css')
  })

  // ── Spacing / radius / type (2026-09-28, second sweep) ────────────────
  const PX_UTIL = /(?<![\w\-\[])(?:[a-z0-9-]+:)*(?:(?:min-|max-)?(?:w|h|size)|p[xytblr]?|m[xytblr]?|gap(?:-[xy])?|space-[xy]|text|rounded(?:-[a-z]+)?|tracking)-\[[0-9.]+px\](?![\w\-])/g
  const BAD_RADIUS = /(?<![\w\-\[])(?:[a-z0-9-]+:)*rounded-(?:xs|sm|md|xl|3xl|4xl)(?:-(?:t|b|l|r|tl|tr|bl|br|s|e|ss|se|es|ee))?(?![\w\-])/g
  const TRACKING_ARB = /(?<![\w\-\[])(?:[a-z0-9-]+:)*tracking-\[[^\]]+\]/g
  const INLINE_TYPE = /(?:fontSize|letterSpacing):\s*(?:'[0-9.]+(?:px|em)?'|"[0-9.]+(?:px|em)?"|[0-9.]+)(?=[,\s}])/g
  const INLINE_RADIUS = /borderRadius:\s*(?:'[0-9.]+px'|"[0-9.]+px"|[1-9][0-9.]*)(?=[,\s}])/g
  const INLINE_ALLOW = ['src/components/admin/source-viewer/', 'src/components/sop/flow/FlowGraphCanvas.tsx', 'src/components/sop/blocks/ModelBlock.tsx', 'src/components/admin/builder-v2/visual/annotation-tools.ts' /* Konva text, rasterised */]

  test('no pixel-valued spacing, type, radius or tracking utilities — use the scale or a named token', () => {
    const files: string[] = []
    walk(SRC, files)
    const hits: string[] = []
    for (const f of files) {
      const src = fs.readFileSync(f, 'utf-8')
      for (const m of src.matchAll(PX_UTIL)) hits.push(`${rel(f)}: ${m[0]}`)
      for (const m of src.matchAll(TRACKING_ARB)) hits.push(`${rel(f)}: ${m[0]}`)
    }
    expect(hits, hits.slice(0, 20).join('\n')).toEqual([])
  })

  test('radius vocabulary is rounded / rounded-lg / rounded-2xl / rounded-full', () => {
    const files: string[] = []
    walk(SRC, files)
    const hits: string[] = []
    for (const f of files) for (const m of fs.readFileSync(f, 'utf-8').matchAll(BAD_RADIUS)) hits.push(`${rel(f)}: ${m[0]}`)
    expect(hits, hits.slice(0, 20).join('\n')).toEqual([])
  })

  test('inline styles use the type and radius tokens, not pixel literals', () => {
    const files: string[] = []
    walk(path.join(SRC, 'components'), files)
    walk(path.join(SRC, 'app'), files)
    const hits: string[] = []
    for (const f of files) {
      const r = rel(f)
      if (INLINE_ALLOW.some((a) => r.startsWith(a))) continue
      const src = fs.readFileSync(f, 'utf-8')
      for (const m of src.matchAll(INLINE_TYPE)) hits.push(`${r}: ${m[0]}`)
      for (const m of src.matchAll(INLINE_RADIUS)) hits.push(`${r}: ${m[0]}`)
    }
    expect(hits, hits.slice(0, 20).join('\n')).toEqual([])
  })

  test('the type and tap-target tokens are declared', () => {
    const theme = fs.readFileSync(path.join(SRC, 'styles', 'blueprint-theme.css'), 'utf-8')
    for (const t of ['--text-micro', '--text-meta', '--text-ui', '--text-reading', '--spacing-tap', '--spacing-tap-glove', '--spacing-tap-row']) {
      expect(theme, t).toMatch(new RegExp(`\\n\\s*${t}:\\s*[0-9]+px`))
    }
  })

  test('every token utility a component may use is declared in the @theme block', () => {
    const theme = fs.readFileSync(path.join(SRC, 'styles', 'blueprint-theme.css'), 'utf-8')
    for (const t of ['accent-step', 'accent-ok', 'accent-hazard', 'accent-mcu', 'ai', 'brand-yellow', 'steel-900', 'steel-700', 'ink-200', 'ink-400', 'ink-600', 'paper-1']) {
      expect(theme, t).toMatch(new RegExp(`--color-${t}:\\s*var\\(--${t}\\)`))
      expect(theme, t).toMatch(new RegExp(`\\n\\s*--${t}:\\s`))
    }
  })
})
