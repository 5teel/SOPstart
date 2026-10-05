'use client'

import { CheckCircle } from 'lucide-react'
import { useFocusGoBack } from '@/hooks/useFocusBack'

/** After Send (D-22): one line and the way back to the place the worker came from. */
export function SentPanel() {
  const goBack = useFocusGoBack()
  return (
    <div data-testid="walk-sent" className="mx-auto flex w-full max-w-205 flex-col items-center gap-4 px-4 py-16 text-center lg:px-8">
      <CheckCircle className="size-12 text-accent-ok" aria-hidden="true" />
      <h2 className="text-step font-semibold text-ink-900">Sent for sign-off</h2>
      <p className="text-reading text-ink-700">Your supervisor will check it.</p>
      <button
        type="button"
        data-testid="walk-sent-back"
        onClick={goBack}
        className="mt-4 min-h-tap-glove w-full max-w-80 rounded-lg bg-ink-900 text-reading font-semibold text-paper"
      >
        Back to the site
      </button>
    </div>
  )
}
