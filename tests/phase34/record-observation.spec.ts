/**
 * OBS-01 — Supervisor/admin/safety_manager can record an observation
 * (verdict + optional note) against a worker + SOP; a plain `worker`
 * role is rejected.
 *
 * Contract (34-RESEARCH.md § Pattern 2, 34-PATTERNS.md § observations.ts):
 *   - `src/actions/observations.ts` exports `recordObservation`.
 *   - Role gate mirrors `completions.ts::signOffCompletion` — an inline
 *     `['supervisor', 'admin', 'safety_manager'].includes(role)` check,
 *     NOT `requireAdminContext()` (which excludes supervisor).
 *   - The insert uses the session client from `getSessionContext()` — RLS
 *     is the safety mechanism (D-12), so `createAdminClient(` must NOT
 *     appear anywhere in this file (2026-06-15/2026-06-26/2026-07-05
 *     write-hole class).
 *
 * Flipped LIVE in: 34-04.
 *
 * Registration: playwright.config.ts `phase34` project
 *   testDir: '.', testMatch: /tests\/phase34\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase34`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OBSERVATIONS_ACTION = path.join(ROOT, 'src', 'actions', 'observations.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('OBS-01 — recordObservation source contract', () => {
  test('src/actions/observations.ts exports recordObservation (green-when-absent — flips live in 34-04)', () => {
    if (!fs.existsSync(OBSERVATIONS_ACTION)) {
      test.skip(true, 'src/actions/observations.ts not yet created — waiting for Plan 34-04')
      return
    }
    const src = read(OBSERVATIONS_ACTION)
    expect(src).toContain('export async function recordObservation')
  })

  test('role gate is the inline supervisor|admin|safety_manager array check, not requireAdminContext()', () => {
    if (!fs.existsSync(OBSERVATIONS_ACTION)) {
      test.skip(true, 'src/actions/observations.ts not yet created — waiting for Plan 34-04')
      return
    }
    const src = read(OBSERVATIONS_ACTION)
    expect(src).toContain("['supervisor', 'admin', 'safety_manager'].includes(role)")
  })

  test('write uses the session client (getSessionContext) — never createAdminClient for this table', () => {
    if (!fs.existsSync(OBSERVATIONS_ACTION)) {
      test.skip(true, 'src/actions/observations.ts not yet created — waiting for Plan 34-04')
      return
    }
    const src = read(OBSERVATIONS_ACTION)
    expect(src).toContain('getSessionContext(')
    expect(src).not.toContain('createAdminClient(')
  })
})

// ---------------------------------------------------------------------------
// Runtime — requires chromium + live app + authenticated sessions
// (Railway-only UAT convention, CLAUDE.md 2026-04-24/2026-05-08).
// ---------------------------------------------------------------------------

test.describe('OBS-01 — recordObservation runtime (requires chromium + live app)', () => {
  test.fixme(
    'a supervisor session records an observation (verdict + optional note) against a worker + SOP — success',
    async ({ page }) => {
      await page.goto('/admin/team')
      // Open a person panel and record an observation as an authenticated supervisor;
      // assert the new row appears in observation history.
    },
  )

  test.fixme(
    'a plain worker session calling recordObservation is rejected with a role error, not a 500',
    async ({ page }) => {
      await page.goto('/admin/team')
      // A worker-role session must never be able to call recordObservation successfully —
      // the server action's role check must reject it deterministically.
    },
  )
})
