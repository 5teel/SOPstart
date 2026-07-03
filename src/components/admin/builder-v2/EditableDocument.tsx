'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { LayoutDataSchema } from '@/lib/builder/layout-schema'
import { sanitizeLayoutContent } from '@/lib/builder/sanitize-layout'
import { useBuilderAutosave } from '@/hooks/useBuilderAutosave'
import {
  deleteBlock,
  duplicateBlock,
  insertBlock,
  reorderBlocks,
  type LayoutItem,
} from '@/lib/builder/content-ops'
import { BLOCK_DEFAULTS, type BlockType } from '@/lib/builder/block-registry'
import type { SectionRenderFamily } from '@/types/sop'
import { BlockEditShell } from './BlockEditShell'
import { commitFieldToContent } from './fields/field-commit'
import { InserterMenu } from './inserter/InserterMenu'
import { ReuseTier } from './inserter/ReuseTier'
import { useSmartGhosts } from './ghosts/useSmartGhosts'
import { GhostRow } from './ghosts/GhostRow'

/**
 * The bespoke edit canvas (D-01, R2) — replaces `<Puck onChange>`.
 *
 * Holds the active section's `content[]` in local state, renders each entry as
 * a `<BlockEditShell>` wrapping the SAME worker component, and on every content
 * change feeds `{ content, root }` into the UNCHANGED `useBuilderAutosave`
 * (P11 RE-WIRE — no new persistence path). The hook debounces to Dexie
 * `draftLayouts`; `useDraftLayoutSync` flushes to Supabase, exactly as before.
 *
 * Selection state stays LOCAL (`useState`) — no search-param/route writes on
 * the hot edit path (CLAUDE.md 2026-05-13). Hydration-clean: no navigator/
 * window at module load or in render (#418).
 */

interface SectionLike {
  id: string
  title?: string | null
  layout_data?: unknown
}

interface EditableDocumentProps {
  section: SectionLike
  sopId: string
  /** Section render-family — selects the inserter's "Fits here" LANE (R3). */
  renderFamily: SectionRenderFamily
  /** The SOP's category tag — the Reuse tier's "this department" scope. */
  sopCategory: string | null
}

interface SortableBlockProps {
  item: LayoutItem
  onCommitField: (field: string, value: unknown) => void
  onDuplicate: () => void
  onDelete: () => void
}

/**
 * A single sortable block. Calls `useSortable` (must be inside SortableContext)
 * and passes the drag ref/handle/transform down to the dnd-agnostic
 * BlockEditShell. Grip = keyboard + pointer handle (dnd-kit gives keyboard
 * reorder for free — a11y).
 */
function SortableBlock({ item, onCommitField, onDuplicate, onDelete }: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.props.id,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  }
  return (
    <BlockEditShell
      item={item}
      onCommitField={onCommitField}
      onDuplicate={onDuplicate}
      onDelete={onDelete}
      setNodeRef={setNodeRef}
      style={style}
      gripProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>}
    />
  )
}

function seedContent(layoutData: unknown): LayoutItem[] {
  const parsed = LayoutDataSchema.safeParse(layoutData)
  if (!parsed.success) return []
  return sanitizeLayoutContent((parsed.data.content ?? []) as unknown[]) as LayoutItem[]
}

function seedRoot(layoutData: unknown): Record<string, unknown> {
  const parsed = LayoutDataSchema.safeParse(layoutData)
  return (parsed.success && parsed.data.root ? parsed.data.root : { props: {} }) as Record<
    string,
    unknown
  >
}

/**
 * A ＋ insert affordance. `big` = the section-end "Add step or block" bar; the
 * hairline variant sits between blocks and reveals a dashed pill on hover
 * (UI-SPEC `.adddiv` / `.addbig`). When active, anchors the InserterMenu below.
 */
function InsertDivider({
  big,
  active,
  onOpen,
  menu,
}: {
  big?: boolean
  active: boolean
  onOpen: () => void
  menu: React.ReactNode
}) {
  return (
    <div className="relative">
      {big ? (
        <button
          type="button"
          data-add-divider
          data-add-big
          aria-label="Add step or block"
          onClick={onOpen}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--ink-300,#d4d4d8)] py-3 font-mono text-[12px] uppercase tracking-wider text-[var(--ink-500,#71717a)] hover:border-[var(--accent-step,#3b82f6)] hover:text-[var(--accent-step,#3b82f6)]"
        >
          ＋ Add step or block
        </button>
      ) : (
        <button
          type="button"
          data-add-divider
          aria-label="Insert block"
          onClick={onOpen}
          className="group relative -my-1 flex w-full items-center justify-center py-1"
        >
          <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--ink-100,#e4e4e7)] opacity-0 group-hover:opacity-100" />
          <span
            className={[
              'relative rounded-full border border-dashed border-[var(--ink-300,#d4d4d8)] bg-[var(--paper,#fff)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--ink-500,#71717a)] transition-opacity',
              active
                ? 'opacity-100 border-[var(--accent-step,#3b82f6)] text-[var(--accent-step,#3b82f6)]'
                : 'opacity-0 group-hover:opacity-100 group-hover:border-[var(--accent-step,#3b82f6)] group-hover:text-[var(--accent-step,#3b82f6)]',
            ].join(' ')}
          >
            ＋ insert block
          </span>
        </button>
      )}
      {active && <div className="absolute left-0 top-full z-50 mt-1">{menu}</div>}
    </div>
  )
}

export function EditableDocument({
  section,
  sopId,
  renderFamily,
  sopCategory,
}: EditableDocumentProps) {
  const [content, setContent] = useState<LayoutItem[]>(() => seedContent(section.layout_data))
  const root = useMemo(() => seedRoot(section.layout_data), [section.layout_data])

  // R3 inserter: which ＋ divider is open (afterIndex; -1 = prepend), and whether
  // the dept-scoped Reuse tier (BlockPicker) modal is showing.
  const [inserterAt, setInserterAt] = useState<number | null>(null)
  const [reuseOpen, setReuseOpen] = useState(false)

  // Close any open inserter when the section switches.
  useEffect(() => {
    setInserterAt(null)
    setReuseOpen(false)
  }, [section.id])

  // P11: the SAME hook <Puck onChange> fed. Reads only { content, root }.
  const handleChange = useBuilderAutosave(section.id, sopId)

  // Re-seed on section switch (Puck used key={section.id} to remount). Suppress
  // the autosave that the re-seed would otherwise trigger.
  const sectionIdRef = useRef(section.id)
  const skipAutosave = useRef(true)
  useEffect(() => {
    if (sectionIdRef.current !== section.id) {
      sectionIdRef.current = section.id
      skipAutosave.current = true
      setContent(seedContent(section.layout_data))
    }
  }, [section.id, section.layout_data])

  // Emit { content, root } once per real change — the exact shape Puck emitted.
  useEffect(() => {
    if (skipAutosave.current) {
      skipAutosave.current = false
      return
    }
    handleChange({ content, root } as unknown as Parameters<typeof handleChange>[0])
  }, [content, root, handleChange])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Vertical-axis reflow only (blocks never free-drag — Konva is the sole
  // freeform surface). Reorder round-trips props losslessly (reorderBlocks) then
  // autosaves via the content effect above.
  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    setContent((c) => {
      const from = c.findIndex((it) => it.props.id === active.id)
      const to = c.findIndex((it) => it.props.id === over.id)
      if (from < 0 || to < 0) return c
      return reorderBlocks(c, from, to)
    })
  }

  // The context-aware inserter anchored at a given cursor (afterIndex).
  // prevType (block above the cursor) drives the smart row; insert → content-ops
  // insertBlock with fresh registry defaults → autosave via the content effect.
  const menuFor = (afterIndex: number) => (
    <InserterMenu
      ctx={renderFamily}
      prevType={afterIndex >= 0 ? ((content[afterIndex]?.type ?? null) as BlockType | null) : null}
      onInsert={(type) => {
        setContent((c) => insertBlock(c, type, afterIndex, BLOCK_DEFAULTS[type]))
        setInserterAt(null)
      }}
      onClose={() => setInserterAt(null)}
      onOpenReuse={() => {
        setInserterAt(null)
        setReuseOpen(true)
      }}
    />
  )

  // R4 smart ghosts: predicted-next from the SMART map, injected between blocks.
  // Accepting inserts the predicted block (content-ops) → autosave via the
  // content effect. Disabled while an inserter menu is open so Tab-accept never
  // collides with the menu's keyboard nav.
  const { ghosts, registerRef, onGhostEnter, onGhostLeave, onGhostClick } = useSmartGhosts(
    content.map((c) => c.type as BlockType),
    (afterIndex, type) =>
      setContent((c) => insertBlock(c, type, afterIndex, BLOCK_DEFAULTS[type])),
    { disabled: inserterAt !== null }
  )
  const ghostByIndex = new Map(ghosts.map((g) => [g.afterIndex, g]))

  return (
    <div
      data-editable-document
      className="mx-auto max-w-[680px] space-y-1 px-6 py-8"
      style={{ backgroundSize: '20px 20px' }}
    >
      {content.length === 0 ? (
        <>
          <div className="p-8 text-center text-[var(--ink-500,#71717a)]">Nothing here yet</div>
          <InsertDivider
            big
            active={inserterAt === -1}
            onOpen={() => setInserterAt(-1)}
            menu={menuFor(-1)}
          />
        </>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={content.map((c) => c.props.id)}
            strategy={verticalListSortingStrategy}
          >
            {/* Prepend divider (cursor above the first block). */}
            <InsertDivider
              active={inserterAt === -1}
              onOpen={() => setInserterAt(-1)}
              menu={menuFor(-1)}
            />
            {content.map((item, idx) => (
              <div key={item.props.id} data-block-index={idx}>
                <SortableBlock
                  item={item}
                  onCommitField={(field, value) =>
                    setContent((c) =>
                      commitFieldToContent(c, item.props.id, item.type as BlockType, field, value)
                    )
                  }
                  onDuplicate={() => setContent((c) => duplicateBlock(c, item.props.id))}
                  onDelete={() => setContent((c) => deleteBlock(c, item.props.id))}
                />
                {/* Between-blocks hairline; section-end gets the big add bar. */}
                <InsertDivider
                  big={idx === content.length - 1}
                  active={inserterAt === idx}
                  onOpen={() => setInserterAt(idx)}
                  menu={menuFor(idx)}
                />
                {/* R4 smart ghost: predicted-next affordance (Tab/click accept). */}
                {ghostByIndex.has(idx) && (
                  <GhostRow
                    ghost={ghostByIndex.get(idx)!}
                    registerRef={registerRef}
                    onEnter={onGhostEnter}
                    onLeave={onGhostLeave}
                    onClick={onGhostClick}
                  />
                )}
              </div>
            ))}
          </SortableContext>
        </DndContext>
      )}

      {/* R3 TIER 3 — dept-scoped Reuse (existing Phase 13 BlockPicker path). */}
      <ReuseTier
        open={reuseOpen}
        sopSectionId={section.id}
        categoryTag={sopCategory}
        onClose={() => setReuseOpen(false)}
      />
    </div>
  )
}
