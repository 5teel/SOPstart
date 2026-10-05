/**
 * Gap closure regression guards -- 37-VERIFICATION.md CR-01 and WR-02/WR-05
 * (the video versions page sibling guard went with the page in Phase 55).
 *
 * Positional source-contract assertions (readFileSync + \r\n strip) matching
 * the phase's existing idiom (tests/phase37/assessor-gate.spec.ts). Also adds
 * a directory-wide sweep so the NEXT unguarded admin-client page fetch fails
 * this spec instead of shipping (2026-07-20: a per-file guard is not
 * coverage).
 *
 * Registration: playwright.config.ts `phase37` project
 *   testDir: '.', testMatch: /tests\/phase37\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase37`
 */
import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

function readSrc(relPath: string): string {
  return readFileSync(path.join(process.cwd(), relPath), 'utf8').replace(/\r\n/g, '\n')
}

const COMPLETION_PAGE = readSrc('src/app/(protected)/activity/[completionId]/page.tsx')
const OBS_ACTIONS = readSrc('src/actions/observations.ts')

test.describe('CR-01 -- completion detail page org-scope guard (59-15: session-client read, owner-only)', () => {
  test('organisationId is destructured from getSessionContext', () => {
    expect(COMPLETION_PAGE).toContain('getSessionContext()')
    const destructureLine = COMPLETION_PAGE.slice(
      COMPLETION_PAGE.indexOf('await getSessionContext()') - 120,
      COMPLETION_PAGE.indexOf('await getSessionContext()')
    )
    expect(destructureLine).toContain('organisationId')
  })

  test('the read is filtered by the SESSION org through the session client, and no service-role read by id remains (F-05)', () => {
    expect(COMPLETION_PAGE).not.toContain('createAdminClient')
    expect(COMPLETION_PAGE).toContain(".eq('organisation_id', organisationId)")
    // the row's own organisation_id is never consumed
    expect(COMPLETION_PAGE).not.toMatch(/data.organisation_id/)
  })

  test('the owner check runs BEFORE any photo is signed, and photos are signed against the session org', () => {
    const ownerIdx = COMPLETION_PAGE.indexOf('data.worker_id !== userId')
    const signIdx = COMPLETION_PAGE.indexOf('signCompletionPhotos(')
    expect(ownerIdx).toBeGreaterThan(-1)
    expect(signIdx).toBeGreaterThan(-1)
    expect(ownerIdx).toBeLessThan(signIdx)
    expect(COMPLETION_PAGE).toContain('signCompletionPhotos(data.completion_photos ?? [], organisationId)')
    expect(COMPLETION_PAGE).not.toContain('createSignedUrl')
  })

  test('the assessor predicate is gone from the page (sign-off lives in the Office, 59-06 getCompletionForReview)', () => {
    expect(COMPLETION_PAGE).not.toContain('isSignedOffAssessor(')
  })
})

test.describe('WR-02 / WR-05 -- observations.ts write-path guards', () => {
  test('requestAssessorReview role-gates before any admin-client work', () => {
    const start = OBS_ACTIONS.indexOf('export async function requestAssessorReview')
    const end = OBS_ACTIONS.indexOf('export interface AssessmentRequest')
    expect(start).toBeGreaterThan(-1)
    const body = OBS_ACTIONS.slice(start, end)
    expect(body).toContain('RECORDER_ROLES.includes(role)')
    const gateIndex = body.indexOf('RECORDER_ROLES.includes(role)')
    const adminIndex = body.indexOf('createAdminClient(')
    expect(adminIndex).toBeGreaterThan(-1)
    expect(gateIndex).toBeLessThan(adminIndex)
  })

  test('RECORDER_ROLES is declared exactly once (reused, not duplicated)', () => {
    expect((OBS_ACTIONS.match(/const RECORDER_ROLES/g) ?? []).length).toBe(1)
  })

  test('recordObservation validates completionId against sop_completions (org + worker scoped) before the ASR-01 predicate read and before the insert', () => {
    const start = OBS_ACTIONS.indexOf('export async function recordObservation')
    const end = OBS_ACTIONS.indexOf('export async function getObservationLabels')
    expect(start).toBeGreaterThan(-1)
    const body = OBS_ACTIONS.slice(start, end)

    const workerFilterIndex = body.indexOf(".eq('worker_id', workerId)")
    const orgFilterIndex = body.indexOf(".eq('organisation_id', organisationId)")
    const insertIndex = body.indexOf("from('sop_observations').insert(")
    const verdictIndex = body.indexOf("verdict === 'performed_to_sop'")

    expect(workerFilterIndex).toBeGreaterThan(-1)
    expect(orgFilterIndex).toBeGreaterThan(-1)
    expect(insertIndex).toBeGreaterThan(-1)
    expect(verdictIndex).toBeGreaterThan(-1)

    expect(workerFilterIndex).toBeLessThan(insertIndex)
    expect(orgFilterIndex).toBeLessThan(insertIndex)
    expect(workerFilterIndex).toBeLessThan(verdictIndex)

    expect(body).toContain('Completion not found.')
  })
})

test.describe('Systemic sweep -- every protected page using the admin client compares organisationId', () => {
  test('every src/app/(protected)/**/page.tsx that calls createAdminClient() also references organisationId', () => {
    const protectedDir = path.join(process.cwd(), 'src/app/(protected)')
    const entries = readdirSync(protectedDir, { recursive: true }) as string[]
    const pageFiles = entries
      .filter((e) => e.toString().endsWith('page.tsx'))
      .map((e) => path.join(protectedDir, e.toString()))

    // Filter on the IMPORT of the admin client module, not a bare
    // createAdminClient( substring match -- a page can mention the name in a
    // comment (e.g. describing a server action it calls) without importing
    // or instantiating the client itself, which would be a false positive.
    const adminClientPages = pageFiles
      .map((f) => ({ file: f, content: readFileSync(f, 'utf8').replace(/\r\n/g, '\n') }))
      .filter((p) => p.content.includes("from '@/lib/supabase/admin'") && p.content.includes('createAdminClient('))

    // An empty glob passing vacuously is the 2026-05-25 "test that tests
    // nothing" trap -- assert the sweep found something before asserting over it.
    expect(adminClientPages.length).toBeGreaterThan(0)

    const unguarded = adminClientPages.filter((p) => !p.content.includes('organisationId'))
    expect(unguarded.map((p) => p.file)).toEqual([])
  })
})
