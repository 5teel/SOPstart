/**
 * Phase 26 Plan 26-02 — R6 convert golden-path regression (pre-phase baseline).
 *
 * `scripts/capture-convert-golden.ts` runs a fixed known-DOCX ParsedSop through
 * the UNCHANGED deterministic convert path and freezes the layout_data +
 * junction rows + block_provenance into `fixtures/convert-golden.json`.
 *
 * This spec re-runs that capture and asserts byte-for-byte equality against the
 * committed fixture. It is GREEN at W0 head (nothing has changed yet). After the
 * Wave 2 bespoke-renderer swap (D-01: layout_data / junction / provenance
 * FROZEN), any drift in the frozen contract makes this fail loudly — that IS the
 * R6 regression guard.
 *
 * Runs under the `phase26` Playwright project (playwright.config.ts).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { buildGoldenSnapshot } from '../../scripts/capture-convert-golden'

const FIXTURE = path.resolve(__dirname, 'fixtures/convert-golden.json')

test.describe('R6 — convert golden-path byte-equivalence (pre-phase baseline)', () => {
  test('layout_data + junctions + provenance match the committed golden fixture', () => {
    const committed = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'))
    expect(buildGoldenSnapshot()).toEqual(committed)
  })

  test('capture is deterministic across repeated runs', () => {
    expect(buildGoldenSnapshot()).toEqual(buildGoldenSnapshot())
  })

  test('fixture covers the full frozen block surface + junction rows', () => {
    const snap = buildGoldenSnapshot()
    const types = snap.sections.flatMap((s) => s.content.map((b) => b.type))
    // Every frozen block family the converter can emit must be represented so a
    // regression in any one path trips the byte-equivalence assertion above.
    for (const expected of [
      'TextBlock',
      'HazardCardBlock',
      'PPECardBlock',
      'StepBlock',
      'StepWithPhotosBlock',
      'CalloutBlock',
      'HeadingBlock',
      'PhotoGridBlock',
    ]) {
      expect(types, `missing ${expected}`).toContain(expected)
    }
    // Non-empty junction baseline with pinned + unverified + provenance.
    const junctions = snap.sections.flatMap((s) => s.junctions)
    expect(junctions.length).toBeGreaterThan(0)
    for (const j of junctions) {
      expect(j.pin_mode).toBe('pinned')
      expect(j.verified).toBe(false)
      expect(j.block_provenance).not.toBeNull()
    }
  })
})
