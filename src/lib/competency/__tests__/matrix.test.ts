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
    { id: 'sop-a', title: 'SOP A', sopNumber: 'A-1' },
    { id: 'sop-b', title: 'SOP B', sopNumber: 'B-1' },
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
})
