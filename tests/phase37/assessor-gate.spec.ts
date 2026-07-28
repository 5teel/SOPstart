/**
 * ASR-01 -- the assessor gate on recordObservation: an advancing
 * ('performed_to_sop') observation requires the recorder to be a signed-off
 * assessor for the SOP, UNLESS the recorder is admin/safety_manager AND
 * supplies an override reason (D-05). needs_support observations never
 * touch the predicate at all (D-03/D-04 branch-before-gate).
 *
 * Flipped LIVE in Plan 37-03 as source-contract assertions over
 * src/actions/observations.ts -- checks wiring POSITION (branch-before-gate),
 * not mere token presence (2026-06-05 dead-feature blind spot).
 *
 * Registration: playwright.config.ts `phase37` project
 *   testDir: '.', testMatch: /tests\/phase37\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase37`
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const OBS_ACTIONS = readFileSync(
  path.join(process.cwd(), 'src/actions/observations.ts'),
  'utf8'
).replace(/\r\n/g, '\n')

test.describe('ASR-01 -- recordObservation assessor gate (source-contract)', () => {
  test('isSignedOffAssessor is imported and called exactly twice (the gate in recordObservation + the UX-only status read in getAssessorStatusForSop)', () => {
    expect(OBS_ACTIONS).toContain("import { isSignedOffAssessor } from '@/lib/competency/assessor'")
    expect((OBS_ACTIONS.match(/isSignedOffAssessor\(/g) ?? []).length).toBe(2)
  })

  test('the GATING isSignedOffAssessor call-site (inside recordObservation) is AFTER the performed_to_sop branch check (D-03/D-04 branch-before-gate)', () => {
    const verdictIndex = OBS_ACTIONS.indexOf("verdict === 'performed_to_sop'")
    const callIndex = OBS_ACTIONS.indexOf('isSignedOffAssessor(userId, sopId, createAdminClient(), organisationId)')
    expect(verdictIndex).toBeGreaterThan(-1)
    expect(callIndex).toBeGreaterThan(-1)
    expect(callIndex).toBeGreaterThan(verdictIndex)
  })

  test('both bare error codes appear, and ASSESSOR_OVERRIDE_REQUIRED is inside a branch referencing admin/safety_manager (D-06)', () => {
    expect(OBS_ACTIONS).toContain('NOT_SIGNED_OFF_ASSESSOR')
    expect(OBS_ACTIONS).toContain('ASSESSOR_OVERRIDE_REQUIRED')
    const overrideIndex = OBS_ACTIONS.indexOf('ASSESSOR_OVERRIDE_REQUIRED')
    const nearby = OBS_ACTIONS.slice(Math.max(0, overrideIndex - 300), overrideIndex)
    expect(nearby).toContain("'admin'")
    expect(nearby).toContain("'safety_manager'")
  })

  test('the sop_observations insert payload carries is_assessor_override and override_reason', () => {
    const insertIndex = OBS_ACTIONS.indexOf("from('sop_observations').insert(")
    expect(insertIndex).toBeGreaterThan(-1)
    const insertSlice = OBS_ACTIONS.slice(insertIndex, insertIndex + 500)
    expect(insertSlice).toContain('is_assessor_override:')
    expect(insertSlice).toContain('override_reason:')
  })

  test('requestAssessorReview uses createAdminClient and references assessment_requested + subject_user_id', () => {
    const start = OBS_ACTIONS.indexOf('export async function requestAssessorReview')
    const end = OBS_ACTIONS.indexOf('export interface AssessmentRequest')
    expect(start).toBeGreaterThan(-1)
    const body = OBS_ACTIONS.slice(start, end)
    expect(body).toContain('createAdminClient(')
    expect(body).toContain('assessment_requested')
    expect(body).toContain('subject_user_id')
  })

  test('listAssessmentRequests does NOT use createAdminClient for its notification read (RLS self-read is the gate)', () => {
    const start = OBS_ACTIONS.indexOf('export async function listAssessmentRequests')
    expect(start).toBeGreaterThan(-1)
    const body = OBS_ACTIONS.slice(start)
    expect(body).not.toContain('createAdminClient(')
  })

  test('getAssessorStatusForSop, requestAssessorReview, listAssessmentRequests are all declared export async function', () => {
    expect(OBS_ACTIONS).toContain('export async function getAssessorStatusForSop')
    expect(OBS_ACTIONS).toContain('export async function requestAssessorReview')
    expect(OBS_ACTIONS).toContain('export async function listAssessmentRequests')
  })
})
