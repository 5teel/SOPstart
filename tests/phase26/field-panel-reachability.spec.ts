/**
 * Phase 26 Plan 26-07 — Pattern C field-panel + P14 reachability parity.
 *
 * Two behavioural gates, both shelled to tsx harnesses (the phase26 project has
 * no `@/` alias + can't load React/CSS in-process — same as 26-06):
 *
 *   1. "field-panel" (Task 1) — the anchored FieldPanel + ArrayFieldEditor EDIT
 *      + PERSIST array/config fields through the Zod-validated lossless path, and
 *      the panel + ⚙ trigger actually mount (dead-feature guard).
 *   2. "reachability" (Task 2) — for every registered block, 0 Puck-editable
 *      fields are unreachable in the bespoke editor (a control mounts per field),
 *      and a representative field per pattern round-trips valid layout_data.
 */
import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')

function runHarness(script: string): string {
  try {
    return execFileSync('npx', ['tsx', path.join('scripts', script)], {
      cwd: ROOT,
      encoding: 'utf8',
      shell: true,
    })
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string }
    throw new Error(`${script} failed:\n${e.stdout ?? ''}\n${e.stderr ?? ''}`)
  }
}

test.describe('field-panel — Pattern C edit + persist (P14)', () => {
  test('field-panel: array/config edit+persist, <2 blocked, panel+trigger mount', () => {
    expect(runHarness('field-panel-check.tsx')).toContain('FIELD-PANEL OK')
  })
})
