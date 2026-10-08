/**
 * Phase 37 -- ASR-01 / CMP-04 locked north star (D28-07 precedent): the
 * assessor gate is a SUPERVISOR/ADMIN-facing write-path concern (who may
 * record an advancing observation or sign-off) -- it must NEVER reach a
 * worker-facing read/walkthrough surface, and the competency ladder
 * (classify.ts) must stay assessor-unaware so the ladder can never invert
 * into a worker gate.
 *
 * LIVE FROM WAVE 0 -- this is the locked north star from 37-CONTEXT domain;
 * it runs and passes now, before any assessor-governance production code
 * exists, and stays live through the rest of the phase as a regression net.
 *
 * Six forbidden tokens (the whole assessor-governance vocabulary):
 *   isSignedOffAssessor, is_assessor_override, override_reason,
 *   NOT_SIGNED_OFF_ASSESSOR, ASSESSOR_OVERRIDE_REQUIRED, assessment_requested
 *
 * Each target file gets a per-file fs.existsSync + test.skip guard (green-
 * when-absent, CLAUDE.md 2026-06-24 idiom) so this spec is discoverable and
 * passing from the very first commit of the phase. Each forbidden token gets
 * its OWN expect(...).not.toContain(...) assertion so a failure names the
 * exact token that leaked into a worker surface, not just "gate found".
 *
 * Registration: playwright.config.ts `phase37` project
 *   testDir: '.', testMatch: /tests\/phase37\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase37`
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

const WORKER_SOP_DETAIL = path.join(ROOT, 'src', 'app', '(protected)', 'sops', '[sopId]', 'page.tsx')
// 58-15: the worker's read/walk surface is the focus screen (the tabbed read page is gone).
const FOCUS = (f: string) => path.join(ROOT, 'src', 'components', 'focus', f)
const FOCUS_WORKER_FILES = [
  'FocusFrame.tsx', 'FocusTopBar.tsx', 'FocusRail.tsx', 'BrowseDocument.tsx', 'FocusWalker.tsx',
  'WalkStep.tsx', 'ReviewAndSend.tsx', 'SentPanel.tsx', 'ResumeCard.tsx', 'KindChip.tsx',
].map(FOCUS)
const WALK_HOOK = path.join(ROOT, 'src', 'hooks', 'useWalk.ts')
const WALK_ACTIONS = path.join(ROOT, 'src', 'actions', 'walk.ts')
// 63-19: the worker surfaces are the home (list, row, Read); the plant stage and machine body are gone.
const HOME = (f: string) => path.join(ROOT, 'src', 'components', 'home', f)
const PROFILE_COMPETENCY_SECTION = path.join(ROOT, 'src', 'components', 'profile', 'CompetencySection.tsx')
const CLASSIFY = path.join(ROOT, 'src', 'lib', 'competency', 'classify.ts')

const TARGETS: Array<{ label: string; file: string }> = [
  { label: 'worker SOP detail / walkthrough route page.tsx', file: WORKER_SOP_DETAIL },
  ...FOCUS_WORKER_FILES.map((file) => ({ label: `focus/${path.basename(file)}`, file })),
  { label: 'useWalk.ts (the walk hook)', file: WALK_HOOK },
  { label: 'walk.ts (walk server actions)', file: WALK_ACTIONS },
  { label: 'HomeShell.tsx (63-11: replaced the one screen)', file: HOME('HomeShell.tsx') },
  { label: 'SopList.tsx (the home list)', file: HOME('SopList.tsx') },
  { label: 'SopRow.tsx (a list row and its status)', file: HOME('SopRow.tsx') },
  { label: 'ReadView.tsx (Read)', file: HOME('ReadView.tsx') },
  { label: 'profile CompetencySection.tsx (informational only)', file: PROFILE_COMPETENCY_SECTION },
  { label: 'classify.ts (competency ladder -- must stay assessor-unaware)', file: CLASSIFY },
  { label: 'useLibrary.ts (the list read; 63-20: the old worker list hook is gone)', file: path.join(ROOT, 'src', 'hooks', 'useLibrary.ts') },
]

const FORBIDDEN_TOKENS = [
  'isSignedOffAssessor',
  'is_assessor_override',
  'override_reason',
  'NOT_SIGNED_OFF_ASSESSOR',
  'ASSESSOR_OVERRIDE_REQUIRED',
  'assessment_requested',
]

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n')
}

test.describe('ASR-01 / CMP-04 -- assessor gate never reaches a worker surface', () => {
  for (const { label, file } of TARGETS) {
    for (const token of FORBIDDEN_TOKENS) {
      test(`${label} contains NO "${token}"`, () => {
        test.skip(!fs.existsSync(file), `${file} does not exist yet`)
        expect(read(file)).not.toContain(token)
      })
    }
  }
})
