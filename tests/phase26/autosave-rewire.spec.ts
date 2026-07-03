/**
 * Phase 26 Plan 26-04 Task 2 — P11 autosave RE-WIRE (behavioural parity).
 *
 * The bespoke `<EditableDocument>` replaces `<Puck onChange={handleChange}>`.
 * This asserts, end-to-end, that editing a block's text writes a draftLayouts
 * row (dirty) whose reloaded layout_data renders the edited text through the
 * worker LayoutRenderer — with junctionId + block_provenance preserved. The
 * proof runs in `scripts/autosave-rewire-check.tsx`; we shell out because
 * Playwright's JSX transform is incompatible with real react-dom/server.
 *
 * This is behavioural (the full edit → persist → reload → render loop), NOT a
 * grep for `useBuilderAutosave`.
 */
import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const HARNESS = path.join('scripts', 'autosave-rewire-check.tsx')

test.describe('P11 autosave re-wire — edit → draftLayouts → reload persists', () => {
  test('editing a block persists via the existing autosave path and reloads', () => {
    let out = ''
    try {
      out = execFileSync('npx', ['tsx', HARNESS], { cwd: ROOT, encoding: 'utf8', shell: true })
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string }
      throw new Error(`autosave-rewire harness failed:\n${e.stdout ?? ''}\n${e.stderr ?? ''}`)
    }
    expect(out).toContain('AUTOSAVE-REWIRE OK')
  })
})
