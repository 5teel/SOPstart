/**
 * Phase 26 Plan 26-06 Task 1 — field-map reachability parity (P14).
 *
 * The hard SPEC rule: no field editable under Puck may become unreachable. This
 * proves it structurally against the LIVE `src/lib/builder/puck-config.tsx`
 * source: for every registered block, the FIELD_MAP field set MUST equal the
 * Puck `fields:` key set — no field dropped, none invented. Reading the real
 * source (not a transcribed literal) makes this drift-proof (CLAUDE.md
 * 2026-05-25 / 2026-06-05: a test must exercise the real contract, not a copy).
 *
 * Pure in-process test: FIELD_MAP is a React-free data module, imported via the
 * relative path the phase26 project requires (no `@/` alias resolution).
 */
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { FIELD_MAP } from '../../src/components/admin/builder-v2/fields/field-map'

const PUCK_CONFIG = readFileSync(
  path.resolve(__dirname, '..', '..', 'src', 'lib', 'builder', 'puck-config.tsx'),
  'utf8'
)
const LINES = PUCK_CONFIG.split(/\r?\n/)

/**
 * Extract the direct field-key set for one block from puck-config text.
 * Component keys sit at 4-space indent (`    TextBlock: {`), the `fields:` object
 * at 6-space, and each direct field key at 8-space (`        content:`). Nested
 * arrayFields/options live at ≥10-space and are correctly excluded. The fields
 * object closes at the first 6-space `},`.
 */
function puckFieldKeys(blockName: string): string[] {
  const start = LINES.findIndex((l) => l === `    ${blockName}: {`)
  if (start < 0) throw new Error(`block ${blockName} not found in puck-config`)
  const fieldsOpen = LINES.findIndex((l, i) => i > start && l === '      fields: {')
  if (fieldsOpen < 0) throw new Error(`no fields: block for ${blockName}`)
  const keys: string[] = []
  for (let i = fieldsOpen + 1; i < LINES.length; i++) {
    if (LINES[i] === '      },') break // fields object close (6-space)
    const m = /^ {8}(\w+):/.exec(LINES[i])
    if (m) keys.push(m[1])
  }
  return keys
}

/** All component keys declared in puck-config (excluding the non-authorable fallback). */
function puckComponentKeys(): string[] {
  // Scope to the `components: {` object so the root config's own 4-space
  // `fields: {` (and any other 4-space key outside components) is excluded.
  const start = LINES.findIndex((l) => l === '  components: {')
  const end = LINES.findIndex((l, i) => i > start && l === '  },')
  return LINES.slice(start + 1, end < 0 ? undefined : end)
    .map((l) => /^ {4}(\w+): \{$/.exec(l)?.[1])
    .filter((k): k is string => Boolean(k) && k !== 'UnsupportedBlockPlaceholder')
}

test.describe('field-map — reachability parity with puck-config fields (P14)', () => {
  test('FIELD_MAP covers exactly the registered block types', () => {
    const fieldMapTypes = Object.keys(FIELD_MAP).sort()
    const puckTypes = puckComponentKeys().sort()
    expect(fieldMapTypes).toEqual(puckTypes)
    // Frozen registry is 17 authorable blocks (VisualBlock lands in a later wave).
    expect(fieldMapTypes.length).toBe(17)
  })

  for (const blockName of Object.keys(FIELD_MAP)) {
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
