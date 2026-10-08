'use client'

/**
 * Phase 59 (OFF-02, D-06, A-08, A-12) -- the expanded Sign off row. Everything the old
 * review page had: the assessor teaching state, the admin override reason and a reject
 * that needs a reason. The panel only mirrors `isAssessor` / `canOverride`; the server
 * recomputes both and stays the authority. Admin-chunk component: the Office pane is its
 * only importer.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Check, Loader2 } from 'lucide-react'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/captions.css'
import type { LightboxExternalProps } from 'yet-another-react-lightbox'
import { getCompletionForReview, type CompletionReview, type ReviewStep } from '@/actions/office'
import { signOffCompletion } from '@/actions/completions'
import { requestAssessorReview } from '@/actions/observations'
import { nzDateTime, relativeWhen } from '@/lib/office/format'
import { focusHref } from '@/lib/sop/focus-path'
import { HOME, homeFrom } from '@/lib/shell/home-state'
import { ReasonDialog } from './ReasonDialog'

// The lightbox and its caption plugin load together, only when a photo is opened.
const PhotoLightbox = dynamic<LightboxExternalProps>(
  async () => {
    const [{ default: Lightbox }, { default: Captions }] = await Promise.all([
      import('yet-another-react-lightbox'),
      import('yet-another-react-lightbox/plugins/captions'),
    ])
    return function PhotoLightbox(props: LightboxExternalProps) {
      return <Lightbox {...props} plugins={[Captions]} />
    }
  },
  { ssr: false },
)

const NOT_ASSESSOR_COPY = 'You need to be signed off on this SOP yourself before you can assess others on it.'
const OVERRIDE_DISCLOSURE_COPY =
  'This will be recorded as an assessor override with your reason, visible in the audit trail.'
const OVERRIDE_REQUIRED_COPY = 'An override reason (10+ characters) is required to approve without assessor status.'
const FAILED_COPY = "That didn't work. Nothing was changed — try again."
const STATUS_FAILED = 'Sign-off recorded but status update failed.'

const LABEL = 'mono text-meta uppercase text-ink-500'
const MIN_REASON = 10

type Receipt = { receipt: string; logged: boolean }

function mapError(code: string): string {
  if (code === 'NOT_SIGNED_OFF_ASSESSOR') return NOT_ASSESSOR_COPY
  if (code === 'ASSESSOR_OVERRIDE_REQUIRED') return OVERRIDE_REQUIRED_COPY
  return code
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function SignOffPanel({ completionId, onDone }: { completionId: string; onDone(r: Receipt): void }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['office-review', completionId],
    queryFn: () => getCompletionForReview(completionId),
  })

  if (isLoading) {
    return (
      <div data-testid="signoff-panel" className="flex flex-col gap-2 rounded-lg border border-ink-200 bg-paper-1 p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-18 animate-pulse rounded-lg bg-ink-100 motion-reduce:animate-none" />
        ))}
      </div>
    )
  }
  if (isError || !data || 'error' in data) {
    return (
      <div data-testid="signoff-panel" className="flex flex-col items-start gap-2 rounded-lg border border-ink-200 bg-paper-1 p-4">
        <p role="alert" className="text-ui text-ink-700">
          {data && 'error' in data ? data.error : "Couldn't load this. Check your signal and try again."}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-4 text-ui font-semibold text-ink-900"
        >
          Try again
        </button>
      </div>
    )
  }
  // Keyed by the record: nothing a previous completion left in the body can reach this one.
  return <SignOffBody key={data.completionId} review={data} onDone={onDone} />
}

type PhotoItem = { id: string; src: string; stepNumber: number | null; stepText: string | null }

function SignOffBody({ review, onDone }: { review: CompletionReview; onDone(r: Receipt): void }) {
  const { completionId, sopId, workerLabel, steps } = review
  const [overrideReason, setOverrideReason] = useState('')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fatal, setFatal] = useState(false)
  const [forceOverride, setForceOverride] = useState(false)
  const [focusTick, setFocusTick] = useState(0)
  const [request, setRequest] = useState<'idle' | 'sending' | 'requested'>('idle')
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const overrideRef = useRef<HTMLTextAreaElement>(null)
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([])
  const openerIndex = useRef(0)

  useEffect(() => {
    headingRef.current?.focus()
  }, [])
  useEffect(() => {
    if (focusTick > 0) overrideRef.current?.focus()
  }, [focusTick])

  // Photos in step order, each captioned with its step; a photo whose step is gone still shows.
  const byId = new Map(review.photos.map((p) => [p.id, p]))
  const seen = new Set<string>()
  const photos: PhotoItem[] = []
  for (const st of steps) {
    for (const id of st.photoIds) {
      const p = byId.get(id)
      if (!p || seen.has(id)) continue
      seen.add(id)
      photos.push({ id, src: p.signed_url, stepNumber: st.stepNumber, stepText: st.text })
    }
  }
  for (const p of review.photos) {
    if (!seen.has(p.id)) photos.push({ id: p.id, src: p.signed_url, stepNumber: null, stepText: null })
  }

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null)
    thumbRefs.current[openerIndex.current]?.focus()
  }, [])

  // While the lightbox is open Esc closes it and nothing else: a capture-phase listener
  // takes the key before the shell's window listener can send the whole screen to the overview.
  const lightboxOpen = lightboxIndex !== null
  useEffect(() => {
    if (!lightboxOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      closeLightbox()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [lightboxOpen, closeLightbox])

  const done = steps.filter((s) => s.state !== 'not_done')
  const showOverride = review.canOverride && (!review.isAssessor || forceOverride)
  const teaching = !review.isAssessor && !review.canOverride
  const overrideOk = overrideReason.trim().length >= MIN_REASON
  const signOffBlocked = fatal || teaching || (showOverride && !overrideOk)
  const busy = pending !== null

  async function approve() {
    if (busy || signOffBlocked) return
    setPending('approve')
    setError(null)
    try {
      const result = await signOffCompletion({
        completionId,
        decision: 'approved',
        overrideReason: showOverride ? overrideReason.trim() : undefined,
      })
      if (result.success) {
        onDone({ receipt: 'Signed off', logged: result.logged })
        return
      }
      if (result.error === STATUS_FAILED) setFatal(true)
      if (result.error === 'ASSESSOR_OVERRIDE_REQUIRED' && review.canOverride) {
        setForceOverride(true)
        setFocusTick((n) => n + 1)
      }
      setError(mapError(result.error))
    } catch {
      setError(FAILED_COPY)
    } finally {
      setPending(null)
    }
  }

  async function reject(reason: string) {
    if (busy) return
    setPending('reject')
    setError(null)
    try {
      const result = await signOffCompletion({ completionId, decision: 'rejected', reason })
      if (result.success) {
        setRejectOpen(false)
        onDone({ receipt: 'Rejected', logged: result.logged })
        return
      }
      if (result.error === STATUS_FAILED) {
        setFatal(true)
        setRejectOpen(false)
      }
      setError(mapError(result.error))
    } catch {
      setError(FAILED_COPY)
    } finally {
      setPending(null)
    }
  }

  async function requestAssessment() {
    if (request !== 'idle') return
    setRequest('sending')
    try {
      const result = await requestAssessorReview(sopId)
      setRequest(result.success ? 'requested' : 'idle')
      if (!result.success) setError(result.error)
    } catch {
      setRequest('idle')
      setError(FAILED_COPY)
    }
  }

  const decidedWord = review.status === 'rejected' ? 'rejected' : 'signed off'
  const stepGroups: Array<{ title: string | null; rows: ReviewStep[] }> = []
  for (const st of done) {
    const last = stepGroups[stepGroups.length - 1]
    if (last && last.title === st.sectionTitle) last.rows.push(st)
    else stepGroups.push({ title: st.sectionTitle, rows: [st] })
  }

  return (
    <div data-testid="signoff-panel" className="flex flex-col gap-4 rounded-lg border border-ink-200 bg-paper-1 p-4">
      <h3 ref={headingRef} tabIndex={-1} className="sr-only">
        Sign off {review.sopTitle}
      </h3>

      <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1">
        <dt className={LABEL}>Worker</dt>
        <dd className="min-w-0 truncate text-ui text-ink-900">{workerLabel}</dd>
        <dt className={LABEL}>SOP</dt>
        <dd className="flex min-w-0 items-center gap-2 text-ui text-ink-900">
          <Link href={focusHref(sopId, { from: homeFrom({ ...HOME, s: 'signoffs' }) })} className="min-w-0 truncate underline">
            {review.sopTitle}
          </Link>
          <span className="mono shrink-0 rounded border border-ink-200 bg-paper-2 px-2 text-meta text-ink-500">
            v{review.sopVersion}
          </span>
        </dd>
        <dt className={LABEL}>Sent</dt>
        <dd className="text-ui text-ink-900">
          {nzDateTime(review.submittedAt)} · {relativeWhen(review.submittedAt)}
        </dd>
      </dl>

      <p className="mono text-meta text-ink-700">
        {plural(done.length, 'step', 'steps')} done · {plural(photos.length, 'photo', 'photos')}
      </p>

      {photos.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className={LABEL}>Photos</span>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {photos.map((p, i) => (
              <div key={p.id} className="flex shrink-0 flex-col items-center gap-1">
                <button
                  type="button"
                  data-testid="signoff-photo"
                  ref={(el) => {
                    thumbRefs.current[i] = el
                  }}
                  aria-label={`Photo ${i + 1} of ${photos.length}${p.stepNumber ? `, step ${p.stepNumber}` : ''}`}
                  onClick={() => {
                    openerIndex.current = i
                    setLightboxIndex(i)
                  }}
                  className="size-18 overflow-hidden rounded-lg border border-ink-200 focus:outline-none focus:ring-2 focus:ring-ink-900"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt="" className="size-full object-cover" />
                </button>
                <span className="mono text-meta text-ink-500">{p.stepNumber ? `Step ${p.stepNumber}` : 'Photo'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stepGroups.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className={LABEL}>Steps done</span>
          <div className="max-h-80 overflow-y-auto">
            {stepGroups.map((g, gi) => (
              <div key={`${g.title ?? 'none'}-${gi}`}>
                {g.title && <p className={`${LABEL} pt-2`}>{g.title}</p>}
                {g.rows.map((st) => (
                  <div key={st.id} className="flex min-h-tap items-center gap-2 border-b border-ink-100 py-2">
                    <Check size={16} className="shrink-0 text-accent-ok" aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-ui text-ink-900">{st.text}</span>
                    <span className="mono shrink-0 text-meta text-ink-500">
                      {[st.state === 'acknowledged' ? 'Acknowledged' : null, st.photoIds.length > 0 ? plural(st.photoIds.length, 'photo', 'photos') : null]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {review.status !== 'pending_sign_off' ? (
        <p role="status" className="text-ui text-ink-700">
          This completion has already been {decidedWord}.
        </p>
      ) : (
        <>
          {teaching && (
            <div className="flex flex-col items-start gap-2 rounded-lg border border-ink-200 bg-paper-2 p-3">
              <p className="text-ui text-ink-900">{NOT_ASSESSOR_COPY}</p>
              <button
                type="button"
                onClick={() => void requestAssessment()}
                disabled={request !== 'idle'}
                className="min-h-tap rounded-lg border border-ink-300 bg-paper-1 px-4 text-ui font-semibold text-ink-900 disabled:opacity-50"
              >
                {request === 'sending' ? 'Sending…' : request === 'requested' ? 'Requested' : 'Request assessment'}
              </button>
            </div>
          )}

          {showOverride && (
            <div className="flex flex-col gap-1">
              <label htmlFor="signoff-override-reason" className="text-ui font-semibold text-ink-900">
                Reason for the override
              </label>
              <p className="text-ui text-ink-500">{OVERRIDE_DISCLOSURE_COPY}</p>
              <textarea
                id="signoff-override-reason"
                data-testid="signoff-override-reason"
                ref={overrideRef}
                rows={3}
                maxLength={500}
                value={overrideReason}
                disabled={busy || fatal}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="w-full resize-none rounded-lg border border-ink-300 bg-paper-1 p-3 text-reading text-ink-900 focus:border-ink-900 focus:outline-none"
              />
              <span className="text-ui text-ink-500">10 characters or more.</span>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              data-testid="signoff-approve"
              disabled={busy || signOffBlocked}
              aria-disabled={busy || signOffBlocked}
              onClick={() => void approve()}
              className={`flex min-h-tap flex-1 items-center justify-center gap-2 rounded-lg text-ui font-semibold ${
                signOffBlocked ? 'bg-ink-300 text-ink-500' : 'bg-accent-signoff text-white disabled:opacity-50'
              }`}
            >
              {pending === 'approve' && <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              Sign off
            </button>
            <button
              type="button"
              data-testid="signoff-reject"
              disabled={busy || fatal}
              onClick={() => setRejectOpen(true)}
              className="flex min-h-tap flex-1 items-center justify-center gap-2 rounded-lg border border-ink-300 bg-paper-1 text-ui font-semibold text-ink-900 disabled:opacity-50"
            >
              Reject
            </button>
          </div>
          {error && !rejectOpen && (
            <p role="alert" className="text-ui text-accent-escalate">
              {error}
            </p>
          )}
        </>
      )}

      {rejectOpen && (
        <ReasonDialog
          title="Reject this completion?"
          body={`${workerLabel} will see your reason and need to do it again.`}
          label="Why are you rejecting it?"
          confirmLabel="Reject"
          confirmTone="escalate"
          pending={pending === 'reject'}
          error={error}
          onConfirm={(reason) => void reject(reason)}
          onCancel={() => {
            setRejectOpen(false)
            setError(null)
          }}
        />
      )}

      {lightboxIndex !== null && photos.length > 0 && (
        <PhotoLightbox
          open
          close={closeLightbox}
          index={lightboxIndex}
          slides={photos.map((p, i) => ({
            src: p.src,
            alt: p.stepNumber ? `Step ${p.stepNumber} photo` : 'Photo',
            title: `${i + 1} of ${photos.length}`,
            description: p.stepNumber ? `Step ${p.stepNumber} · ${p.stepText}` : undefined,
          }))}
        />
      )}
    </div>
  )
}
