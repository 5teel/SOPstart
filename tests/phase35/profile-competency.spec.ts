/**
 * Phase 35 Plan 04 -- CompetencySection.tsx source-contract (informational +
 * self-scoped complement to the CMP-04 no-competency-gate guard).
 *
 * Asserts: CompetencySection imports the SELF-scoped getMyCompetencyStates
 * (never getTrainingMatrix/getTrainingRecordForPerson -- a worker must not
 * call an admin read); renders StatePill; carries a trust-framing caption
 * (the "yours to see" style phrase); contains no lock/disabled/gating
 * affordance; and that profile/page.tsx mounts it.
 *
 * Registration: playwright.config.ts `phase35` project
 *   testDir: '.', testMatch: /tests\/phase35\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase35`
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const COMPETENCY_SECTION = path.join(ROOT, 'src', 'components', 'profile', 'CompetencySection.tsx')
const PROFILE_PAGE = path.join(ROOT, 'src', 'app', '(protected)', 'profile', 'page.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

test.describe('CompetencySection -- self-scoped, informational, gate-free', () => {
  const src = read(COMPETENCY_SECTION)

  test('imports the self-scoped getMyCompetencyStates', () => {
    expect(src).toContain("getMyCompetencyStates")
    expect(src).toMatch(/from ['"]@\/actions\/competency['"]/)
  })

  test('never imports the admin reads (getTrainingMatrix / getTrainingRecordForPerson)', () => {
    expect(src).not.toContain('getTrainingMatrix')
    expect(src).not.toContain('getTrainingRecordForPerson')
  })

  test('imports and renders StatePill', () => {
    expect(src).toContain('StatePill')
    expect(src).toMatch(/from ['"]@\/components\/admin\/competency\/StatePill['"]/)
  })

  test('carries a trust-framing caption ("yours to see" style)', () => {
    expect(src).toMatch(/yours\s+to\s+see/i)
  })

  test('contains no lock/disabled/gating affordance or worker-action conditional on competency state (CMP-04)', () => {
    // Strip // line comments first -- a doc comment citing the forbidden
    // phrase as an example (as this file's own header does) is fine; only
    // real worker-facing copy/markup must avoid it.
    const codeOnly = src.replace(/^\s*\/\/.*$/gm, '')
    expect(src).not.toMatch(/disabled=/)
    expect(src).not.toMatch(/isLocked|<Lock\b|lock-icon|locked=/)
    expect(codeOnly).not.toMatch(/(can't|cannot|not able to).{0,20}(yet|until)/i)
    expect(src).not.toMatch(/competency_state\s*[<>=!]|competencyState\s*[<>=!]|if\s*\([^)]*(competency_state|competencyState)/)
  })

  test('profile/page.tsx mounts CompetencySection', () => {
    const page = read(PROFILE_PAGE)
    expect(page).toContain('CompetencySection')
    expect(page).toMatch(/from ['"]@\/components\/profile\/CompetencySection['"]/)
  })
})
