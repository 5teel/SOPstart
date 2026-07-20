'use client'

/**
 * Phase 34-06 — D-02 per-org verdict label editor. Display names only:
 * the competency engine (Phase 35+) always reads the fixed canonical
 * values (performed_to_sop / needs_support), never these labels.
 */

import { useState, useTransition } from 'react'
import { setObservationLabels } from '@/actions/observations'

interface ObservationLabelsCardProps {
  initial: { performed_to_sop: string; needs_support: string }
}

export function ObservationLabelsCard({ initial }: ObservationLabelsCardProps) {
  const [performedToSop, setPerformedToSop] = useState(initial.performed_to_sop)
  const [needsSupport, setNeedsSupport] = useState(initial.needs_support)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setStatus('idle')
    setError(null)
    startTransition(async () => {
      const result = await setObservationLabels({
        performed_to_sop: performedToSop.trim() || 'Performed to SOP',
        needs_support: needsSupport.trim() || 'Needs support',
      })
      if (!result.success) {
        setStatus('error')
        setError(result.error)
        return
      }
      setStatus('success')
    })
  }

  return (
    <div className="blueprint-frame p-5">
      <p className="text-xs text-[var(--ink-500)] mb-4">
        Display names only — the competency engine always reads the fixed underlying values,
        regardless of what you rename these to.
      </p>
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-500)] mb-1.5 block">
            &ldquo;Performed to SOP&rdquo; label
          </span>
          <input
            type="text"
            value={performedToSop}
            onChange={(e) => setPerformedToSop(e.target.value)}
            disabled={isPending}
            className="w-full px-3 py-2.5 border border-[var(--ink-300)] rounded text-sm text-[var(--ink-900)] bg-[var(--paper-1)] outline-none focus:border-[var(--ink-900)]"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-500)] mb-1.5 block">
            &ldquo;Needs support&rdquo; label
          </span>
          <input
            type="text"
            value={needsSupport}
            onChange={(e) => setNeedsSupport(e.target.value)}
            disabled={isPending}
            className="w-full px-3 py-2.5 border border-[var(--ink-300)] rounded text-sm text-[var(--ink-900)] bg-[var(--paper-1)] outline-none focus:border-[var(--ink-900)]"
          />
        </label>

        {status === 'success' && (
          <p className="text-sm text-[var(--accent-ok)]">Labels saved.</p>
        )}
        {status === 'error' && error && (
          <p className="text-sm text-[var(--accent-escalate)]">{error}</p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="self-start px-4 py-2 rounded text-sm font-bold uppercase tracking-wide bg-[var(--ink-900)] text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
