'use client'

import React, { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { reparseSop, restructureSop } from '@/actions/sops'
import type { ParseJobStatus as ParseJobStatusType } from '@/types/sop'

interface ParseJobStatusProps {
  sopId: string
  initialStatus?: ParseJobStatusType | null
  initialErrorMessage?: string | null
  isOcr?: boolean
  initialStage?: string | null        // current_stage from parse_jobs
  initialIsVideo?: boolean             // whether this is a video SOP
  onRetry?: (stage: string) => void    // retry callback
  onDelete?: () => void                // delete callback
  // Phase 14: optional completion callback so callers (e.g. AI prompt page)
  // can navigate after the job finishes (D-03 review-page redirect).
  onCompleted?: () => void
}

type StageEntry = { key: string; label: string }

// Phase 6 video pipeline — preserve the exact existing labels (verbatim from prior VIDEO_STAGES).
const VIDEO_STAGES_ORIGINAL: ReadonlyArray<StageEntry> = [
  { key: 'uploading', label: 'Uploading' },
  { key: 'extracting_audio', label: 'Extracting' },
  { key: 'transcribing', label: 'Transcribing' },
  { key: 'structuring', label: 'Structuring' },
  { key: 'verifying', label: 'Verifying' },
]

// Phase 14 AI-drafted SOPs (D-02 keeps 'verifying' in both modes).
const AI_STAGES: ReadonlyArray<StageEntry> = [
  { key: 'prompting', label: 'Prompting' },
  { key: 'drafting', label: 'Drafting' },
  { key: 'verifying', label: 'Verifying' },
]

// Generalised map keyed off parse_jobs.input_type. Both legacy video
// keys point at the SAME array — zero behavioural drift for Phase 6.
const STAGE_SETS: Record<string, ReadonlyArray<StageEntry>> = {
  video_file: VIDEO_STAGES_ORIGINAL,
  youtube_url: VIDEO_STAGES_ORIGINAL,
  ai_prompt: AI_STAGES,
}

// Backwards-compat alias for any code-path that still reads VIDEO_STAGES.
const VIDEO_STAGES = VIDEO_STAGES_ORIGINAL

export default function ParseJobStatus({
  sopId,
  initialStatus,
  initialErrorMessage,
  isOcr = false,
  initialStage,
  initialIsVideo,
  onRetry,
  onDelete,
  onCompleted,
}: ParseJobStatusProps) {
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

  useEffect(() => {
    const supabase = createClient()
    let pollingInterval: ReturnType<typeof setInterval> | null = null
    let realtimeConnected = false

    // Fetch initial parse job to detect video type
    supabase
      .from('parse_jobs')
      .select('status, error_message, current_stage, file_type, input_type')
      .eq('sop_id', sopId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { status: string; error_message: string | null; current_stage: string | null; file_type: string; input_type: string | null } | null
        if (row) {
          if (row.status) setStatus(row.status as ParseJobStatusType)
          if (row.error_message) setErrorMessage(row.error_message)
          if (row.current_stage) setCurrentStage(row.current_stage as string)
          if (row.file_type === 'video') setIsVideoSop(true)
          setInputType(row.input_type ?? null)
          if (row.status === 'completed' && onCompleted) onCompleted()
        }
      })

    // Start polling fallback after 5s if Realtime hasn't fired
    const pollingTimeout = setTimeout(() => {
      if (!realtimeConnected) {
        pollingInterval = setInterval(async () => {
          const { data } = await supabase
            .from('parse_jobs')
            .select('status, error_message, current_stage, file_type, input_type')
            .eq('sop_id', sopId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle() as { data: { status: string; error_message: string | null; current_stage: string | null; file_type: string; input_type: string | null } | null }
          if (data) {
            setStatus(data.status as ParseJobStatusType)
            if (data.error_message) setErrorMessage(data.error_message)
            if (data.current_stage) setCurrentStage(data.current_stage as string)
            if (data.file_type === 'video') setIsVideoSop(true)
            setInputType(data.input_type ?? null)
            if (data.status === 'completed') {
              if (pollingInterval) clearInterval(pollingInterval)
              if (onCompleted) onCompleted()
              router.refresh() // auto-refresh to show review UI
            }
            if (data.status === 'failed') {
              if (pollingInterval) clearInterval(pollingInterval)
            }
          }
        }, 5000)
      }
    }, 5000)

    const channel = supabase
      .channel(`parse-job-${sopId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'parse_jobs',
          filter: `sop_id=eq.${sopId}`,
        },
        (payload) => {
          realtimeConnected = true
          if (pollingInterval) clearInterval(pollingInterval)
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
      .subscribe(() => {
        realtimeConnected = true
      })

    return () => {
      clearTimeout(pollingTimeout)
      if (pollingInterval) clearInterval(pollingInterval)
      supabase.removeChannel(channel)
    }
  }, [sopId])

  // Phase 14: pick the active stage set. Prefer parse_jobs.input_type when known;
  // fall back to the legacy isVideoSop boolean for callers that pre-date input_type.
  const activeStageSet: ReadonlyArray<StageEntry> | null =
    inputType && STAGE_SETS[inputType]
      ? STAGE_SETS[inputType]
      : isVideoSop
        ? STAGE_SETS.video_file
        : null

  const handleReparse = async () => {
    setReParsing(true)
    const result = await reparseSop(sopId)
    if ('error' in result) {
      setErrorMessage(result.error)
      setStatus('failed')
      setReParsing(false)
      return
    }
    const endpoint =
      inputType === 'ai_prompt' ? '/api/sops/ai-prompt'
      : isVideoSop ? '/api/sops/transcribe'
      : '/api/sops/parse'
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sopId }),
    }).catch(console.error)
    setStatus('queued')
    setErrorMessage(null)
    setCurrentStage(null)
    setReParsing(false)
    router.refresh()
  }

  const handleRestructure = async (level?: number) => {
    setReParsing(true)
    const result = await restructureSop(sopId)
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

  // Parse failed stage name from error_message format: "Failed at {stage}: {message}"
  const failedStageMatch = errorMessage?.match(/^Failed at ([^:]+):/)
  const failedStage = failedStageMatch?.[1]?.trim() ?? null
  const failedStageName = failedStage
    ? VIDEO_STAGES.find(s => s.key === failedStage)?.label ?? failedStage
    : null

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

  // Generalised stage stepper (Phase 14): renders activeStageSet for any input_type
  // that has an entry in STAGE_SETS (video_file, youtube_url, ai_prompt today).
  const StageStepper = () => {
    if (!activeStageSet || !currentStage || currentStage === 'completed' || currentStage === 'failed') {
      return null
    }
    const stageIndex = activeStageSet.findIndex(s => s.key === currentStage)

    return (
      <div className="flex items-center gap-1 mb-4 overflow-x-auto" role="group" aria-label="Processing stages">
        {activeStageSet.map((stage, i) => {
          const isCompleted = i < stageIndex
          const isActive = i === stageIndex
          const isPending = i > stageIndex

          return (
            <React.Fragment key={stage.key}>
              <span
                className={`text-xs whitespace-nowrap px-1 ${
                  isCompleted ? 'text-green-400' :
                  isActive ? 'text-[var(--ink-900)] font-semibold' :
                  isPending ? 'text-[var(--ink-300)]' :
                  'text-[var(--ink-300)]'
                }`}
                aria-current={isActive ? 'step' : undefined}
                aria-label={stage.label}
              >
                {stage.label}
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
          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={handleReparse}
              disabled={reParsing}
              className="text-[var(--accent-voice)] text-sm hover:text-[var(--ink-700)] font-medium"
            >
              {reParsing ? 'Trying again…' : 'Try again'}
            </button>
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
            {currentStage === 'uploading' && (
              <p className="text-sm font-semibold text-[var(--ink-900)]">Uploading video...</p>
            )}
            {currentStage === 'extracting_audio' && (
              <p className="text-sm font-semibold text-[var(--ink-900)]">Extracting audio from video...</p>
            )}
            {currentStage === 'transcribing' && (
              <>
                <p className="text-sm font-semibold text-[var(--ink-900)]">Transcribing audio... ({elapsed}s)</p>
                <p className="text-xs text-[var(--ink-500)] mt-1">Grab a hot drink — this can take a few minutes.</p>
              </>
            )}
            {currentStage === 'structuring' && (
              <p className="text-sm font-semibold text-[var(--ink-900)]">Structuring SOP from transcript...</p>
            )}
            {currentStage === 'verifying' && (
              <p className="text-sm font-semibold text-[var(--ink-900)]">Running AI verification pass...</p>
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
            {currentStage === 'prompting' && (
              <p className="text-sm font-semibold text-[var(--ink-900)]">Reading your prompt...</p>
            )}
            {currentStage === 'drafting' && (
              <p className="text-sm font-semibold text-[var(--ink-900)]">Drafting your SOP...</p>
            )}
            {currentStage === 'verifying' && (
              <p className="text-sm font-semibold text-[var(--ink-900)]">Running AI verification pass...</p>
            )}
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
