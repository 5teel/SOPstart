/**
 * Phase 26 Plan 26-06 Task 1 — field-map reachability parity (P14).
 *
 * The hard SPEC rule: no field editable under the old Puck config may become
 * unreachable. For every registered block, the FIELD_MAP field set MUST equal
 * the frozen Puck `fields:` key set — no field dropped, none invented.
 *
 * Plan 26-14 removed Puck (`puck-config.tsx` deleted). The frozen field baseline
 * was snapshotted from the last live puck-config into
 * `fixtures/puck-field-baseline.json` (captured with the SAME indent parser this
 * spec used to read the live source), so the 0-unreachable guarantee still holds
 * against the exact pre-removal contract. Regenerate ONLY if the P14 field
 * surface legitimately changes.
 *
 * Pure in-process test: FIELD_MAP is a React-free data module, imported via the
 * relative path the phase26 project requires (no `@/` alias resolution).
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { FIELD_MAP } from '../../src/components/admin/builder-v2/fields/field-map'

const BASELINE = JSON.parse(
  readFileSync(path.resolve(__dirname, 'fixtures', 'puck-field-baseline.json'), 'utf8'),
) as { components: string[]; fields: Record<string, string[]> }

/** Frozen Puck field-key set for one block (snapshot of the deleted puck-config). */
function puckFieldKeys(blockName: string): string[] {
  const keys = BASELINE.fields[blockName]
  if (!keys) throw new Error(`block ${blockName} not found in puck-field-baseline`)
  return keys
}

/** All Puck-configured component keys (frozen baseline; VisualBlock is bespoke). */
function puckComponentKeys(): string[] {
  return BASELINE.components
}

test.describe('field-map — reachability parity with puck-config fields (P14)', () => {
  // VisualBlock (26-09, R5) is a BESPOKE block with no puck-config entry — Puck is
  // being removed, so a new block never had a Puck field set to be parity-checked.
  const BESPOKE = new Set(['VisualBlock'])

  test('FIELD_MAP covers exactly the registered block types', () => {
    const fieldMapTypes = Object.keys(FIELD_MAP).sort()
    const puckTypes = puckComponentKeys().sort()
    // Every Puck-configured block is still mapped (no legacy field dropped)…
    expect(fieldMapTypes.filter((t) => !BESPOKE.has(t))).toEqual(puckTypes)
    // …plus the bespoke VisualBlock → 18 authorable blocks total (26-09).
    expect(fieldMapTypes.length).toBe(18)
  })

  for (const blockName of Object.keys(FIELD_MAP)) {
    if (BESPOKE.has(blockName)) continue // no puck-config to compare against
    test(`${blockName}: FIELD_MAP field set === puck-config fields (0 unreachable)`, () => {
      const mapped = FIELD_MAP[blockName as keyof typeof FIELD_MAP].map((f) => f.field).sort()
      const puck = puckFieldKeys(blockName).sort()
      expect(mapped).toEqual(puck)
    })
  }

  test('every field routes to a known pattern; B has options, D declares numeric', () => {
    for (const specs of Object.values(FIELD_MAP)) {
      for (const s of specs) {
        expect(['A', 'B', 'C', 'D', 'E']).toContain(s.pattern)
        if (s.pattern === 'B') expect(s.options && s.options.length).toBeGreaterThan(0)
        if (s.pattern === 'D') expect(typeof s.numeric).toBe('boolean')
      }
    }
  })
})
