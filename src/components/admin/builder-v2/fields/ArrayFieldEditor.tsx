'use client'

import { useState } from 'react'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
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

/**
 * Phase 26 Plan 26-07 (P14, D-01) — Pattern C array-row editor.
 *
 * Renders one row per array item with add / remove / dnd-kit reorder. Two row
 * shapes cover every registered array field:
 *   - `variant='string'` — each row is a plain string  (PPECard `items[]`)
 *   - `variant='object'` — each row is a record edited via `rowFields`
 *     (Decision `options[]{label,isEscalation}`, Inspect `items[]{label,requirePhoto}`)
 *
 * Row objects are edited by SPREAD-MERGE (`{ ...row, [key]: v }`) so unknown row
 * keys survive — e.g. a Decision option's `nextStepId` (set by the flow-graph
 * field) is preserved when its label is edited here (R7 lossless).
 *
 * Owns local `rows` state (seeded once) so a keystroke never snaps back when the
 * parent commit rejects an intermediate invalid state (e.g. an empty label); the
 * FieldPanel surfaces the Zod validity as an inline message instead of dropping
 * the edit. Removing below `minRows` is blocked (Decision min 2 / Inspect min 1).
 *
 * SSR-safe: row keys are generated in a useState initializer (client-only, the
 * panel only mounts on click) — no module-load/render randomness (#418).
 */

export interface RowFieldDef {
  key: string
  kind: 'text' | 'toggle'
  label: string
}

type RowData = string | Record<string, unknown>
interface InternalRow {
  key: string
  data: RowData
}

interface ArrayFieldEditorProps {
  variant: 'string' | 'object'
  /** Object variant only — the per-row editable fields. */
  rowFields?: readonly RowFieldDef[]
  /** String variant only — the single input's label. */
  itemLabel?: string
  value: readonly RowData[]
  /** Zod min count — the remove button is disabled at/below this. */
  minRows: number
  /** Shape of a freshly-added row (deep-cloned per add). */
  newRow: RowData
  onChange: (rows: RowData[]) => void
  ariaLabel: string
}

function SortableRow({
  row,
  variant,
  rowFields,
  itemLabel,
  canRemove,
  onEditString,
  onEditField,
  onToggle,
  onRemove,
}: {
  row: InternalRow
  variant: 'string' | 'object'
  rowFields?: readonly RowFieldDef[]
  itemLabel?: string
  canRemove: boolean
  onEditString: (v: string) => void
  onEditField: (key: string, v: string) => void
  onToggle: (key: string) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.key,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  }
  const obj = typeof row.data === 'object' ? (row.data as Record<string, unknown>) : {}

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-array-row
      className="flex items-start gap-2 rounded-md border border-[var(--ink-300,#d4d4d8)] bg-[var(--paper,#fafafa)] px-2 py-1.5"
    >
      <button
        type="button"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        className="mt-1 cursor-grab text-[var(--ink-300,#d4d4d8)]"
      >
        <GripVertical size={14} />
      </button>

      <div className="flex flex-1 flex-col gap-1.5">
        {variant === 'string' ? (
          <input
            type="text"
            aria-label={itemLabel ?? 'Item'}
            defaultValue={typeof row.data === 'string' ? row.data : ''}
            onChange={(e) => onEditString(e.target.value)}
            className="w-full rounded border border-[var(--ink-300,#d4d4d8)] px-2 py-1 text-[13px] outline-none focus:shadow-[0_0_0_2px_rgba(59,130,246,0.22)]"
          />
        ) : (
          (rowFields ?? []).map((rf) =>
            rf.kind === 'text' ? (
              <input
                key={rf.key}
                type="text"
                aria-label={rf.label}
                defaultValue={obj[rf.key] == null ? '' : String(obj[rf.key])}
                onChange={(e) => onEditField(rf.key, e.target.value)}
                className="w-full rounded border border-[var(--ink-300,#d4d4d8)] px-2 py-1 text-[13px] outline-none focus:shadow-[0_0_0_2px_rgba(59,130,246,0.22)]"
              />
            ) : (
              <label
                key={rf.key}
                className="flex items-center gap-2 font-mono text-[11px] text-[var(--ink-500,#71717a)]"
              >
                <input
                  type="checkbox"
                  aria-label={rf.label}
                  checked={obj[rf.key] === true}
                  onChange={() => onToggle(rf.key)}
                />
                {rf.label}
              </label>
            )
          )
        )}
      </div>

      <button
        type="button"
        aria-label="Remove row"
        disabled={!canRemove}
        onClick={onRemove}
        className="mt-1 text-[var(--ink-300,#d4d4d8)] enabled:hover:text-[var(--accent-hazard,#ef4444)] disabled:opacity-30"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

export function ArrayFieldEditor({
  variant,
  rowFields,
  itemLabel,
  value,
  minRows,
  newRow,
  onChange,
  ariaLabel,
}: ArrayFieldEditorProps) {
  const [rows, setRows] = useState<InternalRow[]>(() =>
    value.map((data) => ({ key: crypto.randomUUID(), data }))
  )

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Apply a mutation to the internal rows AND emit the plain array in one shot
  // (setRows is async — emit the freshly computed value, not stale state).
  function commit(next: InternalRow[]) {
    setRows(next)
    onChange(next.map((r) => r.data))
  }

  function editString(key: string, v: string) {
    commit(rows.map((r) => (r.key === key ? { ...r, data: v } : r)))
  }
  function editField(key: string, field: string, v: string) {
    commit(
      rows.map((r) =>
        r.key === key ? { ...r, data: { ...(r.data as object), [field]: v } } : r
      )
    )
  }
  function toggleField(key: string, field: string) {
    commit(
      rows.map((r) => {
        if (r.key !== key) return r
        const o = r.data as Record<string, unknown>
        return { ...r, data: { ...o, [field]: !(o[field] === true) } }
      })
    )
  }
  function addRow() {
    const data =
      typeof newRow === 'object' ? structuredClone(newRow) : newRow
    commit([...rows, { key: crypto.randomUUID(), data }])
  }
  function removeRow(key: string) {
    if (rows.length <= minRows) return
    commit(rows.filter((r) => r.key !== key))
  }
  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const from = rows.findIndex((r) => r.key === active.id)
    const to = rows.findIndex((r) => r.key === over.id)
    if (from < 0 || to < 0) return
    const next = rows.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    commit(next)
  }

  const canRemove = rows.length > minRows

  return (
    <div data-array-editor aria-label={ariaLabel} className="flex flex-col gap-1.5">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={rows.map((r) => r.key)} strategy={verticalListSortingStrategy}>
          {rows.map((row) => (
            <SortableRow
              key={row.key}
              row={row}
              variant={variant}
              rowFields={rowFields}
              itemLabel={itemLabel}
              canRemove={canRemove}
              onEditString={(v) => editString(row.key, v)}
              onEditField={(field, v) => editField(row.key, field, v)}
              onToggle={(field) => toggleField(row.key, field)}
              onRemove={() => removeRow(row.key)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        type="button"
        data-array-add
        onClick={addRow}
        className="inline-flex items-center gap-1 self-start rounded border border-dashed border-[var(--ink-300,#d4d4d8)] px-2 py-1 font-mono text-[11px] text-[var(--ink-500,#71717a)] hover:border-[var(--accent-step,#3b82f6)] hover:text-[var(--accent-step,#3b82f6)]"
      >
        <Plus size={12} /> add {itemLabel ?? 'row'}
      </button>
    </div>
  )
}
