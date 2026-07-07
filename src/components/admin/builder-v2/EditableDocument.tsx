'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { useQueryClient } from '@tanstack/react-query'
import type { SectionRenderFamily, SopSectionBlockWithUpdate } from '@/types/sop'
import {
  listSectionBlocksWithUpdates,
  verifyBlock,
  unverifyBlock,
} from '@/actions/sop-section-blocks'
import { useSelectionSync } from '@/components/admin/source-viewer/useSelectionSync'
import { useReviewerFlags } from '@/components/admin/ai-reviewer/useReviewerFlags'
import {
  resolveComponentIdFromSource,
  resolveRegion,
  focusCanvasBlock,
} from './selection-bridge'
import type { SourceProvenanceRegion } from '@/lib/parsers/source-viewer'
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
  /** P12 selection-sync (26-12) — convert-SOP provenance wiring. */
  selectable: boolean
  junctionId: string | null
  region: SourceProvenanceRegion | null
  /** P13 overlays (26-12) — junction row + reviewer-flag surfacing. */
  junction: SopSectionBlockWithUpdate | null
  sopId: string
  flagsCount: number
  flagsOpen: boolean
  onToggleFlags: () => void
  onReviewed: () => void
  /** P8 per-block verify (26-12). */
  verified: boolean
  onToggleVerify: () => void
}

/**
 * A single sortable block. Calls `useSortable` (must be inside SortableContext)
 * and passes the drag ref/handle/transform down to the dnd-agnostic
 * BlockEditShell. Grip = keyboard + pointer handle (dnd-kit gives keyboard
 * reorder for free — a11y).
 */
function SortableBlock({
  item,
  onCommitField,
  onDuplicate,
  onDelete,
  selectable,
  junctionId,
  region,
  junction,
  sopId,
  flagsCount,
  flagsOpen,
  onToggleFlags,
  onReviewed,
  verified,
  onToggleVerify,
}: SortableBlockProps) {
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
      selectable={selectable}
      junctionId={junctionId}
      region={region}
      junction={junction}
      sopId={sopId}
      flagsCount={flagsCount}
      flagsOpen={flagsOpen}
      onToggleFlags={onToggleFlags}
      onReviewed={onReviewed}
      verified={verified}
      onToggleVerify={onToggleVerify}
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

  // P12/P13/P8 (26-12): junction rows for the active section, keyed by junction
  // id. Convert SOPs have rows (with block_provenance + verified state + the
  // update-available flag); inline-authored SOPs have an empty map → no
  // selection-sync / overlays / verify chip (UI-SPEC: non-convert shows none).
  const [junctionMap, setJunctionMap] = useState<Map<string, SopSectionBlockWithUpdate>>(
    () => new Map()
  )
  const refreshJunctions = useCallback(async () => {
    try {
      const rows = await listSectionBlocksWithUpdates(section.id)
      setJunctionMap(new Map(rows.map((r) => [r.id, r])))
    } catch (e) {
      console.warn('[EditableDocument] junction fetch failed', e)
      setJunctionMap(new Map())
    }
  }, [section.id])
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await listSectionBlocksWithUpdates(section.id)
        if (!cancelled) setJunctionMap(new Map(rows.map((r) => [r.id, r])))
      } catch (e) {
        if (!cancelled) setJunctionMap(new Map())
        console.warn('[EditableDocument] junction fetch failed', e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [section.id])

  // componentId (layout props.id) → junction row, matched via each item's
  // props.junctionId. Powers the P12 reverse binding + P13 overlays.
  const componentIdToJunction = useMemo<Map<string, SopSectionBlockWithUpdate>>(() => {
    const out = new Map<string, SopSectionBlockWithUpdate>()
    if (junctionMap.size === 0) return out
    for (const item of content) {
      const componentId = item.props.id as string | undefined
      const jId = (item.props as { junctionId?: string }).junctionId
      if (!componentId || !jId) continue
      const j = junctionMap.get(jId)
      if (j) out.set(componentId, j)
    }
    return out
  }, [content, junctionMap])
  const selectable = junctionMap.size > 0

  // P13 reviewer flags — per-block open-flag counts (reused hook; TanStack-cached
  // per sopId). `openFlagsFor` holds the ONE block whose panel is expanded
  // (UI-SPEC: only one flags panel expanded at a time).
  const reviewer = useReviewerFlags(sopId)
  const [openFlagsFor, setOpenFlagsFor] = useState<string | null>(null)

  // P8 per-block verify — writes through the EXISTING verify action (server gate
  // untouched, authoritative). Refresh junctions (chip state) + invalidate the
  // shared verify-checklist query so the publish gate re-reads.
  const queryClient = useQueryClient()
  const toggleVerify = useCallback(
    async (jId: string, isVerified: boolean) => {
      const res = isVerified ? await unverifyBlock(jId) : await verifyBlock(jId)
      if (!res.ok) {
        console.warn('[EditableDocument] verify toggle failed', res.error)
        return
      }
      // Verify efficiency: after verifying, auto-advance focus to the NEXT
      // unverified block (document order, wrapping) instead of leaving the
      // admin parked on the block they just verified.
      if (!isVerified) {
        const idx = content.findIndex(
          (it) => (it.props as { junctionId?: string }).junctionId === jId
        )
        for (let k = 1; k <= content.length; k++) {
          const it = content[(Math.max(0, idx) + k) % content.length]
          const nj = (it.props as { junctionId?: string }).junctionId
          if (!nj || nj === jId) continue
          const row = junctionMap.get(nj)
          if (row && !row.verified_by_admin_id) {
            const cid = it.props.id as string | undefined
            if (cid) focusCanvasBlock(cid)
            break
          }
        }
      }
      await refreshJunctions()
      queryClient.invalidateQueries({ queryKey: ['verify-checklist', sopId] })
    },
    [refreshJunctions, queryClient, sopId, content, junctionMap]
  )

  // P12 reverse binding — source-pane click → focus the matching canvas block.
  // `useSelectionSync` returns the no-op default outside the provider (source-
  // less SOPs), so registering is always safe.
  const { registerBlockClickHandler } = useSelectionSync()
  useEffect(() => {
    const unregister = registerBlockClickHandler((idFromSource: string) => {
      const componentId = resolveComponentIdFromSource(componentIdToJunction, idFromSource)
      if (componentId) focusCanvasBlock(componentId)
    })
    return unregister
  }, [registerBlockClickHandler, componentIdToJunction])

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
      {/* Section header — confirms which section the tree-rail click navigated
          to (the canvas shows one section at a time). */}
      {section.title && (
        <div className="mb-4 border-b border-[var(--ink-100,#e4e4e7)] pb-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-400,#a1a1aa)]">
            Section
          </span>
          <h2 className="text-lg font-semibold text-[var(--ink-900,#09090b)]">{section.title}</h2>
        </div>
      )}
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
            {content.map((item, idx) => {
              const jId = (item.props as { junctionId?: string }).junctionId ?? null
              const junction = jId ? junctionMap.get(jId) ?? null : null
              const flagsCount = jId ? (reviewer.byBlockId.get(jId)?.length ?? 0) : 0
              return (
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
                  selectable={selectable}
                  junctionId={jId}
                  region={resolveRegion(junctionMap, jId)}
                  junction={junction}
                  sopId={sopId}
                  flagsCount={flagsCount}
                  flagsOpen={openFlagsFor === item.props.id}
                  onToggleFlags={() =>
                    setOpenFlagsFor((prev) => (prev === item.props.id ? null : item.props.id))
                  }
                  onReviewed={refreshJunctions}
                  verified={!!junction?.verified_by_admin_id}
                  onToggleVerify={() => {
                    if (jId) void toggleVerify(jId, !!junction?.verified_by_admin_id)
                  }}
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
              )
            })}
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
