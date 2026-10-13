'use client'

import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { railNumber, type WalkEntry } from '@/lib/sop/focus'
import type { FocusStepRow } from '@/lib/sop/focus-read'
import { KIND_DOT } from '@/components/focus/KindChip'
import { useRegisterOverlay } from '@/hooks/useFocusBack'

export interface FocusRailProps {
  order: WalkEntry<FocusStepRow>[]
  /** Below lg the rail is a full-screen sheet; this is its open state. */
  open: boolean
  onClose(): void
  /** Phone only: the Read / Edit switch moves here from the top bar (UI-SPEC). */
  sheetTop?: ReactNode
}

export function scrollToStep(stepId: string): void {
  const el = document.getElementById(`step-${stepId}`)
  if (!el) return
  el.scrollIntoView({ block: 'start' })
  el.focus({ preventScroll: true })
}

/** The read-only document's step list: every row jumps to its step. */
export function FocusRail({ order, open, onClose, sheetTop }: FocusRailProps) {
  useRegisterOverlay(open, onClose)

  let lastGroup: string | null = null
  return (
    <nav
      data-testid="focus-rail"
      aria-label="Steps"
      className={`${open ? 'flex' : 'hidden'} w-75 shrink-0 flex-col overflow-y-auto border-r border-ink-200 bg-paper-2 max-lg:fixed max-lg:inset-0 max-lg:z-40 max-lg:w-auto lg:flex`}
    >
      <button
        type="button"
        data-testid="focus-rail-close"
        onClick={onClose}
        className="flex min-h-tap items-center gap-2 px-4 text-ui text-ink-700 lg:hidden"
      >
        <X className="size-4" aria-hidden="true" />
        Close
      </button>
      {sheetTop && <div className="px-4 pb-2 sm:hidden">{sheetTop}</div>}
      {order.map((entry) => {
        const header = entry.groupLabel !== lastGroup ? entry.groupLabel : null
        lastGroup = entry.groupLabel
        return (
          <div key={entry.step.id}>
            {header && <p className="section-heading px-4 pb-1 pt-4">{header}</p>}
            <button
              type="button"
              data-testid="focus-rail-row"
              title={railNumber(entry)}
              onClick={() => {
                scrollToStep(entry.step.id)
                onClose()
              }}
              className="flex min-h-tap w-full items-center gap-2 px-4 text-left text-ui text-ink-700"
            >
              <span className={`size-2 shrink-0 rounded-full ${KIND_DOT[entry.step.kind]}`} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{entry.step.text || 'New step'}</span>
            </button>
          </div>
        )
      })}
    </nav>
  )
}
