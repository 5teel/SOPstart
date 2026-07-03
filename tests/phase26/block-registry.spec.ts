/**
 * Phase 26 Plan 26-03 Task 1 — block-registry + sanitize-layout (P17).
 *
 * Behavioural unit assertions (not source-contract): the bespoke registry maps
 * exactly the 17 registered block types to real components, and the relocated
 * sanitize guard rewrites unknown types to the UnsupportedBlockPlaceholder while
 * leaving known types untouched. Runs under the broad `phase26` project.
 */
import { test, expect } from '@playwright/test'
import { BLOCK_COMPONENTS, BLOCK_DEFAULTS, stripMeta } from '@/lib/builder/block-registry'
import { sanitizeLayoutContent } from '@/lib/builder/sanitize-layout'

type Entry = { type: string; props: Record<string, unknown> }

test.describe('block-registry + sanitize-layout (P17)', () => {
  test('BLOCK_COMPONENTS has one component entry per registered block type (placeholder separate)', () => {
    const keys = Object.keys(BLOCK_COMPONENTS)
    // 18 registered block types (26-09 added VisualBlock); UnsupportedBlockPlaceholder is handled in sanitize-layout, not here.
    expect(keys.length).toBe(18)
    expect(keys).not.toContain('UnsupportedBlockPlaceholder')
    for (const k of keys) {
      expect(typeof (BLOCK_COMPONENTS as Record<string, unknown>)[k]).toBe('function')
      // Every registered type has a default-props entry.
      expect(BLOCK_DEFAULTS[k as keyof typeof BLOCK_DEFAULTS]).toBeTruthy()
    }
  })

  test('sanitize rewrites an unknown type to UnsupportedBlockPlaceholder, keeping the original type', () => {
    const out = sanitizeLayoutContent([{ type: 'Nonexistent', props: { id: 'x' } }]) as Entry[]
    expect(out[0].type).toBe('UnsupportedBlockPlaceholder')
    expect(out[0].props.type).toBe('Nonexistent')
    expect(out[0].props.id).toBe('x')
  })

  test('sanitize leaves a known type untouched', () => {
    const out = sanitizeLayoutContent([
      { type: 'TextBlock', props: { id: 'y', content: 'hi' } },
    ]) as Entry[]
    expect(out[0].type).toBe('TextBlock')
    expect(out[0].props.content).toBe('hi')
  })

  test('stripMeta drops id / junctionId / block_provenance but keeps component props', () => {
    const cleaned = stripMeta({
      id: 'a',
      junctionId: 'j',
      block_provenance: { region: {} },
      content: 'keep me',
    })
    expect(cleaned).toEqual({ content: 'keep me' })
  })
})
