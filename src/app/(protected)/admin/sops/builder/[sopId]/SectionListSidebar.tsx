'use client'
import { useState } from 'react'
import { GripVertical } from 'lucide-react'
import { reorderSections } from '@/actions/sections'

interface SectionLite {
  id: string
  title: string
  sort_order: number
}

interface Props {
  sections: SectionLite[]
  activeSectionId: string
  onSelect: (id: string) => void
  sopId: string
}

/**
 * Left-rail section list with HTML5 drag-and-drop reorder.
 * Calls the `reorderSections` server action on drop (atomic RPC).
 * Optimistic update locally; reverts + shows inline error on failure.
 */
export function SectionListSidebar({
  sections,
  activeSectionId,
  onSelect,
  sopId,
}: Props) {
  const [order, setOrder] = useState<SectionLite[]>(() =>
    [...sections].sort((a, b) => a.sort_order - b.sort_order)
  )
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function commitReorder(next: SectionLite[]) {
    setError(null)
    const prev = order
    setOrder(next) // optimistic
    const result = await reorderSections({
      sopId,
      orderedSectionIds: next.map((s) => s.id),
    })
    if ('error' in result) {
      setOrder(prev) // revert
      setError(result.error)
    }
  }

  function handleDrop(targetIdx: number) {
    if (draggedIdx === null || draggedIdx === targetIdx) return
    const next = [...order]
    const [moved] = next.splice(draggedIdx, 1)
    next.splice(targetIdx, 0, moved)
    setDraggedIdx(null)
    void commitReorder(next)
  }

  return (
    <nav
      aria-label="Sections"
      className="w-64 shrink-0 border-r border-steel-700 overflow-y-auto"
    >
      {error && (
        <div className="px-4 py-2 text-xs text-red-400 border-b border-red-500/30 bg-red-500/10">
          {error}
        </div>
      )}
      <ul>
        {order.map((s, idx) => (
          <li
            key={s.id}
            draggable
            onDragStart={() => setDraggedIdx(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(idx)}
            data-section-row={s.id}
            className={`flex items-center gap-2 ${
              s.id === activeSectionId ? 'bg-steel-800' : 'hover:bg-steel-800'
            }`}
          >
            <span
              className="pl-2 text-steel-500 cursor-grab"
              aria-hidden
              data-drag-handle
            >
              <GripVertical size={14} />
            </span>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className={`flex-1 text-left py-3 pr-4 text-sm ${
                s.id === activeSectionId
                  ? 'text-brand-yellow'
                  : 'text-steel-300'
              }`}
            >
              {s.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
