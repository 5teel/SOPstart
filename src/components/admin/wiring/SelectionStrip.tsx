'use client'

/**
 * Phase 32-08 — the ONE permanently-reserved 48px banner slot for the wiring
 * surface (sketch 003 "D hybrid" § Layout stability rule, SC-6). This div is
 * ALWAYS rendered — idle / selection / wiring states swap INNER content and a
 * state class only, never mount/unmount the slot itself, so the wiring graph
 * below never reflows on click (verified by the graph container's
 * getBoundingClientRect().top staying pixel-identical across transitions).
 *
 * Phase 33-09 (SC-5) — copy rewritten to plain language ("Save — done" not
 * "✓ Done wiring"; people-first sentences, no "grant"/"wire up"/"UNWIRED"
 * wording anywhere). The 48px slot STRUCTURE below (className template,
 * unconditional mount, onClick={onDone}) is byte-untouched — Phase 32 SC-6
 * pixel-stability contract.
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
  onDone,
  doneDisabled,
  openInLibraryHref,
}: SelectionStripProps) {
  return (
    <div data-state={state} className={`strip-slot h-[48px] overflow-hidden ${state}`}>
      {state === 'idle' && (
        <span className="mono idle-copy">
          Click a team, role or person to see what they can see · click a collection or SOP to choose who sees it
        </span>
      )}
      {state === 'selection' && (
        <span className="headline">
          {label ? <><b>{label}</b> — </> : null}
          <b>{peopleCount}</b> {peopleCount === 1 ? 'person' : 'people'} can see this.
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
            Choosing who sees <b>{label}</b> — click a team or person on the left. <b>{peopleCount}</b> {peopleCount === 1 ? 'person' : 'people'} can see it now.
          </span>
          <button type="button" className="done" onClick={onDone} disabled={doneDisabled}>
            ✓ Save — done
          </button>
        </>
      )}
    </div>
  )
}
