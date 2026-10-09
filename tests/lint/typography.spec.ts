import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

// ADR-0006: Inter for reading, Saira Semi Condensed for labels and data.
const SRC = path.join(process.cwd(), 'src')
const read = (...p: string[]) => fs.readFileSync(path.join(SRC, ...p), 'utf-8')

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name)
    if (e.isDirectory()) walk(f, out)
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(f)
  }
  return out
}

test.describe('ADR-0006 typography', () => {
  test('no second mono face anywhere in src', () => {
    const hits = walk(SRC).filter((f) => /JetBrains/i.test(fs.readFileSync(f, 'utf-8')))
    expect(hits).toEqual([])
  })

  test('the app layout loads Inter and Saira Semi Condensed only', () => {
    const layout = read('app', 'layout.tsx')
    expect(layout).toMatch(/\bInter\(/)
    expect(layout).toMatch(/Saira_Semi_Condensed\(/)
    expect(layout).toMatch(/--font-inter/)
    expect(layout).toMatch(/--font-saira/)
    expect(layout).not.toMatch(/Mono/)
  })

  test('the label token resolves to Saira and reading to Inter', () => {
    const theme = read('styles', 'blueprint-theme.css')
    expect(theme).toMatch(/--font-label:\s*var\(--font-saira/)
    expect(theme).toMatch(/--font-reading:\s*var\(--font-inter/)
    expect(theme).toMatch(/font-family:\s*var\(--font-reading\)/)
  })

  test('Inter turns on tabular digits', () => {
    const theme = read('styles', 'blueprint-theme.css')
    expect(theme).toMatch(/font-feature-settings:\s*'tnum'/)
  })

  test('micro and meta type tokens meet the 12 px floor', () => {
    const theme = read('styles', 'blueprint-theme.css')
    for (const t of ['--text-micro', '--text-meta']) {
      const m = theme.match(new RegExp(`\\n\\s*${t}:\\s*([0-9]+)px`))
      expect(m, t).not.toBeNull()
      expect(Number(m![1]), t).toBeGreaterThanOrEqual(12)
    }
  })

  test('no font-size under 12 px in the theme file', () => {
    const theme = read('styles', 'blueprint-theme.css')
    const small = [...theme.matchAll(/font-size:\s*([0-9.]+)px/g)].filter((m) => Number(m[1]) < 12)
    expect(small.map((m) => m[0])).toEqual([])
  })
})
