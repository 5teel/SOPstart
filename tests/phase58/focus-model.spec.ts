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
  tickLabel,
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

const sections = [sec('A', 'Mirror Cleaning', 0), sec('B', 'Shutdown', 1), sec('H', 'Safety', 2)]
const steps = [st('s1', 'A', 'step', 0), st('h1', 'H', 'hazard', 0), st('p1', 'H', 'ppe', 1), st('x1', 'B', 'step', 0), st('c1', 'B', 'check', 1)]

test.describe('FOC-03 walk order', () => {
  test('hazard / PPE-only sections first, then every section in sequence; index is 1-based', () => {
    const order = walkOrder(sections, steps)
    expect(order.map((e) => e.step.id)).toEqual(['h1', 'p1', 's1', 'x1', 'c1'])
    expect(order.map((e) => e.index)).toEqual([1, 2, 3, 4, 5])
    expect(order.map((e) => e.groupLabel)).toEqual(['Before you start', 'Before you start', 'Mirror Cleaning', 'Shutdown', 'Shutdown'])
  })

  test('ADR-0023: a caution inside a section of steps stays before the step it guards', () => {
    const own = [st('k1', 'A', 'hazard', 0), st('k2', 'A', 'step', 1), st('k3', 'A', 'step', 2)]
    const order = walkOrder([sec('A', 'Measure', 0)], own)
    expect(order.map((e) => [e.step.id, e.groupLabel])).toEqual([['k1', 'Measure'], ['k2', 'Measure'], ['k3', 'Measure']])
  })

  test('no hazard/PPE keeps section then sort order; equal sort_order falls back to id', () => {
    const plain = [st('b', 'A', 'step', 0), st('a', 'A', 'step', 0), st('z', 'B', 'step', 0)]
    expect(walkOrder([sections[1], sections[0]], plain).map((e) => e.step.id)).toEqual(['a', 'b', 'z'])
  })

  test('railNumber counts within the section, never from step_number', () => {
    const order = walkOrder(sections, steps)
    const h1 = order.find((e) => e.step.id === 'h1')!
    expect(railNumber(h1)).toBe('Safety · 1')
    expect(railNumber(order.find((e) => e.step.id === 'c1')!)).toBe('Shutdown · 2')
  })

  test('hashInput is the id/kind/text list in walk order', () => {
    expect(JSON.parse(hashInput(walkOrder(sections, steps)))[0]).toEqual({ id: 'h1', kind: 'hazard', text: 'text h1' })
  })
})

test.describe('FOC-04 reachability', () => {
  const order = walkOrder(sections, steps) // h1 p1 s1 x1 c1

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
  test('tick label per kind', () => {
    // ADR-0012: the run checklist's tick names
    expect(tickLabel('hazard')).toBe('I understand the hazard')
    expect(tickLabel('ppe')).toBe("I'm wearing it")
    expect(tickLabel('step')).toBe('Done')
    expect(tickLabel('check')).toBe('Confirmed')
  })

  test('kind labels', () => {
    expect(['hazard', 'ppe', 'step', 'check'].map((k) => kindLabel(k as FocusKind))).toEqual(['Hazard', 'PPE', 'Step', 'Check'])
  })
})
