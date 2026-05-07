/**
 * Phase 13 — match-blocks unit tests (Playwright test runner).
 *
 * Pure function tests; do not require browser, DB, or fixtures beyond the
 * literal Block shape. Runs in any project that picks up *.test.ts files.
 */
import { test, expect } from '@playwright/test'
import { scoreBlocks, groupForPicker } from './match-blocks'
import type { Block } from '@/types/sop'

function makeBlock(overrides: Partial<Block>): Block {
  return {
    id: overrides.id ?? 'b-' + Math.random().toString(36).slice(2, 8),
    organisation_id: overrides.organisation_id ?? null,
    kind_slug: overrides.kind_slug ?? 'hazard',
    name: overrides.name ?? 'Test block',
    category: null,
    category_tags: overrides.category_tags ?? [],
    free_text_tags: overrides.free_text_tags ?? [],
    current_version_id: 'v-1',
    archived_at: overrides.archived_at ?? null,
    created_by: null,
    created_at: '2026-05-07T00:00:00Z',
    updated_at: '2026-05-07T00:00:00Z',
  }
}

test('scoreBlocks filters out wrong kind_slug', () => {
  const blocks: Block[] = [
    makeBlock({ id: 'h1', kind_slug: 'hazard', name: 'Hazard A' }),
    makeBlock({ id: 'p1', kind_slug: 'ppe', name: 'PPE A' }),
    makeBlock({ id: 'h2', kind_slug: 'hazard', name: 'Hazard B' }),
  ]
  const result = scoreBlocks(blocks, { kindSlug: 'ppe' })
  expect(result).toHaveLength(1)
  expect(result[0].block.id).toBe('p1')
})

test('exact category_tag match scores 100 or more', () => {
  const blocks: Block[] = [
    makeBlock({
      id: 'exact',
      kind_slug: 'hazard',
      category_tags: ['area-forming'],
      name: 'Exact match',
    }),
    makeBlock({
      id: 'no-match',
      kind_slug: 'hazard',
      category_tags: ['area-other'],
      name: 'No match',
    }),
  ]
  const result = scoreBlocks(blocks, {
    kindSlug: 'hazard',
    sopCategory: 'area-forming',
  })
  const exact = result.find((r) => r.block.id === 'exact')!
  expect(exact.score).toBeGreaterThanOrEqual(100)
  expect(exact.matchReason).toBe('exact-tag')
})

test('prefix-only match scores at least 50 with prefix-tag reason', () => {
  const blocks: Block[] = [
    makeBlock({
      id: 'prefix',
      kind_slug: 'hazard',
      category_tags: ['area-machine-electrical'],
      name: 'Sibling area',
    }),
  ]
  const result = scoreBlocks(blocks, {
    kindSlug: 'hazard',
    sopCategory: 'area-machine-repair',
  })
  expect(result).toHaveLength(1)
  expect(result[0].matchReason).toBe('prefix-tag')
  expect(result[0].score).toBeGreaterThanOrEqual(50)
  expect(result[0].score).toBeLessThan(100)
})

test('archived blocks are excluded', () => {
  const blocks: Block[] = [
    makeBlock({
      id: 'live',
      kind_slug: 'hazard',
      name: 'Live',
    }),
    makeBlock({
      id: 'archived',
      kind_slug: 'hazard',
      name: 'Archived',
      archived_at: '2026-05-01T00:00:00Z',
    }),
  ]
  const result = scoreBlocks(blocks, { kindSlug: 'hazard' })
  expect(result).toHaveLength(1)
  expect(result[0].block.id).toBe('live')
})

test('groupForPicker returns exact populated when matches exist', () => {
  const blocks: Block[] = [
    makeBlock({
      id: 'exact-a',
      kind_slug: 'hazard',
      category_tags: ['area-forming'],
      name: 'A',
    }),
    makeBlock({
      id: 'kind-only',
      kind_slug: 'hazard',
      category_tags: ['something-else'],
      name: 'B',
    }),
  ]
  const grouped = groupForPicker(blocks, {
    kindSlug: 'hazard',
    sopCategory: 'area-forming',
  })
  expect(grouped.exact).toHaveLength(1)
  expect(grouped.exact[0].block.id).toBe('exact-a')
  expect(grouped.allOfKind).toHaveLength(2)
  expect(grouped.totalCount).toBe(2)
})

test('groupForPicker returns allOfKind populated and exact empty when zero category match', () => {
  const blocks: Block[] = [
    makeBlock({
      id: 'a',
      kind_slug: 'hazard',
      category_tags: ['area-other'],
      name: 'A',
    }),
    makeBlock({
      id: 'b',
      kind_slug: 'hazard',
      category_tags: [],
      name: 'B',
    }),
  ]
  const grouped = groupForPicker(blocks, {
    kindSlug: 'hazard',
    sopCategory: 'area-forming',
  })
  expect(grouped.exact).toHaveLength(0)
  expect(grouped.allOfKind).toHaveLength(2)
  expect(grouped.totalCount).toBe(2)
})
