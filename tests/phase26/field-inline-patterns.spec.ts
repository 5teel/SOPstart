/**
 * Phase 26 Plan 26-06 Task 2 — A/B/D inline field editors (P14, behavioural).
 *
 * Proves the three inline patterns EDIT + PERSIST through the real commit path
 * AND that BlockEditShell mounts a control per FIELD_MAP entry (reachability
 * wiring, not a grep). The proof runs in `scripts/field-patterns-check.tsx`; we
 * shell out because Playwright's JSX transform can't render real react-dom/server
 * and the phase26 project can't resolve `@/` + React/CSS in-process.
 */
import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const HARNESS = path.join('scripts', 'field-patterns-check.tsx')

test.describe('field-inline-patterns — A/B/D edit + persist (P14)', () => {
  test('enum cycles, token writes number/string (invalid kept), dual A persists; shell mounts controls', () => {
    let out = ''
    try {
      out = execFileSync('npx', ['tsx', HARNESS], { cwd: ROOT, encoding: 'utf8', shell: true })
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string }
      throw new Error(`field-patterns harness failed:\n${e.stdout ?? ''}\n${e.stderr ?? ''}`)
    }
    expect(out).toContain('FIELD-PATTERNS OK')
  })
})
