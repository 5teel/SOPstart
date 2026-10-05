/**
 * Phase 58 -- FOC-03 / FOC-04 walk order, reachability, review gaps, labels
 * (58-02 Task 1). Unit spec over src/lib/sop/focus.ts, static `@/` imports.
 * Registration: playwright.config.ts `phase58` project.
 */
import { test, expect } from '@playwright/test'
import {
  walkOrder,
  currentIndex,
  isReachable,
  reviewMissing,
  kindLabel,
  primaryLabel,
  railNumber,
  hashInput,
  type FocusStepLike,
  type FocusKind,
} from '@/lib/sop/focus'

const sec = (id: string, title: string, sort_order: number) => ({ id, title, sort_order })
const st = (id: string, section_id: string, kind: FocusKind, sort_order: number, photo_required = false): FocusStepLike => ({
  id,
  section_id,
  kind,
  text: `text ${id}`,
  photo_required,
  sort_order,
})

const sections = [sec('A', 'Mirror Cleaning', 0), sec('B', 'Shutdown', 1)]
const steps = [st('s1', 'A', 'step', 0), st('h1', 'A', 'hazard', 1), st('p1', 'B', 'ppe', 0), st('c1', 'B', 'check', 1)]

test.describe('FOC-03 walk order', () => {
  test('hazard and PPE first, then every section in sequence; index is 1-based', () => {
    const order = walkOrder(sections, steps)
    expect(order.map((e) => e.step.id)).toEqual(['h1', 'p1', 's1', 'c1'])
    expect(order.map((e) => e.index)).toEqual([1, 2, 3, 4])
    expect(order.map((e) => e.groupLabel)).toEqual(['Before you start', 'Before you start', 'Mirror Cleaning', 'Shutdown'])
  })

  test('no hazard/PPE keeps section then sort order; equal sort_order falls back to id', () => {
    const plain = [st('b', 'A', 'step', 0), st('a', 'A', 'step', 0), st('z', 'B', 'step', 0)]
    expect(walkOrder([sections[1], sections[0]], plain).map((e) => e.step.id)).toEqual(['a', 'b', 'z'])
  })

  test('railNumber counts within the section, never from step_number', () => {
    const order = walkOrder(sections, steps)
    const h1 = order.find((e) => e.step.id === 'h1')!
    expect(railNumber(h1)).toBe('Mirror Cleaning · 2')
    expect(railNumber(order.find((e) => e.step.id === 'c1')!)).toBe('Shutdown · 2')
  })

  test('hashInput is the id/kind/text list in walk order', () => {
    expect(JSON.parse(hashInput(walkOrder(sections, steps)))[0]).toEqual({ id: 'h1', kind: 'hazard', text: 'text h1' })
  })
})

test.describe('FOC-04 reachability', () => {
  const order = walkOrder(sections, steps) // h1 p1 s1 c1

  test('default: done steps and the first not-done step only', () => {
    const done = new Set(['h1'])
    expect(currentIndex(order, done)).toBe(1)
    expect(['h1', 'p1', 's1', 'c1'].map((id) => isReachable(order, id, done))).toEqual([true, true, false, false])
  })

  test('jump ahead: every step reachable; unknown ids never', () => {
    expect(['h1', 'p1', 's1', 'c1'].every((id) => isReachable(order, id, new Set(), true))).toBe(true)
    expect(isReachable(order, 'nope', new Set(), true)).toBe(false)
  })
})

test.describe('review gaps', () => {
  test('an unacknowledged hazard and a missing required photo are both listed with walk indexes', () => {
    const s = [st('h1', 'A', 'hazard', 0), ...Array.from({ length: 7 }, (_, i) => st(`x${i}`, 'A', 'step', i + 1)), st('ph', 'A', 'step', 9, true)]
    const order = walkOrder([sec('A', 'A', 0)], s)
    const missing = reviewMissing(order, { acked: new Set(), photos: new Set() })
    expect(missing.map((m) => m.text)).toEqual(['acknowledge the hazard on step 1', 'take the photo on step 9'])
  })

  test('nothing missing -> []', () => {
    const order = walkOrder([sec('A', 'A', 0)], [st('h1', 'A', 'hazard', 0), st('ph', 'A', 'step', 1, true)])
    expect(reviewMissing(order, { acked: new Set(['h1']), photos: new Set(['ph']) })).toEqual([])
  })
})

test.describe('labels', () => {
  test('primary label per kind, and the last step always reviews', () => {
    expect(primaryLabel('hazard', false)).toBe('I understand — continue')
    expect(primaryLabel('ppe', false)).toBe("I'm wearing it — continue")
    expect(primaryLabel('step', false)).toBe('Done — next step')
    expect(primaryLabel('check', false)).toBe('Confirmed — next step')
    for (const k of ['hazard', 'ppe', 'step', 'check'] as const) expect(primaryLabel(k, true)).toBe('Done — review')
  })

  test('kind labels', () => {
    expect(['hazard', 'ppe', 'step', 'check'].map((k) => kindLabel(k as FocusKind))).toEqual(['Hazard', 'PPE', 'Step', 'Check'])
  })
})
