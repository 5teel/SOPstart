'use client'

import React, { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { reparseSop, restructureSop } from '@/actions/sops'
import type { ParseJobStatus as ParseJobStatusType } from '@/types/sop'
import {
  PLAIN_STAGES,
  STAGE_SETS,
  STAGE_TO_PLAIN,
  plainLabel,
  derivePipelineStage,
  shouldStartPolling,
  type Snapshot,
} from '@/lib/admin/job-stages'

// D-08: one realtime+polling engine for both the document/AI parse flow and
// the video-generation pipeline (ported wholesale from PipelineProgressClient
// -- the three-timer model is strictly more robust than a flat 5s-delay poll).
const POLL_INTERVAL_MS = 5000
const REALTIME_GRACE_MS = 5000
const REALTIME_STALE_MS = 15000

interface ParseJobStatusBaseProps {
  isOcr?: boolean
  onRetry?: (stage: string) => void // retry callback
  onDelete?: () => void // delete callback
  // Phase 14: optional completion callback so callers (e.g. AI prompt page)
  // can navigate after the job finishes (D-03 review-page redirect).
  onCompleted?: () => void
}

interface ParseJobStatusParseProps extends ParseJobStatusBaseProps {
  sopId: string
  pipelineId?: undefined
  initialStatus?: ParseJobStatusType | null
  initialErrorMessage?: string | null
  initialStage?: string | null // current_stage from parse_jobs
  initialIsVideo?: boolean // whether this is a video SOP
  initialSnapshot?: undefined
  onSnapshot?: undefined
}

interface ParseJobStatusPipelineProps extends ParseJobStatusBaseProps {
  sopId?: undefined
  pipelineId: string
  initialSnapshot?: Snapshot
  onSnapshot?: (s: Snapshot) => void
  initialStatus?: undefined
  initialErrorMessage?: undefined
  initialStage?: undefined
  initialIsVideo?: undefined
}

type ParseJobStatusProps = ParseJobStatusParseProps | ParseJobStatusPipelineProps

export default function ParseJobStatus(props: ParseJobStatusProps) {
  const {
    sopId,
    pipelineId,
    initialStatus,
    initialErrorMessage,
    isOcr = false,
    initialStage,
    initialIsVideo,
    initialSnapshot,
    onSnapshot,
    onRetry,
    onDelete,
    onCompleted,
  } = props
  const router = useRouter()
  const [status, setStatus] = useState<ParseJobStatusType | null>(
    initialStatus ?? null
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialErrorMessage ?? null
  )
  const [deleting, setDeleting] = useState(false)
  const [reParsing, setReParsing] = useState(false)
  const [currentStage, setCurrentStage] = useState<string | null>(initialStage ?? null)
  const [isVideoSop, setIsVideoSop] = useState(initialIsVideo ?? false)
  const [inputType, setInputType] = useState<string | null>(null)
  const [detailLevel, setDetailLevel] = useState(3)
  const [startTime] = useState<number>(Date.now())
  const [elapsed, setElapsed] = useState(0)
  const [snapshot, setSnapshot] = useState<Snapshot | null>(initialSnapshot ?? null)
  // Loading state for "Review now →" click — router.refresh() runs in a
  // transition so we can show a spinner while the slow RSC fetch lands.
  const [reviewLoading, startReviewTransition] = useTransition()

  const lastUpdateRef = useRef<number>(Date.now())
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Elapsed timer for transcribing stage
  useEffect(() => {
    if (currentStage !== 'transcribing') return
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [currentStage, startTime])

  useEffect(() => {
    const supabase = createClient()
    lastUpdateRef.current = Date.now()

    function startPolling() {
      if (pollingRef.current) return
      pollingRef.current = setInterval(() => {
        if (pipelineId) {
          fetchPipelineSnapshot()
        } else {
          fetchParseJob()
        }
      }, POLL_INTERVAL_MS)
    }

    async function fetchParseJob() {
      const { data } = await supabase
        .from('parse_jobs')
        .select('status, error_message, current_stage, file_type, input_type')
        .eq('sop_id', sopId as string)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle() as { data: { status: string; error_message: string | null; current_stage: string | null; file_type: string; input_type: string | null } | null }
      if (data) {
        setStatus(data.status as ParseJobStatusType)
        if (data.error_message) setErrorMessage(data.error_message)
        if (data.current_stage) setCurrentStage(data.current_stage as string)
        if (data.file_type === 'video') setIsVideoSop(true)
        setInputType(data.input_type ?? null)
        lastUpdateRef.current = Date.now()
        if (data.status === 'completed') {
          if (onCompleted) onCompleted()
          router.refresh() // auto-refresh to show review UI
        }
      }
    }

    async function fetchPipelineSnapshot() {
      try {
        const res = await fetch(`/api/sops/pipeline/${pipelineId}/snapshot`)
        if (!res.ok) return
        const next = (await res.json()) as Snapshot
        setSnapshot(next)
        onSnapshot?.(next)
        lastUpdateRef.current = Date.now()
      } catch {
        // swallow network errors — polling will retry
      }
    }

    let channel: ReturnType<typeof supabase.channel>

    if (pipelineId) {
      channel = supabase
        .channel(`pipeline-${pipelineId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sop_pipeline_runs', filter: `id=eq.${pipelineId}` },
          () => { lastUpdateRef.current = Date.now(); fetchPipelineSnapshot() }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'parse_jobs', filter: `pipeline_run_id=eq.${pipelineId}` },
          () => { lastUpdateRef.current = Date.now(); fetchPipelineSnapshot() }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sops', filter: `pipeline_run_id=eq.${pipelineId}` },
          () => { lastUpdateRef.current = Date.now(); fetchPipelineSnapshot() }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'video_generation_jobs', filter: `pipeline_run_id=eq.${pipelineId}` },
          () => { lastUpdateRef.current = Date.now(); fetchPipelineSnapshot() }
        )
        .subscribe((subStatus) => {
          if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT' || subStatus === 'CLOSED') {
            startPolling()
          }
        })
      fetchPipelineSnapshot()
    } else {
      channel = supabase
        .channel(`parse-job-${sopId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'parse_jobs', filter: `sop_id=eq.${sopId}` },
          (payload) => {
            lastUpdateRef.current = Date.now()
            if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
            setStatus(payload.new.status as ParseJobStatusType)
            if (payload.new.error_message) setErrorMessage(payload.new.error_message)
            if (payload.new.current_stage) {
              setCurrentStage(payload.new.current_stage as string)
            }
            if (payload.new.file_type === 'video') setIsVideoSop(true)
            if (payload.new.input_type !== undefined) setInputType((payload.new.input_type as string | null) ?? null)
            if (payload.new.status === 'completed' && onCompleted) onCompleted()
          }
        )
        .subscribe((subStatus) => {
          lastUpdateRef.current = Date.now()
          if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT' || subStatus === 'CLOSED') {
            startPolling()
          }
        })
      fetchParseJob()
    }

    // Polling grace period: if no realtime event fires within REALTIME_GRACE_MS, start polling.
    const startPollingTimeout = setTimeout(() => {
      if (shouldStartPolling(lastUpdateRef.current, Date.now(), REALTIME_GRACE_MS)) {
        startPolling()
      }
    }, REALTIME_GRACE_MS)

    // Stale watchdog: even if realtime is delivering events, start polling after
    // REALTIME_STALE_MS to catch silent drops (connected then went quiet).
    const staleWatchdog = setInterval(() => {
      if (shouldStartPolling(lastUpdateRef.current, Date.now(), REALTIME_STALE_MS)) {
        startPolling()
      }
    }, REALTIME_STALE_MS)

    return () => {
      clearTimeout(startPollingTimeout)
      clearInterval(staleWatchdog)
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sopId, pipelineId])

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
    router.push('/admin/sops')
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

  // Generalised stage stepper (D-07/D-08): renders the plain-language labels
  // for whichever active set applies — pipeline mode derives its current key
  // from the snapshot, parse mode translates parse_jobs.current_stage.
  const StageStepper = () => {
    const activeSetKey = pipelineId ? 'video_generation' : (inputType ?? (isVideoSop ? 'video_file' : 'upload'))
    const activeStageSet = STAGE_SETS[activeSetKey] ?? null
    const currentPlainKey = pipelineId
      ? (snapshot ? (derivePipelineStage(snapshot).errorAt ?? derivePipelineStage(snapshot).plainKey) : null)
      : (currentStage ? STAGE_TO_PLAIN[currentStage] ?? null : null)

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
                  isCompleted ? 'text-green-400' :
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
                <div className={`h-px flex-1 min-w-[8px] ${
                  isCompleted ? 'bg-[var(--ink-900)]' : 'bg-[var(--ink-100)]'
                }`} />
              )}
            </React.Fragment>
          )
        })}
      </div>
    )
  }

  // Pipeline mode: this component is the realtime+polling engine and the
  // stage stepper; the outcome CTAs (review link, ready link, error panels)
  // are rendered by PipelineProgressClient off derivePipelineStage(snapshot).
  if (pipelineId) {
    return <StageStepper />
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
          <CheckCircle className="text-green-400 flex-shrink-0 mt-0.5" size={20} />
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
                  className="text-red-400 text-sm font-medium hover:text-red-300"
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
              className="text-red-400 text-sm hover:text-red-300 font-medium"
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
            <Loader2 size={20} className="text-blue-400 animate-spin flex-shrink-0 mt-0.5" />
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
          <Loader2 size={20} className="text-blue-400 animate-spin flex-shrink-0 mt-0.5" />
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
        className="flex-shrink-0 mt-0.5 animate-spin border-2 border-blue-500/30 border-t-blue-400 rounded-full w-5 h-5"
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
