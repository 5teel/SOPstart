/**
 * Phase 26 Plan 26-04 Task 1 — lossless props round-trip (P15 / R7 / D-02 hook).
 *
 * The bespoke reducer is the agent-contract hook: every op MUST round-trip ALL
 * props keys losslessly, so `junctionId`, `block_provenance`, and future 26.5
 * agent-layer metadata never drop on an edit (RESEARCH Pitfall 7). This proves
 * the contract behaviourally against the real content-ops helpers — not a grep.
 *
 * Pure module, imported via relative path (the phase26 project has no `@/`
 * alias resolution; established pattern — see render-parity / convert-golden).
 */
import { test, expect } from '@playwright/test'
import {
  updateBlockProps,
  duplicateBlock,
  deleteBlock,
  reorderBlocks,
  insertBlock,
  stampProvenance,
  type LayoutItem,
} from '../../src/lib/builder/content-ops'

// A converted block carrying frozen-contract metadata + a synthetic unknown
// agent key (`__agent`) that stands in for 26.5 metadata.
function convertedBlock(id: string, text: string): LayoutItem {
  return {
    type: 'TextBlock',
    props: {
      id,
      content: text,
      junctionId: `junc-${id}`,
      block_provenance: { region: { page: 1, para: 2 }, parser_run_id: 'run-1', parser_version: 7 },
      __agent: { note: 'machine-authored', embeddingId: 'emb-42' },
    },
  }
}

test.describe('content-ops — lossless props round-trip (R7/D-02 hook)', () => {
  test('updateBlockProps changes only the targeted field; metadata survives byte-identical', () => {
    const before = convertedBlock('a', 'original body')
    const content = [before]

    const after = updateBlockProps(content, 'a', { content: 'edited body' })
    const p = after[0].props

    // Only the edited field differs.
    expect(p.content).toBe('edited body')
    // Frozen-contract + unknown agent keys survive UNCHANGED.
    expect(p.junctionId).toBe('junc-a')
    expect(p.block_provenance).toEqual(before.props.block_provenance)
    expect(p.__agent).toEqual(before.props.__agent)
    // Never reconstructed — the untouched keys are deep-equal to the source.
    expect(p.id).toBe('a')

    // Original object not mutated (immutable update).
    expect(content[0].props.content).toBe('original body')
  })

  test('duplicateBlock deep-copies unknown keys and assigns a fresh id', () => {
    const content = [convertedBlock('a', 'body')]
    const after = duplicateBlock(content, 'a')

    expect(after).toHaveLength(2)
    const copy = after[1].props
    expect(copy.id).not.toBe('a')
    expect(typeof copy.id).toBe('string')
    // Unknown + provenance keys copied.
    expect(copy.junctionId).toBe('junc-a')
    expect(copy.__agent).toEqual(content[0].props.__agent)
    // Deep copy — mutating the copy's nested object does NOT affect the source.
    ;(copy.block_provenance as { parser_run_id: string }).parser_run_id = 'MUTATED'
    expect(
      (content[0].props.block_provenance as { parser_run_id: string }).parser_run_id
    ).toBe('run-1')
  })

  test('reorderBlocks moves order while every block keeps ALL props', () => {
    const content = [
      convertedBlock('a', 'first'),
      convertedBlock('b', 'second'),
      convertedBlock('c', 'third'),
    ]
    const after = reorderBlocks(content, 2, 0)
    expect(after.map((i) => i.props.id)).toEqual(['c', 'a', 'b'])
    // Each moved block keeps its junctionId + provenance + agent keys.
    for (const item of after) {
      expect(item.props.junctionId).toBe(`junc-${item.props.id}`)
      expect(item.props.__agent).toBeDefined()
      expect(item.props.block_provenance).toBeDefined()
    }
    // Out-of-range is a no-op (returns same array ref).
    expect(reorderBlocks(content, 9, 0)).toBe(content)
  })

  test('deleteBlock removes only the target; insertBlock stamps a fresh id', () => {
    const content = [convertedBlock('a', 'x'), convertedBlock('b', 'y')]
    expect(deleteBlock(content, 'a').map((i) => i.props.id)).toEqual(['b'])

    const inserted = insertBlock(content, 'HeadingBlock', 0, { text: 'New' })
    expect(inserted).toHaveLength(3)
    expect(inserted[1].type).toBe('HeadingBlock')
    expect(typeof inserted[1].props.id).toBe('string')
    expect(inserted[1].props.text).toBe('New')
  })

  test('stampProvenance merges without dropping existing props', () => {
    const stamped = stampProvenance(
      { id: 'a', content: 'body', junctionId: 'junc-a' },
      { page: 3 },
      'run-9',
      5
    )
    expect(stamped.content).toBe('body')
    expect(stamped.junctionId).toBe('junc-a')
    expect(stamped.block_provenance).toEqual({
      region: { page: 3 },
      parser_run_id: 'run-9',
      parser_version: 5,
    })
  })
})
