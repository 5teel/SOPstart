/**
 * SB-LINE-01 — Desktop walkthrough layout variant (Wave 2 live).
 *
 * Source-contract assertions confirming the DesktopWalkthrough + the
 * dynamic-import switcher meet the plan's truth list. Full end-to-end
 * Playwright with `setViewportSize` + `getComputedStyle` is deferred
 * to phase verification UAT (Task 5 blocking checkpoint) because the
 * chromium binary isn't installed in the executor environment (per
 * Plan 15-01 Rule-3 finding).
 *
 * The Wave-0 lint guard `tests/lint/no-static-desktop-import.spec.ts`
 * runs alongside this file and PROVES the runtime bundle isolation
 * contract via the import graph (the real source-of-truth for
 * SB-LINE-06).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const DESKTOP = path.join(ROOT, 'src', 'components', 'sop', 'walkthrough', 'DesktopWalkthrough.tsx')
const SWITCHER = path.join(ROOT, 'src', 'components', 'sop', 'walkthrough', 'WalkthroughSwitcher.tsx')
const MOBILE = path.join(ROOT, 'src', 'components', 'sop', 'walkthrough', 'MobileWalkthrough.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('SB-LINE-01 — Desktop walkthrough layout (Wave 2 contract)', () => {
  test('DesktopWalkthrough.tsx exists', () => {
    expect(fs.existsSync(DESKTOP)).toBe(true)
  })

  test('WalkthroughSwitcher.tsx exists', () => {
    expect(fs.existsSync(SWITCHER)).toBe(true)
  })

  test('DesktopWalkthrough body text uses Tailwind ≥24px class or 1.5rem inline (D-01)', () => {
    const src = read(DESKTOP)
    // text-2xl ≈ 24px; or explicit fontSize 1.5rem (24px)
    expect(src).toMatch(/text-2xl|fontSize:\s*['"]1\.5rem['"]/)
  })

  test('DesktopWalkthrough primary Next button is min-h-[60px] (D-19)', () => {
    const src = read(DESKTOP)
    expect(src).toContain('min-h-[60px]')
  })

  test('DesktopWalkthrough secondary text (warnings/cautions/tips/tools) uses ≥18px (text-lg)', () => {
    const src = read(DESKTOP)
    expect(src).toMatch(/text-lg/)
  })

  test('DesktopWalkthrough wires markStepAcknowledged + "I\'ve done this — Next" copy', () => {
    const src = read(DESKTOP)
    expect(src).toMatch(/markStepAcknowledged\(/)
    expect(src).toMatch(/I&apos;ve done this\s*—\s*Next/)
  })

  test('DesktopWalkthrough has forward-jump guard (history.replaceState + strict > check)', () => {
    const src = read(DESKTOP)
    // Phase 15 perf fix (3b541b6) swapped router.replace for window.history.replaceState
    // to avoid an RSC fetch on every step nav — see CLAUDE.md Learnings 2026-05-13.
    expect(src).toMatch(/history\.replaceState\(/)
    expect(src).toMatch(/requestedIdx\s*>\s*highestAckIdx\s*\+\s*1/)
  })

  test('WalkthroughSwitcher uses next/dynamic for DesktopWalkthrough with ssr:false', () => {
    const src = read(SWITCHER)
    expect(src).toMatch(/import\s+dynamic\s+from\s+['"]next\/dynamic['"]/)
    // dynamic import of DesktopWalkthrough with ssr: false
    expect(src).toMatch(/dynamic\([\s\S]*?DesktopWalkthrough[\s\S]*?ssr:\s*false/)
  })

  test('WalkthroughSwitcher uses next/dynamic for WalkthroughVoiceModal with ssr:false', () => {
    const src = read(SWITCHER)
    expect(src).toMatch(/dynamic\([\s\S]*?WalkthroughVoiceModal[\s\S]*?ssr:\s*false/)
  })

  test('WalkthroughSwitcher statically imports MobileWalkthrough (SSR path)', () => {
    const src = read(SWITCHER)
    expect(src).toMatch(
      /import\s+\{\s*MobileWalkthrough\s*\}\s+from\s+['"]@\/components\/sop\/walkthrough\/MobileWalkthrough['"]/
    )
  })

  test('WalkthroughSwitcher calls useViewport() to choose variant (D-04)', () => {
    const src = read(SWITCHER)
    expect(src).toMatch(/import\s+\{\s*useViewport\s*\}\s+from\s+['"]@\/hooks\/useViewport['"]/)
    expect(src).toMatch(/useViewport\(\)/)
  })

  test('Mobile variant rendered when viewport === mobile, Desktop when === desktop', () => {
    const src = read(SWITCHER)
    expect(src).toMatch(/variant\s*===\s*['"]desktop['"]/)
    expect(src).toMatch(/<MobileWalkthrough/)
    expect(src).toMatch(/<DesktopWalkthrough/)
  })

  test('WalkthroughSwitcher mounts WalkthroughVoiceButton (D-14)', () => {
    const src = read(SWITCHER)
    expect(src).toMatch(/<WalkthroughVoiceButton/)
  })

  test('MobileWalkthrough has data-walkthrough="mobile" marker for UAT', () => {
    const src = read(MOBILE)
    expect(src).toContain('data-walkthrough="mobile"')
  })

  test('DesktopWalkthrough has data-walkthrough="desktop" marker for UAT', () => {
    const src = read(DESKTOP)
    expect(src).toContain('data-walkthrough="desktop"')
  })
})
