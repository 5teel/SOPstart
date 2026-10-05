/**
 * Phase 59 -- wide shell pane. Requirement SHL-06; decisions D-02, A-04, A-12.
 * Owner: 59-03 (ShellFrame wide class + role tab resolution + Esc guard). Registration: playwright.config.ts `phase59`.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const FRAME = read('src/components/shell/ShellFrame.tsx')

test.describe('shell wide', () => {
  test('ShellFrame keeps the literal lg:w-100 detail width', () => {
    expect(FRAME).toContain('lg:w-100')
  })

  test('the wide variant adds lg:w-[58%] lg:min-w-140 only when the place is wide', () => {
    expect(FRAME).toContain('lg:w-[58%] lg:min-w-140')
    expect(FRAME).toMatch(/wide \? 'lg:w-\[58%\] lg:min-w-140' : 'lg:w-100'/)
    expect(FRAME).toContain('const wide = isWidePlace(')
    expect(FRAME).toContain('data-wide={wide}')
  })

  test('ShellFrame has exactly one setPlace( writer and one replaceState', () => {
    expect((FRAME.match(/setPlace\(/g) ?? []).length).toBe(1)
    expect((FRAME.match(/replaceState/g) ?? []).length).toBe(1)
  })

  test('the Escape handler returns early on defaultPrevented and on an aria-modal element (A-12)', () => {
    const at = FRAME.indexOf("e.key !== 'Escape'")
    expect(at).toBeGreaterThan(-1)
    const handler = FRAME.slice(at, at + 300)
    expect(handler).toContain('defaultPrevented')
    expect(handler).toContain('aria-modal')
  })

  test('a tab the role may not see falls back to the inbox in render, never by redirect', () => {
    const resolve = FRAME.slice(FRAME.indexOf('function resolvePlace'), FRAME.indexOf('function isTypingTarget'))
    expect(resolve).toContain('officeTabs')
    expect(resolve).toContain("{ kind: 'room', id: 'office' }")
    expect(resolve).not.toMatch(/router|redirect|replaceState/)
    expect(FRAME).toContain('parsePlace(initialPlace, initialTab)')
  })

  test('PlantStage keeps its ResizeObserver refit so the map re-centres on a pane resize', () => {
    expect(read('src/components/sop/plant/PlantStage.tsx')).toContain('ResizeObserver')
  })

  test('the page reads tab and a UUID-gated sop and hands them to the shells', () => {
    const page = read('src/app/page.tsx')
    expect(page).toContain('initialTab=')
    expect(page).toMatch(/initialSop=\{typeof sop === 'string' && UUID\.test\(sop\)/)
    for (const f of ['WorkerShell', 'AdminShell']) {
      const src = read(`src/components/shell/${f}.tsx`)
      expect(src, f).toContain('initialTab={initialTab}')
      expect(src, f).toContain('officeTabs={tabsForRole(')
    }
    expect(read('src/components/shell/AdminShell.tsx')).toContain("from '@/lib/shell/query-keys'")
  })
})
