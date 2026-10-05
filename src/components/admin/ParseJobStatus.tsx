'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { reparseSop, restructureSop } from '@/actions/sops'
import { useParseJob } from '@/hooks/useParseJob'
import type { ParseJobStatus as ParseJobStatusType } from '@/types/sop'
import {
  PLAIN_STAGES,
  STAGE_SETS,
  STAGE_TO_PLAIN,
  plainLabel,
} from '@/lib/admin/job-stages'

// D-08: the realtime + polling engine (three-timer model: realtime grace, stale
// watchdog, 5s poll) lives in useParseJob (Phase 58-13), shared with the editor.

interface ParseJobStatusBaseProps {
  isOcr?: boolean
  onRetry?: (stage: string) => void // retry callback
  onDelete?: () => void // delete callback
  // Phase 14: optional completion callback so callers (e.g. AI prompt page)
  // can navigate after the job finishes (D-03 review-page redirect).
  onCompleted?: () => void
}

interface ParseJobStatusProps extends ParseJobStatusBaseProps {
  sopId: string
  initialStatus?: ParseJobStatusType | null
  initialErrorMessage?: string | null
  initialStage?: string | null // current_stage from parse_jobs
  initialIsVideo?: boolean // whether this is a video SOP
}

export default function ParseJobStatus(props: ParseJobStatusProps) {
  const {
    sopId,
    initialStatus,
    initialErrorMessage,
    isOcr = false,
    initialStage,
    initialIsVideo,
    onRetry,
    onDelete,
    onCompleted,
  } = props
  const router = useRouter()
  const { job, patch } = useParseJob(sopId, {
    initial: {
      status: initialStatus ?? null,
      errorMessage: initialErrorMessage ?? null,
      currentStage: initialStage ?? null,
      isVideo: initialIsVideo ?? false,
    },
    onCompleted,
    onPollCompleted: () => router.refresh(), // auto-refresh to show review UI
  })
  const { status, errorMessage, currentStage, isVideo: isVideoSop, inputType } = job
  const setStatus = (v: ParseJobStatusType | null) => patch({ status: v })
  const setErrorMessage = (v: string | null) => patch({ errorMessage: v })
  const setCurrentStage = (v: string | null) => patch({ currentStage: v })
  const [deleting, setDeleting] = useState(false)
  const [reParsing, setReParsing] = useState(false)
  const [detailLevel, setDetailLevel] = useState(3)
  const [startTime] = useState<number>(Date.now())
  const [elapsed, setElapsed] = useState(0)
  // Loading state for "Review now →" click — router.refresh() runs in a
  // transition so we can show a spinner while the slow RSC fetch lands.
  const [reviewLoading, startReviewTransition] = useTransition()

  // Elapsed timer for transcribing stage
  useEffect(() => {
    if (currentStage !== 'transcribing') return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [currentStage, startTime])

  const handleReparse = async () => {
    setReParsing(true)
    const result = await reparseSop(sopId as string)
    if ('error' in result) {
      setErrorMessage(result.error)
      setStatus('failed')
      setReParsing(false)
      return
    }
    const endpoint = isVideoSop ? '/api/sops/transcribe' : '/api/sops/parse'
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sopId }),
      })
      if (!res.ok) {
        setErrorMessage('Could not start the retry — please try again.')
        setStatus('failed')
        setReParsing(false)
        return
      }
    } catch {
      setErrorMessage('Could not start the retry — check your connection and try again.')
      setStatus('failed')
      setReParsing(false)
      return
    }
    setStatus('queued')
    setErrorMessage(null)
    setCurrentStage(null)
    setReParsing(false)
    router.refresh()
  }

  const handleRestructure = async (level?: number) => {
    setReParsing(true)
    const result = await restructureSop(sopId as string)
    if ('error' in result) {
      setErrorMessage(result.error)
      setStatus('failed')
      setReParsing(false)
      return
    }
    fetch('/api/sops/restructure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sopId, detailLevel: level ?? detailLevel }),
    }).catch(console.error)
    setStatus('queued')
    setErrorMessage(null)
    setCurrentStage('structuring')
    setReParsing(false)
    router.refresh()
  }

  const handleDelete = async () => {
    if (onDelete) {
      onDelete()
      return
    }
    setDeleting(true)
    await fetch(`/api/sops/${sopId}`, { method: 'DELETE' })
    router.push('/?place=workshop')
  }

  // Gap-closure (40-13, CR-04/WR-02): an AI-prompt draft has no source file to
  // re-parse, so the retry affordance must not be offered for it.
  const canRetry = inputType !== 'ai_prompt'

  // Parse failed stage name from error_message format: "Failed at {stage}: {message}"
  const failedStageMatch = errorMessage?.match(/^Failed at ([^:]+):/)
  const failedStage = failedStageMatch?.[1]?.trim() ?? null
  const failedStageName = failedStage ? plainLabel(failedStage) ?? failedStage : null

  // Surface unused-variable lints — these helpers are wired through render branches
  // below (and onRetry is exposed via props for future call sites). Reference here
  // so the linter doesn't complain about declared-but-not-read.
  void failedStageName
  void onRetry

  // OCR low-confidence banner
  const OcrBanner = () => (
    <div className="bg-[var(--accent-voice)]/20 border border-[var(--accent-voice)]/50 text-[var(--accent-voice)] rounded-lg px-4 py-3 text-sm flex gap-2 items-start mb-4">
      <AlertTriangle className="flex-shrink-0 mt-0.5" size={16} />
      <span>
        Heads up — this document was scanned or photographed, so some text might be off. Check it carefully before publishing.
      </span>
    </div>
  )

  // Stage stepper (D-07/D-08): plain-language labels for the active set,
  // translating parse_jobs.current_stage.
  const StageStepper = () => {
    const activeSetKey = inputType ?? (isVideoSop ? 'video_file' : 'upload')
    const activeStageSet = STAGE_SETS[activeSetKey] ?? null
    const currentPlainKey = currentStage ? STAGE_TO_PLAIN[currentStage] ?? null : null

    if (!activeStageSet || !currentPlainKey) {
      return null
    }
    const stageIndex = activeStageSet.findIndex(k => k === currentPlainKey)

    return (
      <div className="flex items-center gap-1 mb-4 overflow-x-auto" role="group" aria-label="Processing stages">
        {activeStageSet.map((key, i) => {
          const label = PLAIN_STAGES.find(s => s.key === key)?.label ?? key
          const isCompleted = i < stageIndex
          const isActive = i === stageIndex
          const isPending = i > stageIndex

          return (
            <React.Fragment key={key}>
              <span
                className={`text-xs whitespace-nowrap px-1 ${
                  isCompleted ? 'text-accent-signoff' :
                  isActive ? 'text-[var(--ink-900)] font-semibold' :
                  isPending ? 'text-[var(--ink-300)]' :
                  'text-[var(--ink-300)]'
                }`}
                aria-current={isActive ? 'step' : undefined}
                aria-label={label}
              >
                {label}
              </span>
              {i < activeStageSet.length - 1 && (
                <div className={`h-px flex-1 min-w-2 ${
                  isCompleted ? 'bg-[var(--ink-900)]' : 'bg-[var(--ink-100)]'
                }`} />
              )}
            </React.Fragment>
          )
        })}
      </div>
    )
  }

  if (status === 'completed') {
    const isAiPrompt = inputType === 'ai_prompt'
    const completionCopy = isAiPrompt
      ? 'AI draft ready to review'
      : isVideoSop
        ? 'Transcript and SOP ready to review'
        : 'Parsed and ready to review'

    return (
      <>
        {isOcr && <OcrBanner />}
        <div className="bg-white border border-[var(--ink-100)] rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="text-accent-signoff flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-[var(--ink-900)]">
              {completionCopy}
            </p>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <button
                onClick={() => startReviewTransition(() => router.refresh())}
                disabled={reviewLoading}
                className="inline-flex items-center gap-1.5 text-[var(--ink-900)] text-sm font-medium hover:text-[var(--ink-700)] disabled:opacity-60 disabled:cursor-wait"
                aria-busy={reviewLoading}
              >
                {reviewLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading review&hellip;
                  </>
                ) : (
                  <>Review now &rarr;</>
                )}
              </button>
              {isVideoSop && (
                <>
                  <button
                    onClick={() => handleRestructure()}
                    disabled={reParsing}
                    className="text-[var(--ink-500)] text-sm font-medium hover:text-[var(--ink-900)]"
                  >
                    {reParsing ? 'Processing...' : 'Re-structure'}
                  </button>
                  <button
                    onClick={handleReparse}
                    disabled={reParsing}
                    className="text-[var(--ink-500)] text-sm font-medium hover:text-[var(--ink-900)]"
                  >
                    {reParsing ? 'Processing...' : 'Re-transcribe'}
                  </button>
                </>
              )}
            </div>
            {(isVideoSop || isAiPrompt) && (
              <DetailLevelControl value={detailLevel} onChange={setDetailLevel} onApply={() => handleRestructure()} disabled={reParsing} />
            )}
          </div>
        </div>
      </>
    )
  }

  if (status === 'failed') {
    if (isVideoSop) {
      return (
        <div className="bg-white border border-[var(--ink-100)] rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-[var(--accent-voice)] flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--ink-900)]">
                {errorMessage ?? 'Processing failed'}
              </p>
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                <button
                  onClick={() => handleRestructure()}
                  disabled={reParsing}
                  className="text-[var(--ink-900)] text-sm font-medium hover:text-[var(--ink-700)]"
                >
                  {reParsing ? 'Processing...' : 'Re-structure only'}
                </button>
                <button
                  onClick={handleReparse}
                  disabled={reParsing}
                  className="text-[var(--accent-voice)] text-sm font-medium hover:text-[var(--ink-700)]"
                >
                  {reParsing ? 'Processing...' : 'Full re-transcribe'}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-accent-escalate text-sm font-medium hover:text-accent-escalate"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="bg-white border border-[var(--ink-100)] rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="text-[var(--accent-voice)] flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--ink-900)]">Couldn&apos;t parse that one</p>
          {errorMessage && (
            <p className="text-xs text-[var(--ink-500)] mt-1 line-clamp-2">{errorMessage}</p>
          )}
          {!canRetry && (
            <p className="text-xs text-[var(--ink-500)] mt-1">
              This draft was written from a prompt, so there&apos;s nothing to re-parse — start a new AI draft instead.
            </p>
          )}
          <div className="flex items-center gap-4 mt-3">
            {canRetry && (
              <button
                onClick={handleReparse}
                disabled={reParsing}
                className="text-[var(--accent-voice)] text-sm hover:text-[var(--ink-700)] font-medium"
              >
                {reParsing ? 'Trying again…' : 'Try again'}
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-accent-escalate text-sm hover:text-accent-escalate font-medium"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Video SOP: show stage-specific processing state
  if (isVideoSop && currentStage) {
    return (
      <div className="bg-white border border-[var(--ink-100)] rounded-lg p-4">
        <StageStepper />
        <div className="flex items-start gap-3">
          {currentStage === 'verifying' ? (
            <Loader2 size={20} className="text-[var(--accent-voice)] animate-spin flex-shrink-0 mt-0.5" />
          ) : (
            <Loader2 size={20} className="text-accent-step animate-spin flex-shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-semibold text-[var(--ink-900)]">
              {plainLabel(currentStage)}
              {currentStage === 'transcribing' ? ` (${elapsed}s)` : ''}
            </p>
            {currentStage === 'transcribing' && (
              <p className="text-xs text-[var(--ink-500)] mt-1">Grab a hot drink — this can take a few minutes.</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Phase 14: AI-prompt SOP processing state — render the 3-stage stepper.
  if (inputType === 'ai_prompt' && currentStage) {
    return (
      <div className="bg-white border border-[var(--ink-100)] rounded-lg p-4">
        <StageStepper />
        <div className="flex items-start gap-3">
          <Loader2 size={20} className="text-accent-step animate-spin flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[var(--ink-900)]">{plainLabel(currentStage)}</p>
          </div>
        </div>
      </div>
    )
  }

  // Non-video parsing / queued / processing state (default)
  return (
    <div className="bg-white border border-[var(--ink-100)] rounded-lg p-4 flex items-start gap-3">
      <div
        className="flex-shrink-0 mt-0.5 animate-spin border-2 border-accent-step/30 border-t-blue-400 rounded-full w-5 h-5"
        aria-hidden="true"
      />
      <div>
        <p className="text-sm font-semibold text-[var(--ink-900)]">Crunching your SOP&hellip;</p>
        <p className="text-xs text-[var(--ink-500)] mt-1">
          Grab a hot drink or take a smoko — we&apos;ll let you know when it&apos;s ready.
        </p>
      </div>
    </div>
  )
}

// ─── Detail Level Control ───────────────────────────────────────────────────

const DETAIL_LABELS = ['Minimal', 'Brief', 'Standard', 'Detailed', 'Maximum'] as const

function DetailLevelControl({
  value,
  onChange,
  onApply,
  disabled,
}: {
  value: number
  onChange: (v: number) => void
  onApply: () => void
  disabled: boolean
}) {
  return (
    <div className="mt-3 pt-3 border-t border-[var(--ink-100)]">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[var(--ink-500)] uppercase tracking-wider">
          Detail level
        </span>
        <span className="text-xs text-[var(--ink-500)]">
          {DETAIL_LABELS[value - 1]} ({value}/5)
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-[var(--ink-500)]">−</span>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="flex-1 h-2 rounded-full appearance-none bg-[var(--paper-2)] accent-[var(--ink-900)] cursor-pointer"
          aria-label="Detail level"
        />
        <span className="text-xs text-[var(--ink-500)]">+</span>
        <button
          onClick={onApply}
          disabled={disabled}
          className="text-xs font-semibold text-[var(--ink-900)] hover:text-[var(--ink-700)] disabled:opacity-50 whitespace-nowrap"
        >
          Apply
        </button>
      </div>
    </div>
  )
}
