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
 *   E3  — bespoke render place exists (block-registry BLOCK_COMPONENTS) and the
 *          old puck-config.tsx is GONE (Phase 26 D-01: Puck fully removed, 26-14)
 *   E4  — bespoke inline editing uses contentEditable (InlineText.tsx)
 *   E5  — BuilderTreeRail.tsx exists and imports reorderSections
 *   E6  — BuilderTreeRail.tsx renders 'Reference images' and does NOT leak
 *          'Unanchored figures' as a user-visible text string
 *   E7  — server publish route still contains the unverified_blocks 400 gate
 *          (REGRESSION TRIPWIRE — must stay GREEN)
 *   E3-bespoke — BuilderClient.tsx mounts the bespoke EditableDocument and no
 *          longer imports Puck (@puckeditor/core absent)
 *
 * Updated in Plan 26-14: E3/E4/E3-one-list originally asserted Puck-config
 * internals; Puck is removed, so they now assert the bespoke end-state.
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
// E3: bespoke render place exists and Puck is gone (Phase 26 D-01 / 26-14).
// ---------------------------------------------------------------------------
test('E3: bespoke BLOCK_COMPONENTS render place exists; puck-config.tsx is removed', () => {
  const registry = readSrc('src/lib/builder/block-registry.tsx')
  expect(registry, 'block-registry must export BLOCK_COMPONENTS').toContain(
    'export const BLOCK_COMPONENTS',
  )
  const puckConfig = path.join(REPO_ROOT, 'src/lib/builder/puck-config.tsx')
  expect(fs.existsSync(puckConfig), 'puck-config.tsx must be deleted (Puck removed)').toBe(false)
})

// ---------------------------------------------------------------------------
// E4: bespoke inline editing uses contentEditable (InlineText.tsx).
// ---------------------------------------------------------------------------
test('E4: bespoke InlineText uses contentEditable for in-place text editing', () => {
  const src = readSrc('src/components/admin/builder-v2/InlineText.tsx')
  expect(src, 'InlineText must use contentEditable').toContain('contentEditable')
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
// E3-bespoke: BuilderClient mounts the bespoke EditableDocument and no longer
//     imports Puck (Phase 26 D-01 / 26-14 — Puck fully removed).
// ---------------------------------------------------------------------------
test('E3-bespoke: BuilderClient mounts EditableDocument and does not import Puck', () => {
  const src = readSrc(
    'src/app/(protected)/admin/sops/builder/[sopId]/BuilderClient.tsx',
  )
  expect(src, 'BuilderClient must mount the bespoke EditableDocument').toContain(
    'EditableDocument',
  )
  expect(src, 'BuilderClient must not import Puck').not.toContain('@puckeditor/core')
})
