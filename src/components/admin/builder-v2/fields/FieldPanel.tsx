'use client'

import { useEffect, useRef, useState } from 'react'
import type { BlockType } from '@/lib/builder/block-registry'
import type { LayoutItem } from '@/lib/builder/content-ops'
import { FIELD_MAP } from './field-map'
// Panel validates rows against the block's *PropsSchema via isFieldValueValid
// (the same Zod gate commitFieldToContent uses for the actual write).
import { isFieldValueValid } from './field-commit'
import { ArrayFieldEditor, type RowFieldDef } from './ArrayFieldEditor'

/**
 * Phase 26 Plan 26-07 (P14, D-01) — Pattern C anchored field panel.
 *
 * The popover that edits the fields the inline patterns (A/B/D) can't: array
 * lists and panel-only scalar config. Reuses the inserter's `.pk` chrome
 * (1.5px --ink-900 border, 10px radius, deep shadow, 300px, mono header) so
 * there is ONE popover visual language (UI-SPEC §Field-panel visual spec).
 *
 * Opens from the block's "⚙ edit fields" tool; Esc / click-away closes; every
 * change autosaves through the block's Zod-validated, lossless `onCommitField`
 * (→ commitFieldToContent → updateBlockProps; junctionId / block_provenance
 * survive). Invalid states (e.g. Decision `options` < 2) are BLOCKED with an
 * inline message, never silently dropped — the local editor keeps the edit.
 *
 * The C-fields per block are derived from FIELD_MAP (pattern === 'C'); their row
 * shapes live in C_FIELD_SHAPES below (the exact Zod shapes from blocks.ts).
 *
 * SSR-safe: document listeners attach only inside the mount effect (#418).
 */

type CFieldShape =
  | { kind: 'scalar-text'; label: string; placeholder?: string }
  | { kind: 'string-array'; itemLabel: string; minRows: number; newValue: string }
  | {
      kind: 'object-array'
      itemLabel: string
      rowFields: readonly RowFieldDef[]
      minRows: number
      newRow: Record<string, unknown>
    }

/**
 * The bespoke editor shape for every Pattern-C field (keyed `${BlockType}.${field}`).
 * Row shapes mirror the block `*PropsSchema` in src/components/sop/blocks/*.
 */
const C_FIELD_SHAPES: Record<string, CFieldShape> = {
  'PhotoBlock.alt': { kind: 'scalar-text', label: 'Alt text', placeholder: 'Describe the photo' },
  'ModelBlock.assetUrl': {
    kind: 'scalar-text',
    label: 'Asset URL (.glb / .usdz)',
    placeholder: 'https://…',
  },
  'PPECardBlock.items': {
    kind: 'string-array',
    itemLabel: 'PPE item',
    minRows: 1,
    newValue: 'New item',
  },
  'DecisionBlock.options': {
    kind: 'object-array',
    itemLabel: 'option',
    minRows: 2,
    rowFields: [
      { key: 'label', kind: 'text', label: 'Option label' },
      { key: 'isEscalation', kind: 'toggle', label: 'Escalation?' },
    ],
    newRow: { label: 'New option', isEscalation: false },
  },
  'InspectBlock.items': {
    kind: 'object-array',
    itemLabel: 'check',
    minRows: 1,
    rowFields: [
      { key: 'label', kind: 'text', label: 'Item label' },
      { key: 'requirePhoto', kind: 'toggle', label: 'Require photo?' },
    ],
    newRow: { label: 'New check', requirePhoto: false },
  },
}

/** Does this block have any Pattern-C field (i.e. should show the ⚙ trigger)? */
export function hasPanelFields(type: BlockType): boolean {
  return (FIELD_MAP[type] ?? []).some((f) => f.pattern === 'C')
}

interface FieldPanelProps {
  item: LayoutItem
  onCommitField: (field: string, value: unknown) => void
  onClose: () => void
}

export function FieldPanel({ item, onCommitField, onClose }: FieldPanelProps) {
  const type = item.type as BlockType
  const cFields = (FIELD_MAP[type] ?? []).filter((f) => f.pattern === 'C')
  const ref = useRef<HTMLDivElement>(null)

  // Candidate value per field (for the inline validity message only). Seeded
  // from props; editors bubble changes here AND to onCommitField.
  const [candidate, setCandidate] = useState<Record<string, unknown>>(() => {
    const seed: Record<string, unknown> = {}
    for (const f of cFields) seed[f.field] = item.props[f.field]
    return seed
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [onClose])

  function apply(field: string, value: unknown) {
    setCandidate((c) => ({ ...c, [field]: value }))
    onCommitField(field, value)
  }

  return (
    <div
      ref={ref}
      data-field-panel
      role="dialog"
      aria-label="Edit fields"
      className="absolute right-1 top-8 z-30 w-[300px] rounded-[10px] border-[1.5px] border-[var(--ink-900,#09090b)] bg-[var(--paper,#fafafa)] shadow-[0_18px_50px_rgba(0,0,0,0.24)]"
    >
      <div className="flex items-center justify-between border-b border-[var(--ink-300,#d4d4d8)] px-3 py-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-500,#71717a)]">
          Edit fields
        </span>
        <button
          type="button"
          aria-label="Close field panel"
          onClick={onClose}
          className="font-mono text-[11px] text-[var(--ink-500,#71717a)] hover:text-[var(--ink-900,#09090b)]"
        >
          esc
        </button>
      </div>

      <div className="space-y-3 px-3 py-3">
        {cFields.map((f) => {
          const shape = C_FIELD_SHAPES[`${type}.${f.field}`]
          const valid = isFieldValueValid(item.props, type, f.field, candidate[f.field])
          return (
            <div key={f.field} className="space-y-1.5">
              <span className="block font-mono text-[9px] uppercase tracking-wider text-[var(--ink-500,#71717a)]">
                {shape && 'label' in shape ? shape.label : f.field}
              </span>

              {shape?.kind === 'scalar-text' && (
                <input
                  type="text"
                  aria-label={`Edit ${f.field}`}
                  placeholder={shape.placeholder}
                  defaultValue={item.props[f.field] == null ? '' : String(item.props[f.field])}
                  onChange={(e) => apply(f.field, e.target.value)}
                  className="w-full rounded border border-[var(--ink-300,#d4d4d8)] px-2 py-1 text-[13px] outline-none focus:shadow-[0_0_0_2px_rgba(59,130,246,0.22)]"
                />
              )}

              {shape?.kind === 'string-array' && (
                <ArrayFieldEditor
                  variant="string"
                  itemLabel={shape.itemLabel}
                  value={(Array.isArray(item.props[f.field]) ? item.props[f.field] : []) as string[]}
                  minRows={shape.minRows}
                  newRow={shape.newValue}
                  ariaLabel={`Edit ${f.field}`}
                  onChange={(rows) => apply(f.field, rows)}
                />
              )}

              {shape?.kind === 'object-array' && (
                <ArrayFieldEditor
                  variant="object"
                  rowFields={shape.rowFields}
                  itemLabel={shape.itemLabel}
                  value={
                    (Array.isArray(item.props[f.field])
                      ? item.props[f.field]
                      : []) as Record<string, unknown>[]
                  }
                  minRows={shape.minRows}
                  newRow={shape.newRow}
                  ariaLabel={`Edit ${f.field}`}
                  onChange={(rows) => apply(f.field, rows)}
                />
              )}

              {!valid && (
                <span
                  data-field-invalid
                  className="block font-mono text-[10px] text-[var(--accent-hazard,#ef4444)]"
                >
                  Invalid — keeping the last valid value.
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
