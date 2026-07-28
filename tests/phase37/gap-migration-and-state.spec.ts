/**
 * 37-08 gap closure regression guards.
 *
 * Closure source: 37-VERIFICATION.md CR-02, 37-REVIEW.md WR-01/WR-03/WR-04.
 *
 * Registration: playwright.config.ts `phase37` project
 *   testDir: '.', testMatch: /tests\/phase37\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase37`
 *
 * CLAUDE.md 2026-07-18: a worktree checkout CRLF-normalizes source files and
 * breaks `\n`-literal source-contract matching. Every target is read via
 * readFileSync + `.replace(/\r\n/g, '\n')` before matching, and `[\s\S]`
 * is used in place of the regex `/s` flag (CLAUDE.md 2026-06-02 TS target).
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function read(p: string): string {
  return readFileSync(path.join(ROOT, p), 'utf8').replace(/\r\n/g, '\n')
}

const APPLIER = read('scripts/apply-phase37-migration.mjs')
const MIGRATION_00057 = read('supabase/migrations/00057_restore_sop_observations_cross_org_guard.sql')
const ASSESSOR = read('src/lib/competency/assessor.ts')
const MODAL = read('src/components/observations/RecordObservationModal.tsx')
const CLIENT = read('src/app/(protected)/activity/[completionId]/CompletionDetailClient.tsx')

test.describe('CR-02 -- applier applies 00056+00057 in order and pins the restored conjunct', () => {
  test('MIGRATION_FILES exists; the old single-file MIGRATION_FILE const is gone (word-boundary, not substring)', () => {
    expect(APPLIER).toContain('MIGRATION_FILES')
    // Word-boundary regex, not a substring check -- MIGRATION_FILES itself
    // contains the substring "MIGRATION_FILE", so a naive .includes would
    // always pass even if the old single-file const were still declared.
    expect(/\bMIGRATION_FILE\b/.test(APPLIER)).toBe(false)
  })

  test('both migration filenames are present, and 00056 is applied before 00057 (apply order asserted, not assumed)', () => {
    const idx56 = APPLIER.indexOf('00056_assessor_governance.sql')
    const idx57 = APPLIER.indexOf('00057_restore_sop_observations_cross_org_guard.sql')
    expect(idx56).toBeGreaterThan(-1)
    expect(idx57).toBeGreaterThan(-1)
    expect(idx56).toBeLessThan(idx57)
  })

  test('the db-push fallback catch block applies both files via a for loop over MIGRATION_FILES', () => {
    const startIdx = APPLIER.indexOf('supabase db push failed')
    const endIdx = APPLIER.indexOf('applied via', startIdx)
    expect(startIdx).toBeGreaterThan(-1)
    expect(endIdx).toBeGreaterThan(startIdx)
    const catchSlice = APPLIER.slice(startIdx, endIdx)
    expect(catchSlice).toMatch(/for \(const file of MIGRATION_FILES\)/)
  })

  test("assertion group 3's ok expression requires current_user_role AND is_assessor_override AND sop_observation_refs_in_org", () => {
    const anchorIdx = APPLIER.indexOf('sop_observations_insert_recorder policy with_check')
    expect(anchorIdx).toBeGreaterThan(-1)
    const slice = APPLIER.slice(anchorIdx, anchorIdx + 600)
    expect(slice).toContain('current_user_role')
    expect(slice).toContain('is_assessor_override')
    expect(slice).toContain('sop_observation_refs_in_org')
  })

  test('the asserted conjunct is cross-checked against 00057s own SQL body (ground truth, not a typed-in string)', () => {
    expect(MIGRATION_00057).toContain('sop_observation_refs_in_org')
  })
})

test.describe('WR-01 -- order-independent sign-off evaluation', () => {
  test('signOffByCompletion Map is gone; hasSignOff evaluates .some() over all rows', () => {
    expect(ASSESSOR).not.toContain('signOffByCompletion')
    expect(ASSESSOR).not.toContain('new Map(')
    expect(ASSESSOR).toContain("signOffs.some(s => s.decision === 'approved')")
  })
})

test.describe('WR-03 -- per-SOP state reset scoped to the [sopId] effect', () => {
  test('the [sopId] effect (not just the open-transition block) resets assessorStatus/requestSent/overrideOpen', () => {
    // Scoped to the effect window specifically -- asserting these setters
    // exist ANYWHERE in the file would pass on the pre-fix code too, since
    // they already live in the open-transition reset block. The point of
    // WR-03 is that they ALSO run on every sopId change, which only a
    // window scoped to the [sopId] effect can prove.
    const anchorIdx = MODAL.indexOf('getAssessorStatusForSop', 200)
    expect(anchorIdx).toBeGreaterThan(-1)
    const effectStart = MODAL.lastIndexOf('useEffect(() => {', anchorIdx)
    const effectEnd = MODAL.indexOf('}, [sopId])', anchorIdx) + '}, [sopId])'.length
    expect(effectStart).toBeGreaterThan(-1)
    expect(effectEnd).toBeGreaterThan(effectStart)
    const effectSlice = MODAL.slice(effectStart, effectEnd)
    expect(effectSlice).toContain('setAssessorStatus(null)')
    expect(effectSlice).toContain('setRequestSent(false)')
    expect(effectSlice).toContain('setOverrideOpen(false)')
  })
})

test.describe('WR-04 -- server override demand opens the override sheet', () => {
  test('the ASSESSOR_OVERRIDE_REQUIRED branch inside handleApprove calls setOverrideSheetOpen(true)', () => {
    // Scoped to the occurrence of ASSESSOR_OVERRIDE_REQUIRED inside
    // handleApprove specifically -- a file-global search would also match
    // the mapSignOffError copy-mapping branch (a different, unrelated
    // occurrence of the same string), and setOverrideSheetOpen(true) exists
    // elsewhere in the file (handleApproveClick's pre-emptive open) even on
    // the broken pre-fix version. The 2026-06-05 dead-feature trap in
    // miniature: presence anywhere in the file proves nothing about whether
    // THIS branch is wired.
    const fnIdx = CLIENT.indexOf('async function handleApprove')
    expect(fnIdx).toBeGreaterThan(-1)
    const errorIdx = CLIENT.indexOf('ASSESSOR_OVERRIDE_REQUIRED', fnIdx)
    expect(errorIdx).toBeGreaterThan(-1)
    const window = CLIENT.slice(errorIdx, errorIdx + 400)
    expect(window).toContain('setOverrideSheetOpen(true)')
  })
})
