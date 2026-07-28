/**
 * Phase 37 -- D-05 (override always available, reason mandatory) / D-07
 * (append-only audit via stamped columns, not a new table) schema contract.
 *
 * LIVE at the end of Plan 37-01 -- Tasks 2 and 3 of THIS plan create every
 * target this spec asserts against, so it is live and passing by the time
 * the plan finishes (unlike the four `test.fixme` stubs in sibling specs,
 * which stay pending until a later plan flips them live).
 *
 * Registration: playwright.config.ts `phase37` project
 *   testDir: '.', testMatch: /tests\/phase37\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase37`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

const MIGRATION = path.join(ROOT, 'supabase', 'migrations', '00056_assessor_governance.sql')
const DATABASE_TYPES = path.join(ROOT, 'src', 'types', 'database.types.ts')
const OBSERVATIONS_VALIDATOR = path.join(ROOT, 'src', 'lib', 'validators', 'observations.ts')
const COMPLETIONS_VALIDATOR = path.join(ROOT, 'src', 'lib', 'validators', 'completions.ts')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

test.describe('D-05/D-07 -- migration 00056 override audit columns + constraints', () => {
  test('migration file exists', () => {
    expect(fs.existsSync(MIGRATION)).toBe(true)
  })

  test('is_assessor_override boolean column declared on both tables', () => {
    test.skip(!fs.existsSync(MIGRATION), 'migration not created yet')
    const content = read(MIGRATION)
    expect(countOccurrences(content, 'is_assessor_override boolean not null default false')).toBeGreaterThanOrEqual(2)
  })

  test('override_reason text column declared on both tables', () => {
    test.skip(!fs.existsSync(MIGRATION), 'migration not created yet')
    const content = read(MIGRATION)
    expect(countOccurrences(content, 'override_reason text')).toBeGreaterThanOrEqual(2)
  })

  test('both override-reason-required CHECK constraints are named and present', () => {
    test.skip(!fs.existsSync(MIGRATION), 'migration not created yet')
    const content = read(MIGRATION)
    expect(content).toContain('sop_observations_override_reason_required')
    expect(content).toContain('completion_sign_offs_override_reason_required')
  })

  test('worker_notifications.subject_user_id present', () => {
    test.skip(!fs.existsSync(MIGRATION), 'migration not created yet')
    expect(read(MIGRATION)).toContain('subject_user_id')
  })

  test('sop_observations_insert_recorder policy re-created', () => {
    test.skip(!fs.existsSync(MIGRATION), 'migration not created yet')
    expect(read(MIGRATION)).toContain('sop_observations_insert_recorder')
  })
})

test.describe('D-05/D-07 -- typed columns hand-extended in database.types.ts', () => {
  test('database.types.ts contains is_assessor_override and subject_user_id', () => {
    const content = read(DATABASE_TYPES)
    expect(content).toContain('is_assessor_override')
    expect(content).toContain('subject_user_id')
  })
})

test.describe('D-05 -- overrideReason validated on both write schemas', () => {
  test('RecordObservationSchema carries overrideReason', () => {
    expect(read(OBSERVATIONS_VALIDATOR)).toContain('overrideReason')
  })

  test('SignOffSchema carries overrideReason', () => {
    expect(read(COMPLETIONS_VALIDATOR)).toContain('overrideReason')
  })
})
