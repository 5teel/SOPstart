/**
 * Phase 36 -- REF-01 / CMP-04 north star (D28-07 precedent): refresher-due
 * and version-currency state NEVER gate worker read/walkthrough access.
 * Forked from tests/phase35/no-competency-gate.spec.ts -- same GATE_PATTERN
 * idiom, swapped to the Phase 36 derived field names.
 *
 * LIVE from Wave 0 -- all five target files already exist today, so every
 * assertion runs live now and stays live as later plans (36-06..36-08) add
 * chips/badges to these files.
 *
 * IMPORTANT distinction (do NOT "fix" this regex into uselessness): a chip
 * render guard like `{isRefresherDue && <span .../>}` is a JSX conditional
 * RENDER, not a gate, and must NOT match GATE_PATTERN. An `if (isRefresherDue)`
 * branch or a comparison (`isRefresherOverdue === true`, `refresherDueAt <
 * now`, `refresher_interval_months > 0`) IS a gate and MUST match.
 *
 * Registration: playwright.config.ts `phase36` project
 *   testDir: '.', testMatch: /tests\/phase36\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase36`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

const READ_TAB = path.join(ROOT, 'src', 'components', 'sop', 'tabs', 'ReadTab.tsx')
const WORKER_SOP_DETAIL = path.join(ROOT, 'src', 'app', '(protected)', 'sops', '[sopId]', 'page.tsx')
const PROFILE_COMPETENCY_SECTION = path.join(ROOT, 'src', 'components', 'profile', 'CompetencySection.tsx')
const SOP_LIBRARY_CARD = path.join(ROOT, 'src', 'components', 'sop', 'SopLibraryCard.tsx')
const WORKER_SOP_LIBRARY = path.join(ROOT, 'src', 'app', '(protected)', 'sops', 'page.tsx')

const TARGETS: Array<{ label: string; file: string }> = [
  { label: 'ReadTab.tsx (worker SOP read surface)', file: READ_TAB },
  { label: 'worker SOP detail / walkthrough route page.tsx', file: WORKER_SOP_DETAIL },
  { label: 'profile CompetencySection.tsx (informational only)', file: PROFILE_COMPETENCY_SECTION },
  { label: 'SopLibraryCard.tsx', file: SOP_LIBRARY_CARD },
  { label: 'worker SOP library page.tsx', file: WORKER_SOP_LIBRARY },
]

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

// A refresher/version-currency gating branch: any comparison or if-branch
// that inspects the new derived fields and could alter worker-facing
// control flow. A bare JSX render guard (`{x && <...`) does NOT match --
// only an `if (...)` branch or a `[<>=!]` comparison does.
const GATE_FIELDS = 'isOutdatedVersion|refresherDueAt|isRefresherOverdue|isRefresherDue|refresher_interval_months'
const GATE_PATTERN = new RegExp(
  `(${GATE_FIELDS})\\s*[<>=!]|if\\s*\\([^)]*(${GATE_FIELDS})[^)]*\\)`
)

test.describe('GATE_PATTERN self-check -- proves the regex is live, not inert', () => {
  test('matches an if-branch on each gate field', () => {
    expect('if (isRefresherOverdue)').toMatch(GATE_PATTERN)
    expect('if (isOutdatedVersion) return null').toMatch(GATE_PATTERN)
  })

  test('matches a comparison on each gate field', () => {
    expect('refresherDueAt < now').toMatch(GATE_PATTERN)
    expect('refresher_interval_months > 0').toMatch(GATE_PATTERN)
    expect('isRefresherDue === true').toMatch(GATE_PATTERN)
  })

  test('does NOT match a bare JSX render guard', () => {
    expect('{isRefresherDue && <span').not.toMatch(GATE_PATTERN)
  })
})

test.describe('REF-01 / CMP-04 -- refresher and version-currency state never gate worker access', () => {
  for (const { label, file } of TARGETS) {
    test(`${label} contains NO refresher/version-currency conditional gate`, () => {
      test.skip(!fs.existsSync(file), `${file} does not exist yet`)
      expect(read(file)).not.toMatch(GATE_PATTERN)
    })
  }
})
