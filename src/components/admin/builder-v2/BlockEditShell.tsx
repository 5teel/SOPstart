'use client'

import { useState } from 'react'
import { GripVertical, Copy, Trash2, SlidersHorizontal } from 'lucide-react'
import { BLOCK_COMPONENTS, stripMeta, type BlockType } from '@/lib/builder/block-registry'
import { humanizeBlockType } from '@/lib/builder/block-type-labels'
import type { LayoutItem } from '@/lib/builder/content-ops'
import { FIELD_MAP, ACCENT_BY_TYPE, DEFAULT_ACCENT, type FieldSpec } from './fields/field-map'
import { InlineText } from './InlineText'
import { EnumChip } from './fields/EnumChip'
import { InlineToken } from './fields/InlineToken'
import { FieldPanel, hasPanelFields } from './fields/FieldPanel'

/**
 * Per-block edit shell (R2 — edit == worker render; P14 — bespoke field editors).
 *
 * The body IS the same worker component from `BLOCK_COMPONENTS` (no forked
 * renderer). On hover we reveal:
 *   - block tools (grip / duplicate / delete / type label),
 *   - a FIELD_MAP-driven field strip that makes every Puck-editable field
 *     reachable — Pattern A → InlineText, B → EnumChip, D → InlineToken,
 *     C → the anchored FieldPanel (⚙ edit-fields tool; array + config editors).
 * Every edit commits through the caller's Zod-validated, lossless `onCommitField`
 * (junctionId / block_provenance survive — R7). Pattern E (media grid) is
 * declared in FIELD_MAP and lands in 26-09; until then its fields show a
 * `media — soon` marker (not yet inline-editable).
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

  // Pattern E (media grid) — declared for reachability, implemented in 26-09.
  return (
    <div className="flex items-center gap-2">
      {label}
      <span className="rounded border border-dashed border-[var(--ink-300,#d4d4d8)] px-2 py-0.5 font-mono text-[10px] text-[var(--ink-500,#71717a)]">
        media — soon
      </span>
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-block-id={item.props.id}
      data-block-type={item.type}
      className="group relative rounded-lg border border-transparent transition-colors hover:border-[var(--accent-step,#3b82f6)] hover:shadow-[0_0_0_3px_rgba(59,130,246,0.09)]"
    >
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

      {/* Body: the SAME worker component (R2) as the live preview. */}
      <div className="p-4">
        {Block ? (
          <BlockAny {...stripMeta(item.props)} />
        ) : (
          <div className="text-sm text-[var(--ink-500,#71717a)]">Unsupported block: {item.type}</div>
        )}
      </div>

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
