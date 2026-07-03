/**
 * Phase 26 Plan 26-03 Task 3 — contract-check target guard (RESEARCH Pitfall 1).
 *
 * The prebuild three-place gate (`scripts/contract-check.ts`) must read the LIVE
 * bespoke registry `src/lib/builder/block-registry.tsx`, not the soon-dead
 * `puck-config.tsx`. If it silently points at a stale/dead file the gate passes
 * while checking nothing. This spec asserts:
 *   1. the script's `BLOCK_REGISTRY_FILE` constant resolves to the live
 *      block-registry (and NOT puck-config), by reading the script source, and
 *   2. running the gate exits 0 AND extracts the 17-block set from
 *      BLOCK_COMPONENTS — which only lives in block-registry.tsx, so a stale
 *      target would yield 0 keys and fail. That is the behavioural proof the
 *      gate is really reading the live registry.
 *
 * The script source is read rather than imported: it uses `import.meta.url`
 * (ESM) and Playwright's CJS test transform can't evaluate it. Runs under the
 * broad `phase26` project.
 */
import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const SCRIPT = path.join(ROOT, 'scripts', 'contract-check.ts')
const LIVE_REGISTRY = path.join(ROOT, 'src', 'lib', 'builder', 'block-registry.tsx')

test.describe('contract-check target guard (Pitfall 1)', () => {
  test('gate constant targets the live block-registry.tsx, not the dead puck-config', () => {
    const src = fs.readFileSync(SCRIPT, 'utf8')
    // The place-(1) source constant points at the bespoke registry file.
    expect(src).toMatch(
      /BLOCK_REGISTRY_FILE\s*=\s*path\.join\(\s*ROOT\s*,\s*['"]src\/lib\/builder\/block-registry\.tsx['"]\s*\)/
    )
    // It reads that constant (not a puck-config path) as place (1).
    expect(src).toContain('fs.readFileSync(BLOCK_REGISTRY_FILE')
    expect(src).not.toMatch(/readFileSync\(\s*PUCK_CONFIG/)
    // And the live registry file exists + defines BLOCK_COMPONENTS.
    expect(fs.existsSync(LIVE_REGISTRY)).toBe(true)
    expect(fs.readFileSync(LIVE_REGISTRY, 'utf8')).toContain('export const BLOCK_COMPONENTS')
  })

  test('contract-check runs against the registry and exits 0 (behavioural)', () => {
    let out = ''
    try {
      out = execFileSync('npx', ['tsx', path.join('scripts', 'contract-check.ts')], {
        cwd: ROOT,
        encoding: 'utf8',
        shell: true,
      })
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string }
      throw new Error(`contract-check failed:\n${e.stdout ?? ''}\n${e.stderr ?? ''}`)
    }
    expect(out).toContain('Three-place contract intact')
    // 18 keys extracted from BLOCK_COMPONENTS (26-09 added VisualBlock) — a stale target would yield 0.
    expect(out).toContain('BLOCK_COMPONENTS:   18 blocks')
  })
})
