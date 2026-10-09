'use client'

/**
 * Review and confirm (D-10, D-22): every step with its acknowledgement and photo,
 * and the one button that writes the completion. Nothing is written until Send
 * for sign-off; the walk row already holds every step and photo (D-09).
 */
import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { submitCompletion } from '@/actions/completions'
import type { WalkEntry } from '@/lib/sop/focus'
import type { FocusStepRow } from '@/lib/sop/focus-read'
import type { WalkState } from '@/lib/sop/walk-read'

export const SEND_ERROR = "Couldn't send it. Your steps and photos are saved — try again."

export interface ReviewAndSendProps {
  walk: WalkState
  order: WalkEntry<FocusStepRow>[]
  missing: { stepId: string; index: number; text: string }[]
  previews: Record<string, string>
  onReopen(stepId: string): void
  onKeepChecking(): void
  onSent(): void
}

export function ReviewAndSend({ walk, order, missing, previews, onReopen, onKeepChecking, onSent }: ReviewAndSendProps) {
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const doneIds = new Set(Object.keys(walk.done))
  const photoSteps = new Set(walk.photos.map((p) => p.stepId))
  const missingSteps = new Set(missing.map((m) => m.stepId))
  const undone = order.filter((e) => !doneIds.has(e.step.id))
  const todo = [
    ...missing.map((m) => m.text),
    ...undone.filter((e) => !missingSteps.has(e.step.id)).map((e) => `finish step ${e.index}`),
  ]
  const blocked = todo.length > 0
  const doneCount = order.length - undone.length

  async function send() {
    if (sending || blocked) return
    setSending(true)
    setError(null)
    try {
      const res = await submitCompletion({ walkId: walk.id })
      if (!res.success) return setError(SEND_ERROR)
      onSent()
    } catch {
      setError(SEND_ERROR)
    } finally {
      setSending(false)
    }
  }

  let lastGroup: string | null = null
  return (
    <div data-testid="walk-review" className="mx-auto flex w-full max-w-205 flex-col gap-6 px-4 py-8 lg:px-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-step font-semibold text-ink-900">Ready to send?</h2>
        <p className="text-reading text-ink-700">Look over what you did. Once you send it, your supervisor signs it off.</p>
        <p data-testid="walk-review-summary" className="mono text-meta uppercase text-ink-600">
          {doneCount} {doneCount === 1 ? 'step' : 'steps'} done · {walk.photos.length} {walk.photos.length === 1 ? 'photo' : 'photos'}
        </p>
      </div>

      <div className="flex flex-col">
        {order.map((entry) => {
          const { step } = entry
          const header = entry.groupLabel !== lastGroup ? entry.groupLabel : null
          lastGroup = entry.groupLabel
          const isDone = doneIds.has(step.id)
          const acked = (step.kind === 'hazard' || step.kind === 'ppe') && !!walk.acks[step.id]
          const hasPhoto = photoSteps.has(step.id)
          const preview = previews[`${walk.id}:${step.id}`]
          return (
            <div key={step.id}>
              {header && <p className="mono pb-1 pt-4 text-meta uppercase text-ink-600">{header}</p>}
              <button
                type="button"
                data-testid="walk-review-row"
                data-done={isDone}
                onClick={() => onReopen(step.id)}
                className={`flex w-full items-center gap-3 border-b border-ink-100 text-left ${
                  hasPhoto ? 'min-h-tap-row' : 'min-h-tap'
                } ${isDone ? '' : 'bg-paper-2'}`}
              >
                {isDone ? (
                  <Check className="size-4 shrink-0 text-accent-ok" aria-hidden="true" />
                ) : (
                  <span className="mono shrink-0 text-meta uppercase text-accent-escalate">Not done</span>
                )}
                <span className="min-w-0 flex-1 truncate text-ui text-ink-900">{step.text}</span>
                {acked && <span className="mono shrink-0 text-meta uppercase text-ink-600">Acknowledged</span>}
                {hasPhoto &&
                  (preview ? (
                    <img src={preview} alt="" className="size-18 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <span className="flex size-18 shrink-0 items-center justify-center rounded-lg border border-ink-200 bg-paper-2">
                      <Check className="size-5 text-accent-ok" aria-hidden="true" />
                    </span>
                  ))}
              </button>
            </div>
          )
        })}
      </div>

      {blocked && (
        <p data-testid="walk-review-missing" className="text-ui text-ink-700">
          {todo.length} {todo.length === 1 ? 'thing' : 'things'} still to do: {todo.join(', ')}.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <button
          type="button"
          data-testid="walk-send"
          disabled={blocked || sending}
          aria-disabled={blocked || sending}
          onClick={() => void send()}
          className={`inline-flex min-h-tap-glove w-full items-center justify-center gap-2 rounded-lg text-reading font-semibold ${
            blocked ? 'bg-ink-300 text-ink-500' : 'bg-accent-signoff text-white'
          }`}
        >
          {sending ? (
            <>
              <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Sending…
            </>
          ) : (
            'Send for sign-off'
          )}
        </button>
        {error && (
          <p role="alert" data-testid="walk-send-error" className="text-ui text-accent-escalate">
            {error}
          </p>
        )}
        <button type="button" data-testid="walk-keep-checking" onClick={onKeepChecking} className="min-h-tap text-ui text-ink-700">
          Keep checking
        </button>
      </div>
    </div>
  )
}
