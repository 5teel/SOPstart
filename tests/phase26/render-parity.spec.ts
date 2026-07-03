/**
 * Phase 26 Plan 26-03 Task 2 — LayoutRenderer render-parity (R2, behavioural).
 *
 * The bespoke Puck-free LayoutRenderer MUST render the SAME block components the
 * worker saw under Puck's <Render>. The proof runs in
 * `scripts/render-parity-check.tsx`, which renders every registered block type
 * through LayoutRenderer + directly (react-dom/server) and asserts the former's
 * markup contains the latter's — plus unknown-type → placeholder and the
 * version / parse-failure fallbacks.
 *
 * We shell out rather than render inline because Playwright's test transform
 * rewrites project JSX to its own element descriptors ({__pw_type…}) that real
 * react-dom/server cannot render; the tsx subprocess uses the genuine React
 * runtime. Exit 0 + "RENDER-PARITY OK" is the behavioural gate.
 */
import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const HARNESS = path.join('scripts', 'render-parity-check.tsx')

test.describe('LayoutRenderer render-parity (R2) — bespoke switch == component render', () => {
  test('every block type renders its registered component; P17 + fallbacks intact', () => {
    let out = ''
    try {
      out = execFileSync('npx', ['tsx', HARNESS], {
        cwd: ROOT,
        encoding: 'utf8',
        shell: true,
      })
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string }
      throw new Error(
        `render-parity harness failed:\n${e.stdout ?? ''}\n${e.stderr ?? ''}`
      )
    }
    expect(out).toContain('RENDER-PARITY OK')
    expect(out).toContain('18 block types')
  })
})
