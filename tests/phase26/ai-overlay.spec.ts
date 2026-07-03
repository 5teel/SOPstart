/**
 * Phase 26 Plan 26-12 Task 2 — P13 AI-flag overlay + P9 orphan chip (behavioural).
 *
 * Proves the bespoke re-implementation of Puck's `componentOverlay` review
 * surface: an open-flag block renders the ⚑ header badge + the reused
 * `ReviewerFlagsPanel` (query seeded, real flag row asserted), a clean block
 * renders none, and an "Unanchored figures…" heading renders the Reference-images
 * chip. Proof runs in `scripts/ai-overlay-check.tsx` (tsx subprocess — the
 * phase26 project can't resolve `@/` + real react-dom/server in-process). NOT a
 * grep for `ReviewerFlagsPanel`.
 */
import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const HARNESS = path.join('scripts', 'ai-overlay-check.tsx')

test.describe('P13/P9 AI-flag overlay + orphan chip on the bespoke canvas (behavioural)', () => {
  test('open flag → badge + panel; verified → none; orphan heading → chip', () => {
    let out = ''
    try {
      out = execFileSync('npx', ['tsx', HARNESS], { cwd: ROOT, encoding: 'utf8', shell: true })
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string }
      throw new Error(`ai-overlay harness failed:\n${e.stdout ?? ''}\n${e.stderr ?? ''}`)
    }
    expect(out).toContain('AI-OVERLAY OK')
  })
})
