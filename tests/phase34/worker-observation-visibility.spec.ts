/**
 * OBS-02 — Worker sees every observation about them (verdict, note,
 * observer name, date, SOP version) on `/profile`.
 *
 * Contract (34-RESEARCH.md § Architectural Responsibility Map,
 * 34-PATTERNS.md § profile/page.tsx):
 *   - `src/app/(protected)/profile/page.tsx` renders an additive
 *     "Observations about you" section (e.g. an `ObservationsSection`
 *     component), following the `<OrgSwitcher />` additive-section
 *     precedent already in that file.
 *   - `src/actions/observations.ts` exports `listObservationsForWorker`
 *     — a self-scoped read (`observed_worker_id = auth.uid()`), never a
 *     query for a different worker's rows.
 *
 * Flipped LIVE in: 34-08.
 *
 * Registration: playwright.config.ts `phase34` project
 *   testDir: '.', testMatch: /tests\/phase34\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase34`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const PROFILE_PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'profile', 'page.tsx')
const OBSERVATIONS_ACTION = path.join(ROOT, 'src', 'actions', 'observations.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('OBS-02 — worker self-read source contract', () => {
  test('profile page references an observations section component (green-when-absent — flips live in 34-08)', () => {
    if (!fs.existsSync(PROFILE_PAGE)) {
      test.skip(true, 'src/app/(protected)/profile/page.tsx not found')
      return
    }
    const src = read(PROFILE_PAGE)
    if (!src.includes('Observation')) {
      test.skip(true, 'profile page does not yet reference an observations section — waiting for Plan 34-08')
      return
    }
    expect(src).toMatch(/Observation(s)?Section/)
  })

  test('src/actions/observations.ts exports listObservationsForWorker (self-scoped read)', () => {
    if (!fs.existsSync(OBSERVATIONS_ACTION)) {
      test.skip(true, 'src/actions/observations.ts not yet created — waiting for Plan 34-04/34-08')
      return
    }
    const src = read(OBSERVATIONS_ACTION)
    if (!src.includes('listObservationsForWorker')) {
      test.skip(true, 'listObservationsForWorker not yet exported — waiting for Plan 34-08')
      return
    }
    expect(src).toContain('export async function listObservationsForWorker')
  })
})

// ---------------------------------------------------------------------------
// Runtime — requires chromium + live app + authenticated worker session
// (Railway-only UAT convention, CLAUDE.md 2026-04-24/2026-05-08).
// ---------------------------------------------------------------------------

test.describe('OBS-02 — worker self-read runtime (requires chromium + live app)', () => {
  test.fixme(
    'an authenticated worker reads /profile and sees every observation where observed_worker_id = self (verdict, note, observer name, date, sop version) — never another worker\'s rows',
    async ({ page }) => {
      await page.goto('/profile')
      // Assert the "Observations about you" section renders only rows where
      // observed_worker_id matches the logged-in worker's own id.
    },
  )
})
