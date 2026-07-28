/**
 * Gap closure regression guards -- 37-VERIFICATION.md CR-01 (+ its rule-5
 * sibling on the video versions page) and WR-02/WR-05.
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
const VIDEO_PAGE = readSrc('src/app/(protected)/admin/sops/[sopId]/video/page.tsx')
const OBS_ACTIONS = readSrc('src/actions/observations.ts')

test.describe('CR-01 -- completion detail page org-scope guard', () => {
  test('organisationId is destructured from getSessionContext', () => {
    expect(COMPLETION_PAGE).toContain('getSessionContext()')
    const destructureLine = COMPLETION_PAGE.slice(
      COMPLETION_PAGE.indexOf('await getSessionContext()') - 120,
      COMPLETION_PAGE.indexOf('await getSessionContext()')
    )
    expect(destructureLine).toContain('organisationId')
  })

  test('the org guard is present exactly once and runs BEFORE the signed-URL mint and the assessor predicate', () => {
    const guard = "data.organisation_id !== organisationId"
    expect((COMPLETION_PAGE.match(new RegExp(guard.replace(/[.]/g, '\\.'), 'g')) ?? []).length).toBe(1)
    const guardIndex = COMPLETION_PAGE.indexOf(guard)
    const signedUrlIndex = COMPLETION_PAGE.indexOf('createSignedUrl')
    const predicateIndex = COMPLETION_PAGE.indexOf('isSignedOffAssessor(')
    expect(guardIndex).toBeGreaterThan(-1)
    expect(signedUrlIndex).toBeGreaterThan(-1)
    expect(predicateIndex).toBeGreaterThan(-1)
    expect(guardIndex).toBeLessThan(signedUrlIndex)
    expect(guardIndex).toBeLessThan(predicateIndex)
  })

  test('the assessor predicate is called with the session organisationId, not the row org', () => {
    expect(COMPLETION_PAGE).toContain('isSignedOffAssessor(userId, data.sop_id, admin, organisationId)')
    // Only one remaining reference to the row's own org field -- the guard
    // itself -- proving the predicate no longer consumes it (CR-01 T-37-07-02).
    expect((COMPLETION_PAGE.match(/data\.organisation_id/g) ?? []).length).toBe(1)
  })
})

test.describe('Rule-5 sibling -- video versions page org-scope guard', () => {
  test('the org guard is present and the sops select includes organisation_id', () => {
    expect(VIDEO_PAGE).toContain('sop.organisation_id !== organisationId')
    const selectIndex = VIDEO_PAGE.indexOf(".from('sops')")
    const selectSlice = VIDEO_PAGE.slice(selectIndex, selectIndex + 200)
    expect(selectSlice).toContain('organisation_id')
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
