/**
 * Phase 35 -- CMP-04 locked north star: competency state NEVER gates worker
 * read/walkthrough access. Forked from tests/phase28/library-and-worker.spec.ts
 * (the D28-07 review_due_at/owner_user_id guard) -- same GATE_PATTERN idiom,
 * swapped to the competency_state/competencyState field names.
 *
 * Targets THREE worker-facing files:
 *   - ReadTab.tsx (worker SOP read surface)
 *   - the worker SOP detail/walkthrough route page.tsx
 *   - src/components/profile/CompetencySection.tsx (not yet created --
 *     lands in plan 35-04; guarded with fs.existsSync + test.skip so Wave 1
 *     stays green, and the assertion self-activates the moment 35-04
 *     creates the file, mirroring the phase22 fs.existsSync green-when-
 *     absent precedent, CLAUDE.md 2026-06-24).
 *
 * Registration: playwright.config.ts `phase35` project
 *   testDir: '.', testMatch: /tests\/phase35\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase35`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const READ_TAB = path.join(ROOT, 'src', 'components', 'sop', 'tabs', 'ReadTab.tsx')
const WORKER_SOP_DETAIL = path.join(ROOT, 'src', 'app', '(protected)', 'sops', '[sopId]', 'page.tsx')
const PROFILE_COMPETENCY_SECTION = path.join(ROOT, 'src', 'components', 'profile', 'CompetencySection.tsx')

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

// A competency-state gating branch: any comparison/if-branch inspecting
// competency_state or competencyState that could alter worker-facing
// control flow. A bare mention in a documentation comment is fine.
const GATE_PATTERN = /competency_state\s*[<>=!]|competencyState\s*[<>=!]|if\s*\([^)]*(competency_state|competencyState)/

test.describe('GATE_PATTERN self-check -- proves the regex is live, not inert', () => {
  test('matches a competencyState comparison/if-branch', () => {
    expect("if (competencyState === 'read')").toMatch(GATE_PATTERN)
  })
})

test.describe('CMP-04 -- competency state never gates worker access', () => {
  test('ReadTab.tsx contains NO competency_state conditional/gate anywhere', () => {
    expect(read(READ_TAB)).not.toMatch(GATE_PATTERN)
  })

  test('worker SOP detail / walkthrough route contains no competency_state gate', () => {
    expect(read(WORKER_SOP_DETAIL)).not.toMatch(GATE_PATTERN)
  })

  test('worker /profile competency section contains no gate -- informational only', () => {
    test.skip(!fs.existsSync(PROFILE_COMPETENCY_SECTION), 'CompetencySection.tsx not yet created (lands in plan 35-04)')
    expect(read(PROFILE_COMPETENCY_SECTION)).not.toMatch(GATE_PATTERN)
  })
})
