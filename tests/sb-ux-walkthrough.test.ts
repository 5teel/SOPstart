/**
 * SB-UX-03 -- the walk is built for a phone in a glove. Repointed in 58-15: the
 * two fixme stubs described the immersive step card and the desktop/mobile view
 * toggle (persisted to localStorage), both retired with the old walkthroughs. The
 * surviving behaviour is the glove-sized walk: the focus walk step and its
 * review/send actions use the 60px glove tap target and the step type token.
 *
 * Dropped: the view-mode toggle persistence -- there is one walk layout and no
 * toggle, and nothing is persisted on the device.
 *
 * Registration: playwright.config.ts `phase12.5-stubs` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf-8').replace(/\r\n/g, '\n')

test('SB-UX-03: the walk step text uses the step type token and its actions are glove-sized', () => {
  const step = read('src/components/focus/WalkStep.tsx')
  expect(step).toContain('data-testid="walk-step-text"')
  expect(step).toContain('text-step')
  expect(step).toContain('min-h-tap-glove')
})

test('SB-UX-03: the review and send action is glove-sized, and the walker renders the walk step', () => {
  expect(read('src/components/focus/ReviewAndSend.tsx')).toContain('min-h-tap-glove')
  expect(read('src/components/focus/FocusWalker.tsx')).toContain('<WalkStep')
})
