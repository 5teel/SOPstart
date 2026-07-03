/**
 * Phase 26 Plan 26-04 Task 3 — dnd-kit vertical sortable reorder.
 *
 * Behavioural: dragging block B above block A reorders content[] and every
 * block keeps ALL its props (junctionId/block_provenance survive — the same
 * lossless contract the autosave persists). Plus two isolation guards from the
 * acceptance criteria: `restrictToVerticalAxis` applied (no free-drag), and
 * @dnd-kit imported ONLY under `src/components/admin/builder-v2/` (admin-only —
 * threat T-26-04-03, keeps the editor out of the worker bundle).
 */
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { reorderBlocks, type LayoutItem } from '../../src/lib/builder/content-ops'

const SRC = path.resolve(__dirname, '..', '..', 'src')
const EDITABLE_DOC = path.join(SRC, 'components', 'admin', 'builder-v2', 'EditableDocument.tsx')

function block(id: string): LayoutItem {
  return {
    type: 'TextBlock',
    props: {
      id,
      content: `body ${id}`,
      junctionId: `junc-${id}`,
      block_provenance: { region: { page: 1 }, parser_run_id: 'r', parser_version: 1 },
    },
  }
}

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
  }
  return out
}

test.describe('reorder — dnd-kit vertical sortable (keyboard + pointer)', () => {
  test('dragging a block up reorders content[] and preserves all props', () => {
    const content = [block('a'), block('b'), block('c')]
    // onDragEnd resolves from/to by id then dispatches reorderBlocks — simulate
    // dragging 'c' onto 'a' (to the top).
    const from = content.findIndex((i) => i.props.id === 'c')
    const to = content.findIndex((i) => i.props.id === 'a')
    const after = reorderBlocks(content, from, to)

    expect(after.map((i) => i.props.id)).toEqual(['c', 'a', 'b'])
    // Lossless — the persisted (draftLayouts) order carries intact metadata.
    for (const item of after) {
      expect(item.props.junctionId).toBe(`junc-${item.props.id}`)
      expect(item.props.block_provenance).toBeDefined()
    }
  })

  test('restrictToVerticalAxis is applied (blocks reflow, never free-drag)', () => {
    const source = fs.readFileSync(EDITABLE_DOC, 'utf8')
    expect(source).toContain('restrictToVerticalAxis')
    expect(source).toContain('verticalListSortingStrategy')
  })

  test('@dnd-kit is imported only under builder-v2/ (admin-only, worker-safe)', () => {
    const offenders = walk(SRC)
      .filter((f) => /@dnd-kit\//.test(fs.readFileSync(f, 'utf8')))
      .filter((f) => !f.split(path.sep).join('/').includes('/admin/builder-v2/'))
    expect(offenders, `@dnd-kit imported outside builder-v2: ${offenders.join(', ')}`).toEqual([])
  })
})
