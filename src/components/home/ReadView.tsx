'use client'
/**
 * ADR-0012 -- one SOP, in the home's centre pane: reading and running are the same list.
 *
 * Reading writes nothing (the outline is a browser-client read, useReadSop). Start or Resume
 * opens a run on the server and the list becomes a checklist: each tick is written before it
 * shows (useRun). The start merge (fuse) plays only here, at that moment, centred in the pane.
 * Lazy module: HomeShell loads it when a SOP opens, so it rides outside the gated home bundle.
 */
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Camera, Check, Lightbulb, Loader2 } from 'lucide-react'
import { getSopOwner } from '@/actions/sop-owner'
import { Wordmark } from '@/components/brand/Wordmark'
import { captureSlowFlag, motionMode, playFuse, prefetchFuse, slowFactor } from '@/lib/brand/fuse'
import { KindChip, isSignal } from '@/components/focus/KindChip'
import { ClearView } from '@/components/home/ClearView'
import { DOT } from '@/components/home/SopRow'
import { StandardLabels } from '@/components/sop/StandardLabels'
import { WorkerObjective } from '@/components/shell/WorkerObjective'
import { useReadSop } from '@/hooks/useReadSop'
import { useRun } from '@/hooks/useRun'
import type { LibraryRow } from '@/hooks/useLibrary'
import { BEFORE_YOU_START, currentIndex, tickLabel, walkOrder } from '@/lib/sop/focus'
import { focusHref } from '@/lib/sop/focus-path'

// Raise and ask are lazy modules (60 A-07).
const RequestComposerTrigger = dynamic(
  () => import('@/components/requests/RequestComposer').then((m) => m.RequestComposerTrigger),
  { ssr: false, loading: () => null },
)
const AskTrigger = dynamic(() => import('@/components/requests/AskPicker').then((m) => m.AskTrigger), {
  ssr: false,
  loading: () => null,
})

/**
 * The wordmark's face is loaded (the merge must not play on a fallback font that then swaps). Only the first
 * family is checked: next/font adds an unloaded size-adjusted fallback face to the list, which would read false for ever.
 */
function wordmarkFontReady(el: Element): boolean {
  const family = getComputedStyle(el).fontFamily.split(',')[0]
  return document.fonts.check(`800 22px ${family}`, 'SOP') && document.fonts.check(`600 22px ${family}`, 'start')
}

const OWNER_ROLES = ['supervisor', 'admin', 'safety_manager']

export function ReadView({ row, role, from, onOpenSop, onClose }: { row: LibraryRow; role: string | null; from: string; onOpenSop(id: string): void; onClose(): void }) {
  const { data, isLoading } = useReadSop(row.id)
  const supervisorUp = !!role && OWNER_ROLES.includes(role)
  const canEdit = role === 'admin' || role === 'safety_manager'
  const ownerQ = useQuery({
    queryKey: ['sop-owner', row.id],
    enabled: supervisorUp,
    staleTime: 1000 * 60 * 5,
    queryFn: () => getSopOwner(row.id),
  })
  const owner = ownerQ.data && 'label' in ownerQ.data ? ownerQ.data.label : null

  const order = data ? walkOrder(data.sections, data.steps) : []
  const run = useRun({ sopId: row.id, order, allowForward: !!data?.sop.allow_forward_jump, onMoved: onOpenSop })
  const { status } = row
  // Where a run stands: this view's own run, else what the library knows (a run left on another day).
  const resumeAt = run.walk ? Math.min(currentIndex(order, run.done) + 1, order.length) : status?.kind === 'stopped' ? status.step : null
  const [asking, setAsking] = useState(false)
  // ADR-0015: the document as written first; the clear version one tap away once an admin approves it (admins see it before).
  const [view, setView] = useState<'direct' | 'clear'>('direct')
  const clear = data?.sop.clear_version ?? null
  const showClear = !!clear && (!!data?.sop.clear_approved_at || canEdit)
  // After Send: the popup says what was recorded until the worker picks home or review.
  const [reviewing, setReviewing] = useState(false)
  const goHome = () => {
    run.finish()
    onClose()
  }

  useEffect(() => {
    captureSlowFlag()
    prefetchFuse()
  }, [])

  // The next step to tick comes into view after each tick (and when the run opens).
  const nextRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!run.running || !run.nextId) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    nextRef.current?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
  }, [run.running, run.nextId])

  // Start, Resume and Begin again: the run opens on the server at the press while the merge covers the pane.
  const starting = useRef(false)
  const onStart = (e: React.MouseEvent<HTMLButtonElement>, over = false) => {
    if (starting.current) return
    starting.current = true
    // The checklist is always the version as written: ticks, photos and sign-off attach to it.
    setView('direct')
    const open = async () => {
      if (await (over ? run.startOver() : run.begin())) run.setRunning(true)
    }
    const motion = motionMode()
    const mode = motion === 'full' && resumeAt === null && !over ? 'full' : 'short'
    const button = (document.querySelector('[data-fuse="button"]') as HTMLElement | null) ?? e.currentTarget
    const chipEl = document.querySelector('[data-fuse="sop"] .wm-sop')
    const labelEl = button.querySelector('.wm-start')
    const pane = button.closest('[data-testid="home-reader"]') ?? document.body
    const done = () => (starting.current = false)
    if (motion !== 'off' && typeof Element.prototype.animate === 'function' && chipEl && labelEl && wordmarkFontReady(chipEl)) {
      void playFuse(
        { chip: chipEl.getBoundingClientRect(), label: labelEl.getBoundingClientRect(), button: button.getBoundingClientRect(), pane: pane.getBoundingClientRect(), mode, factor: slowFactor() },
        open,
      ).finally(done)
    } else void open().finally(done)
  }

  if (data === null) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8">
        <p data-testid="read-missing" className="text-reading text-ink-700">This SOP isn&apos;t in your library.</p>
      </div>
    )
  }

  const running = run.running
  const doneCount = order.filter((e) => run.done.has(e.step.id)).length
  const allDone = order.length > 0 && doneCount === order.length
  let lastGroup: string | null = null

  return (
    <div data-testid="read-view" data-state={running ? 'running' : 'reading'} className={running ? '' : 'pb-24'}>
      {running && (
        // The run bar: the whole wordmark means every tick is being recorded (ADR-0012).
        <div data-testid="run-bar" className="sticky top-0 z-10 border-b border-ink-200 bg-paper">
          <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5 lg:px-8">
            <Wordmark size="bar" target />
            <span data-testid="run-progress" className="font-label text-meta text-ink-700">
              {run.sent ? 'Sent for sign-off' : `${doneCount} of ${order.length} ticked`}
            </span>
            {!run.sent && (
              <button type="button" data-testid="run-stop" onClick={() => void run.stop()} className="back ml-auto">
                Stop
              </button>
            )}
          </div>
          <div className="h-1 bg-ink-100" role="progressbar" aria-valuemin={0} aria-valuemax={order.length} aria-valuenow={doneCount}>
            <div className="h-1 bg-ink-900 transition-[width] duration-300" style={{ width: `${order.length ? (doneCount / order.length) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      <div className="mx-auto max-w-3xl px-4 pt-6 lg:px-8">
        {!running && <Wordmark variant="chip" size="merge" data-fuse="sop" />}
        <h1 className="mb-1.5 mt-2.5 text-2xl font-semibold text-ink-900">{row.title}</h1>
        <p className="font-label text-meta text-ink-600">
          <i aria-hidden="true" className="mr-1 inline-block size-2 rounded align-baseline" style={{ background: row.colourVar }} />
          {row.areaName} · {row.type} · v{row.version ?? 1}
          {owner ? ` · owner ${owner}` : ''}
          {row.minutes ? ` · ~${row.minutes} min` : ''}
        </p>
        {/* The SOP's objective, one per lineage (A-01). */}
        <div className="mt-1.5">
          <WorkerObjective type="sop" id={row.rootId} />
        </div>
        {data && data.standards.sop.length > 0 && (
          <div data-testid="read-standards" className="mt-2.5 flex flex-wrap gap-1.5">
            <StandardLabels names={data.standards.sop.map((s) => s.name)} />
          </div>
        )}
        {status && !running && (
          <p data-testid="read-status" className="mt-3 flex items-center gap-1.5 text-ui text-ink-600">
            <i aria-hidden="true" className={DOT[status.kind]} />
            {status.text}
          </p>
        )}

        {!running && (
          <div className="mb-1.5 mt-5 flex flex-wrap items-center gap-3.5">
            <button
              type="button"
              data-testid="read-start"
              data-fuse="button"
              aria-label="start"
              disabled={run.busy || order.length === 0}
              onClick={(e) => onStart(e)}
              className="flex min-h-tap-glove w-full items-center justify-center rounded-lg bg-ink-900 disabled:opacity-60 lg:w-auto lg:px-10"
            >
              <Wordmark variant="start" size="merge" onInk data-fuse="start" />
            </button>
            <span className="text-ui text-ink-600">
              {resumeAt !== null ? (
                <>
                  Picks up at step {resumeAt} of {order.length || (status?.kind === 'stopped' ? status.total : 0)} ·{' '}
                  <button type="button" data-testid="read-begin-again" onClick={() => setAsking(true)} className="underline">
                    or begin from step 1
                  </button>
                </>
              ) : data ? (
                `${order.length} ${order.length === 1 ? 'step' : 'steps'} · nothing is recorded until you start`
              ) : null}
            </span>
          </div>
        )}
        {run.error && !running && (
          <p role="alert" data-testid="walk-error" className="mt-2 text-ui text-accent-escalate">
            {run.error}
          </p>
        )}

        {!running && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-ui text-ink-700">
            <RequestComposerTrigger kinds={['change_sop', 'observe_me']} about={{ sops: [{ id: row.id, title: row.title }] }} triggerStyle="text" />
            {supervisorUp && <AskTrigger sopId={row.id} sopTitle={row.title} variant="rail" align="start" />}
            {canEdit && (
              <Link data-testid="read-edit" href={focusHref(row.id, { mode: 'edit', from })} className="underline">
                Edit
              </Link>
            )}
          </div>
        )}

        {!running && showClear && (
          <div className="mt-5">
            <span className="seg" role="group" aria-label="Version" data-testid="read-version">
              <button type="button" aria-pressed={view === 'direct'} data-testid="read-version-direct" onClick={() => setView('direct')}>
                As written
              </button>
              <button type="button" aria-pressed={view === 'clear'} data-testid="read-version-clear" onClick={() => setView('clear')}>
                Clear version{data?.sop.clear_approved_at ? '' : ' · not approved'}
              </button>
            </span>
          </div>
        )}

        <div className="mt-6" />
        {!running && view === 'clear' && clear && data ? (
          <ClearView sopId={row.id} clear={clear} approvedAt={data.sop.clear_approved_at} canApprove={canEdit} signed={data.signed} />
        ) : isLoading || !data ? (
          <div aria-busy="true" className="space-y-3 pt-2">
            <div className="h-5 w-3/4 animate-pulse rounded bg-paper-2 motion-reduce:animate-none" />
            <div className="h-5 w-1/2 animate-pulse rounded bg-paper-2 motion-reduce:animate-none" />
          </div>
        ) : (
          <ol data-testid="read-steps" className="m-0 list-none p-0">
            {order.map((e) => {
              const { step } = e
              const header = e.groupLabel !== lastGroup ? e.groupLabel : null
              lastGroup = e.groupLabel
              const isDone = run.done.has(step.id)
              const isNext = running && !isDone && step.id === run.nextId
              const open = running && !isDone && run.reachable(step.id)
              const needsPhoto = step.photo_required && !run.photoSteps.has(step.id)
              const state = !running ? 'read' : isDone ? 'done' : open ? (isNext ? 'next' : 'open') : 'waiting'
              const names = (data.standards.steps[step.id] ?? []).map((s) => s.name)
              return (
                <li key={step.id} className="contents">
                  {header && (
                    // A section's standards sit on its heading, as they did on the old browse page (Phase 56 C).
                    <h2 className="section-heading flex flex-wrap items-center gap-2 pb-1 pt-5">
                      {header}
                      {header !== BEFORE_YOU_START && <StandardLabels names={(data.standards.sections[step.section_id] ?? []).map((s) => s.name)} />}
                    </h2>
                  )}
                  <div
                    ref={isNext ? nextRef : undefined}
                    data-testid="step-row"
                    data-step-id={step.id}
                    data-kind={step.kind}
                    data-state={state}
                    className={`flex gap-3 border-b border-ink-200 py-3 ${isNext ? '-mx-3 rounded-lg border-transparent bg-paper-2 px-3' : ''}`}
                  >
                    {running ? (
                      <button
                        type="button"
                        data-testid="step-tick"
                        aria-label={isDone ? `Step ${e.index} ticked` : `${tickLabel(step.kind)} (step ${e.index})`}
                        aria-pressed={isDone}
                        disabled={isDone || !open || needsPhoto || run.busy}
                        onClick={() => void run.tick(step.id)}
                        className={`grid size-tap-glove shrink-0 place-items-center rounded-lg border-2 font-label text-reading font-bold ${
                          isDone ? 'border-ink-900 bg-ink-900 text-paper' : open && !needsPhoto ? 'border-ink-900 bg-paper-1 text-ink-900' : 'border-dashed border-ink-300 text-ink-400'
                        }`}
                      >
                        {isDone ? <Check className="size-7" aria-hidden="true" /> : e.index}
                      </button>
                    ) : (
                      <span className="w-6 shrink-0 pt-1 font-label text-meta text-ink-600">{e.index}</span>
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <p className={`text-reading text-ink-900 ${isNext ? 'font-semibold' : ''}`}>
                        {step.text}
                        {step.photo_required && !running && <span className="font-label text-meta text-ink-600"> · photo</span>}
                      </p>
                      {(isSignal(step.kind) || names.length > 0) && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {isSignal(step.kind) && <KindChip kind={step.kind} />}
                          <StandardLabels names={names} />
                        </div>
                      )}
                      {step.tip && (
                        <p className="flex items-start gap-1.5 text-ui text-ink-700">
                          <Lightbulb className="mt-0.5 size-4 shrink-0 text-ink-500" aria-hidden="true" />
                          <span>
                            <span className="mr-1 font-semibold">Tip</span>
                            {step.tip}
                          </span>
                        </p>
                      )}
                      {step.image_urls.map((url) => (
                        <img key={url} src={url} alt="" loading="lazy" decoding="async" className="max-h-64 w-fit max-w-full rounded-lg object-contain" />
                      ))}
                      {running && step.photo_required && (
                        <PhotoSlot
                          has={run.photoSteps.has(step.id)}
                          preview={run.previews[step.id]}
                          disabled={isDone || !open || run.busy}
                          onPhoto={(file) => void run.photo(step.id, file)}
                        />
                      )}
                      {isNext && <p className="text-ui text-ink-600">{needsPhoto ? 'Add the photo, then tick.' : `Tick: ${tickLabel(step.kind)}.`}</p>}
                    </div>
                  </div>
                </li>
              )
            })}
          </ol>
        )}

      </div>

      {running && (
        // Pinned to the foot of the pane for the whole run; Send wakes up once every step is ticked.
        <div data-testid="run-send" className="sticky bottom-0 z-10 border-t border-ink-200 bg-paper">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-3 lg:px-8">
            {run.sent ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="min-w-0 flex-1 text-ui font-semibold text-ink-900">Sent for sign-off at {run.sent}.</p>
                <button type="button" data-testid="run-done" onClick={goHome} className="min-h-tap-glove rounded-lg bg-ink-900 px-6 text-reading font-semibold text-paper">
                  Back to home
                </button>
              </div>
            ) : (
              <>
                {run.error && (
                  <p role="alert" data-testid="walk-error" className="text-ui text-accent-escalate">
                    {run.error}
                  </p>
                )}
                {allDone && run.missing.length > 0 && <p className="text-ui text-ink-600">Still to do: {run.missing.map((m) => m.text).join(', ')}.</p>}
                <div className="flex items-center gap-3">
                  <p className="min-w-0 flex-1 text-ui text-ink-700">
                    {allDone
                      ? `All ${order.length} steps ticked${run.photoSteps.size > 0 ? ` · ${run.photoSteps.size} photo${run.photoSteps.size === 1 ? '' : 's'}` : ''}.`
                      : `${order.length - doneCount} of ${order.length} still to tick`}
                  </p>
                  <button
                    type="button"
                    data-testid="run-send-button"
                    disabled={!allDone || run.busy || run.missing.length > 0}
                    onClick={() => void run.send()}
                    aria-busy={run.sending}
                    className={`inline-flex min-h-tap-glove shrink-0 items-center justify-center gap-2 rounded-lg px-5 text-reading font-semibold ${
                      allDone ? 'bg-ink-900 text-paper' : 'bg-paper-2 text-ink-500'
                    } ${run.sending ? '' : 'disabled:opacity-60'}`}
                  >
                    {run.sending ? (
                      <>
                        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                        Sending…
                      </>
                    ) : (
                      'Send for sign-off'
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {run.sent && !reviewing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            e.preventDefault()
            setReviewing(true)
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="run-sent-title" data-testid="run-sent-dialog" className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-paper-1 p-6">
            <span className="grid size-12 place-items-center rounded-full bg-accent-ok text-paper">
              <Check className="size-7" aria-hidden="true" />
            </span>
            <h2 id="run-sent-title" data-testid="run-sent" className="text-xl font-semibold text-ink-900">
              Sent for sign-off
            </h2>
            <div>
              <p className="text-ui text-ink-600">Recorded at {run.sent}</p>
              <p className="text-reading font-semibold text-ink-900">{row.title}</p>
              <ul className="mt-2 flex flex-col gap-1 text-reading text-ink-700">
                <li>All {order.length} steps ticked</li>
                {run.photoSteps.size > 0 && <li>{run.photoSteps.size} photo{run.photoSteps.size === 1 ? '' : 's'}</li>}
              </ul>
            </div>
            <p className="text-reading text-ink-700">Your supervisor gets it next and signs it off.</p>
            <div className="flex flex-col gap-2">
              <button type="button" data-testid="run-sent-home" autoFocus onClick={goHome} className="min-h-tap-glove w-full rounded-lg bg-ink-900 text-reading font-semibold text-paper">
                Back to home
              </button>
              <button type="button" data-testid="run-sent-review" onClick={() => setReviewing(true)} className="min-h-tap-glove w-full rounded-lg border border-ink-300 text-reading text-ink-900">
                Review what you sent
              </button>
            </div>
          </div>
        </div>
      )}

      {asking && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            // Handled here: the home's Esc (close the SOP) skips a prevented key.
            e.preventDefault()
            setAsking(false)
          }}
        >
          <div role="dialog" aria-modal="true" aria-labelledby="start-over-title" data-testid="walk-start-over-dialog" className="flex w-full max-w-sm flex-col gap-4 rounded-2xl bg-paper-1 p-6">
            <h2 id="start-over-title" className="text-reading font-semibold text-ink-900">
              Start over?
            </h2>
            <p className="text-reading text-ink-700">Your ticks and photos so far will be thrown away.</p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                data-testid="walk-start-over-confirm"
                autoFocus
                onClick={(e) => {
                  setAsking(false)
                  onStart(e, true)
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

function PhotoSlot({ has, preview, disabled, onPhoto }: { has: boolean; preview?: string; disabled: boolean; onPhoto(file: File): void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex items-center gap-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        data-testid="step-photo-input"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) onPhoto(file)
        }}
      />
      {has &&
        (preview ? (
          <img data-testid="step-photo" src={preview} alt="Your photo for this step" className="size-18 rounded-lg object-cover" />
        ) : (
          <span data-testid="step-photo" className="grid size-18 place-items-center rounded-lg border border-ink-200 bg-paper-2">
            <Check className="size-6 text-accent-ok" aria-hidden="true" />
          </span>
        ))}
      {!disabled && (
        <button
          type="button"
          data-testid={has ? 'step-photo-retake' : 'step-photo-button'}
          onClick={() => fileRef.current?.click()}
          className="inline-flex min-h-tap-glove items-center gap-2 rounded-lg border border-ink-300 bg-paper-1 px-4 text-reading text-ink-900"
        >
          <Camera className="size-5" aria-hidden="true" />
          {has ? 'Retake' : 'Add a photo'}
        </button>
      )}
    </div>
  )
}
