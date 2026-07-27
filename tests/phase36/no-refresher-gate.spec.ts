/**
 * Phase 36 -- REF-01 / CMP-04 north star (D28-07 precedent): refresher-due
 * and version-currency state NEVER gate worker read/walkthrough access.
 * Forked from tests/phase35/no-competency-gate.spec.ts -- same GATE_PATTERN
 * idiom, swapped to the Phase 36 derived field names.
 *
 * LIVE from Wave 0 -- all five original target files already exist today, so
 * every assertion runs live now and stays live as later plans (36-06..36-08)
 * add chips/badges to these files.
 *
 * Plan 36-10 widened the target list to every Phase 36-touched file that can
 * render to a worker OR influence a worker path -- StatePill.tsx (the shared
 * chip renderer consumed by all three competency surfaces),
 * TrainingRecordSection.tsx (per-worker record panel), and
 * TrainingMatrixView.tsx (a supervisor surface, but the same north star
 * applies: nothing here may disable or lock a worker's underlying access).
 *
 * IMPORTANT distinction (do NOT "fix" this regex into uselessness): a chip
 * render guard like `{isRefresherDue && <span .../>}` is a JSX conditional
 * RENDER, not a gate, and must NOT match GATE_PATTERN. An `if (isRefresherDue)`
 * branch, a comparison (`isRefresherOverdue === true`, `refresherDueAt <
 * now`, `refresher_interval_months > 0`), or a bare ternary branch
 * (`isRefresherOverdue ? lockedView : normalView`) IS a gate and MUST match.
 * Passive SYNTAX must NOT match (WR-06 -- the earlier `[<>=!]` class flagged
 * bare `=`, i.e. plain JSX props and destructuring defaults, which forced
 * spread/`??` workarounds at the call sites; those are now plain syntax
 * again): JSX attribute-passing (`propName={value}`), destructuring/param
 * defaults (`field = false`), optional props (`field?: boolean`), nullish
 * defaults (`field ?? false`), optional chaining (`field?.x`), and label
 * ternaries whose branch is a string literal
 * (`isRefresherOverdue ? 'Refresher overdue' : ...` -- a render-text choice,
 * not control flow; StatePill.tsx relies on this carve-out). Known ceiling:
 * a string-literal ternary feeding className (e.g. 'pointer-events-none')
 * would evade the carve-out -- that class of gate is for human review, not
 * this regex.
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
const STATE_PILL = path.join(ROOT, 'src', 'components', 'admin', 'competency', 'StatePill.tsx')
const TRAINING_RECORD_SECTION = path.join(ROOT, 'src', 'components', 'admin', 'competency', 'TrainingRecordSection.tsx')
const TRAINING_MATRIX_VIEW = path.join(ROOT, 'src', 'components', 'admin', 'competency', 'TrainingMatrixView.tsx')

const TARGETS: Array<{ label: string; file: string }> = [
  { label: 'ReadTab.tsx (worker SOP read surface)', file: READ_TAB },
  { label: 'worker SOP detail / walkthrough route page.tsx', file: WORKER_SOP_DETAIL },
  { label: 'profile CompetencySection.tsx (informational only)', file: PROFILE_COMPETENCY_SECTION },
  { label: 'SopLibraryCard.tsx', file: SOP_LIBRARY_CARD },
  { label: 'worker SOP library page.tsx', file: WORKER_SOP_LIBRARY },
  { label: 'StatePill.tsx (shared chip renderer)', file: STATE_PILL },
  { label: 'TrainingRecordSection.tsx (per-worker record panel)', file: TRAINING_RECORD_SECTION },
  { label: 'TrainingMatrixView.tsx (supervisor matrix surface)', file: TRAINING_MATRIX_VIEW },
]

function read(p: string): string {
  return fs.readFileSync(p, 'utf-8')
}

/** Slice `content` to a window around every occurrence of `label`, joined by
 * a separator -- used to scope the passive-chip check to just the chip's own
 * markup instead of the whole file (so a legitimate, unrelated onClick/
 * disabled= elsewhere in the same file never trips the assertion). */
function sliceAroundOccurrences(content: string, label: string, radius = 250): string {
  const slices: string[] = []
  let idx = content.indexOf(label)
  while (idx !== -1) {
    slices.push(content.slice(Math.max(0, idx - radius), idx + label.length + radius))
    idx = content.indexOf(label, idx + label.length)
  }
  return slices.join('\n---\n')
}

// A refresher/version-currency gating branch: any comparison, bare ternary,
// or if-branch that inspects the new derived fields and could alter
// worker-facing control flow. A bare JSX render guard (`{x && <...`), a
// plain JSX prop / destructuring default (single `=`), optional-prop /
// nullish / optional-chaining syntax (`?:`, `??`, `?.`), and a
// string-literal label ternary do NOT match (see header comment).
const GATE_FIELDS = 'isOutdatedVersion|refresherDueAt|isRefresherOverdue|isRefresherDue|refresher_interval_months'
const GATE_PATTERN = new RegExp(
  `(${GATE_FIELDS})\\s*(===|!==|==|!=|<=?|>=?|\\?(?![?.:]|\\s*['"\`]))|if\\s*\\([^)]*(${GATE_FIELDS})[^)]*\\)`
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

  test('matches a bare ternary gate', () => {
    expect('isRefresherOverdue ? lockedView : normalView').toMatch(GATE_PATTERN)
    expect('return isOutdatedVersion ? null : sop').toMatch(GATE_PATTERN)
  })

  test('does NOT match a bare JSX render guard', () => {
    expect('{isRefresherDue && <span').not.toMatch(GATE_PATTERN)
  })

  test('does NOT match passive syntax: JSX prop, destructuring default, optional prop, nullish default, label ternary', () => {
    expect('isRefresherDue={refresher.isRefresherDue}').not.toMatch(GATE_PATTERN)
    expect('isRefresherDue = false,').not.toMatch(GATE_PATTERN)
    expect('isRefresherDue?: boolean').not.toMatch(GATE_PATTERN)
    expect('isRefresherDue ?? false').not.toMatch(GATE_PATTERN)
    expect("isRefresherOverdue ? 'Refresher overdue' : 'Refresher due'").not.toMatch(GATE_PATTERN)
    expect('isRefresherOverdue ? `Refresher due ${formatNZDate(x)}` : y').not.toMatch(GATE_PATTERN)
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

// ---------------------------------------------------------------------------
// Second, stricter assertion class (Plan 36-10): the chip-DEFINING markup
// itself (StatePill.tsx's two sibling chips, SopLibraryCard.tsx's refresher
// badge) must carry no `disabled=` and no `onClick` anywhere near the chip's
// own label text -- i.e. the chip is passive, not merely un-gated by
// GATE_PATTERN's comparison/if-branch check. Scoped to a window around each
// chip label (sliceAroundOccurrences) rather than the whole file, so the
// matrix's legitimate pre-existing cell-drilldown button (which merely
// RENDERS a <StatePill> inside it) and the versions page's legitimate
// pre-existing Save/Turn-off controls never trip this assertion --
// TrainingMatrixView.tsx and TrainingRecordSection.tsx are deliberately NOT
// in this stricter list; they only ever render <StatePill result={...} />,
// they don't define the chip markup itself.
// ---------------------------------------------------------------------------
const CHIP_DEFINING_TARGETS: Array<{ label: string; file: string; chipLabels: string[] }> = [
  { label: 'StatePill.tsx', file: STATE_PILL, chipLabels: ['Outdated version', 'Refresher overdue', 'Refresher due'] },
  { label: 'SopLibraryCard.tsx', file: SOP_LIBRARY_CARD, chipLabels: ['data-refresher-due-badge'] },
]

test.describe('REF-01 / CMP-04 -- chip markup itself is passive (no disabled=/onClick near the chip label)', () => {
  for (const { label, file, chipLabels } of CHIP_DEFINING_TARGETS) {
    for (const chipLabel of chipLabels) {
      test(`${label} -- "${chipLabel}" chip has no disabled= or onClick nearby`, () => {
        test.skip(!fs.existsSync(file), `${file} does not exist yet`)
        const content = read(file)
        test.skip(!content.includes(chipLabel), `"${chipLabel}" not present in ${file} yet`)
        const window = sliceAroundOccurrences(content, chipLabel)
        expect(window).not.toMatch(/\bdisabled[=>]/)
        expect(window).not.toContain('onClick')
      })
    }
  }
})
