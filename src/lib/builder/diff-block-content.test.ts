/**
 * Phase 13 plan 13-04 — diff-block-content unit tests (Playwright runner).
 *
 * Pure function; no DB, browser, or fixtures required.
 */
import { test, expect } from '@playwright/test'
import { diffBlockContent } from './diff-block-content'
import type { BlockContent } from '@/types/sop'

test('identical hazard contents → changed=false, kindChanged=false', () => {
  const a: BlockContent = { kind: 'hazard', text: 'Hot surface', severity: 'warning' }
  const b: BlockContent = { kind: 'hazard', text: 'Hot surface', severity: 'warning' }
  const diff = diffBlockContent(a, b)
  expect(diff.changed).toBe(false)
  expect(diff.kindChanged).toBe(false)
  // All fields still emitted (modal renders side-by-side)
  expect(diff.fields.find((f) => f.key === 'text')?.oldValue).toBe('Hot surface')
  expect(diff.fields.find((f) => f.key === 'severity')?.newValue).toBe('warning')
})

test('hazard severity change → changed=true with severity field diff', () => {
  const a: BlockContent = { kind: 'hazard', text: 'Hot surface', severity: 'warning' }
  const b: BlockContent = { kind: 'hazard', text: 'Hot surface', severity: 'critical' }
  const diff = diffBlockContent(a, b)
  expect(diff.changed).toBe(true)
  expect(diff.kindChanged).toBe(false)
  const sev = diff.fields.find((f) => f.key === 'severity')
  expect(sev?.oldValue).toBe('warning')
  expect(sev?.newValue).toBe('critical')
})

test('ppe items added → changed=true with items field diff', () => {
  const a: BlockContent = { kind: 'ppe', items: ['Hi-vis vest'] }
  const b: BlockContent = { kind: 'ppe', items: ['Hi-vis vest', 'Steel-cap boots'] }
  const diff = diffBlockContent(a, b)
  expect(diff.changed).toBe(true)
  const items = diff.fields.find((f) => f.key === 'items')
  expect(items?.oldValue).toBe('Hi-vis vest')
  expect(items?.newValue).toBe('Hi-vis vest\nSteel-cap boots')
})

test('kind mismatch → kindChanged=true with __kind__ field', () => {
  const a: BlockContent = { kind: 'hazard', text: 'X', severity: 'warning' }
  const b: BlockContent = { kind: 'ppe', items: ['Y'] }
  const diff = diffBlockContent(a, b)
  expect(diff.kindChanged).toBe(true)
  expect(diff.changed).toBe(true)
  expect(diff.fields).toHaveLength(1)
  expect(diff.fields[0].key).toBe('__kind__')
  expect(diff.fields[0].oldValue).toBe('hazard')
  expect(diff.fields[0].newValue).toBe('ppe')
})

test('step warning/tip optional fields handled when added', () => {
  const a: BlockContent = { kind: 'step', text: 'Tighten bolt' }
  const b: BlockContent = {
    kind: 'step',
    text: 'Tighten bolt',
    warning: 'Watch fingers',
    tip: 'Use 15mm spanner',
  }
  const diff = diffBlockContent(a, b)
  expect(diff.changed).toBe(true)
  const warning = diff.fields.find((f) => f.key === 'warning')
  expect(warning?.oldValue).toBe('')
  expect(warning?.newValue).toBe('Watch fingers')
})
