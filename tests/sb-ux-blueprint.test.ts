/**
 * SB-UX-01 -- paper theme. Repointed in 58-15: this was a live-browser probe of
 * the public landing page against localhost:3000 (it needs a running server, so it
 * could only ever fail here -- evals run against the deployed site), plus three
 * stubs for retired surfaces. The surviving behaviour is that the whole app is
 * paper-themed, which lives in the root layout and the focus frame.
 *
 * Dropped with the tabbed page (no successor): SB-UX-08 (worker preview toggle
 * clamped to 430px -- the toggle is gone) and SB-UX-02 (SOP detail as a 6-tab
 * shell driven by ?tab= -- the focus screen has no tabs; tab addresses redirect in
 * the proxy). The "admin route is not paper" stub is dropped: paper is app-wide.
 *
 * Registration: playwright.config.ts `phase12.5-stubs` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8').replace(/\r\n/g, '\n')

test('SB-UX-01: the root layout sets data-theme="paper" on the body (app-wide paper theme)', () => {
  expect(read('src/app/layout.tsx')).toContain('<body data-theme="paper">')
})

test('SB-UX-01: the focus screen frame is paper, not a dark chrome', () => {
  const frame = read('src/components/focus/FocusFrame.tsx')
  expect(frame).toContain('data-testid="focus-screen"')
  expect(frame).toContain('bg-paper')
})
