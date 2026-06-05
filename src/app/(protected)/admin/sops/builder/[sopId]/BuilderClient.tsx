'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import type { Data, Viewports } from '@puckeditor/core'
import type { SopWithSections, SopSectionBlockWithUpdate } from '@/types/sop'
import {
  puckConfig,
  createPuckOverrides,
  sanitizeLayoutContent,
} from '@/lib/builder/puck-config'
import { LayoutDataSchema } from '@/lib/builder/layout-schema'
import { useBuilderAutosave } from '@/hooks/useBuilderAutosave'
import { useDraftLayoutSync } from '@/hooks/useDraftLayoutSync'
import { useNetworkStore } from '@/stores/network'
import { db } from '@/lib/offline/db'
import { listSectionBlocksWithUpdates } from '@/actions/sop-section-blocks'
import { listBlockCategories } from '@/actions/blocks'
import { BuilderTreeRail } from '@/components/admin/builder/BuilderTreeRail'
import { AddMenu } from '@/components/admin/builder/AddMenu'
import { StructuredFieldPopover } from '@/components/admin/builder/StructuredFieldPopover'
import { BlockPicker } from '@/components/admin/blocks/BlockPicker'
import type { BlockPickerOnAddInput } from '@/components/admin/blocks/BlockPicker'
import { addBlockToSection } from '@/actions/sop-section-blocks'
import { useSelectionSync } from '@/components/admin/source-viewer/useSelectionSync'
import { ReviewerFlagsPanel } from '@/components/admin/ai-reviewer/ReviewerFlagsPanel'
import { RerunReviewerButton } from '@/components/admin/ai-reviewer/RerunReviewerButton'

// D-01 (revised 2026-04-24): Use Puck's native viewports prop. It clamps
// only the preview canvas, leaving the palette + fields sidebars at full
// width so the admin can still drag blocks while inspecting the mobile
// layout. The previous body-attr CSS clamp squashed the entire Puck layout.
const BUILDER_VIEWPORTS: Viewports = [
  { width: '100%', height: 'auto', label: 'Desktop', icon: 'Monitor' },
  // 430px ≈ iPhone 14/15 Pro Max; matches the worker walkthrough target.
  { width: 430, height: 'auto', label: 'Mobile', icon: 'Smartphone' },
]

const Puck = dynamic(
  () => import('@puckeditor/core').then((m) => m.Puck),
  {
    ssr: false,
    loading: () => <div className="p-8 text-[var(--ink-500)]">Loading editor…</div>,
  }
)

const emptyData: Data = { content: [], root: { props: {} } }

// Structured block types (D-04): non-text fields warrant the StructuredFieldPopover
const STRUCTURED_BLOCK_TYPES = new Set([
  'MeasurementBlock',
  'DecisionBlock',
  'InspectBlock',
  'SignOffBlock',
  'HazardCardBlock',
  'PPECardBlock',
])

interface BuilderClientProps {
  sopId: string
  initialSop: SopWithSections
}

export function BuilderClient({ sopId, initialSop }: BuilderClientProps) {
  const sections = [...(initialSop.sop_sections ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order
  )
  const [activeSectionId, setActiveSectionId] = useState(sections[0]?.id ?? '')
  const activeSection = sections.find((s) => s.id === activeSectionId)

  // Plan 04: autosave + sync hooks. useDraftLayoutSync registers the
  // mount/online/visibility triggers that call flushDraftLayouts.
  const { syncing, lastSyncResult } = useDraftLayoutSync()
  const isOnline = useNetworkStore((s) => s.isOnline)
  const handleChange = useBuilderAutosave(activeSectionId, sopId)

  // Track last-synced timestamp for the SAVED pill. Polls Dexie every 2s
  // while mounted and reads the most recent `updated_at` across this SOP's
  // draftLayouts rows with `syncState: 'synced'`.
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [savedTick, setSavedTick] = useState(0)
  useEffect(() => {
    let cancelled = false
    async function refresh() {
      try {
        const rows = await db.draftLayouts
          .where('sop_id')
          .equals(sopId)
          .toArray()
        const synced = rows.filter((r) => r.syncState === 'synced')
        const latest = synced.reduce(
          (acc, r) => (r.updated_at > acc ? r.updated_at : acc),
          0
        )
        if (!cancelled) setLastSavedAt(latest > 0 ? latest : null)
      } catch {
        // Dexie not ready / SSR — leave lastSavedAt as-is
      }
    }
    void refresh()
    const poll = setInterval(refresh, 2_000)
    // Separate tick interval so the "Ns AGO" label ticks every second without
    // hitting Dexie.
    const tick = setInterval(() => setSavedTick((t) => t + 1), 1_000)
    return () => {
      cancelled = true
      clearInterval(poll)
      clearInterval(tick)
    }
  }, [sopId])

  // D-07: when flushDraftLayouts reports a cross-admin overwrite, surface a
  // quiet toast naming the affected section titles. Auto-clears after ~4s.
  const [overwriteToast, setOverwriteToast] = useState<string | null>(null)
  useEffect(() => {
    if (!lastSyncResult?.overwrittenByServer?.length) return
    const overwrittenTitles = lastSyncResult.overwrittenByServer.map(
      (id) => sections.find((s) => s.id === id)?.title ?? id.slice(0, 8)
    )
    setOverwriteToast(
      `Updated by another admin - ${overwrittenTitles.join(', ')}`
    )
    const t = setTimeout(() => setOverwriteToast(null), 4000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSyncResult])

  // D-16: surface a section-level toast when activeSection.layout_data is
  // structurally broken. The sanitized initial data path below falls back to
  // emptyData so the editor still mounts.
  const [layoutErrorToast, setLayoutErrorToast] = useState<string | null>(null)
  useEffect(() => {
    if (!activeSection || activeSection.layout_data == null) {
      setLayoutErrorToast(null)
      return
    }
    const parsed = LayoutDataSchema.safeParse(activeSection.layout_data)
    setLayoutErrorToast(
      parsed.success
        ? null
        : `Section "${activeSection.title}" has broken layout data - revert to last save?`
    )
  }, [activeSection])

  // Derive the save-state pill label. OFFLINE when network is down (rows stay
  // in Dexie with syncState: 'dirty'); SAVING while a flush is in-flight;
  // SAVED {N}s AGO when lastSavedAt is known; plain SAVED otherwise.
  const savePillLabel = !isOnline
    ? 'OFFLINE · QUEUED'
    : syncing
      ? 'SAVING…'
      : lastSavedAt
        ? `SAVED ${Math.max(0, Math.round((Date.now() - lastSavedAt) / 1000))}s AGO`
        : 'SAVED'
  // savedTick is consumed by the label computation above — reference it so
  // React re-runs the render each tick.
  void savedTick

  // Phase 13 plan 13-04: fetch junction rows + hydrated latestVersion for
  // the active section. Used to render UpdateAvailableBadge on canvas items
  // whose source block has advanced.
  const [junctionMap, setJunctionMap] = useState<
    Map<string, SopSectionBlockWithUpdate>
  >(new Map())

  const refreshJunctions = useCallback(async () => {
    if (!activeSection) {
      setJunctionMap(new Map())
      return
    }
    try {
      const rows = await listSectionBlocksWithUpdates(activeSection.id)
      setJunctionMap(new Map(rows.map((r) => [r.id, r])))
    } catch (e) {
      console.warn('[BuilderClient] junction refresh failed', e)
    }
  }, [activeSection])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!activeSection) {
        if (!cancelled) setJunctionMap(new Map())
        return
      }
      try {
        const rows = await listSectionBlocksWithUpdates(activeSection.id)
        if (!cancelled) setJunctionMap(new Map(rows.map((r) => [r.id, r])))
      } catch (e) {
        console.warn('[BuilderClient] junction fetch failed', e)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeSection])

  // Walk the active section's layout_data and build a lookup from
  // Puck componentId (= layout entry props.id) → junction row, by matching
  // each item's `props.junctionId` against the junctionMap key.
  const componentIdToJunction = useMemo<
    Map<string, SopSectionBlockWithUpdate>
  >(() => {
    const out = new Map<string, SopSectionBlockWithUpdate>()
    if (!activeSection?.layout_data || junctionMap.size === 0) return out
    const parsed = LayoutDataSchema.safeParse(activeSection.layout_data)
    if (!parsed.success) return out
    const items = (parsed.data.content ?? []) as Array<{
      props?: { id?: string; junctionId?: string }
    }>
    for (const item of items) {
      const componentId = item?.props?.id
      const junctionId = item?.props?.junctionId
      if (!componentId || !junctionId) continue
      const junction = junctionMap.get(junctionId)
      if (junction) out.set(componentId, junction)
    }
    return out
  }, [activeSection, junctionMap])

  // Phase 21.6 Plan 05 (E6 + D-04): build componentId → raw props and
  // componentId → block type lookups. Pure read of layout_data.
  // componentIdToProps feeds the "Reference images" chip in componentOverlay.
  // componentIdToType feeds StructuredFieldPopover block-type detection.
  const { componentIdToProps, componentIdToType } = useMemo<{
    componentIdToProps: Map<string, Record<string, unknown>>
    componentIdToType: Map<string, string>
  }>(() => {
    const propsMap = new Map<string, Record<string, unknown>>()
    const typeMap = new Map<string, string>()
    if (!activeSection?.layout_data) return { componentIdToProps: propsMap, componentIdToType: typeMap }
    const parsed = LayoutDataSchema.safeParse(activeSection.layout_data)
    if (!parsed.success) return { componentIdToProps: propsMap, componentIdToType: typeMap }
    const items = (parsed.data.content ?? []) as Array<{
      type?: string
      props?: Record<string, unknown> & { id?: string }
    }>
    for (const item of items) {
      const componentId = item?.props?.id
      if (!componentId || typeof componentId !== 'string') continue
      propsMap.set(componentId, item.props ?? {})
      if (item.type) typeMap.set(componentId, item.type)
    }
    return { componentIdToProps: propsMap, componentIdToType: typeMap }
  }, [activeSection])

  // Phase 21 Plan 21-02 — selection-sync wiring (source viewer ↔ canvas).
  // The provider lives one level up in BuilderWithSourceViewer; when the
  // pane is absent (no source attached / wrapper disabled), useSelectionSync
  // returns the no-op default value and these handlers are inert.
  const {
    setActiveProvenance,
    registerBlockClickHandler,
    activeBlockId: highlightedFromSourceClickBlockId,
  } = useSelectionSync()

  // Stable ref so SelectionSyncTap can fire onItemSelected without
  // re-rendering on every parent re-render (the tap's effect deps stay
  // shallow).
  const onItemSelectedRef = useRef<
    (info: { componentId: string; junctionId: string | null }) => void
  >(() => {})
  useEffect(() => {
    onItemSelectedRef.current = ({ junctionId }) => {
      if (!junctionId) {
        // Inline-authored block — no provenance possible. Clear any prior
        // highlight so the source pane returns to its idle state.
        setActiveProvenance(null, null)
        return
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const junction: any = junctionMap.get(junctionId)
      const region = (junction?.block_provenance ?? null) as
        | import('@/lib/parsers/source-viewer').SourceProvenanceRegion
        | null
      // Even when region is null we propagate the activeBlockId so the
      // source pane can keep showing "no source for this block" cues.
      setActiveProvenance(region, junctionId)
    }
  }, [junctionMap, setActiveProvenance])

  // Reverse channel — clicks inside the source pane should scroll the
  // matching Puck canvas item into view + paint a yellow outline.
  // BlockClickHandler receives a junctionId or paragraph/segment id; we
  // resolve it back to a DOM node via componentId mapping.
  useEffect(() => {
    const unregister = registerBlockClickHandler((idFromSource: string) => {
      // The source pane forwards either a junction id (PDF bbox click) or a
      // paragraph / transcript line id. For junction ids, look up the
      // matching componentId via the existing layout walk.
      let matchingComponentId: string | null = null
      for (const [componentId, junction] of componentIdToJunction.entries()) {
        if (junction.id === idFromSource) {
          matchingComponentId = componentId
          break
        }
      }
      if (!matchingComponentId) return
      const escaped =
        typeof window !== 'undefined' && typeof window.CSS?.escape === 'function'
          ? window.CSS.escape(matchingComponentId)
          : matchingComponentId.replace(/[^a-zA-Z0-9_-]/g, (c) => `\\${c}`)
      const el = document.querySelector<HTMLElement>(`[data-puck-item-id="${escaped}"]`)
      if (el) {
        requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: 'auto', block: 'center' })
        })
      }
    })
    return unregister
  }, [registerBlockClickHandler, componentIdToJunction])

  // Phase 21.6 Plan 05 (D-03): AddMenu open/close state and insert anchor.
  // insertAfterStepIndex tracks which step row is active in the rail so the
  // AddMenu inserts after it. -1 = append at end of section.
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [insertAfterStepIndex, setInsertAfterStepIndex] = useState(-1)

  // Phase 21.6 Plan 05 (D-03): BlockPicker (Phase 13 library picker) state.
  // Opened when AddMenu "From library…" is clicked. Reuses the existing
  // Phase 13 addBlockToSection path — no reimplementation (T-21.6-05-03).
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false)

  // Handle a library block being added from the Phase 13 BlockPicker.
  // After addBlockToSection returns the junctionId, refresh junctions so
  // the UpdateAvailableBadge overlay has the latest data.
  async function handleLibraryAdd(input: BlockPickerOnAddInput) {
    if (!activeSection) return
    const result = await addBlockToSection({
      sopSectionId: activeSection.id,
      blockId: input.blockId,
      pinMode: input.pinMode,
    })
    if ('error' in result) {
      console.warn('[BuilderClient] library addBlockToSection failed', result.error)
      return
    }
    // Refresh junctions so the componentIdToJunction map picks up the new row.
    void refreshJunctions()
  }

  // Phase 21.6 Plan 05 (D-04): StructuredFieldPopover state.
  // Opened when a structured-type block is selected on canvas.
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [selectedBlockType, setSelectedBlockType] = useState<string | null>(null)
  const selectedBlockAnchorRef = useRef<HTMLElement | null>(null)

  // Stable identity so StructuredFieldPopover's Escape/mousedown listeners are
  // not torn down and re-added on every BuilderClient render.
  const closeStructuredPopover = useCallback(() => {
    setSelectedBlockId(null)
    setSelectedBlockType(null)
  }, [])

  // Memoized overrides factory — rebuilt when junctions or the section change
  // so the componentOverlay closure captures the latest map / refresh callback.
  const overrides = useMemo(
    () =>
      createPuckOverrides({
        loadCategories: listBlockCategories,
        junctionMap,
        componentIdToJunction,
        componentIdToProps,
        onReviewed: () => {
          void refreshJunctions()
        },
        onItemSelected: (info) => {
          onItemSelectedRef.current(info)
          // D-04: track selected block for StructuredFieldPopover.
          // Look up the block type from componentIdToType (built from layout_data).
          const btype = componentIdToType.get(info.componentId)
          if (btype && STRUCTURED_BLOCK_TYPES.has(btype)) {
            setSelectedBlockId(info.componentId)
            setSelectedBlockType(btype)
          } else {
            // Text/non-structured block or unknown — close popover if open
            setSelectedBlockId(null)
            setSelectedBlockType(null)
          }
        },
        // Phase 21 Plan 21-03 — inline ReviewerFlagsPanel under each block.
        // Empty state renders nothing (no chrome) so verified blocks stay quiet.
        renderReviewerFlagsPanel: ({ junctionId }) =>
          junctionId ? (
            <ReviewerFlagsPanel sopId={sopId} blockId={junctionId} />
          ) : null,
      }),
    [junctionMap, componentIdToJunction, componentIdToProps, componentIdToType, refreshJunctions, sopId]
  )

  // Reference highlighted state so React keeps the subscription effect alive
  // when source-pane clicks fire. Cleared via the source-pane state machine.
  void highlightedFromSourceClickBlockId

  // D-13: sanitize unknown block types before passing data to <Puck>.
  // Also carries through flow_graph from the SOP-level record (D-16) so
  // FlowGraphField pre-loads the existing graph when the builder opens.
  const sanitizedInitial: Data = useMemo(() => {
    if (!activeSection || activeSection.layout_data == null) {
      return {
        content: [],
        root: { props: { flowGraph: initialSop.flow_graph ?? null } },
      } as unknown as Data
    }
    const parsed = LayoutDataSchema.safeParse(activeSection.layout_data)
    if (!parsed.success) {
      return {
        content: [],
        root: { props: { flowGraph: initialSop.flow_graph ?? null } },
      } as unknown as Data
    }
    const sanitizedContent = sanitizeLayoutContent(
      (parsed.data.content ?? []) as unknown[]
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return {
      ...parsed.data,
      content: sanitizedContent,
      root: { props: { flowGraph: initialSop.flow_graph ?? null } },
    } as any as Data
  }, [activeSection, initialSop.flow_graph])

  return (
    <div className="flex flex-col h-screen bg-[var(--paper)] text-[var(--ink-900)]">
      {/* Top chrome — SAVED pill + SEND TO REVIEW (Plan 04 wires real save state) */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--ink-100)]">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/sops"
            className="text-sm text-[var(--ink-500)] hover:text-[var(--ink-700)] transition-colors"
          >
            ← Library
          </Link>
          <h1 className="text-base font-semibold">
            {initialSop.title ?? 'Untitled SOP'}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {layoutErrorToast && (
            <div
              role="alert"
              className="px-3 py-1.5 rounded border border-red-500/30 bg-red-500/10 text-red-300 text-xs font-mono uppercase tracking-wider cursor-pointer"
              onClick={() => setLayoutErrorToast(null)}
            >
              {layoutErrorToast} (click to dismiss)
            </div>
          )}
          {overwriteToast && (
            <span
              role="status"
              className="px-3 py-1.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-mono uppercase tracking-wider"
            >
              {overwriteToast}
            </span>
          )}
          <span className="font-mono text-[11px] uppercase tracking-wider text-[var(--ink-500)] border border-[var(--ink-300)] rounded px-2 py-0.5">
            {savePillLabel}
          </span>
          {/* Phase 21 Plan 21-03 — Re-run AI Reviewer toolbar button. */}
          <RerunReviewerButton sopId={sopId} />
          {/*
            Phase 21 Plan 21-04 — Publish surface moved to <VerifyChecklistGate>
            in the right-pane sidebar (BuilderWithSourceViewer mounts it).
            The placeholder span here is gone — the gate's publish button is
            the sole entry point and it's gated on per-block verification.
          */}
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        {/* Left rail — BuilderTreeRail (replaces SectionListSidebar neighbour role).
            Phase 21.6 Plan 05: mounts the step-centric tree rail built in Plan 03.
            SectionListSidebar.tsx remains on disk (source for fold reference). */}
        <BuilderTreeRail
          sections={sections}
          activeSection={
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (activeSection ?? null) as any
          }
          activeSectionId={activeSectionId}
          onSelect={setActiveSectionId}
          sopId={sopId}
          onStepSelect={(stepIdx) => setInsertAfterStepIndex(stepIdx)}
          onOpenAddMenu={() => setAddMenuOpen(true)}
        />
        {/* Canvas — Puck owns the viewport clamp via BUILDER_VIEWPORTS.
            Puck remounts per active section (Research Open Question 2).
            ui prop suppresses native sidebars (E3 one-list invariant, Pitfall 5:
            pass as prop not setUi so it survives key={activeSection.id} remount). */}
        <main className="flex-1 min-w-0 overflow-auto relative">
          {activeSection ? (
            <Puck
              key={activeSection.id}
              config={puckConfig}
              overrides={overrides}
              data={sanitizedInitial}
              onChange={handleChange}
              viewports={BUILDER_VIEWPORTS}
              ui={{ leftSideBarVisible: false, rightSideBarVisible: false }}
            />
          ) : (
            <div className="p-8 text-[var(--ink-500)]">
              No sections yet — add one from the sidebar.
            </div>
          )}

          {/* Phase 21.6 Plan 05 (D-04): StructuredFieldPopover — anchored to
              the selected structured-type block. Hosts existing Puck field
              inputs via children slot; edits flow through Puck onChange path. */}
          {selectedBlockId && selectedBlockType && (
            <StructuredFieldPopover
              blockId={selectedBlockId}
              blockType={selectedBlockType}
              anchorRef={selectedBlockAnchorRef}
              onClose={closeStructuredPopover}
            />
          )}
        </main>
      </div>

      {/* Phase 21.6 Plan 05 (D-03): AddMenu — rendered when the add-control is
          clicked in the rail. Positioned relative to the active add button;
          portal-mounted at body level for simplicity (outside canvas). */}
      {addMenuOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40,
          }}
          onClick={() => setAddMenuOpen(false)}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '280px',
              transform: 'translateY(-50%)',
              zIndex: 50,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <AddMenu
              insertAfterIndex={insertAfterStepIndex}
              onClose={() => setAddMenuOpen(false)}
              onOpenLibrary={() => {
                setAddMenuOpen(false)
                setLibraryPickerOpen(true)
              }}
            />
          </div>
        </div>
      )}

      {/* Phase 21.6 Plan 05 (D-03): Phase 13 BlockPicker (library picker).
          Reuses the existing addBlockToSection path — not reimplemented (T-21.6-05-03).
          kindSlug 'step' shows all kinds (no hard filter for the builder context). */}
      {libraryPickerOpen && (
        <BlockPicker
          open={libraryPickerOpen}
          onClose={() => setLibraryPickerOpen(false)}
          kindSlug="step"
          sopCategory={initialSop.category_tag ?? null}
          onAdd={async (input: BlockPickerOnAddInput) => {
            await handleLibraryAdd(input)
            setLibraryPickerOpen(false)
          }}
        />
      )}
    </div>
  )
}
