/**
 * Phase 26 Plan 26-08 (R3) — the tiered, context-aware inserter.
 *
 * Behavioural proof against the PURE inserter-model (the same functions the
 * `InserterMenu` React shell drives) + the real `content-ops` / `BLOCK_DEFAULTS`
 * wiring — not a grep. Proves the four must-have truths:
 *   1. context differs by section render-family ("Fits here" LANE),
 *   2. keyboard nav (↑↓ highlight, ↵ resolve) + type-to-filter,
 *   3. insert adds a block at the cursor with fresh default props,
 *   4. Reuse is department-scoped (scope → BlockPicker sopCategory).
 *
 * Relative imports (the phase26 project has no `@/` alias — established pattern).
 */
import { test, expect } from '@playwright/test'
import {
  LANE,
  SMART,
  homeRows,
  allRows,
  filterRows,
  moveHighlight,
  reuseSopCategory,
  type InserterRow,
} from '../../src/components/admin/builder-v2/inserter/inserter-model'
import { insertBlock, type LayoutItem } from '../../src/lib/builder/content-ops'
import { BLOCK_DEFAULTS } from '../../src/lib/builder/block-registry'
import { humanizeBlockType } from '../../src/lib/builder/block-type-labels'

const insertTypes = (rows: InserterRow[]) =>
  rows.filter((r): r is Extract<InserterRow, { kind: 'insert' }> => r.kind === 'insert').map((r) => r.type)

test.describe('inserter — context varies by section render-family', () => {
  test('a Hazards section yields a DIFFERENT "Fits here" list than a Steps section', () => {
    const haz = insertTypes(homeRows('hazard', null))
    const steps = insertTypes(homeRows('steps', null))
    expect(haz).not.toEqual(steps)
    // The lists reflect their family: Hazards leads with a Hazard block, Steps with a Step.
    expect(haz).toContain('HazardCardBlock')
    expect(steps).toContain('StepBlock')
    expect(steps).not.toContain('HazardCardBlock')
    // LANE is keyed to every render-family.
    for (const family of ['hazard', 'ppe', 'steps', 'content', 'signoff', 'emergency', 'custom'] as const) {
      expect(LANE[family].length).toBeGreaterThan(0)
    }
  })

  test('the smart row is driven by the block above the cursor', () => {
    // Measurement predicts Decision ("branch on the result").
    const afterMeasure = homeRows('steps', 'MeasurementBlock')
    expect(afterMeasure[0]).toMatchObject({ kind: 'insert', type: 'DecisionBlock', smart: true })
    // A block with no prediction produces no smart row.
    const afterText = homeRows('steps', 'TextBlock')
    expect(afterText.some((r) => r.kind === 'insert' && r.smart)).toBe(false)
    expect(SMART.StepBlock?.type).toBe('MeasurementBlock')
  })
})

test.describe('inserter — keyboard nav + type-to-filter', () => {
  test('↑↓ move the highlight (clamped) and ↵ resolves the highlighted row', () => {
    const rows = homeRows('steps', null, { hasReuse: true })
    // ↓ from 0 → 1, ↑ back to 0, ↑ at top clamps to 0.
    expect(moveHighlight(rows.length, 0, 1)).toBe(1)
    expect(moveHighlight(rows.length, 1, -1)).toBe(0)
    expect(moveHighlight(rows.length, 0, -1)).toBe(0)
    // ↓ at the bottom clamps to the last row.
    expect(moveHighlight(rows.length, rows.length - 1, 1)).toBe(rows.length - 1)
    // The highlighted top row inserts a real block type.
    expect(rows[0]).toMatchObject({ kind: 'insert', type: 'StepBlock' })
  })

  test('type-to-filter narrows to matching labels', () => {
    const rows = allRows()
    const filtered = filterRows(rows, 'haz')
    expect(filtered.length).toBeGreaterThan(0)
    expect(filtered.every((r) => r.label.toLowerCase().includes('haz'))).toBe(true)
    expect(insertTypes(filtered)).toContain('HazardCardBlock')
    // Empty query is a passthrough.
    expect(filterRows(rows, '  ')).toHaveLength(rows.length)
  })
})

test.describe('inserter — insert adds a block with fresh default props', () => {
  test('inserting at the cursor adds one block with a new id + registry defaults', () => {
    const content: LayoutItem[] = [
      { type: 'TextBlock', props: { id: 'a', content: 'intro' } },
      { type: 'StepBlock', props: { id: 'b', number: 1, text: 'do it' } },
    ]
    // Pick the highlighted row from a Steps-section home menu (StepBlock).
    const type = insertTypes(homeRows('steps', null))[0]
    const next = insertBlock(content, type, 0, BLOCK_DEFAULTS[type])

    expect(next).toHaveLength(3)
    // Placed at the cursor (after index 0), before the original block 'b'.
    expect(next[1].type).toBe(type)
    expect(next.map((i) => i.props.id)).toEqual(['a', next[1].props.id, 'b'])
    // Fresh id, not reused.
    expect(next[1].props.id).not.toBe('a')
    expect(typeof next[1].props.id).toBe('string')
    // Carries the registry default props (fresh, editable).
    for (const [k, v] of Object.entries(BLOCK_DEFAULTS[type])) {
      expect(next[1].props[k]).toEqual(v)
    }
    // Original array untouched.
    expect(content).toHaveLength(2)
  })
})

test.describe('inserter — humanised labels only (P16)', () => {
  test('every row label is the humanised block label, never raw PascalCase', () => {
    const rows = [...homeRows('hazard', 'HazardCardBlock', { hasReuse: true, hasAI: true }), ...allRows()]
    for (const row of rows) {
      // No raw internal type name leaks into a label.
      expect(row.label).not.toMatch(/Block$/)
      expect(row.label).not.toMatch(/Grid$/)
      if (row.kind === 'insert') {
        expect(row.label).toBe(humanizeBlockType(row.type))
      }
    }
  })
})

test.describe('inserter — Reuse tier is department-scoped', () => {
  test('scope toggle maps to the BlockPicker sopCategory (dept → tag, all → null)', () => {
    // "This department" narrows the Phase 13 picker to the SOP's category.
    expect(reuseSopCategory('dept', 'area-forming')).toBe('area-forming')
    // "All departments" broadens it (null = no category filter).
    expect(reuseSopCategory('all', 'area-forming')).toBeNull()
    // A SOP with no category stays null under either scope.
    expect(reuseSopCategory('dept', null)).toBeNull()
  })

  test('the Reuse drill row appears only when the host wires it', () => {
    expect(homeRows('steps', null, { hasReuse: true }).some((r) => r.kind === 'nav' && r.page === 'reuse')).toBe(true)
    expect(homeRows('steps', null, { hasReuse: false }).some((r) => r.kind === 'nav' && r.page === 'reuse')).toBe(false)
  })
})
