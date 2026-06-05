/**
 * Phase 21.6 (Plan 21.6-01) — builder-edit-stage.spec.ts
 *
 * SOURCE-CONTRACT assertions for the Builder Edit Stage redesign.
 * No chromium runtime required — reads source files from disk.
 *
 * Rationale: live UAT is deferred (CLAUDE.md Railway-only-testing); these
 * source-contract checks serve as the CI gate for the structural invariants
 * defined in Phase 21.6 (E3–E7). Consistent with Phase 15/21/21.5 approach.
 *
 * Assertions:
 *   E3  — puck-config.tsx exports both `components:` and `outline:` null-renderers
 *          returning empty fragments <></> in createPuckOverrides
 *   E4  — puck-config.tsx has contentEditable: true on at least one field
 *   E5  — BuilderTreeRail.tsx exists and imports reorderSections
 *   E6  — BuilderTreeRail.tsx renders 'Reference images' and does NOT leak
 *          'Unanchored figures' as a user-visible text string
 *   E7  — server publish route still contains the unverified_blocks 400 gate
 *          (REGRESSION TRIPWIRE — must stay GREEN through Plans 02–05)
 *   E3-one-list — BuilderClient.tsx suppresses Puck's native sidebars via
 *          leftSideBarVisible: false + rightSideBarVisible: false
 *
 * RED/GREEN expectations at phase head (2026-06-05):
 *   GREEN now: E7 (tripwire — regression guard, no code needed)
 *   RED now:   E3, E4, E5, E6, E3-one-list (production code not yet written;
 *              downstream Plans 02–05 flip these GREEN)
 */

import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const REPO_ROOT = path.resolve(__dirname, '..', '..')

function readSrc(relPath: string): string {
  const full = path.join(REPO_ROOT, relPath)
  if (!fs.existsSync(full)) {
    throw new Error(`SOURCE-CONTRACT: file not found — ${relPath} (at ${full})`)
  }
  return fs.readFileSync(full, 'utf-8')
}

// ---------------------------------------------------------------------------
// E3: puck-config.tsx — createPuckOverrides includes components + outline
//     null-renderers returning empty fragments <></>
//     Fails RED at phase head; passes GREEN after Plan 02.
// ---------------------------------------------------------------------------
test('E3: createPuckOverrides returns components and outline null-renderers', () => {
  const src = readSrc('src/lib/builder/puck-config.tsx')
  expect(src, 'puck-config must have components: () => <></>').toMatch(
    /components:\s*\(\)\s*=>\s*<><\/>/,
  )
  expect(src, 'puck-config must have outline: () => <></>').toMatch(
    /outline:\s*\(\)\s*=>\s*<><\/>/,
  )
})

// ---------------------------------------------------------------------------
// E4: puck-config.tsx — at least one field has contentEditable: true
//     Fails RED at phase head; passes GREEN after Plan 02.
// ---------------------------------------------------------------------------
test('E4: puck-config.tsx has contentEditable: true on text/textarea fields', () => {
  const src = readSrc('src/lib/builder/puck-config.tsx')
  expect(src, 'puck-config must contain contentEditable: true').toMatch(
    /contentEditable:\s*true/,
  )
})

// ---------------------------------------------------------------------------
// E5: BuilderTreeRail.tsx — exists and wires reorderSections
//     Fails RED at phase head; passes GREEN after Plan 03.
// ---------------------------------------------------------------------------
test('E5: BuilderTreeRail.tsx exists and imports reorderSections', () => {
  const src = readSrc('src/components/admin/builder/BuilderTreeRail.tsx')
  expect(src, 'BuilderTreeRail must reference reorderSections').toContain('reorderSections')
})

// ---------------------------------------------------------------------------
// E6: BuilderTreeRail.tsx — renders 'Reference images' display label and does
//     NOT leak 'Unanchored figures' as a user-visible text string outside a
//     startsWith comparison guard.
//     Fails RED at phase head; passes GREEN after Plan 03.
// ---------------------------------------------------------------------------
test('E6: BuilderTreeRail uses "Reference images" label; does not leak "Unanchored figures"', () => {
  const src = readSrc('src/components/admin/builder/BuilderTreeRail.tsx')

  // The substitution label must be present
  expect(src, 'BuilderTreeRail must contain "Reference images"').toContain('Reference images')

  // The raw label must NOT appear in non-comment, non-guard lines
  const lines = src.split(/\r?\n/).filter((l) => {
    const t = l.trim()
    return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
  })
  const rawLeak = lines.filter(
    (l) => l.includes('Unanchored figures') && !l.includes('startsWith'),
  )
  expect(
    rawLeak,
    '"Unanchored figures" must not appear outside a startsWith() comparison guard',
  ).toHaveLength(0)
})

// ---------------------------------------------------------------------------
// E7: publish route unchanged — unverified_blocks gate still present.
//     REGRESSION TRIPWIRE — GREEN now, must stay GREEN through Plans 02–05.
// ---------------------------------------------------------------------------
test('E7: server publish route still contains the unverified_blocks 400 gate', () => {
  const src = readSrc('src/app/api/sops/[sopId]/publish/route.ts')
  expect(src, "publish route must contain 'unverified_blocks' literal").toContain(
    'unverified_blocks',
  )
})

// ---------------------------------------------------------------------------
// E3-one-list: BuilderClient.tsx suppresses Puck's native sidebar panels.
//     Fails RED at phase head; passes GREEN after Plan 05.
// ---------------------------------------------------------------------------
test('E3-one-list: BuilderClient.tsx passes leftSideBarVisible: false and rightSideBarVisible: false to Puck', () => {
  const src = readSrc(
    'src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx',
  )
  expect(
    src,
    'BuilderClient must pass leftSideBarVisible: false to Puck ui prop',
  ).toContain('leftSideBarVisible: false')
  expect(
    src,
    'BuilderClient must pass rightSideBarVisible: false to Puck ui prop',
  ).toContain('rightSideBarVisible: false')
})
