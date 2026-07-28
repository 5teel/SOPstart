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

  test('the INSERT itself uses the session client (getSessionContext) — never createAdminClient for the write', () => {
    if (!fs.existsSync(OBSERVATIONS_ACTION)) {
      test.skip(true, 'src/actions/observations.ts not yet created — waiting for Plan 34-04')
      return
    }
    const src = read(OBSERVATIONS_ACTION)
    // Scoped to the recordObservation function body (D-12 applies to the
    // observation INSERT path specifically) — setObservationLabels and
    // observer-name resolution legitimately use createAdminClient elsewhere
    // in this file (organisations has no authenticated UPDATE policy;
    // auth.admin.listUsers requires service-role — both self-enforce org
    // scope per the CLAUDE.md 2026-06-15 pattern).
    //
    // Phase 37 ASR-01 legitimately added a SCOPED admin-client PREDICATE
    // READ (isSignedOffAssessor) inside this same function body — RLS on
    // sop_completions/completion_sign_offs/sop_observations does not
    // reliably return a supervisor's own rows about OTHER workers via the
    // session client (2026-07-20 inverted-false-deny class), so the read
    // (not the write) needs the admin client. D-12 still holds: the assert
    // below is scoped to the `.insert(` call itself, not the whole function
    // body, so it fails if the WRITE ever moves off the session client
    // while staying green for the predicate read (CLAUDE.md 2026-07-13:
    // repoint stale guards to what actually moved, not a blanket ban).
    const start = src.indexOf('export async function recordObservation')
    const nextExport = src.indexOf('\nexport async function', start + 1)
    const fnBody = nextExport === -1 ? src.slice(start) : src.slice(start, nextExport)
    expect(fnBody).toContain('getSessionContext(')
    const insertStart = fnBody.indexOf("await (supabase as any).from('sop_observations').insert(")
    expect(insertStart, 'sop_observations insert call not found in recordObservation').toBeGreaterThan(-1)
    const insertCallLine = fnBody.slice(insertStart, fnBody.indexOf('\n', insertStart))
    expect(insertCallLine).not.toContain('createAdminClient(')
    expect(insertCallLine).not.toMatch(/\badmin\b/)
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
