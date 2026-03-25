'use client'

import { useState } from 'react'
import { Users, Check, Loader2 } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

interface AssignmentRowProps {
  type: 'role' | 'individual'
  name: string
  subtitle?: string
  isAssigned: boolean
  assignmentId?: string
  isLoading: boolean
  onAssign: () => void
  onRemove: () => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AssignmentRow({
  type,
  name,
  subtitle,
  isAssigned,
  isLoading,
  onAssign,
  onRemove,
}: AssignmentRowProps) {
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [hovered, setHovered] = useState(false)

  function handleRemoveClick() {
    setConfirmingRemove(true)
  }

  function handleConfirmRemove() {
    setConfirmingRemove(false)
    onRemove()
  }

  function handleCancelRemove() {
    setConfirmingRemove(false)
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-steel-800 rounded-xl border border-steel-700 min-h-[56px]">
      {/* Left icon */}
      {type === 'role' ? (
        <Users size={20} className="text-steel-400 flex-shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-steel-700 flex items-center justify-center text-sm font-bold text-steel-100 flex-shrink-0 select-none">
          {getInitials(name)}
        </div>
      )}

      {/* Middle — name + subtitle */}
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-base font-medium text-steel-100 truncate">{name}</span>
        {subtitle && (
          <span className="text-xs text-steel-400 truncate">{subtitle}</span>
        )}
      </div>

      {/* Right — action area */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {confirmingRemove ? (
          /* Inline removal confirmation — no modal */
          <div className="flex items-center gap-2">
            <span className="text-sm text-steel-300 hidden sm:inline">Remove assignment?</span>
            <button
              type="button"
              onClick={handleConfirmRemove}
              className="h-[36px] px-3 text-red-400 font-semibold text-sm rounded-lg border border-red-500/40 hover:bg-red-500/10 transition-colors"
            >
              Remove
            </button>
            <button
              type="button"
              onClick={handleCancelRemove}
              className="h-[36px] px-3 text-steel-400 font-semibold text-sm rounded-lg border border-steel-600 hover:bg-steel-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : isLoading ? (
          /* Loading state */
          <div className="h-[44px] px-4 flex items-center justify-center opacity-70 pointer-events-none">
            <Loader2 size={18} className="animate-spin text-steel-400" />
          </div>
        ) : isAssigned ? (
          /* Assigned state — show "Assigned" with hover → "Remove" */
          <button
            type="button"
            onClick={handleRemoveClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            className={[
              'h-[44px] px-4 font-semibold text-sm rounded-lg border transition-colors flex items-center gap-1.5',
              hovered
                ? 'bg-red-500/10 text-red-400 border-red-500/40 hover:bg-red-500/20'
                : 'bg-green-500/20 text-green-400 border-green-500/40',
            ].join(' ')}
            aria-label={hovered ? 'Remove assignment' : 'Already assigned'}
          >
            {hovered ? (
              'Remove'
            ) : (
              <>
                <Check size={14} />
                Assigned
              </>
            )}
          </button>
        ) : (
          /* Not assigned state */
          <button
            type="button"
            onClick={onAssign}
            className="h-[44px] px-4 bg-brand-yellow text-steel-900 font-semibold text-sm rounded-lg hover:bg-amber-400 transition-colors"
          >
            + Assign
          </button>
        )}
      </div>
    </div>
  )
}
