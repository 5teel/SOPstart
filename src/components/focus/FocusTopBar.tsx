'use client'

import type { ReactNode } from 'react'
import { ArrowLeft, List } from 'lucide-react'

/** Back + title + a version chip + one right-hand slot. Nothing from the site lives here (focus rule). */
export function FocusTopBar({
  title,
  chip,
  stepsLabel,
  onBack,
  onOpenRail,
  children,
}: {
  title: string
  chip?: string | null
  /** "Steps · 7 of 24" -- the phone button that opens the rail sheet. */
  stepsLabel: string | null
  onBack(): void
  onOpenRail(): void
  children?: ReactNode
}) {
  return (
    <header data-testid="focus-top-bar" className="flex min-h-tap items-center gap-2 border-b border-ink-200 bg-paper px-4">
      <button
        type="button"
        data-testid="focus-back"
        onClick={onBack}
        className="inline-flex min-h-tap items-center gap-2 text-ui text-ink-700"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back
      </button>
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
    </header>
  )
}
