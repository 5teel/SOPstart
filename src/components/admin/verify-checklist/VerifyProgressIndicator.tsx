'use client'

/**
 * Phase 21 (Plan 21-04 Task 1) — Sticky progress indicator at the top of
 * the checklist sidebar.
 *
 * Spike 004 finding #2: this indicator MUST be visible at all times so
 * the admin always knows where they are in the verify pass. Hiding it
 * (e.g. on scroll) cost ~30s in the spike's eye-flow trial.
 *
 * Renders:
 *   - "X / N verified" text
 *   - thin progress bar
 *   - publish button (disabled until isReady === true)
 *   - disabled-state tooltip listing remaining count
 *
 * The publish button is the SOLE publish surface in the builder — the
 * placeholder in `BuilderClient.tsx` is replaced when this gate mounts
 * (Task 2 wiring).
 */

export type VerifyProgressIndicatorProps = {
  verifiedCount: number
  totalCount: number
  isReady: boolean
  onPublish: () => void
  publishLabel?: string
}

export function VerifyProgressIndicator({
  verifiedCount,
  totalCount,
  isReady,
  onPublish,
  publishLabel = 'Publish SOP',
}: VerifyProgressIndicatorProps): React.JSX.Element {
  const remaining = Math.max(0, totalCount - verifiedCount)
  const pct = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0
  const tooltip = isReady
    ? 'All blocks verified — ready to publish'
    : `${remaining} block${remaining === 1 ? '' : 's'} remaining to verify`

  return (
    <div
      data-testid="verify-progress-indicator"
      className="sticky top-0 z-10 bg-[var(--ink-50)] border-b border-[var(--ink-200)] px-3 py-2 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <span
          data-testid="verify-progress-count"
          className="font-mono text-xs uppercase tracking-wider text-[var(--ink-700)]"
        >
          {verifiedCount} / {totalCount} verified
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--ink-500)]">
          {pct}%
        </span>
      </div>
      <div
        className="h-1 w-full bg-[var(--ink-200)] rounded overflow-hidden"
        aria-hidden
      >
        <div
          data-testid="verify-progress-bar"
          className={[
            'h-full transition-all',
            isReady ? 'bg-green-500' : 'bg-yellow-500',
          ].join(' ')}
          style={{ width: `${pct}%` }}
        />
      </div>
      <button
        type="button"
        data-testid="publish-button"
        disabled={!isReady}
        onClick={onPublish}
        title={tooltip}
        className={[
          'px-3 py-1.5 text-sm font-bold rounded',
          isReady
            ? 'bg-yellow-400 text-black hover:bg-yellow-300 cursor-pointer'
            : 'bg-[var(--ink-300)] text-[var(--ink-700)] cursor-not-allowed',
        ].join(' ')}
      >
        {publishLabel}
      </button>
    </div>
  )
}
