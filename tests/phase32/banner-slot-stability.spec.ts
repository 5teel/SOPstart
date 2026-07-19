/**
 * SC-6 — SelectionStrip fixed 48px slot, pixel-identical graph position across states.
 *
 * Flipped live in 32-08 (Rule-3 degrade — no chromium binary installed in this
 * environment, see tests/phase32/org-chart-build.spec.ts precedent from 32-07):
 * source-contract assertions prove the slot is unconditionally rendered (no
 * `? null :` mount branch) and each state's copy is wired; the true pixel
 * measurement is kept as a documented `test.fixme` runtime smoke.
 *
 * Contract (32-08-PLAN must_haves):
 *   - `src/components/admin/wiring/SelectionStrip.tsx` is a permanently
 *     reserved fixed 48px-height slot that SWAPS content/class (idle /
 *     selection / wiring states) — it never mounts/unmounts, so the wiring
 *     graph below it never reflows on click.
 *
 * Registration: playwright.config.ts `phase32` project
 *   testDir: '.', testMatch: /tests\/phase32\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase32`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const STRIP = path.join(ROOT, 'src', 'components', 'admin', 'wiring', 'SelectionStrip.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('SC-6 — SelectionStrip source contract', () => {
  test('renders exactly one unconditional h-[48px] overflow-hidden slot — no conditional slot-div mount', () => {
    const src = read(STRIP)
    expect(src).toContain("h-[48px] overflow-hidden")
    // The outer slot div itself must never be behind a ternary that can render null/undefined —
    // only ONE `<div` with data-state exists, and it is unconditional (not `{state === 'x' ? <div ... : null}`).
    const divCount = (src.match(/<div data-state=/g) ?? []).length
    expect(divCount).toBe(1)
    expect(src).not.toMatch(/state === '\w+' \? <div/)
  })

  test('idle state renders the onboarding copy (33-09 plain language)', () => {
    const src = read(STRIP)
    expect(src).toContain('Click a team, role or person to see what they can see')
    expect(src).toContain('click a collection or SOP to choose who sees it')
  })

  test('selection and wiring states render people-first plain-language sentences (33-09, no "grant" wording)', () => {
    const src = read(STRIP)
    expect(src).toContain('<b>{peopleCount}</b> {peopleCount === 1 ? \'person\' : \'people\'} can see this.')
    expect(src).toContain('Choosing who sees <b>{label}</b>')
  })

  test('wiring state exposes a ✓ Save — done control wired to onDone (33-09)', () => {
    const src = read(STRIP)
    expect(src).toContain('✓ Save — done')
    expect(src).toContain('onClick={onDone}')
  })

  test('state class swaps on the SAME slot element (data-state + state-name class, not a remount)', () => {
    const src = read(STRIP)
    expect(src).toContain('className={`strip-slot h-[48px] overflow-hidden ${state}`}')
  })
})

// ---------------------------------------------------------------------------
// Runtime smoke — requires chromium + live app (Rule-3 fallback documented
// above). Prerequisites: `npx playwright install chromium`, app running,
// admin magic-link session (CLAUDE.md 2026-04-24 pattern).
// ---------------------------------------------------------------------------

test.describe('SC-6 — banner slot stability runtime (requires chromium + live app)', () => {
  test.fixme(
    'SelectionStrip reserves a fixed 48px slot; bay getBoundingClientRect().top never changes across idle/selection/wiring',
    async ({ page }) => {
      await page.goto('/admin/sops?view=access')
      const bayTop = () => page.locator('.bay').boundingBox()
      const idle = await bayTop()
      await page.locator('.jack').first().click()
      const selection = await bayTop()
      expect(selection?.y).toBe(idle?.y)
      // Enter wire-up mode on the pinned NEW SOP, if present.
      const newSopJack = page.locator('.jack.newsop')
      if (await newSopJack.count()) {
        await newSopJack.click()
        const wiring = await bayTop()
        expect(wiring?.y).toBe(idle?.y)
      }
    },
  )
})
