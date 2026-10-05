/**
 * Phase 26 Plan 26-12 Task 3 — P8 publish-gate regression (behavioural, server KEEP).
 *
 * The bespoke canvas re-implements the per-block verify chip, but the server
 * route `POST /api/sops/[sopId]/publish` remains the authoritative gate. This
 * spec exercises the REAL route handler (Supabase mocked) and
 * asserts: one unticked step → 400 `unverified_steps` {count} (also no_steps and
 * open_findings); all ticked and clear → 200 success. Proof runs in `scripts/verify-gate-check.tsx`. Behavioural, NOT
 * a source grep (extends the Wave-4 publish-gate contract with a real invocation).
 */
import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const HARNESS = path.join('scripts', 'verify-gate-check.tsx')

test.describe('P8 publish-gate — unticked → 400, all-ticked → 200 (behavioural)', () => {
  test('real publish route rejects unticked steps / open findings and passes when all clear', () => {
    let out = ''
    try {
      out = execFileSync('npx', ['tsx', HARNESS], { cwd: ROOT, encoding: 'utf8', shell: true })
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string }
      throw new Error(`verify-gate harness failed:\n${e.stdout ?? ''}\n${e.stderr ?? ''}`)
    }
    expect(out).toContain('VERIFY-GATE OK')
  })
})
