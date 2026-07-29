'use client'
import Link from 'next/link'
import { FileText, ChevronRight } from 'lucide-react'
import type { CachedSop } from '@/lib/offline/db'
import { categoryLabel } from '@/lib/sop-categories'

interface SopLibraryCardProps {
  sop: CachedSop
  isCached: boolean
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
}

export function SopLibraryCard({
  sop,
  isCached,
  hasNewerVersion = false,
  isRefresherDue = false,
  isRefresherOverdue = false,
}: SopLibraryCardProps) {
  const meta = [categoryLabel(sop.category_slug ?? null), sop.department].filter(Boolean).join(' · ')

  return (
    <Link
      href={`/sops/${sop.id}`}
      className="flex items-start gap-4 p-4 bg-white border border-[var(--ink-100)] rounded-xl hover:bg-[var(--paper-2)] hover:border-[var(--ink-300)] active:bg-[var(--paper-2)] transition-colors cursor-pointer min-h-[88px]"
    >
      {/* Left column — icon + cache dot */}
      <div className="flex flex-col items-center gap-2 flex-shrink-0 pt-0.5">
        <FileText size={28} className="text-[var(--ink-500)]" />
        {isCached ? (
          <span
            className="w-2.5 h-2.5 rounded-full bg-[var(--accent-signoff)]"
            title="Available offline"
          />
        ) : (
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--ink-300)]" />
        )}
      </div>

      {/* Middle column — title, meta, badges */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-[var(--ink-900)] leading-snug line-clamp-2">
          {sop.title ?? 'Untitled SOP'}
        </p>
        {meta && (
          <p className="text-xs text-[var(--ink-500)] mt-0.5">{meta}</p>
        )}
        {sop.sop_number && (
          <p className="mono text-xs text-[var(--ink-500)]">{sop.sop_number}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--accent-signoff)]/10 text-[var(--accent-signoff)] text-xs font-semibold rounded">
            Assigned
          </span>
          {/* AFL-VER-04 / D-08: "Updated" badge — derives from hasNewerVersion prop
              (comparison of sop.published_at vs worker's last submitted_at, computed in
              the parent page). D-09: badge is informational only, no onClick re-walk. */}
          {hasNewerVersion && (
            <span
              data-updated-badge="true"
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--accent-signoff)]/15 text-[var(--accent-signoff)] text-xs font-semibold rounded border border-[var(--accent-signoff)]/30"
              title="This SOP has been updated since you last completed it"
            >
              Updated
            </span>
          )}
          {/* Phase 36 REF-01 / D-08: informational refresher-due badge — a
              sibling of the "Updated" badge, same informational-only
              precedent (D-09). Amber/decision-toned, never red — this is a
              coaching nudge, not a hazard warning. */}
          {isRefresherDue && (
            <span
              data-refresher-due-badge="true"
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[var(--accent-decision)]/10 text-[var(--accent-decision)] text-xs font-semibold rounded"
              title="Time for a refresher walkthrough of this SOP"
            >
              {isRefresherOverdue ? 'Refresher overdue' : 'Refresher due'}
            </span>
          )}
        </div>
      </div>

      {/* Right column — chevron */}
      <div className="flex-shrink-0 flex flex-col items-end justify-between self-stretch">
        <ChevronRight size={18} className="text-[var(--ink-300)]" />
      </div>
    </Link>
  )
}
