'use client'

/**
 * Phase 25: DepartmentBottomSheet + DepartmentSidebar — replace CategoryBottomSheet.
 *
 * Old props: { categories: CategoryItem[]; activeCategory: string|null; onSelect; open; onClose }
 * New props: { departments: Department[]; selectedIds: string[]; allDepartments: boolean;
 *              onSelect: (ids, allDepts) => void; open: boolean; onClose: () => void }
 *
 * Visual: same slide-up panel structure as CategoryBottomSheet.
 * Each department row: colour swatch + name + checkbox.
 * "All departments" option at top (cyan, ◇ prefix, no swatch).
 * "Done" button commits the selection.
 *
 * The desktop sidebar (DepartmentSidebar) renders inline — same department selection
 * but in a sticky side panel.
 *
 * Worker SOP visibility is gated by sops_visible_by_department RLS (Plan 01);
 * this component is a view filter only.
 */

import { useState } from 'react'
import { Check } from 'lucide-react'
import type { Department } from '@/types/sop'

export interface DepartmentBottomSheetProps {
  departments: Department[]
  selectedIds: string[]
  allDepartments: boolean
  onSelect: (ids: string[], allDepts: boolean) => void
  open: boolean
  onClose: () => void
}

function DepartmentRow({
  dept,
  isSelected,
  onToggle,
  height,
}: {
  dept: { id: string; name: string; colour: string }
  isSelected: boolean
  onToggle: () => void
  height: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'flex items-center justify-between px-4 rounded-xl transition-colors cursor-pointer w-full text-left',
        height,
        isSelected
          ? 'bg-[var(--ink-900)]/15 border border-[var(--ink-900)]/30'
          : 'hover:bg-[var(--paper-2)]',
      ].join(' ')}
    >
      <span className="flex items-center gap-3">
        {isSelected && <Check size={16} className="text-[var(--ink-900)] flex-shrink-0" />}
        {!isSelected && <span className="w-4 flex-shrink-0" />}
        {/* Colour swatch */}
        <span
          style={{
            display: 'inline-block',
            width: '10px',
            height: '10px',
            borderRadius: '3px',
            background: dept.colour,
            flexShrink: 0,
          }}
          aria-hidden
        />
        <span className={`text-base font-medium text-[var(--ink-900)]`}>{dept.name}</span>
      </span>
    </button>
  )
}

function AllDepartmentsRow({
  isSelected,
  onToggle,
  height,
}: {
  isSelected: boolean
  onToggle: () => void
  height: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        'flex items-center justify-between px-4 rounded-xl transition-colors cursor-pointer w-full text-left',
        height,
        isSelected
          ? 'border border-[var(--accent-mcu)]/40'
          : 'hover:bg-[var(--paper-2)]',
      ].join(' ')}
      style={isSelected ? { background: 'rgba(6,182,212,0.06)' } : {}}
    >
      <span className="flex items-center gap-3">
        {isSelected && <Check size={16} style={{ color: 'var(--accent-mcu)' }} className="flex-shrink-0" />}
        {!isSelected && <span className="w-4 flex-shrink-0" />}
        <span style={{ color: 'var(--accent-mcu)' }} className="text-base font-medium">
          ◇ All departments
        </span>
      </span>
    </button>
  )
}

export function DepartmentBottomSheet({
  departments,
  selectedIds,
  allDepartments,
  onSelect,
  open,
  onClose,
}: DepartmentBottomSheetProps) {
  // Local draft state — committed on Done
  const [draftIds, setDraftIds] = useState<string[]>(selectedIds)
  const [draftAll, setDraftAll] = useState<boolean>(allDepartments)

  if (!open) return null

  function toggleDept(id: string) {
    setDraftAll(false)
    setDraftIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  function toggleAll() {
    if (draftAll) {
      setDraftAll(false)
    } else {
      setDraftAll(true)
      setDraftIds([])
    }
  }

  function handleDone() {
    onSelect(draftIds, draftAll)
    onClose()
  }

  return (
    <>
      {/* Mobile bottom sheet */}
      <div className="lg:hidden">
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Sheet panel */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white rounded-t-2xl shadow-2xl max-h-[70vh] overflow-hidden flex flex-col">
          {/* Handle */}
          <div className="mx-auto mt-3 mb-0 w-10 h-1 bg-[var(--ink-300)] rounded-full flex-shrink-0" />

          {/* Header */}
          <div className="px-4 py-4 border-b border-[var(--ink-100)] flex items-center justify-between flex-shrink-0">
            <h2 className="text-base font-semibold text-[var(--ink-900)]">Filter by department</h2>
            {(draftIds.length > 0 || draftAll) && (
              <button
                type="button"
                onClick={() => { setDraftIds([]); setDraftAll(false) }}
                className="text-sm text-[var(--ink-900)] hover:text-[var(--ink-700)]"
              >
                Clear
              </button>
            )}
          </div>

          {/* Department list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1">
            <AllDepartmentsRow
              isSelected={draftAll}
              onToggle={toggleAll}
              height="h-[56px]"
            />
            {departments.map((dept) => (
              <DepartmentRow
                key={dept.id}
                dept={dept}
                isSelected={draftIds.includes(dept.id)}
                onToggle={() => toggleDept(dept.id)}
                height="h-[56px]"
              />
            ))}
          </div>

          {/* Done button */}
          <div className="px-4 py-3 border-t border-[var(--ink-100)] flex justify-end">
            <button
              type="button"
              onClick={handleDone}
              className="text-sm font-semibold text-white rounded-lg px-5 h-[44px] transition-colors hover:opacity-80"
              style={{ background: 'var(--ink-900)' }}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// Desktop sidebar variant — rendered separately in the page layout
export function DepartmentSidebar({
  departments,
  selectedIds,
  allDepartments,
  onSelect,
}: Pick<DepartmentBottomSheetProps, 'departments' | 'selectedIds' | 'allDepartments' | 'onSelect'>) {
  function toggleDept(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((s) => s !== id)
      : [...selectedIds, id]
    onSelect(next, false)
  }

  function toggleAll() {
    if (allDepartments) {
      onSelect([], false)
    } else {
      onSelect([], true)
    }
  }

  return (
    <aside className="w-[240px] flex-shrink-0 sticky top-0 h-screen overflow-y-auto py-6 px-3 border-r border-[var(--ink-100)] bg-[var(--paper)]">
      <p className="text-xs font-semibold text-[var(--ink-500)] uppercase tracking-widest px-3 mb-3">
        Departments
      </p>
      <div className="flex flex-col gap-1">
        <AllDepartmentsRow
          isSelected={allDepartments}
          onToggle={toggleAll}
          height="h-[44px]"
        />
        {departments.map((dept) => (
          <DepartmentRow
            key={dept.id}
            dept={dept}
            isSelected={selectedIds.includes(dept.id)}
            onToggle={() => toggleDept(dept.id)}
            height="h-[44px]"
          />
        ))}
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// Backward compat: re-export old names as aliases so any remaining consumer
// that was not updated in this plan does not break at compile time.
// Remove when all consumers are migrated.
// ---------------------------------------------------------------------------
/** @deprecated Use DepartmentBottomSheet */
export const CategoryBottomSheet = DepartmentBottomSheet
/** @deprecated Use DepartmentSidebar */
export const CategorySidebar = DepartmentSidebar
