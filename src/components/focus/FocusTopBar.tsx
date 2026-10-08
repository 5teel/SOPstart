'use client'

import type { ReactNode } from 'react'
import { ArrowLeft, List, X } from 'lucide-react'
import { Wordmark } from '@/components/brand/Wordmark'

/**
 * The admin-only Walk / Edit switch (D-06). It flips in place: the walker sets
 * local state and rewrites ?mode= with history.replaceState, no navigation.
 */
export function ModeSwitch({
  value,
  onChange,
  testId,
}: {
  value: 'walk' | 'edit'
  onChange(next: 'walk' | 'edit'): void
  testId: string
}) {
  return (
    <div role="group" aria-label="Mode" data-testid={testId} className="inline-flex overflow-hidden rounded-lg border border-ink-300">
      {(['walk', 'edit'] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={value === m}
          data-testid={`${testId}-${m}`}
          onClick={() => m !== value && onChange(m)}
          className={`min-h-tap px-4 text-ui ${value === m ? 'bg-ink-900 font-semibold text-paper' : 'bg-paper text-ink-700'}`}
        >
          {m === 'walk' ? 'Read' : 'Edit'}
        </button>
      ))}
    </div>
  )
}

/** Wordmark (where the Start merge lands) + title + a version chip + one right-hand slot + Back / Stop. Nothing from the site lives here (focus rule). */
export function FocusTopBar({
  title,
  chip,
  stepsLabel,
  backLabel = 'Back',
  onBack,
  onOpenRail,
  children,
}: {
  title: string
  chip?: string | null
  /** "Steps · 7 of 24" -- the phone button that opens the rail sheet. */
  stepsLabel: string | null
  /** Stop while a SOP is running, Back while reading. */
  backLabel?: 'Back' | 'Stop'
  onBack(): void
  onOpenRail(): void
  children?: ReactNode
}) {
  return (
    <header data-testid="focus-top-bar" className="flex min-h-tap items-center gap-2 border-b border-ink-200 bg-paper px-4">
      <Wordmark size="bar" target />
      <span aria-hidden="true" className="h-5 w-px bg-ink-300" />
      <h1 className="min-w-0 flex-1 truncate text-reading font-semibold text-ink-900">{title}</h1>
      {chip && (
        <span data-testid="focus-version-chip" className="mono rounded border border-ink-300 px-2 py-1 text-meta uppercase text-ink-500">
          {chip}
        </span>
      )}
      {children}
      {stepsLabel && (
        <button
          type="button"
          data-testid="focus-steps-button"
          onClick={onOpenRail}
          className="inline-flex min-h-tap items-center gap-2 text-ui text-ink-700 lg:hidden"
        >
          <List className="size-4" aria-hidden="true" />
          {stepsLabel}
        </button>
      )}
      <button
        type="button"
        data-testid="focus-back"
        onClick={onBack}
        className="inline-flex min-h-tap items-center gap-2 text-ui text-ink-700"
      >
        {backLabel === 'Stop' ? <X className="size-4" aria-hidden="true" /> : <ArrowLeft className="size-4" aria-hidden="true" />}
        {backLabel}
      </button>
    </header>
  )
}
