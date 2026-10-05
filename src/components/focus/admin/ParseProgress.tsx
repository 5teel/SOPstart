'use client'

/**
 * Phase 58 (58-13, WRK-03, D-19) -- the editor column while a SOP is still being
 * read: the stage, what is happening, a rough time left, and a quiet "you can go
 * Back". It reads the parse job through the one shared engine (useParseJob) and
 * never moves the user: when the job finishes it calls `onDone` and the editor
 * swaps in place. Failure shows the job's plain error with Try again and Back.
 */
import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { PLAIN_STAGES } from '@/lib/admin/job-stages'
import { parseProgress } from '@/lib/sop/parse-progress'
import { requeueParse, useParseJob, type ParseJobSnapshot } from '@/hooks/useParseJob'
import { useFocusGoBack } from '@/hooks/useFocusBack'

export interface ParseProgressProps {
  sopId: string
  /** The page's read of the latest parse job; the hook keeps it current. */
  job: ParseJobSnapshot | null
  /** The job finished. The editor re-reads the SOP and shows the steps in place. */
  onDone(): void
}

export function ParseProgress({ sopId, job: initial, onDone }: ParseProgressProps) {
  const goBack = useFocusGoBack()
  const { job, patch, pollError } = useParseJob(sopId, { initial: initial ?? undefined, onCompleted: onDone })
  const [retrying, setRetrying] = useState(false)
  const [started] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())

  // Only moves the "time left" line along; it never navigates.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(t)
  }, [])

  const inputType = job.inputType ?? (job.isVideo ? 'video_file' : 'upload')
  const since = job.startedAt ? Date.parse(job.startedAt) : started
  const p = parseProgress({
    inputType,
    // No row yet means the upload has only just landed: treat as waiting its turn.
    status: job.status ?? 'queued',
    currentStage: job.currentStage,
    elapsedMs: Math.max(0, now - (Number.isNaN(since) ? started : since)),
  })

  async function tryAgain() {
    setRetrying(true)
    const error = await requeueParse(sopId, job.isVideo)
    setRetrying(false)
    if (error) patch({ status: 'failed', errorMessage: error })
    else patch({ status: 'queued', errorMessage: null, currentStage: null, startedAt: new Date().toISOString() })
  }

  if (p.state === 'failed') {
    const canRetry = inputType !== 'ai_prompt'
    return (
      <div data-testid="parse-progress" data-state="failed" className="rounded-lg border border-ink-200 bg-paper-1 p-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-accent-escalate" aria-hidden="true" />
          <div className="flex flex-col gap-2">
            <p className="text-reading font-semibold text-ink-900">We couldn&apos;t read this document.</p>
            {job.errorMessage && <p className="text-ui text-ink-700">{job.errorMessage}</p>}
            {!canRetry && (
              <p className="text-ui text-ink-500">This draft was written from a prompt, so there&apos;s nothing to read again. Start a new AI draft instead.</p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              {canRetry && (
                <button
                  type="button"
                  data-testid="parse-try-again"
                  disabled={retrying}
                  onClick={() => void tryAgain()}
                  className="min-h-tap rounded-lg bg-ink-900 px-4 text-ui font-semibold text-paper disabled:bg-ink-300 disabled:text-ink-500"
                >
                  {retrying ? 'Trying again…' : 'Try again'}
                </button>
              )}
              <button type="button" onClick={goBack} className="min-h-tap rounded-lg border border-ink-300 px-4 text-ui text-ink-900">
                Back
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const currentIndex = p.state === 'done' ? PLAIN_STAGES.length : PLAIN_STAGES.findIndex((s) => s.key === p.stage)

  return (
    <div data-testid="parse-progress" data-state={p.state} className="flex flex-col gap-3 rounded-lg border border-ink-200 bg-paper-1 p-6">
      <ol className="mono flex flex-wrap gap-x-4 gap-y-1 text-meta" aria-label="Progress">
        {PLAIN_STAGES.map((s, i) => (
          <li
            key={s.key}
            aria-current={i === currentIndex ? 'step' : undefined}
            className={i < currentIndex ? 'text-accent-ok' : i === currentIndex ? 'text-ink-900' : 'text-ink-400'}
          >
            {s.label}
          </li>
        ))}
      </ol>

      <p data-testid="parse-stage" className="text-reading font-semibold text-ink-900">
        {p.detail}
      </p>
      {p.eta && (
        <p data-testid="parse-eta" className="text-ui text-ink-500">
          {p.eta}
        </p>
      )}

      <span className="flex h-1 w-full overflow-hidden rounded-full bg-ink-100" aria-hidden="true">
        <span className="h-1 w-1/3 animate-pulse rounded-full bg-accent-step motion-reduce:animate-none" />
      </span>

      {p.state === 'done' ? (
        <p role="status" aria-live="polite" className="text-ui text-ink-900">
          Done reading.
        </p>
      ) : (
        <p className="text-ui text-ink-500">You can go Back. We keep reading and it&apos;ll be waiting for you.</p>
      )}
      {pollError && (
        <p role="status" className="text-ui text-ink-500">
          Can&apos;t check progress right now. Trying again.
        </p>
      )}
    </div>
  )
}
