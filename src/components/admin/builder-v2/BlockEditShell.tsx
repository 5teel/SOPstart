'use client'

import { useState } from 'react'
import { GripVertical, Copy, Trash2, SlidersHorizontal } from 'lucide-react'
import { BLOCK_COMPONENTS, stripMeta, type BlockType } from '@/lib/builder/block-registry'
import { humanizeBlockType } from '@/lib/builder/block-type-labels'
import type { LayoutItem } from '@/lib/builder/content-ops'
import { useSelectionSync } from '@/components/admin/source-viewer/useSelectionSync'
import { selectBlock } from './selection-bridge'
import type { SourceProvenanceRegion } from '@/lib/parsers/source-viewer'
import { ReviewerFlagsPanel } from '@/components/admin/ai-reviewer/ReviewerFlagsPanel'
import { PuckItemBadgeOverlay } from '@/components/sop/blocks/PuckItemBadgeOverlay'
import type { SopSectionBlockWithUpdate } from '@/types/sop'
import { FIELD_MAP, ACCENT_BY_TYPE, DEFAULT_ACCENT, type FieldSpec } from './fields/field-map'
import { InlineText } from './InlineText'
import { EnumChip } from './fields/EnumChip'
import { InlineToken } from './fields/InlineToken'
import { FieldPanel, hasPanelFields } from './fields/FieldPanel'
import { MediaGrid } from './visual/MediaGrid'

/**
 * Per-block edit shell (R2 — edit == worker render; P14 — bespoke field editors).
 *
 * The body IS the same worker component from `BLOCK_COMPONENTS` (no forked
 * renderer). On hover we reveal:
 *   - block tools (grip / duplicate / delete / type label),
 *   - a FIELD_MAP-driven field strip that makes every Puck-editable field
 *     reachable — Pattern A → InlineText, B → EnumChip, D → InlineToken,
 *     C → the anchored FieldPanel (⚙ edit-fields tool; array + config editors),
 *     E → the unified MediaGrid (media grid + medium sub-picker, 26-09).
 * Every edit commits through the caller's Zod-validated, lossless `onCommitField`
 * (junctionId / block_provenance survive — R7). Pattern E routes the legacy photo
 * blocks THROUGH the Visual media control without any layout_data kind rewrite (A3).
 *
 * `data-block-id={item.props.id}` is the stable hook the later selection-sync
 * reverse binding (P12) queries — always rendered. Worker read mode (LayoutRenderer)
 * never mounts this shell, so workers never see any edit affordance.
 */
interface BlockEditShellProps {
  item: LayoutItem
  /** Commit a single field edit; value is raw (string for A/D, enum value for B). */
  onCommitField: (field: string, value: unknown) => void
  onDuplicate: () => void
  onDelete: () => void
  /** Task 3 (dnd-kit) supplies these to the grip; optional so callers can omit. */
  gripProps?: React.HTMLAttributes<HTMLButtonElement>
  setNodeRef?: (node: HTMLElement | null) => void
  style?: React.CSSProperties
  /**
   * P12 selection-sync (26-12). When the SOP was converted from a source doc,
   * the canvas host marks blocks `selectable` and supplies the block's junction
   * id + resolved provenance region. Focusing/clicking the block fires
   * `setActiveProvenance(region, junctionId)` → the source pane highlights it.
   * Non-convert SOPs pass `selectable={false}` and see none of this (UI-SPEC
   * §Convert-Provenance: `body:not(.convert) .verify{display:none}`).
   */
  selectable?: boolean
  junctionId?: string | null
  region?: SourceProvenanceRegion | null
  /** Notify the host a block was selected (e.g. to lift single-panel state). */
  onSelect?: () => void
  /**
   * P13 AI-flag overlay + P9 orphan chip (26-12). The junction row carries the
   * update-available flag (13-04 badge) and verify state; `sopId` + `flagsCount`
   * drive the reviewer-flag badge/panel (reused `ReviewerFlagsPanel`,
   * `PuckItemBadgeOverlay` AS-IS). `flagsOpen` is lifted to the host so only ONE
   * panel is expanded at a time (UI-SPEC §Review Overlays).
   */
  junction?: SopSectionBlockWithUpdate | null
  sopId?: string
  flagsCount?: number
  flagsOpen?: boolean
  onToggleFlags?: () => void
  /** Refresh junctions after the update-available badge Accept/Decline. */
  onReviewed?: () => void
}

function FieldControl({
  spec,
  item,
  accent,
  onCommitField,
  onOpenPanel,
}: {
  spec: FieldSpec
  item: LayoutItem
  accent: string
  onCommitField: (field: string, value: unknown) => void
  onOpenPanel: () => void
}) {
  const raw = item.props[spec.field]
  const label = (
    <span className="min-w-[5rem] font-mono text-[9px] uppercase tracking-wider text-[var(--ink-500,#71717a)]">
      {spec.field}
    </span>
  )

  if (spec.pattern === 'A') {
    return (
      <div className="flex items-start gap-2">
        {label}
        <InlineText
          autoFocus={false}
          initialValue={raw == null ? '' : String(raw)}
          ariaLabel={`Edit ${spec.field}`}
          className="prose block flex-1 whitespace-pre-wrap rounded border border-[var(--ink-300,#d4d4d8)] px-2 py-1 text-[13px] outline-none focus:shadow-[0_0_0_2px_rgba(59,130,246,0.22)]"
          onCommit={(value) => {
            if (value !== raw) onCommitField(spec.field, value)
          }}
        />
      </div>
    )
  }

  if (spec.pattern === 'B') {
    return (
      <div className="flex items-center gap-2">
        {label}
        <EnumChip
          value={raw}
          options={spec.options ?? []}
          accent={accent}
          ariaLabel={`Edit ${spec.field}`}
          onSelect={(value) => onCommitField(spec.field, value)}
        />
      </div>
    )
  }

  if (spec.pattern === 'D') {
    return (
      <div className="flex items-center gap-2">
        {label}
        <InlineToken
          value={raw}
          ariaLabel={`Edit ${spec.field}`}
          onCommit={(rawStr) => onCommitField(spec.field, rawStr)}
        />
      </div>
    )
  }

  // Pattern C (array / config panel) — opens the anchored FieldPanel (26-07).
  if (spec.pattern === 'C') {
    return (
      <div className="flex items-center gap-2">
        {label}
        <button
          type="button"
          data-open-field-panel
          aria-label={`Edit ${spec.field} in field panel`}
          onClick={onOpenPanel}
          className="inline-flex items-center gap-1 rounded border border-[var(--ink-300,#d4d4d8)] px-2 py-0.5 font-mono text-[10px] text-[var(--ink-500,#71717a)] hover:border-[var(--accent-step,#3b82f6)] hover:text-[var(--accent-step,#3b82f6)]"
        >
          <SlidersHorizontal size={11} /> edit
        </button>
      </div>
    )
  }

  // Pattern E (media grid + medium sub-picker) — the unified Visual media control
  // (26-09). Legacy photo blocks edit THROUGH it without any layout_data kind
  // rewrite (A3); the Visual block adds the photo/diagram/video sub-picker.
  return (
    <div className="flex items-start gap-2">
      {label}
      <MediaGrid item={item} field={spec.field} onCommitField={onCommitField} />
    </div>
  )
}

export function BlockEditShell({
  item,
  onCommitField,
  onDuplicate,
  onDelete,
  gripProps,
  setNodeRef,
  style,
  selectable = false,
  junctionId = null,
  region = null,
  onSelect,
  junction = null,
  sopId,
  flagsCount = 0,
  flagsOpen = false,
  onToggleFlags,
  onReviewed,
}: BlockEditShellProps) {
  const type = item.type as BlockType
  // Cast to include undefined: item.type may be an unregistered type.
  const Block = BLOCK_COMPONENTS[type] as (typeof BLOCK_COMPONENTS)[BlockType] | undefined
  const specs = FIELD_MAP[type] ?? []
  const accent = ACCENT_BY_TYPE[type] ?? DEFAULT_ACCENT
  const showPanelTrigger = hasPanelFields(type)
  const [panelOpen, setPanelOpen] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const BlockAny = Block as any

  // P9 orphan-image chip — Heading blocks whose text starts "Unanchored figures…"
  // (re-implemented from the old Puck componentOverlay / sketch chip).
  const isOrphanHeading =
    item.type === 'HeadingBlock' &&
    String((item.props as { text?: unknown }).text ?? '').startsWith('Unanchored figures')
  // P13 update-available badge (13-04) is reused via PuckItemBadgeOverlay, keyed
  // by componentId off a one-entry map built from this block's junction row.
  const badgeMap: Map<string, SopSectionBlockWithUpdate> =
    junction ? new Map([[item.props.id, junction]]) : new Map()
  const showReviewOverlay = selectable && (isOrphanHeading || flagsCount > 0 || !!junction)

  const bodyInner = Block ? (
    <BlockAny {...stripMeta(item.props)} />
  ) : (
    <div className="text-sm text-[var(--ink-500,#71717a)]">Unsupported block: {item.type}</div>
  )
  const body = <div className="p-4">{bodyInner}</div>

  // P12 forward binding — fire selection-sync on focus/click (convert SOPs only).
  // `useSelectionSync` returns the no-op default outside the provider, so this is
  // safe on the source-less Build canvas too; `selectable` gates it to convert SOPs.
  const { setActiveProvenance } = useSelectionSync()
  const handleSelect = selectable
    ? () => {
        selectBlock(setActiveProvenance, region, junctionId)
        onSelect?.()
      }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-block-id={item.props.id}
      data-block-type={item.type}
      data-selectable={selectable ? 'true' : undefined}
      tabIndex={selectable ? 0 : undefined}
      onFocusCapture={handleSelect}
      onClick={handleSelect}
      className="group relative rounded-lg border border-transparent transition-colors hover:border-[var(--accent-step,#3b82f6)] hover:shadow-[0_0_0_3px_rgba(59,130,246,0.09)] focus:outline-none focus-visible:border-[var(--accent-step,#3b82f6)] focus-visible:shadow-[0_0_0_3px_rgba(59,130,246,0.18)]"
    >
      {/* P13/P9 review overlay — badges sit inside the block header (never
          floating, per UI-SPEC z-order). Only shown on convert SOPs. */}
      {showReviewOverlay && (
        <div data-review-overlay className="absolute left-2 top-1 z-20 flex items-center gap-1">
          {isOrphanHeading && (
            <span
              data-reference-images-chip
              aria-label="Reference images"
              className="inline-flex items-center rounded border border-dashed border-[var(--ink-300,#d4d4d8)] px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-[var(--ink-500,#71717a)]"
            >
              Reference images
            </span>
          )}
          {flagsCount > 0 && (
            <button
              type="button"
              data-ai-flag-badge
              aria-label={`${flagsCount} AI ${flagsCount === 1 ? 'flag' : 'flags'} — tap to review`}
              aria-expanded={flagsOpen}
              onClick={onToggleFlags}
              className="inline-flex items-center gap-1 rounded border border-[var(--accent-ai,#8b5cf6)] bg-[color-mix(in_srgb,var(--accent-ai,#8b5cf6)_12%,transparent)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--accent-ai,#8b5cf6)]"
            >
              ⚑ {flagsCount}
            </button>
          )}
        </div>
      )}

      {/* Drag grip — Task 3 wires @dnd-kit useSortable listeners via gripProps. */}
      <button
        type="button"
        data-block-grip
        aria-label="Drag to reorder"
        {...gripProps}
        className="absolute -left-6 top-1/2 flex -translate-y-1/2 cursor-grab items-center text-[var(--ink-300,#d4d4d8)] opacity-0 group-hover:opacity-100"
      >
        <GripVertical size={16} />
      </button>

      {/* Type label + tools — hidden until hover (worker read mode shows none). */}
      <div className="absolute right-1 top-1 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100">
        <span className="px-1 font-mono text-[9px] uppercase tracking-wider text-[var(--ink-500,#71717a)]">
          {humanizeBlockType(item.type)}
        </span>
        <button
          type="button"
          aria-label="Duplicate block"
          onClick={onDuplicate}
          className="grid h-6 w-6 place-items-center rounded border border-[var(--ink-300,#d4d4d8)]"
        >
          <Copy size={12} />
        </button>
        <button
          type="button"
          aria-label="Delete block"
          onClick={onDelete}
          className="grid h-6 w-6 place-items-center rounded border border-[var(--ink-300,#d4d4d8)] hover:text-[var(--accent-hazard,#ef4444)]"
        >
          <Trash2 size={12} />
        </button>
        {showPanelTrigger && (
          <button
            type="button"
            data-edit-fields-tool
            aria-label="Edit fields"
            onClick={() => setPanelOpen((o) => !o)}
            className="grid h-6 w-6 place-items-center rounded border border-[var(--ink-300,#d4d4d8)] hover:text-[var(--accent-step,#3b82f6)]"
          >
            <SlidersHorizontal size={12} />
          </button>
        )}
      </div>

      {/* Pattern C anchored field panel (P14) — array + config editors. */}
      {showPanelTrigger && panelOpen && (
        <FieldPanel item={item} onCommitField={onCommitField} onClose={() => setPanelOpen(false)} />
      )}

      {/* Body: the SAME worker component (R2) as the live preview. P13 wraps it
          in the reused 13-04 PuckItemBadgeOverlay so a linked block with a newer
          library version surfaces the "update ▸" badge (no-op when up to date). */}
      {selectable && junction ? (
        <PuckItemBadgeOverlay
          componentId={item.props.id}
          componentIdToJunction={badgeMap}
          onReviewed={onReviewed}
        >
          {body}
        </PuckItemBadgeOverlay>
      ) : (
        body
      )}

      {/* P13 inline AI-flag panel (reused AS-IS; renders null when clean). One
          panel expanded at a time — `flagsOpen` is lifted to the canvas host. */}
      {selectable && flagsOpen && sopId && junctionId && (
        <div data-flags-panel className="px-4 pb-2">
          <ReviewerFlagsPanel sopId={sopId} blockId={junctionId} blockProvenance={region ?? null} />
        </div>
      )}

      {/* FIELD_MAP-driven editors (P14) — hover-revealed, every field reachable. */}
      {specs.length > 0 && (
        <div
          data-field-strip
          className="space-y-1.5 border-t border-[var(--ink-300,#d4d4d8)] px-4 py-2 opacity-0 group-hover:opacity-100"
        >
          {specs.map((spec) => (
            // data-field is the P14 reachability hook: every Puck-editable field
            // renders exactly one affordance row (parity test asserts 0 missing).
            <div key={spec.field} data-field={spec.field}>
              <FieldControl
                spec={spec}
                item={item}
                accent={accent}
                onCommitField={onCommitField}
                onOpenPanel={() => setPanelOpen(true)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
