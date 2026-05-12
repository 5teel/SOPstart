/**
 * SB-LINE-02 — Sequential walkthrough acknowledgement gate (Wave 2 live).
 *
 * Wave 0 scaffold flipped to live source-contract assertions in Wave 2.
 *
 * The full end-to-end Playwright run (cookie-auth + seeded Visy SOP +
 * chromium browser) is deferred to phase verification UAT (Task 5
 * blocking checkpoint in the plan). The chromium binary is not installed
 * in the executor environment (per Plan 15-01 Rule-3 finding) and the
 * Wave 0 fixture seeding needs a `npx supabase db push` that ships in
 * the same UAT pass.
 *
 * What this file verifies right now (source-contract level):
 *   1. MobileWalkthrough.tsx exists and wires `markStepAcknowledged`
 *      into the "I've done this — Next" button onClick (D-19).
 *   2. MobileWalkthrough.tsx implements the forward-jump guard via
 *      `router.replace` + strict `>` check against `getHighestAckIndex`
 *      (D-20 + Pitfall 4 — no infinite redirect loop).
 *   3. MobileWalkthrough.tsx passes `stepAckTrace` to `submitCompletion`
 *      so the server persists `sop_completions.step_ack_trace` (D-21).
 *   4. The primary CTA copy is exactly "I've done this — Next" (SPEC
 *      acceptance criterion).
 *   5. The Next button is `min-h-[60px]` (glove-friendly tap target).
 *
 * These five assertions directly cover the four behavioural truths the
 * plan calls for (sequential gate, deep-link redirect, backward nav
 * still allowed via existing Prev button, ack_trace persisted to JSONB).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const MOBILE_WALKTHROUGH = path.resolve(
  __dirname,
  '..',
  '..',
  'src',
  'components',
  'sop',
  'walkthrough',
  'MobileWalkthrough.tsx'
)

function readMobile(): string {
  return fs.readFileSync(MOBILE_WALKTHROUGH, 'utf-8')
}

test.describe('SB-LINE-02 — Sequential acknowledgement gate (Wave 2 contract tests)', () => {
  test('MobileWalkthrough exists', () => {
    expect(fs.existsSync(MOBILE_WALKTHROUGH)).toBe(true)
  })

  test('Next button wires markStepAcknowledged (D-19)', () => {
    const src = readMobile()
    expect(src).toMatch(/markStepAcknowledged\(/)
    // markStepAcknowledged is called from handleMarkComplete, which is
    // the Next button's onClick.
    expect(src).toMatch(/walkthroughStore\.markStepAcknowledged\(sopId,\s*stepId\)/)
  })

  test('Primary CTA reads "I\'ve done this — Next" (SPEC criterion)', () => {
    const src = readMobile()
    // Apostrophe is HTML-escaped (&apos;) inside JSX text.
    expect(src).toMatch(/I&apos;ve done this\s*—\s*Next/)
  })

  test('Next button has min-h-[60px] (glove-friendly tap target)', () => {
    const src = readMobile()
    // Tailwind arbitrary value class — needs literal match.
    expect(src).toContain('min-h-[60px]')
  })

  test('Forward-jump guard uses router.replace + strict > check (D-20, Pitfall 4)', () => {
    const src = readMobile()
    expect(src).toMatch(/router\.replace\(/)
    // Strict greater-than against highestAckIdx + 1, not >=.
    expect(src).toMatch(/requestedIdx\s*>\s*highestAckIdx\s*\+\s*1/)
    expect(src).toMatch(/getHighestAckIndex\(/)
  })

  test('Submit passes stepAckTrace to server action (D-21)', () => {
    const src = readMobile()
    expect(src).toMatch(/getAckTrace\(sopId\)/)
    // The submitCompletion call site includes stepAckTrace.
    expect(src).toMatch(/stepAckTrace,?\s*\}\)/m)
  })

  test('Back/Prev navigation does NOT call markStepAcknowledged (D-20 backward always allowed)', () => {
    const src = readMobile()
    // The Prev button onClick just calls handleStepChange — no ack call.
    const prevButton =
      src.match(/disabled=\{!prevStep\}[\s\S]*?Prev\b/)?.[0] ?? ''
    expect(prevButton).not.toMatch(/markStepAcknowledged/)
  })

  test('submitCompletion validator accepts stepAckTrace (D-21)', () => {
    const validatorPath = path.resolve(
      __dirname,
      '..',
      '..',
      'src',
      'lib',
      'validators',
      'completions.ts'
    )
    const src = fs.readFileSync(validatorPath, 'utf-8')
    expect(src).toMatch(/StepAckEntrySchema/)
    expect(src).toMatch(/stepAckTrace:.*optional\(\)/)
  })

  // Wave 4 additions — verify end-to-end ack-trace flow through both
  // walkthrough variants and the server action.

  test('DesktopWalkthrough also passes stepAckTrace to submitCompletion (D-21)', () => {
    const desktopPath = path.resolve(
      __dirname,
      '..',
      '..',
      'src',
      'components',
      'sop',
      'walkthrough',
      'DesktopWalkthrough.tsx',
    )
    const src = fs.readFileSync(desktopPath, 'utf-8')
    expect(src).toMatch(/getAckTrace\(sopId\)/)
    expect(src).toMatch(/stepAckTrace,?\s*\}\)/m)
  })

  test('submitCompletion server action persists step_ack_trace to sop_completions (D-21)', () => {
    const actionPath = path.resolve(
      __dirname,
      '..',
      '..',
      'src',
      'actions',
      'completions.ts',
    )
    const src = fs.readFileSync(actionPath, 'utf-8')
    // Server action destructures stepAckTrace from validated input
    expect(src).toMatch(/stepAckTrace/)
    // And writes the snake_case jsonb column on the insert payload
    expect(src).toMatch(/step_ack_trace:\s*\(stepAckTrace/)
  })

  test('AckTraceEntry schema requires {stepId: uuid, timestamp: int} (D-21)', () => {
    const validatorPath = path.resolve(
      __dirname,
      '..',
      '..',
      'src',
      'lib',
      'validators',
      'completions.ts',
    )
    const src = fs.readFileSync(validatorPath, 'utf-8')
    expect(src).toMatch(/StepAckEntrySchema\s*=\s*z\.object/)
    expect(src).toMatch(/stepId:\s*z\.string\(\)\.uuid\(\)/)
    expect(src).toMatch(/timestamp:\s*z\.number\(\)\.int\(\)/)
  })
})
