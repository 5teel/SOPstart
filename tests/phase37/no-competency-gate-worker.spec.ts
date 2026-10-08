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
// 57-08: the worker list page and library card are gone; the worker surfaces are the shell + plant files.
const SHELL = (f: string) => path.join(ROOT, 'src', 'components', 'shell', f)
const PLANT = (f: string) => path.join(ROOT, 'src', 'components', 'sop', 'plant', f)
const PROFILE_COMPETENCY_SECTION = path.join(ROOT, 'src', 'components', 'profile', 'CompetencySection.tsx')
const CLASSIFY = path.join(ROOT, 'src', 'lib', 'competency', 'classify.ts')
// Phase 53-02: the worker list derivation moved out of page.tsx into this hook.
const WORKER_SOPS_HOOK = path.join(ROOT, 'src', 'hooks', 'useWorkerSops.ts')

const TARGETS: Array<{ label: string; file: string }> = [
  { label: 'worker SOP detail / walkthrough route page.tsx', file: WORKER_SOP_DETAIL },
  ...FOCUS_WORKER_FILES.map((file) => ({ label: `focus/${path.basename(file)}`, file })),
  { label: 'useWalk.ts (the walk hook)', file: WALK_HOOK },
  { label: 'walk.ts (walk server actions)', file: WALK_ACTIONS },
  { label: 'WorkerShell.tsx (worker one screen)', file: SHELL('WorkerShell.tsx') },
  { label: 'HomeShell.tsx (63-11: replaced OneScreen)', file: path.join(process.cwd(), 'src', 'components', 'home', 'HomeShell.tsx') },
  { label: 'RoomBodies.tsx', file: SHELL('RoomBodies.tsx') },
  { label: 'SiteSummary.tsx', file: SHELL('SiteSummary.tsx') },
  { label: 'MachinePanel.tsx (machine body)', file: PLANT('MachinePanel.tsx') },
  { label: 'NowCard.tsx', file: PLANT('NowCard.tsx') },
  { label: 'profile CompetencySection.tsx (informational only)', file: PROFILE_COMPETENCY_SECTION },
  { label: 'classify.ts (competency ladder -- must stay assessor-unaware)', file: CLASSIFY },
  { label: 'useWorkerSops.ts (worker list derivation)', file: WORKER_SOPS_HOOK },
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
