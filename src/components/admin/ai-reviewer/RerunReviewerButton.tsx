'use client'

/**
 * Phase 21 (Plan 21-03 Task 3) — "Re-run AI Reviewer" toolbar button.
 *
 * Mounted in the builder header chrome (next to the publish placeholder).
 * Calls `POST /api/sops/[sopId]/ai-reviewer`; renders inline status text
 * on 429 with a friendly message (no toast dependency — we keep the
 * surface inline so admins always see why they're blocked).
 *
 * D-21-09 isolation — admin-only.
 */

import { RefreshCw } from 'lucide-react'
import { useReviewerFlags } from './useReviewerFlags'

export function RerunReviewerButton({
  sopId,
}: {
  sopId: string
}): React.JSX.Element {
  const { rerun, isRerunning, rerunError, clearRerunError } = useReviewerFlags(sopId)

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        data-testid="rerun-reviewer-button"
        onClick={() => {
          void rerun()
        }}
        disabled={isRerunning}
        className="flex items-center gap-1.5 rounded border border-[var(--ink-300)] bg-[var(--paper)] px-2.5 py-1.5 text-xs font-mono uppercase tracking-wider text-[var(--ink-700)] transition-colors hover:bg-[var(--ink-100)] disabled:opacity-50"
      >
        <RefreshCw
          className={`h-3.5 w-3.5 ${isRerunning ? 'animate-spin' : ''}`}
          aria-hidden="true"
        />
        {isRerunning ? 'Running…' : 'Re-run AI Reviewer'}
      </button>
      {rerunError && (
        <span
          role="alert"
          data-testid="reviewer-rerun-error"
          data-kind={rerunError.kind}
          className="cursor-pointer px-2 py-1 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-mono uppercase tracking-wider"
          onClick={clearRerunError}
        >
          {rerunError.message} (click to dismiss)
        </span>
      )}
    </div>
  )
}
