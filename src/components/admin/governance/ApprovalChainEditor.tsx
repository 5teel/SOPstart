'use client'

/**
 * Phase 29 Plan 03 — APR-01 admin-facing config panel (D29-05: one panel, no
 * new route, no wizard). Relocated to /admin/settings in 30-08 (UX-03 fold).
 *
 * Presentational + local edit state only — all data (categories, members,
 * existing chains) is fetched server-side by admin/settings/page.tsx and passed
 * in as props. Save wires directly to setApprovalChain (src/actions/approvals.ts).
 *
 * Step rows mirror chainStepSchema (src/lib/validators/approvals.ts): exactly
 * one of role/userId, role restricted to admin/safety_manager (Pitfall 3).
 * Drag-reorder copies the ArrayFieldEditor dnd-kit idiom (Phase 26,
 * src/components/admin/builder-v2/fields/ArrayFieldEditor.tsx) — do not
 * hand-roll drag logic.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
import { setApprovalChain } from '@/actions/approvals'
import type { ChainStep } from '@/lib/governance/approvals'

const CHAIN_ROLES = ['admin', 'safety_manager'] as const

export interface ChainMember {
  user_id: string
  role: string
  label: string
}

interface EditableStep {
  key: string
  target: 'role' | 'member'
  role: (typeof CHAIN_ROLES)[number]
  userId: string
  label: string
}

function toEditableSteps(steps: ChainStep[], members: ChainMember[]): EditableStep[] {
  if (steps.length === 0) {
    return [{ key: crypto.randomUUID(), target: 'role', role: 'admin', userId: members[0]?.user_id ?? '', label: '' }]
  }
  return steps.map((s) => ({
    key: crypto.randomUUID(),
    target: s.userId ? 'member' : 'role',
    role: (s.role ?? 'admin') as (typeof CHAIN_ROLES)[number],
    userId: s.userId ?? members[0]?.user_id ?? '',
    label: s.label,
  }))
}

function SortableStepRow({
  step,
  index,
  members,
  canRemove,
  onChange,
  onRemove,
}: {
  step: EditableStep
  index: number
  members: ChainMember[]
  canRemove: boolean
  onChange: (next: Partial<EditableStep>) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.key })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="blueprint-frame flex items-start gap-2 p-2">
      <button
        type="button"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
        className="mt-2 cursor-grab text-[var(--ink-500)]"
      >
        <GripVertical size={14} />
      </button>

      <div className="flex flex-1 flex-wrap items-center gap-2">
        <span className="mono text-[11px] text-[var(--ink-500)]">Step {index + 1}</span>

        <select
          aria-label="Approver type"
          value={step.target}
          onChange={(e) => onChange({ target: e.target.value as 'role' | 'member' })}
          className="rounded border border-[var(--ink-100)] bg-[var(--paper-1)] px-2 py-1 text-sm"
        >
          <option value="role">Role</option>
          <option value="member">Named member</option>
        </select>

        {step.target === 'role' ? (
          <select
            aria-label="Approver role"
            value={step.role}
            onChange={(e) => onChange({ role: e.target.value as (typeof CHAIN_ROLES)[number] })}
            className="rounded border border-[var(--ink-100)] bg-[var(--paper-1)] px-2 py-1 text-sm"
          >
            {CHAIN_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        ) : (
          <select
            aria-label="Approver member"
            value={step.userId}
            onChange={(e) => onChange({ userId: e.target.value })}
            className="rounded border border-[var(--ink-100)] bg-[var(--paper-1)] px-2 py-1 text-sm"
          >
            {members.map((m) => (
              <option key={m.user_id} value={m.user_id}>{m.label}</option>
            ))}
          </select>
        )}

        <input
          type="text"
          aria-label="Step label"
          placeholder="Label (e.g. Site manager)"
          value={step.label}
          onChange={(e) => onChange({ label: e.target.value })}
          className="min-w-[10rem] flex-1 rounded border border-[var(--ink-100)] bg-[var(--paper-1)] px-2 py-1 text-sm"
        />
      </div>

      <button
        type="button"
        aria-label="Remove step"
        disabled={!canRemove}
        onClick={onRemove}
        className="mt-1 text-[var(--ink-500)] enabled:hover:text-red-600 disabled:opacity-30"
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export function ApprovalChainEditor({
  categories,
  members,
  chains,
}: {
  categories: string[]
  members: ChainMember[]
  chains: Record<string, ChainStep[]>
}) {
  const router = useRouter()
  const [category, setCategory] = useState(categories[0] ?? '')
  const [steps, setSteps] = useState<EditableStep[]>(() => toEditableSteps(chains[categories[0] ?? ''] ?? [], members))
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function selectCategory(next: string) {
    setCategory(next)
    setSteps(toEditableSteps(chains[next] ?? [], members))
    setError(null)
    setSaved(false)
  }

  function updateStep(key: string, patch: Partial<EditableStep>) {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)))
    setSaved(false)
  }

  function addStep() {
    if (steps.length >= 4) return
    setSteps((prev) => [
      ...prev,
      { key: crypto.randomUUID(), target: 'role', role: 'admin', userId: members[0]?.user_id ?? '', label: '' },
    ])
    setSaved(false)
  }

  function removeStep(key: string) {
    if (steps.length <= 1) return
    setSteps((prev) => prev.filter((s) => s.key !== key))
    setSaved(false)
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    setSteps((prev) => {
      const from = prev.findIndex((s) => s.key === active.id)
      const to = prev.findIndex((s) => s.key === over.id)
      if (from < 0 || to < 0) return prev
      const next = prev.slice()
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next
    })
    setSaved(false)
  }

  function handleSave() {
    setError(null)
    setSaved(false)
    if (!category) {
      setError('Select a category')
      return
    }
    const payload: ChainStep[] = steps.map((s) =>
      s.target === 'role'
        ? { role: s.role, label: s.label }
        : { userId: s.userId, label: s.label },
    )
    startTransition(async () => {
      const result = await setApprovalChain(category, payload)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  if (categories.length === 0) {
    return (
      <div className="blueprint-frame p-4">
        <p className="text-sm text-[var(--ink-500)]">No SOP categories yet — publish an SOP with a category to configure an approval chain.</p>
      </div>
    )
  }

  return (
    <div className="blueprint-frame p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="mono text-[11px] uppercase tracking-wider text-[var(--ink-500)]">Category</span>
        <select
          aria-label="Chain category"
          value={category}
          onChange={(e) => selectCategory(e.target.value)}
          className="rounded border border-[var(--ink-100)] bg-[var(--paper-1)] px-2 py-1 text-sm"
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={onDragEnd}>
        <SortableContext items={steps.map((s) => s.key)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {steps.map((step, i) => (
              <SortableStepRow
                key={step.key}
                step={step}
                index={i}
                members={members}
                canRemove={steps.length > 1}
                onChange={(patch) => updateStep(step.key, patch)}
                onRemove={() => removeStep(step.key)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={addStep}
          disabled={steps.length >= 4}
          className="evidence-btn !min-h-[32px] text-sm inline-flex items-center gap-1 disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" /> Add step
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="evidence-btn !min-h-[36px] text-sm"
        >
          {isPending ? 'Saving…' : 'Save chain'}
        </button>

        {saved && !error && <span className="text-xs text-green-600">Saved</span>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}
