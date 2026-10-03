/**
 * Phase 52 -- HOM-02. Unit tests for the ONE worker-state classifier module,
 * `src/lib/sop/worker-signal.ts` (2026-09-27: a classification lives in ONE
 * plain module imported by every surface that asks the question).
 *
 * Static @/ imports only (CLAUDE.md 2026-06-24: dynamic import('@/...') fails
 * in Playwright's Node runner outside a testDir-scoped project).
 *
 * Registration: playwright.config.ts `phase52` project
 *   testDir: '.', testMatch: /tests\/phase52\/.*\.(spec|test)\.ts$/
 * Verify: `npx playwright test --list --project=phase52`
 */
import { test, expect } from '@playwright/test'
import {
  plantRelState,
  PLANT_REL_LABEL,
  compareToDoFirst,
  derivePlantPins,
  machineSops,
  pickNowQueue,
  askMatches,
  narrowForAsk,
  type WorkerSop,
  type PlantRel,
} from '@/lib/sop/worker-signal'
import type { SopMachineLink } from '@/lib/validators/site'
import type { WorkerSopRow } from '@/lib/sop/worker-signal'

function sop(id: string, title: string, overrides: Partial<WorkerSop> = {}): WorkerSop {
  return {
    id,
    title,
    categoryLabel: null,
    lastCompletedAt: null,
    isRefresherDue: false,
    isRefresherOverdue: false,
    hasNewerVersion: false,
    isAssigned: true,
    isSelfAssigned: false,
    removalRequested: false,
    raw: {} as WorkerSopRow,
    ...overrides,
  }
}

test.describe('plantRelState', () => {
  test('unassigned -> null', () => {
    expect(plantRelState(sop('a', 'A', { isAssigned: false }))).toBeNull()
  })
  test('isRefresherOverdue -> due', () => {
    expect(
      plantRelState(sop('a', 'A', { lastCompletedAt: '2026-01-01T00:00:00Z', isRefresherOverdue: true }))
    ).toBe('due')
  })
  test('isRefresherDue -> due', () => {
    expect(
      plantRelState(sop('a', 'A', { lastCompletedAt: '2026-01-01T00:00:00Z', isRefresherDue: true }))
    ).toBe('due')
  })
  test('completed + hasNewerVersion -> new', () => {
    expect(
      plantRelState(sop('a', 'A', { lastCompletedAt: '2026-01-01T00:00:00Z', hasNewerVersion: true }))
    ).toBe('new')
  })
  test('due AND new -> due (due wins)', () => {
    expect(
      plantRelState(
        sop('a', 'A', { lastCompletedAt: '2026-01-01T00:00:00Z', isRefresherDue: true, hasNewerVersion: true })
      )
    ).toBe('due')
  })
  test('assigned with lastCompletedAt null -> never', () => {
    expect(plantRelState(sop('a', 'A', { lastCompletedAt: null }))).toBe('never')
  })
  test('assigned, completed, nothing else -> done', () => {
    expect(plantRelState(sop('a', 'A', { lastCompletedAt: '2026-01-01T00:00:00Z' }))).toBe('done')
  })
})

// topSignal (the Phase 41 worker list/detail badge helper) was retired in
// 54-05 alongside SopWorkerBrowser, its only consumer — plantRelState is now
// the sole classifier this module exports (CLAUDE.md 2026-09-27).

test('PLANT_REL_LABEL deep-equals the sketch vocabulary', () => {
  expect(PLANT_REL_LABEL).toEqual({ due: 'Due', new: 'Updated', never: 'Never done', done: 'Done' })
})

test.describe('compareToDoFirst', () => {
  test('sorts done/new/never/due/unassigned into due/never/new/done/unassigned', () => {
    const done = sop('1', 'Zebra', { lastCompletedAt: '2026-01-01T00:00:00Z' })
    const news = sop('2', 'Yak', { lastCompletedAt: '2026-01-01T00:00:00Z', hasNewerVersion: true })
    const never = sop('3', 'Xray', { lastCompletedAt: null })
    const due = sop('4', 'Whiskey', { lastCompletedAt: '2026-01-01T00:00:00Z', isRefresherDue: true })
    const unassigned = sop('5', 'Victor', { isAssigned: false })
    const items = [done, news, never, due, unassigned]
    const rank = (s: WorkerSop): PlantRel | null => plantRelState(s)
    const sorted = [...items].sort((a, b) => compareToDoFirst(a, b))
    expect(sorted.map(rank)).toEqual(['due', 'never', 'new', 'done', null])
  })

  test('equal states order by title (localeCompare)', () => {
    const b = sop('1', 'Banana', { lastCompletedAt: null })
    const a = sop('2', 'Apple', { lastCompletedAt: null })
    const sorted = [b, a].sort((x, y) => compareToDoFirst(x, y))
    expect(sorted.map((s) => s.title)).toEqual(['Apple', 'Banana'])
  })
})

test.describe('derivePlantPins', () => {
  const machines = [{ id: 'A' }, { id: 'B' }]
  const dueSop = sop('due1', 'Due one', { lastCompletedAt: '2026-01-01T00:00:00Z', isRefresherDue: true })
  const neverSop = sop('never1', 'Never one', { lastCompletedAt: null })
  const doneSop = sop('done1', 'Done one', { lastCompletedAt: '2026-01-01T00:00:00Z' })
  const unassignedSop = sop('unassigned1', 'Unassigned one', { isAssigned: false })
  const sopsById = new Map<string, WorkerSop>([
    ['due1', dueSop],
    ['never1', neverSop],
    ['done1', doneSop],
    ['unassigned1', unassignedSop],
  ])
  const links: SopMachineLink[] = [
    { sop_id: 'due1', machine_id: 'A' },
    { sop_id: 'never1', machine_id: 'A' },
    { sop_id: 'done1', machine_id: 'A' },
    { sop_id: 'unassigned1', machine_id: 'A' },
    { sop_id: 'missing-id', machine_id: 'A' },
    { sop_id: 'done1', machine_id: 'B' },
  ]

  test('machine A counts due + never (not done, not unassigned, not a missing id) -> 2', () => {
    const pins = derivePlantPins(machines, links, sopsById)
    expect(pins.get('A')).toBe(2)
  })

  test('machine B linked only to a done SOP gets no entry', () => {
    const pins = derivePlantPins(machines, links, sopsById)
    expect(pins.has('B')).toBe(false)
  })

  test('a to-do SOP linked to two machines counts on both', () => {
    const bothLinks: SopMachineLink[] = [
      { sop_id: 'due1', machine_id: 'A' },
      { sop_id: 'due1', machine_id: 'B' },
    ]
    const pins = derivePlantPins(machines, bothLinks, sopsById)
    expect(pins.get('A')).toBe(1)
    expect(pins.get('B')).toBe(1)
  })
})

test.describe('machineSops', () => {
  test('returns only SOPs present in sopsById, sorted to-do first', () => {
    const dueSop = sop('due1', 'Zulu due', { lastCompletedAt: '2026-01-01T00:00:00Z', isRefresherDue: true })
    const doneSop = sop('done1', 'Alpha done', { lastCompletedAt: '2026-01-01T00:00:00Z' })
    const sopsById = new Map<string, WorkerSop>([
      ['due1', dueSop],
      ['done1', doneSop],
    ])
    const links: SopMachineLink[] = [
      { sop_id: 'due1', machine_id: 'A' },
      { sop_id: 'done1', machine_id: 'A' },
      { sop_id: 'ghost', machine_id: 'A' },
    ]
    const result = machineSops('A', links, sopsById)
    expect(result.map((s) => s.id)).toEqual(['due1', 'done1'])
  })
})

test.describe('pickNowQueue', () => {
  const machineList = [
    { id: 'B', name: 'Beta', department_id: 'd1' },
    { id: 'A', name: 'Alpha', department_id: 'd1' },
  ]
  const departments = [{ id: 'd1', name: 'Forming' }]

  test('orders due -> never -> new, excludes done and unassigned, respects the default limit of 3', () => {
    const due = sop('due1', 'Due one', { lastCompletedAt: '2026-01-01T00:00:00Z', isRefresherDue: true })
    const never = sop('never1', 'Never one', { lastCompletedAt: null })
    const news = sop('new1', 'New one', { lastCompletedAt: '2026-01-01T00:00:00Z', hasNewerVersion: true })
    const done = sop('done1', 'Done one', { lastCompletedAt: '2026-01-01T00:00:00Z' })
    const unassigned = sop('unassigned1', 'Unassigned one', { isAssigned: false })
    const links: SopMachineLink[] = [
      { sop_id: 'due1', machine_id: 'A' },
      { sop_id: 'never1', machine_id: 'A' },
      { sop_id: 'new1', machine_id: 'A' },
      { sop_id: 'done1', machine_id: 'A' },
      { sop_id: 'unassigned1', machine_id: 'A' },
    ]
    const queue = pickNowQueue([due, never, news, done, unassigned], links, machineList, departments)
    expect(queue.map((q) => q.sop.id)).toEqual(['due1', 'never1', 'new1'])
    expect(queue.length).toBeLessThanOrEqual(3)
  })

  test('machine = the SOP\'s first linked machine by name (Alpha before Beta)', () => {
    const due = sop('due1', 'Due one', { lastCompletedAt: '2026-01-01T00:00:00Z', isRefresherDue: true })
    const links: SopMachineLink[] = [
      { sop_id: 'due1', machine_id: 'B' },
      { sop_id: 'due1', machine_id: 'A' },
    ]
    const queue = pickNowQueue([due], links, machineList, departments)
    expect(queue[0].machine?.name).toBe('Alpha')
  })

  test('departmentName resolves from the machine\'s department_id, or null', () => {
    const due = sop('due1', 'Due one', { lastCompletedAt: '2026-01-01T00:00:00Z', isRefresherDue: true })
    const links: SopMachineLink[] = [{ sop_id: 'due1', machine_id: 'A' }]
    const queue = pickNowQueue([due], links, machineList, departments)
    expect(queue[0].departmentName).toBe('Forming')
  })

  test('a to-do SOP with no machine link is included with machine null', () => {
    const due = sop('due1', 'Unlinked due', { lastCompletedAt: '2026-01-01T00:00:00Z', isRefresherDue: true })
    const queue = pickNowQueue([due], [], machineList, departments)
    expect(queue).toHaveLength(1)
    expect(queue[0].machine).toBeNull()
    expect(queue[0].departmentName).toBeNull()
  })

  test('respects a custom limit', () => {
    const items = ['1', '2', '3', '4'].map((id) =>
      sop(id, `Due ${id}`, { lastCompletedAt: '2026-01-01T00:00:00Z', isRefresherDue: true })
    )
    const queue = pickNowQueue(items, [], machineList, departments, 2)
    expect(queue).toHaveLength(2)
  })
})

test.describe('askMatches', () => {
  const machineList = [
    { id: 'A', name: 'EVAL Press' },
    { id: 'B', name: 'EVAL Oven' },
  ]

  test('empty and whitespace-only query -> empty set', () => {
    const sopsById = new Map<string, WorkerSop>()
    expect(askMatches('', machineList, [], sopsById).size).toBe(0)
    expect(askMatches('   ', machineList, [], sopsById).size).toBe(0)
  })

  test('a query matching a machine name matches case-insensitively', () => {
    const sopsById = new Map<string, WorkerSop>()
    const matches = askMatches('press', machineList, [], sopsById)
    expect(matches.has('A')).toBe(true)
    expect(matches.has('B')).toBe(false)
  })

  test('a query matching only a linked SOP title highlights that SOP\'s machine', () => {
    const linkedSop = sop('s1', 'Guard inspection')
    const sopsById = new Map<string, WorkerSop>([['s1', linkedSop]])
    const links: SopMachineLink[] = [{ sop_id: 's1', machine_id: 'B' }]
    const matches = askMatches('guard', machineList, links, sopsById)
    expect(matches.has('B')).toBe(true)
    expect(matches.has('A')).toBe(false)
  })

  test('an unmatched query -> empty set', () => {
    const sopsById = new Map<string, WorkerSop>()
    expect(askMatches('zzz-nothing', machineList, [], sopsById).size).toBe(0)
  })
})

test.describe('narrowForAsk', () => {
  const rows = [sop('1', 'Clean the press'), sop('2', 'Oil the chain')]

  test('blank query -> all rows', () => {
    expect(narrowForAsk('', 'EVAL Press', rows)).toHaveLength(2)
  })

  test('query matching the machine name -> all rows', () => {
    expect(narrowForAsk('press', 'EVAL Press', rows)).toHaveLength(2)
  })

  test('otherwise only rows whose title contains the query', () => {
    const result = narrowForAsk('chain', 'EVAL Press', rows)
    expect(result.map((r) => r.id)).toEqual(['2'])
  })
})
