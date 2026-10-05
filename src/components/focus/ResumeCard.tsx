'use client'

import { useState } from 'react'
import { useRegisterOverlay } from '@/hooks/useFocusBack'

/**
 * Shown over the browse document when the worker has a walk in progress (D-09).
 * "Start over" asks first; the dialog registers with the frame so Esc closes it
 * before Esc would leave the screen.
 */
export function ResumeCard({
  position,
  total,
  busy,
  onResume,
  onStartOver,
}: {
  position: number
  total: number
  busy: boolean
  onResume(): void
  onStartOver(): void
}) {
  const [asking, setAsking] = useState(false)
  useRegisterOverlay(asking, () => setAsking(false))

  return (
    <div data-testid="walk-resume" className="mb-6 flex flex-col gap-3 rounded-lg border border-ink-200 bg-paper-1 p-4">
      <button
        type="button"
        data-testid="walk-resume-button"
        disabled={busy}
        onClick={onResume}
        className="min-h-tap-glove w-full rounded-lg bg-ink-900 text-reading font-semibold text-paper"
      >
        Resume where you left off (step {position} of {total})
      </button>
      <button type="button" data-testid="walk-start-over" disabled={busy} onClick={() => setAsking(true)} className="min-h-tap text-ui text-ink-700">
        Start over
      </button>

      {asking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="start-over-title" data-testid="walk-start-over-dialog" className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-paper-1 p-6">
            <h2 id="start-over-title" className="text-reading font-semibold text-ink-900">
              Start over?
            </h2>
            <p className="text-reading text-ink-700">Your ticks and photos from this walk will be thrown away.</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                data-testid="walk-start-over-confirm"
                disabled={busy}
                onClick={() => {
                  setAsking(false)
                  onStartOver()
                }}
                className="min-h-tap w-full rounded-lg bg-accent-escalate text-ui font-semibold text-white"
              >
                Start over
              </button>
              <button type="button" onClick={() => setAsking(false)} className="min-h-tap text-ui text-ink-700">
                Keep walking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
