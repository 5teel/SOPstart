import { test, expect } from '@playwright/test'
import { buildMatrix, type BuildMatrixInput } from '@/lib/competency/matrix'

const baseInput: BuildMatrixInput = {
  people: [
    { id: 'p1', displayName: 'p1@example.com' },
    { id: 'p2', displayName: 'p2@example.com' },
  ],
  requiredSopsByPerson: {
    p1: ['sop-a', 'sop-b'],
    p2: ['sop-a'],
  },
  sops: [
    { id: 'sop-a', title: 'SOP A', sopNumber: 'A-1', currentVersion: 2, refresherIntervalMonths: null },
    { id: 'sop-b', title: 'SOP B', sopNumber: 'B-1', currentVersion: 1, refresherIntervalMonths: null },
  ],
  completions: [],
  signOffs: [],
  observations: [],
}

test.describe('buildMatrix', () => {
  test('assembles a cell per (person, requiredSop) pair with not_started default', () => {
    const result = buildMatrix(baseInput)
    expect(result.cells).toHaveLength(3) // p1 x 2 sops + p2 x 1 sop
    expect(result.cells.every(c => c.state === 'not_started')).toBe(true)
  })

  test('completion advances cell state and row/col rollups reflect it', () => {
    const input: BuildMatrixInput = {
      ...baseInput,
      completions: [{ id: 'c1', workerId: 'p1', sopId: 'sop-a', sopVersion: 2, submittedAt: '2026-01-01T00:00:00.000Z' }],
      signOffs: [{ completionId: 'c1', decision: 'approved', createdAt: '2026-01-02T00:00:00.000Z' }],
    }
    const result = buildMatrix(input)
    const cell = result.cells.find(c => c.personId === 'p1' && c.sopId === 'sop-a')
    expect(cell?.state).toBe('competent_signed_off')
    expect(cell?.latestCompletionAt).toBe('2026-01-01T00:00:00.000Z')
    expect(cell?.latestCompletionVersion).toBe(2)

    const rowRollup = result.rowRollups.find(r => r.personId === 'p1')
    expect(rowRollup?.competentCount).toBe(1)
    expect(rowRollup?.total).toBe(2)

    const colRollup = result.colRollups.find(c => c.sopId === 'sop-a')
    expect(colRollup?.signedOffCount).toBe(1)
  })

  test('extra-curricular completion (SOP not required) never appears in cells/rollups (D-10)', () => {
    const input: BuildMatrixInput = {
      ...baseInput,
      completions: [{ id: 'c2', workerId: 'p2', sopId: 'sop-b', sopVersion: 1, submittedAt: '2026-01-01T00:00:00.000Z' }],
    }
    const result = buildMatrix(input)
    // p2 only requires sop-a, so no cell for sop-b should exist for p2
    expect(result.cells.find(c => c.personId === 'p2' && c.sopId === 'sop-b')).toBeUndefined()
    expect(result.cells).toHaveLength(3)
  })

  test('every cell exposes latestCompletionAt/latestCompletionVersion fields (Phase 36 forward-compat)', () => {
    const result = buildMatrix(baseInput)
    for (const cell of result.cells) {
      expect(cell).toHaveProperty('latestCompletionAt')
      expect(cell).toHaveProperty('latestCompletionVersion')
    }
  })

  test('needs_support observation flags the cell and rollups', () => {
    const input: BuildMatrixInput = {
      ...baseInput,
      completions: [{ id: 'c3', workerId: 'p1', sopId: 'sop-a', sopVersion: 1, submittedAt: '2026-01-01T00:00:00.000Z' }],
      observations: [{ observedWorkerId: 'p1', sopId: 'sop-a', verdict: 'needs_support', createdAt: '2026-01-02T00:00:00.000Z' }],
    }
    const result = buildMatrix(input)
    const cell = result.cells.find(c => c.personId === 'p1' && c.sopId === 'sop-a')
    expect(cell?.state).toBe('read')
    expect(cell?.needsSupportFlag).toBe(true)
    const rowRollup = result.rowRollups.find(r => r.personId === 'p1')
    expect(rowRollup?.needsSupportCount).toBe(1)
  })

  // Phase 36 (CMP-03/REF-01/REF-02) ----------------------------------------

  test('CMP-03: outdated-version cell carries isOutdatedVersion true while state/competentCount/signedOffCount are byte-identical to pre-Phase-36 (never demote)', () => {
    const input: BuildMatrixInput = {
      ...baseInput,
      completions: [{ id: 'c1', workerId: 'p1', sopId: 'sop-a', sopVersion: 1, submittedAt: '2026-01-01T00:00:00.000Z' }],
      signOffs: [{ completionId: 'c1', decision: 'approved', createdAt: '2026-01-02T00:00:00.000Z' }],
      nowIso: '2026-02-01T00:00:00.000Z',
    }
    const result = buildMatrix(input)
    const cell = result.cells.find(c => c.personId === 'p1' && c.sopId === 'sop-a')
    // sop-a currentVersion is 2, completion was on version 1 -> outdated
    expect(cell?.isOutdatedVersion).toBe(true)
    // Byte-identical to the pre-Phase-36 expectation: same evidence still yields
    // competent_signed_off — outdated is an ADDITIVE tally, never a demotion.
    expect(cell?.state).toBe('competent_signed_off')

    const rowRollup = result.rowRollups.find(r => r.personId === 'p1')
    expect(rowRollup?.competentCount).toBe(1)
    const colRollup = result.colRollups.find(c => c.sopId === 'sop-a')
    expect(colRollup?.signedOffCount).toBe(1)
  })

  test('current-version cell carries isOutdatedVersion false', () => {
    const input: BuildMatrixInput = {
      ...baseInput,
      completions: [{ id: 'c1', workerId: 'p1', sopId: 'sop-a', sopVersion: 2, submittedAt: '2026-01-01T00:00:00.000Z' }],
    }
    const result = buildMatrix(input)
    const cell = result.cells.find(c => c.personId === 'p1' && c.sopId === 'sop-a')
    expect(cell?.isOutdatedVersion).toBe(false)
  })

  test('no-completion cell: isOutdatedVersion false, refresherDueAt null, isRefresherOverdue false', () => {
    const result = buildMatrix(baseInput)
    const cell = result.cells.find(c => c.personId === 'p1' && c.sopId === 'sop-a')
    expect(cell?.isOutdatedVersion).toBe(false)
    expect(cell?.refresherDueAt).toBeNull()
    expect(cell?.isRefresherOverdue).toBe(false)
  })

  test('D-02: refresher-unset SOP -> refresherDueAt null / isRefresherOverdue false for every cell, 0 rollup tallies', () => {
    const input: BuildMatrixInput = {
      ...baseInput,
      completions: [{ id: 'c1', workerId: 'p1', sopId: 'sop-a', sopVersion: 2, submittedAt: '2020-01-01T00:00:00.000Z' }],
      nowIso: '2026-01-01T00:00:00.000Z',
    }
    const result = buildMatrix(input)
    const cell = result.cells.find(c => c.personId === 'p1' && c.sopId === 'sop-a')
    expect(cell?.refresherDueAt).toBeNull()
    expect(cell?.isRefresherOverdue).toBe(false)
    const rowRollup = result.rowRollups.find(r => r.personId === 'p1')
    expect(rowRollup?.refresherOverdueCount).toBe(0)
    const colRollup = result.colRollups.find(c => c.sopId === 'sop-a')
    expect(colRollup?.refresherOverdueCount).toBe(0)
  })

  test('D-03: refresher-overdue SOP with a completion that was NOT signed off still marks isRefresherOverdue true', () => {
    const input: BuildMatrixInput = {
      ...baseInput,
      sops: [
        { id: 'sop-a', title: 'SOP A', sopNumber: 'A-1', currentVersion: 2, refresherIntervalMonths: 6 },
        { id: 'sop-b', title: 'SOP B', sopNumber: 'B-1', currentVersion: 1, refresherIntervalMonths: null },
      ],
      completions: [{ id: 'c1', workerId: 'p1', sopId: 'sop-a', sopVersion: 2, submittedAt: '2025-01-01T00:00:00.000Z' }],
      signOffs: [],
      nowIso: '2026-01-01T00:00:00.000Z',
    }
    const result = buildMatrix(input)
    const cell = result.cells.find(c => c.personId === 'p1' && c.sopId === 'sop-a')
    expect(cell?.awaitingSignOff).toBe(true)
    expect(cell?.refresherDueAt).not.toBeNull()
    expect(cell?.isRefresherOverdue).toBe(true)

    const rowRollup = result.rowRollups.find(r => r.personId === 'p1')
    expect(rowRollup?.refresherOverdueCount).toBe(1)
    const colRollup = result.colRollups.find(c => c.sopId === 'sop-a')
    expect(colRollup?.refresherOverdueCount).toBe(1)
  })

  test('rollup tallies: outdatedCount counts exactly the cells with isOutdatedVersion true', () => {
    const input: BuildMatrixInput = {
      ...baseInput,
      completions: [
        { id: 'c1', workerId: 'p1', sopId: 'sop-a', sopVersion: 1, submittedAt: '2026-01-01T00:00:00.000Z' }, // outdated (current 2)
        { id: 'c2', workerId: 'p2', sopId: 'sop-a', sopVersion: 2, submittedAt: '2026-01-01T00:00:00.000Z' }, // current
      ],
    }
    const result = buildMatrix(input)
    const rowRollupP1 = result.rowRollups.find(r => r.personId === 'p1')
    const rowRollupP2 = result.rowRollups.find(r => r.personId === 'p2')
    expect(rowRollupP1?.outdatedCount).toBe(1)
    expect(rowRollupP2?.outdatedCount).toBe(0)
    const colRollup = result.colRollups.find(c => c.sopId === 'sop-a')
    expect(colRollup?.outdatedCount).toBe(1)
  })
})
