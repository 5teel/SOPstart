/**
 * Phase 63 -- the SOPstart wordmark. Requirements BRAND-01, GATE-01. Owner: 63-04.
 * Registration: playwright.config.ts `phase63`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const walk = (dir: string): string[] =>
  fs.readdirSync(path.join(process.cwd(), dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`
    return e.isDirectory() ? walk(rel) : /\.(tsx?|css)$/.test(e.name) ? [rel] : []
  })

test.describe('wordmark', () => {
  test('Wordmark.tsx carries no literal colour or length -- it reads the --wm-* tokens through classes', () => {
    const src = read('src/components/brand/Wordmark.tsx')
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(src).not.toMatch(/\d+px/)
    expect(src).not.toContain('rgb(')
    expect(src).toContain('aria-label="SOPstart"')
    expect(src).toContain('data-wm-target')
  })

  test('the .wm classes exist and sit on the tape / weight tokens', () => {
    const css = read('src/styles/blueprint-theme.css')
    for (const cls of ['.wm-sop', '.wm-start', '.wm-on-ink', '.wm-notape', '.wm-bar', '.wm-hero']) expect(css, cls).toContain(cls)
    for (const tok of ['var(--wm-tape)', 'var(--wm-tape-on-ink)', 'var(--wm-weight-sop)', 'var(--wm-weight-start)']) expect(css, tok).toContain(tok)
    expect(css).toMatch(/--wm-font:\s*var\(--font-saira, 'Saira Semi Condensed'\)/)
  })

  test('Saira Semi Condensed 600 and 800 load through next/font on <html>', () => {
    const layout = read('src/app/layout.tsx')
    expect(layout).toContain("from 'next/font/google'")
    expect(layout).toContain('Saira_Semi_Condensed')
    expect(layout).toMatch(/weight: \['600', '800'\]/)
    expect(layout).toContain("variable: '--font-saira'")
    expect(layout).toContain('className={saira.variable}')
  })

  test('brand yellow lives only in the wordmark (outside the annotation-tool allowlist)', () => {
    const allow = /src\/components\/(brand|focus\/admin\/annotate)\//
    const hits = [...walk('src/components'), ...walk('src/app')]
      .filter((f) => !allow.test(f) && !f.endsWith('.css'))
      .filter((f) => /brand-yellow|wm-accent/.test(read(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')))
    expect(hits).toEqual([])
  })
})
