/**
 * Phase 26 Plan 26-12 Task 1 — P12 selection-sync RE-WIRE (behavioural parity).
 *
 * Proves canvas↔source selection-sync was re-earned off Puck's `componentOverlay`:
 * a block selection fires `setActiveProvenance(region, junctionId)` (spy), and a
 * source-region click resolves back to the matching `[data-block-id]` block. The
 * proof runs in `scripts/selection-sync-check.tsx`; we shell out because the
 * phase26 project can't resolve `@/` + real react-dom/server in-process (same as
 * the 26-04 autosave-rewire + render-parity harnesses). NOT a grep for
 * `setActiveProvenance`.
 */
import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const HARNESS = path.join('scripts', 'selection-sync-check.tsx')

test.describe('P12 selection-sync re-wire — canvas ↔ source (behavioural)', () => {
  test('block select fires setActiveProvenance(region, junctionId); source click resolves to [data-block-id]', () => {
    let out = ''
    try {
      out = execFileSync('npx', ['tsx', HARNESS], { cwd: ROOT, encoding: 'utf8', shell: true })
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string }
      throw new Error(`selection-sync harness failed:\n${e.stdout ?? ''}\n${e.stderr ?? ''}`)
    }
    expect(out).toContain('SELECTION-SYNC OK')
  })
})
