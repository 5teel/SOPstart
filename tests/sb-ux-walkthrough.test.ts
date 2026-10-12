/**
 * SB-UX-03 -- the run is built for a phone in a glove. ADR-0012: the run is the home view's checklist. Repointed in 58-15: the
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

test('SB-UX-03 (ADR-0012): every tick, the photo button, Send and Done are glove-sized', () => {
  const view = read('src/components/home/ReadView.tsx')
  expect(view).toContain('data-testid="step-tick"')
  expect(view).toMatch(/data-testid="step-tick"[\s\S]*?size-tap-glove/)
  expect(view).toMatch(/data-testid=\{has \? 'step-photo-retake' : 'step-photo-button'\}[\s\S]*?min-h-tap-glove/)
  expect(view).toMatch(/data-testid="run-send-button"[\s\S]*?min-h-tap-glove/)
  expect(view).toMatch(/data-testid="run-done"[\s\S]*?min-h-tap-glove/)
})
