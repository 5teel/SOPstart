/**
 * OBS-03 / D-10 — Observation is linked to the worker's profile and
 * stamped with `sop_version` at record time, resolved server-side —
 * never a client-supplied value.
 *
 * Contract (34-RESEARCH.md § Pattern 3, 34-PATTERNS.md § observations.ts):
 *   - `recordObservation` reads `sops.version` via
 *     `.from('sops').select('version')` immediately before insert.
 *   - The insert writes `sop_version: sop.version` (the server-resolved
 *     read), mirroring `sop_completions.sop_version` (COMP-04) — the
 *     client never supplies this value directly.
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

test.describe('OBS-03 / D-10 — server-resolved sop_version source contract', () => {
  test('recordObservation reads current SOP version server-side (green-when-absent — flips live in 34-04)', () => {
    if (!fs.existsSync(OBSERVATIONS_ACTION)) {
      test.skip(true, 'src/actions/observations.ts not yet created — waiting for Plan 34-04')
      return
    }
    const src = read(OBSERVATIONS_ACTION)
    expect(src).toContain("from('sops').select('version')")
  })

  test('insert writes sop_version from the server-resolved read, not a client-supplied field', () => {
    if (!fs.existsSync(OBSERVATIONS_ACTION)) {
      test.skip(true, 'src/actions/observations.ts not yet created — waiting for Plan 34-04')
      return
    }
    const src = read(OBSERVATIONS_ACTION)
    expect(src).toContain('sop_version: sop.version')
  })
})

// ---------------------------------------------------------------------------
// Runtime — requires chromium + live app + authenticated session
// (Railway-only UAT convention, CLAUDE.md 2026-04-24/2026-05-08).
// ---------------------------------------------------------------------------

test.describe('OBS-03 / D-10 — sop_version stamp runtime (requires chromium + live app)', () => {
  test.fixme(
    'recording an observation stamps sop_version equal to the SOP\'s current version at insert time, ignoring any client-supplied version',
    async ({ page }) => {
      await page.goto('/admin/team')
      // Record an observation against a known SOP, then read the row back and
      // assert row.sop_version === the SOP's live sops.version column.
    },
  )
})
