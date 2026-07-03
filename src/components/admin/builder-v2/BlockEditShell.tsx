'use client'

import { useState } from 'react'
import { GripVertical, Copy, Trash2 } from 'lucide-react'
import { BLOCK_COMPONENTS, stripMeta, type BlockType } from '@/lib/builder/block-registry'
import { humanizeBlockType } from '@/lib/builder/block-type-labels'
import type { LayoutItem } from '@/lib/builder/content-ops'
import { InlineText } from './InlineText'

/**
 * Per-block edit shell (R2 — edit == worker render).
 *
 * The body IS the same worker component from `BLOCK_COMPONENTS` (no forked
 * renderer). On top we layer hover affordances (grip / duplicate / delete /
 * type label) and click-to-edit for the block's primary text field. The worker
 * read state (non-editing) is byte-identical to what the walkthrough renders.
 *
 * `data-block-id={item.props.id}` is the stable hook the later selection-sync
 * reverse binding (P12) queries — always rendered.
 */

// Primary inline-editable text field per block type (Pattern A). The full
// per-field structured panels (P14) land in a later wave; here we wire the one
// main text field so click-to-edit works on the common blocks.
// ponytail: primary text field only — array/config fields come with W2 panels.
const PRIMARY_TEXT_FIELD: Partial<Record<BlockType, string>> = {
  TextBlock: 'content',
  HeadingBlock: 'text',
  CalloutBlock: 'body',
  StepBlock: 'text',
  HazardCardBlock: 'body',
  MeasurementBlock: 'label',
  SignOffBlock: 'title',
  ZoneBlock: 'label',
  EscalateBlock: 'title',
  VoiceNoteBlock: 'prompt',
  InspectBlock: 'title',
  PPECardBlock: 'title',
  DecisionBlock: 'question',
}

interface BlockEditShellProps {
  item: LayoutItem
  onCommitText: (field: string, value: string) => void
  onDuplicate: () => void
  onDelete: () => void
  /** Task 3 (dnd-kit) supplies these to the grip; optional so Task 2 renders. */
  gripProps?: React.HTMLAttributes<HTMLButtonElement>
  setNodeRef?: (node: HTMLElement | null) => void
  style?: React.CSSProperties
}

export function BlockEditShell({
  item,
  onCommitText,
  onDuplicate,
  onDelete,
  gripProps,
  setNodeRef,
  style,
}: BlockEditShellProps) {
  const [editingField, setEditingField] = useState<string | null>(null)
  const type = item.type as BlockType
  // Cast to include undefined: item.type may be an unregistered type (the `as
  // BlockType` above is a convenience, not a guarantee).
  const Block = BLOCK_COMPONENTS[type] as (typeof BLOCK_COMPONENTS)[BlockType] | undefined
  const primaryField = PRIMARY_TEXT_FIELD[type]
  const canEditText = Boolean(Block && primaryField)
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
      </div>

      {/* Body: the SAME worker component (R2). Click primary text to edit inline. */}
      {canEditText && editingField === primaryField ? (
        <InlineText
          initialValue={String(item.props[primaryField as string] ?? '')}
          ariaLabel={`Edit ${humanizeBlockType(item.type)} text`}
          className="prose block w-full whitespace-pre-wrap rounded p-4 outline-none focus:shadow-[0_0_0_2px_rgba(59,130,246,0.22)]"
          onCommit={(value) => {
            setEditingField(null)
            if (value !== item.props[primaryField as string]) {
              onCommitText(primaryField as string, value)
            }
          }}
        />
      ) : (
        <div
          onClick={canEditText ? () => setEditingField(primaryField as string) : undefined}
          className={canEditText ? 'cursor-text' : undefined}
        >
          {Block ? (
            <BlockAny {...stripMeta(item.props)} />
          ) : (
            <div className="p-4 text-sm text-[var(--ink-500,#71717a)]">
              Unsupported block: {item.type}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
