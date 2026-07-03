/**
 * Phase 26 Plan 26-12 Task 3 — P8 publish-gate regression (behavioural, server KEEP).
 *
 * The bespoke canvas re-implements the per-block verify chip, but the server
 * route `POST /api/sops/[sopId]/publish` remains the authoritative gate. This
 * spec exercises the REAL route handler (Supabase + auto-queue mocked) and
 * asserts: one unverified block → 400 `unverified_blocks` {count}; all verified
 * → 200 success. Proof runs in `scripts/verify-gate-check.tsx`. Behavioural, NOT
 * a source grep (extends the Wave-4 publish-gate contract with a real invocation).
 */
import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const HARNESS = path.join('scripts', 'verify-gate-check.tsx')

test.describe('P8 publish-gate — unverified → 400, all-verified → 200 (behavioural)', () => {
  test('real publish route rejects unverified blocks and passes when all verified', () => {
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
