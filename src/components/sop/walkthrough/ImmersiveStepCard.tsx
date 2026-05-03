'use client'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { useWalkthroughStore } from '@/stores/walkthrough'
import type { SopWithSections } from '@/types/sop'

interface Props {
  sop: SopWithSections
  onStepChange: (stepId: string) => void
  completedSteps?: Set<string>
}

export function ImmersiveStepCard({ sop, onStepChange, completedSteps }: Props) {
  const search = useSearchParams()
  const lockedSteps = useWalkthroughStore((s) => s.lockedSteps)

  const steps = sop.sop_sections.flatMap((s) => s.sop_steps ?? [])
  const currentId = search.get('step') ?? steps[0]?.id
  const currentIdx = Math.max(0, steps.findIndex((s) => s.id === currentId))
  const current = steps[currentIdx]
  if (!current) return null

  const prev = steps[currentIdx - 1]
  const next = steps[currentIdx + 1]
  const sectionTitle =
    sop.sop_sections.find((s) => (s.sop_steps ?? []).some((st) => st.id === current.id))?.title ??
    'Section'
  const locked = !!lockedSteps[current.id]
  const done = completedSteps?.has(current.id) ?? false

  return (
    <article
      className="immersive-step-card bg-grid flex flex-col"
      data-immersive="true"
    >
      <header className="px-4 py-3 border-b border-[var(--ink-100)] flex items-center justify-between">
        <div className="mono text-[11px] uppercase tracking-wider text-[var(--ink-500)] truncate">
          {sectionTitle} · Step {currentIdx + 1}/{steps.length}
        </div>
        {done && (
          <div className="flex items-center gap-1 text-green-600 flex-shrink-0">
            <CheckCircle2 size={14} />
            <span className="mono text-[11px] uppercase tracking-wider">Done</span>
          </div>
        )}
      </header>

      <div className="flex-1 px-4 py-6 overflow-y-auto">
        <h2 className={`text-lg font-semibold mb-3 ${done ? 'line-through opacity-50' : ''}`}>
          {current.text}
        </h2>
        {current.warning && (
          <p className="text-sm text-[var(--accent-escalate)] mt-2">⚠ {current.warning}</p>
        )}
        {current.caution && (
          <p className="text-sm text-[var(--accent-decision)] mt-2">⚡ {current.caution}</p>
        )}
        {current.tip && (
          <p className="text-sm text-[var(--ink-500)] mt-2">💡 {current.tip}</p>
        )}
        {current.required_tools && current.required_tools.length > 0 && (
          <div className="mt-3">
            <span className="mono text-[11px] uppercase tracking-wider text-[var(--ink-500)]">
              Tools required:
            </span>
            <ul className="mt-1 space-y-1">
              {current.required_tools.map((tool, i) => (
                <li key={i} className="text-sm text-[var(--ink-700)]">• {tool}</li>
              ))}
            </ul>
          </div>
        )}
        {current.time_estimate_minutes != null && (
          <p className="text-xs text-[var(--ink-500)] mt-3">
            Est. {current.time_estimate_minutes} min
          </p>
        )}
      </div>

      {/* Non-sticky footer — prev/next only; action bar lives in WalkthroughTab */}
      <footer className="bg-[var(--paper)] border-t border-[var(--ink-100)] px-4 py-3 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={!prev}
          onClick={() => prev && onStepChange(prev.id)}
          className="evidence-btn"
          style={{ opacity: prev ? 1 : 0.3 }}
          aria-label="Previous step"
        >
          ← Prev
        </button>
        {locked && (
          <span className="mono text-[11px] uppercase tracking-wider text-[var(--accent-escalate)]">
            🔒 Locked
          </span>
        )}
        <button
          type="button"
          disabled={!next || locked}
          onClick={() => next && !locked && onStepChange(next.id)}
          className="evidence-btn"
          style={{ opacity: next && !locked ? 1 : 0.3 }}
          aria-label="Next step"
        >
          {locked ? '🔒 Locked' : 'Next →'}
        </button>
      </footer>
    </article>
  )
}
