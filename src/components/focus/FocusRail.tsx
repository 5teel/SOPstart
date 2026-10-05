'use client'

import { Check, Lock, X } from 'lucide-react'
import { railNumber, type WalkEntry } from '@/lib/sop/focus'
import type { FocusStepRow } from '@/lib/sop/focus-read'
import { KIND_DOT } from '@/components/focus/KindChip'
import { useRegisterOverlay } from '@/hooks/useFocusBack'

/** Browse rows are all plain. The walk (58-11) passes `rowState` to mark done, current and locked rows. */
export type RailRowState = 'open' | 'done' | 'current' | 'locked'

export interface FocusRailProps {
  order: WalkEntry<FocusStepRow>[]
  /** Below lg the rail is a full-screen sheet; this is its open state. */
  open: boolean
  onClose(): void
  rowState?(entry: WalkEntry<FocusStepRow>): RailRowState
  /** Defaults to scrolling the column to the step. */
  onPick?(entry: WalkEntry<FocusStepRow>): void
}

export function scrollToStep(stepId: string): void {
  const el = document.getElementById(`step-${stepId}`)
  if (!el) return
  el.scrollIntoView({ block: 'start' })
  el.focus({ preventScroll: true })
}

export function FocusRail({ order, open, onClose, rowState, onPick }: FocusRailProps) {
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
      {order.map((entry) => {
        const header = entry.groupLabel !== lastGroup ? entry.groupLabel : null
        lastGroup = entry.groupLabel
        const state = rowState?.(entry) ?? 'open'
        const locked = state === 'locked'
        return (
          <div key={entry.step.id}>
            {header && <p className="mono px-4 pb-1 pt-4 text-meta uppercase text-ink-500">{header}</p>}
            <button
              type="button"
              data-testid="focus-rail-row"
              data-state={state}
              aria-disabled={locked || undefined}
              aria-current={state === 'current' ? 'step' : undefined}
              title={railNumber(entry)}
              onClick={() => {
                if (locked) return
                ;(onPick ?? ((e) => scrollToStep(e.step.id)))(entry)
                onClose()
              }}
              className={`flex min-h-tap w-full items-center gap-2 px-4 text-left text-ui ${
                state === 'current' ? 'border-l-4 border-accent-step bg-paper-1 font-semibold text-ink-900' : locked ? 'text-ink-400' : 'text-ink-700'
              }`}
            >
              {state === 'done' ? (
                <Check className="size-4 shrink-0 text-accent-ok" aria-hidden="true" />
              ) : locked ? (
                <Lock className="size-4 shrink-0 text-ink-400" aria-hidden="true" />
              ) : (
                <span className={`size-2 shrink-0 rounded-full ${KIND_DOT[entry.step.kind]}`} aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate">{entry.step.text || 'New step'}</span>
            </button>
          </div>
        )
      })}
    </nav>
  )
}
