/**
 * Phase 58 -- every Phase 58 capability row is present in
 * .planning/codebase/CAPABILITY-MATRIX.md (CLAUDE.md Capability Matrix trigger),
 * each naming its guard. Plans 58-04, 58-05, 58-08, 58-09, 58-11 and 58-13 assert
 * in their own specs that the code matches their row.
 * Registration: playwright.config.ts `phase58` project.
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const matrix = fs.readFileSync(path.join(process.cwd(), '.planning/codebase/CAPABILITY-MATRIX.md'), 'utf8').replace(/\r\n/g, '\n')
const row = (label: string) => {
  const line = matrix.split('\n').find((l) => l.startsWith(`| ${label}`))
  expect(line, `matrix row "${label}"`).toBeTruthy()
  return line!
}

const ROWS: Array<[string, string[]]> = [
  ['Phase 58 -- open a SOP to browse or walk', ['resolveFocusTarget', 'not RLS', 'LATEST PUBLISHED']],
  ['Phase 58 -- start, record, resume and start over a walk', ['sop_walks', 'workers_can_view_own_sop_walks', 'dropped in 00072', 'createAdminClient()', 'src/actions/walk.ts']],
  ['Phase 58 -- send a walk for sign-off', ['submitCompletion', 'recordSignature']],
  ['Phase 58 -- edit steps, sections, tips, kinds, photo flag, step images and objective', ['requireSopEditAccess', 'clear_focus_step_tick', 'src/actions/focus-steps.ts']],
  ['Phase 58 -- tick or untick a step, clear an AI finding, run the AI check, publish, start a new version', ['requireAdminContext', 'src/actions/findings.ts', 'src/actions/versions.ts']],
  ['Phase 58 -- Walk / Edit switch visible', ['requireSopEditAccess']],
  ['Phase 58 -- read earlier versions of a SOP', ['listLineageVersions', 'requireAdminContext']],
  ['Phase 58 -- read AI findings', ['admins_can_view_sop_ai_findings', 'requireSopEditAccess']],
]

test.describe('capability matrix rows (Phase 58)', () => {
  for (const [label, guards] of ROWS) {
    test(`row present and names its guard: ${label}`, () => {
      const line = row(label)
      for (const g of guards) expect(line, `"${label}" should mention ${g}`).toContain(g)
    })
  }

  test('a worker draft refusal is stated as page-enforced, not RLS', () => {
    expect(row('Phase 58 -- open a SOP to browse or walk')).toContain('not RLS')
  })

  test('the matrix names the 00071 / 00072 migration objects it relies on', () => {
    expect(matrix).toContain('workers_can_view_own_sop_walks')
    expect(matrix).toContain('00071')
    expect(matrix).toContain('00072')
  })

  test('the walk row states that sop_walks is server-written (review CR-01)', () => {
    const line = row('Phase 58 -- start, record, resume and start over a walk')
    expect(line).toContain('written by the server only')
    expect(line).not.toContain('session-scoped `src/actions/walk.ts`')
  })
})
