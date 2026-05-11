'use client'

interface StepProgressProps {
  completedCount: number
  totalSteps: number
}

export function StepProgress({ completedCount, totalSteps }: StepProgressProps) {
  const pct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0
  // The next incomplete step index (1-based), shown in the counter
  const nextStep = Math.min(completedCount + 1, totalSteps)
  const allDone = completedCount >= totalSteps && totalSteps > 0

  return (
    <div className="px-4 pt-3 pb-4 bg-[var(--paper)]">
      {/* Progress bar */}
      <div className="h-2 bg-[var(--paper-2)] rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-[var(--ink-900)] rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Counter row */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[var(--ink-900)] tabular-nums">
          {allDone ? `All ${totalSteps} steps done` : `Step ${nextStep} of ${totalSteps}`}
        </span>
        <span className="text-sm text-[var(--ink-500)] tabular-nums">{pct}% done</span>
      </div>
    </div>
  )
}
