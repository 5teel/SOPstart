'use client'

/**
 * Phase 32-08 — the ONE permanently-reserved 48px banner slot for the wiring
 * surface (sketch 003 "D hybrid" § Layout stability rule, SC-6). This div is
 * ALWAYS rendered — idle / selection / wiring states swap INNER content and a
 * state class only, never mount/unmount the slot itself, so the wiring graph
 * below never reflows on click (verified by the graph container's
 * getBoundingClientRect().top staying pixel-identical across transitions).
 *
 * Idle copy doubles as onboarding. Selection and wiring share the same
 * "Visible to N people via M grants" template (32-08-PLAN Task 1 literal
 * spec) — wiring adds the live ✓ Done control.
 */

import type { ReactNode } from 'react'
import Link from 'next/link'

export type SelectionStripState = 'idle' | 'selection' | 'wiring'

export interface SelectionStripProps {
  state: SelectionStripState
  /** Name of the focused org-unit/collection (selection) or the SOP being wired (wiring). */
  label?: ReactNode
  peopleCount?: number
  grantCount?: number
  onDone?: () => void
  doneDisabled?: boolean
  /** 32-09 SC-4: set when the focused unit is a department/collection — viz-as-library-filter deep-link. */
  openInLibraryHref?: string
}

export function SelectionStrip({
  state,
  label,
  peopleCount = 0,
  grantCount = 0,
  onDone,
  doneDisabled,
  openInLibraryHref,
}: SelectionStripProps) {
  return (
    <div data-state={state} className={`strip-slot h-[48px] overflow-hidden ${state}`}>
      {state === 'idle' && (
        <span className="mono idle-copy">
          Select anything to trace who it reaches · click the NEW SOP to wire it up
        </span>
      )}
      {state === 'selection' && (
        <span className="headline">
          {label ? <><b>{label}</b> — </> : null}
          Visible to <b>{peopleCount}</b> {peopleCount === 1 ? 'person' : 'people'} via {grantCount} grant{grantCount === 1 ? '' : 's'}.
          {openInLibraryHref && (
            <Link href={openInLibraryHref} className="mono open-in-library">
              Open in library →
            </Link>
          )}
        </span>
      )}
      {state === 'wiring' && (
        <>
          <span className="headline">
            ⚡ Wiring <b>{label}</b> — click org units to grant access. Visible to <b>{peopleCount}</b> {peopleCount === 1 ? 'person' : 'people'} via {grantCount} grant{grantCount === 1 ? '' : 's'}.
          </span>
          <button type="button" className="done" onClick={onDone} disabled={doneDisabled}>
            ✓ Done wiring
          </button>
        </>
      )}
    </div>
  )
}
