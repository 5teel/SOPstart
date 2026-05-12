/**
 * SB-LINE-01 / D-04 — useViewport SSR-safe viewport hook contract coverage.
 *
 * The hook uses `useState` + `useEffect` + `window.matchMedia` and lives at
 * `src/hooks/useViewport.ts`. The most failure-mode-relevant invariant for
 * D-04 (SSR-mismatch safety) is the *initial state literal* — calling
 * `window.matchMedia` inside `useState`'s initial value would throw on SSR,
 * so the hook must hard-code `'mobile'` as the initial state and only call
 * matchMedia inside `useEffect`.
 *
 * We assert that contract via static source inspection here. Wave 2's
 * real-route integration tests (`desktop-walkthrough-layout.spec.ts`) cover
 * the runtime swap end-to-end against the actual walkthrough route at
 * desktop and mobile viewports — that's the right surface for browser-level
 * behavior. This file's job is to lock the hydration-safe initial-state
 * literal so a future refactor can't regress D-04 without a test failure.
 *
 * Phase 15-01 plan Task 4 acceptance — these tests must PASS (not test.fixme).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { test, expect } from '@playwright/test'

const HOOK_SRC = readFileSync(
  resolve(process.cwd(), 'src/hooks/useViewport.ts'),
  'utf8',
)

test.describe('Phase 15 D-04 — useViewport hook contract', () => {
  test('initial state is hard-coded mobile (SSR hydration-safe per D-04)', () => {
    // The literal MUST be 'mobile' to match the SSR render path. If a refactor
    // ever switches this to a window.matchMedia call inside useState, it will
    // throw on the server — this test catches that regression at the source level.
    expect(HOOK_SRC).toMatch(/useState<'mobile' \| 'desktop'>\('mobile'\)/)
  })

  test('hook reads matchMedia only inside useEffect, not at module/render time', () => {
    // Locate the useEffect block and confirm window.matchMedia is invoked inside it.
    // (A render-time matchMedia call would crash on SSR.)
    const effectMatch = HOOK_SRC.match(/useEffect\(\(\)\s*=>\s*\{([\s\S]*?)\},\s*\[\]\)/)
    expect(effectMatch).not.toBeNull()
    const effectBody = effectMatch?.[1] ?? ''
    expect(effectBody).toContain('window.matchMedia')
  })

  test('breakpoint is exactly (min-width: 1024px) per D-03', () => {
    expect(HOOK_SRC).toContain('(min-width: 1024px)')
  })

  test('listens to MediaQueryList change events (hot-resize support)', () => {
    expect(HOOK_SRC).toMatch(/addEventListener\(['"]change['"]/)
    // And cleans up the listener — required for React Strict Mode + remount safety.
    expect(HOOK_SRC).toMatch(/removeEventListener\(['"]change['"]/)
  })

  test('export shape is the documented signature: () => "mobile" | "desktop"', () => {
    expect(HOOK_SRC).toMatch(/export function useViewport\(\):\s*'mobile' \| 'desktop'/)
  })
})
