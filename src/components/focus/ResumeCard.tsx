'use client'

import { useState } from 'react'
import { Wordmark } from '@/components/brand/Wordmark'
import { useRegisterOverlay } from '@/hooks/useFocusBack'

/**
 * Shown over the browse document when the worker has a walk in progress (D-09).
 * "or begin from step 1" asks first; the dialog registers with the frame so Esc closes it
 * before Esc would leave the screen.
 */
export function ResumeCard({
  position,
  total,
  busy,
  initialAsking = false,
  onResume,
  onStartOver,
}: {
  position: number
  total: number
  busy: boolean
  /** Open the discard confirmation on arrival (?fresh=1 from Read). */
  initialAsking?: boolean
  onResume(): void
  onStartOver(): void
}) {
  const [asking, setAsking] = useState(initialAsking)
  useRegisterOverlay(asking, () => setAsking(false))

  return (
    <div data-testid="walk-resume" className="mb-6 flex flex-col gap-3 rounded-lg border border-ink-200 bg-paper-1 p-4">
      <button
        type="button"
        data-testid="walk-resume-button"
        disabled={busy}
        onClick={onResume}
        aria-label="start"
        className="flex min-h-tap-glove w-full items-center justify-center rounded-lg bg-ink-900"
      >
        <Wordmark variant="start" size="merge" onInk />
      </button>
      <p className="text-ui text-ink-600">Picks up at step {position} of {total}</p>
      <button type="button" data-testid="walk-start-over" disabled={busy} onClick={() => setAsking(true)} className="min-h-tap self-start text-ui text-ink-700 underline">
        or begin from step 1
      </button>

      {asking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="start-over-title" data-testid="walk-start-over-dialog" className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-paper-1 p-6">
            <h2 id="start-over-title" className="text-reading font-semibold text-ink-900">
              Start over?
            </h2>
            <p className="text-reading text-ink-700">Your ticks and photos so far will be thrown away.</p>
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
                Keep going
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
