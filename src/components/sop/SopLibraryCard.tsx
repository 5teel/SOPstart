'use client'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import type { CachedSop } from '@/lib/offline/db'
import { categoryLabel } from '@/lib/sop-categories'

interface SopLibraryCardProps {
  sop: CachedSop
  /**
   * AFL-VER-04 / D-08: true when a newer published version exists than the
   * worker's last completion for this SOP lineage.
   * Derived from sop.published_at vs the worker's last submitted_at — no schema
   * change needed (RESEARCH.md AFL-VER-04).
   * D-09: badge is informational only — no forced re-walk.
   */
  hasNewerVersion?: boolean
  /**
   * Phase 36 REF-01 / D-08: true when the refresher due date is within the
   * lead-in window (REFRESHER_DUE_WINDOW_DAYS before it) or has passed.
   * Derived from refresherDueDate/isRefresherDue
   * (src/lib/competency/refresher.ts) over refresher_interval_months + the
   * worker's last completion, computed in the parent page. Informational
   * only — no forced re-walk, no gating (CMP-04).
   */
  isRefresherDue?: boolean
  /** Phase 36 REF-01 / D-08: true when the due date has actually passed —
   * escalates the chip label from "Refresher due" to "Refresher overdue". */
  isRefresherOverdue?: boolean
  /** False for a library row the worker has not added — those say so, the
   *  rest say nothing (a badge on every card is noise). */
  isAssigned?: boolean
  /** Assigned but never walked — the phone's twin of the desktop row signal. */
  neverDone?: boolean
}

/**
 * The phone row. One tap target, two lines of text, at most one chip — the
 * desktop Miller row's twin, sized for a glove.
 */
export function SopLibraryCard({
  sop,
  hasNewerVersion = false,
  isRefresherDue = false,
  isRefresherOverdue = false,
  isAssigned = true,
  neverDone = false,
}: SopLibraryCardProps) {
  const meta = [sop.sop_number, categoryLabel(sop.category_slug ?? null), sop.department].filter(Boolean).join(' · ')

  return (
    <Link
      href={`/sops/${sop.id}`}
      className="flex min-h-[64px] items-center gap-3 rounded-lg border border-[var(--ink-100)] bg-white px-4 py-3 transition-colors hover:border-[var(--ink-300)] hover:bg-[var(--paper-2)] active:bg-[var(--paper-2)]"
    >
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-[var(--ink-900)]">
          {sop.title ?? 'Untitled SOP'}
        </p>
        {meta && <p className="mono mt-0.5 truncate text-[11px] text-[var(--ink-500)]">{meta}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 empty:hidden">
          {/* AFL-VER-04 / D-08: "Updated" badge — derives from hasNewerVersion prop
              (comparison of sop.published_at vs worker's last submitted_at, computed in
              the parent page). D-09: badge is informational only, no onClick re-walk. */}
          {hasNewerVersion && (
            <span
              data-updated-badge="true"
              className="mono rounded bg-amber-600/[0.16] px-1.5 py-0.5 text-[11px] text-amber-700"
              title="This SOP has been updated since you last completed it"
            >
              Updated since you read it
            </span>
          )}
          {/* Phase 36 REF-01 / D-08: informational refresher-due badge — a
              sibling of the "Updated" badge, same informational-only
              precedent (D-09). Amber when due, hazard-red once overdue —
              still a nudge, never a gate. */}
          {isRefresherDue && (
            <span
              data-refresher-due-badge="true"
              className={`mono rounded px-1.5 py-0.5 text-[11px] ${
                isRefresherOverdue
                  ? 'bg-red-500/[0.14] text-[var(--accent-hazard)]'
                  : 'bg-amber-600/[0.16] text-amber-700'
              }`}
              title="Time for a refresher walkthrough of this SOP"
            >
              {isRefresherOverdue ? 'Refresher overdue' : 'Refresher due'}
            </span>
          )}
          {!hasNewerVersion && !isRefresherDue && (neverDone || !isAssigned) && (
            <span className="mono rounded bg-[var(--paper-2)] px-1.5 py-0.5 text-[11px] text-[var(--ink-500)]">
              {isAssigned ? 'Not done yet' : 'Not yours'}
            </span>
          )}
        </div>
      </div>
      <ChevronRight size={18} className="flex-shrink-0 text-[var(--ink-300)]" />
    </Link>
  )
}
