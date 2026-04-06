'use client'

import React, { useEffect, useState } from 'react'
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
}

const VIDEO_STAGES = [
  { key: 'uploading', label: 'Uploading' },
  { key: 'extracting_audio', label: 'Extracting' },
  { key: 'transcribing', label: 'Transcribing' },
  { key: 'structuring', label: 'Structuring' },
  { key: 'verifying', label: 'Verifying' },
] as const

export default function ParseJobStatus({
  sopId,
  initialStatus,
  initialErrorMessage,
  isOcr = false,
  initialStage,
  initialIsVideo,
  onRetry,
  onDelete,
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
  const [detailLevel, setDetailLevel] = useState(3)
  const [startTime] = useState<number>(Date.now())
  const [elapsed, setElapsed] = useState(0)

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
      .select('status, error_message, current_stage, file_type')
      .eq('sop_id', sopId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        const row = data as { status: string; error_message: string | null; current_stage: string | null; file_type: string } | null
        if (row) {
          if (row.status) setStatus(row.status as ParseJobStatusType)
          if (row.error_message) setErrorMessage(row.error_message)
          if (row.current_stage) setCurrentStage(row.current_stage as string)
          if (row.file_type === 'video') setIsVideoSop(true)
        }
      })

    // Start polling fallback after 5s if Realtime hasn't fired
    const pollingTimeout = setTimeout(() => {
      if (!realtimeConnected) {
        pollingInterval = setInterval(async () => {
          const { data } = await supabase
            .from('parse_jobs')
            .select('status, error_message, current_stage, file_type')
            .eq('sop_id', sopId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle() as { data: { status: string; error_message: string | null; current_stage: string | null; file_type: string } | null }
          if (data) {
            setStatus(data.status as ParseJobStatusType)
            if (data.error_message) setErrorMessage(data.error_message)
            if (data.current_stage) setCurrentStage(data.current_stage as string)
            if (data.file_type === 'video') setIsVideoSop(true)
            if (data.status === 'completed' || data.status === 'failed') {
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

  const handleReparse = async () => {
    setReParsing(true)
    const result = await reparseSop(sopId)
    if ('error' in result) {
      setErrorMessage(result.error)
      setStatus('failed')
      setReParsing(false)
      return
    }
    const endpoint = isVideoSop ? '/api/sops/transcribe' : '/api/sops/parse'
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

  // OCR low-confidence banner
  const OcrBanner = () => (
    <div className="bg-brand-orange/20 border border-brand-orange/50 text-brand-orange rounded-lg px-4 py-3 text-sm flex gap-2 items-start mb-4">
      <AlertTriangle className="flex-shrink-0 mt-0.5" size={16} />
      <span>
        Heads up — this document was scanned or photographed, so some text might be off. Check it carefully before publishing.
      </span>
    </div>
  )

  // Video stage stepper (shown during active video processing)
  const VideoStageStepper = () => {
    if (!isVideoSop || !currentStage || currentStage === 'completed' || currentStage === 'failed') {
      return null
    }
    const stageIndex = VIDEO_STAGES.findIndex(s => s.key === currentStage)

    return (
      <div className="flex items-center gap-1 mb-4 overflow-x-auto" role="group" aria-label="Processing stages">
        {VIDEO_STAGES.map((stage, i) => {
          const isCompleted = i < stageIndex
          const isActive = i === stageIndex
          const isPending = i > stageIndex

          return (
            <React.Fragment key={stage.key}>
              <span
                className={`text-xs whitespace-nowrap px-1 ${
                  isCompleted ? 'text-green-400' :
                  isActive ? 'text-brand-yellow font-semibold' :
                  isPending ? 'text-steel-600' :
                  'text-steel-600'
                }`}
                aria-current={isActive ? 'step' : undefined}
                aria-label={stage.label}
              >
                {stage.label}
              </span>
              {i < VIDEO_STAGES.length - 1 && (
                <div className={`h-px flex-1 min-w-[8px] ${
                  isCompleted ? 'bg-brand-yellow' : 'bg-steel-700'
                }`} />
              )}
            </React.Fragment>
          )
        })}
      </div>
    )
  }

  if (status === 'completed') {
    return (
      <>
        {isOcr && <OcrBanner />}
        <div className="bg-steel-800 border border-steel-700 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="text-green-400 flex-shrink-0 mt-0.5" size={20} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-steel-100">
              {isVideoSop ? 'Transcript and SOP ready to review' : 'Parsed and ready to review'}
            </p>
            <div className="flex items-center gap-4 mt-2 flex-wrap">
              <button
                onClick={() => router.refresh()}
                className="text-brand-yellow text-sm font-medium hover:text-amber-400"
              >
                Review now &rarr;
              </button>
              {isVideoSop && (
                <>
                  <button
                    onClick={() => handleRestructure()}
                    disabled={reParsing}
                    className="text-steel-400 text-sm font-medium hover:text-steel-100"
                  >
                    {reParsing ? 'Processing...' : 'Re-structure'}
                  </button>
                  <button
                    onClick={handleReparse}
                    disabled={reParsing}
                    className="text-steel-400 text-sm font-medium hover:text-steel-100"
                  >
                    {reParsing ? 'Processing...' : 'Re-transcribe'}
                  </button>
                </>
              )}
            </div>
            {isVideoSop && (
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
        <div className="bg-steel-800 border border-steel-700 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-brand-orange flex-shrink-0 mt-0.5" size={20} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-steel-100">
                {errorMessage ?? 'Processing failed'}
              </p>
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                <button
                  onClick={() => handleRestructure()}
                  disabled={reParsing}
                  className="text-brand-yellow text-sm font-medium hover:text-amber-400"
                >
                  {reParsing ? 'Processing...' : 'Re-structure only'}
                </button>
                <button
                  onClick={handleReparse}
                  disabled={reParsing}
                  className="text-brand-orange text-sm font-medium hover:text-amber-500"
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
      <div className="bg-steel-800 border border-steel-700 rounded-lg p-4 flex items-start gap-3">
        <AlertTriangle className="text-brand-orange flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-steel-100">Couldn&apos;t parse that one</p>
          {errorMessage && (
            <p className="text-xs text-steel-400 mt-1 line-clamp-2">{errorMessage}</p>
          )}
          <div className="flex items-center gap-4 mt-3">
            <button
              onClick={handleReparse}
              disabled={reParsing}
              className="text-brand-orange text-sm hover:text-amber-500 font-medium"
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
      <div className="bg-steel-800 border border-steel-700 rounded-lg p-4">
        <VideoStageStepper />
        <div className="flex items-start gap-3">
          {currentStage === 'verifying' ? (
            <Loader2 size={20} className="text-brand-orange animate-spin flex-shrink-0 mt-0.5" />
          ) : (
            <Loader2 size={20} className="text-blue-400 animate-spin flex-shrink-0 mt-0.5" />
          )}
          <div>
            {currentStage === 'uploading' && (
              <p className="text-sm font-semibold text-steel-100">Uploading video...</p>
            )}
            {currentStage === 'extracting_audio' && (
              <p className="text-sm font-semibold text-steel-100">Extracting audio from video...</p>
            )}
            {currentStage === 'transcribing' && (
              <>
                <p className="text-sm font-semibold text-steel-100">Transcribing audio... ({elapsed}s)</p>
                <p className="text-xs text-steel-400 mt-1">Grab a hot drink — this can take a few minutes.</p>
              </>
            )}
            {currentStage === 'structuring' && (
              <p className="text-sm font-semibold text-steel-100">Structuring SOP from transcript...</p>
            )}
            {currentStage === 'verifying' && (
              <p className="text-sm font-semibold text-steel-100">Running AI verification pass...</p>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Non-video parsing / queued / processing state (default)
  return (
    <div className="bg-steel-800 border border-steel-700 rounded-lg p-4 flex items-start gap-3">
      <div
        className="flex-shrink-0 mt-0.5 animate-spin border-2 border-blue-500/30 border-t-blue-400 rounded-full w-5 h-5"
        aria-hidden="true"
      />
      <div>
        <p className="text-sm font-semibold text-steel-100">Crunching your SOP&hellip;</p>
        <p className="text-xs text-steel-400 mt-1">
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
    <div className="mt-3 pt-3 border-t border-steel-700">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-steel-400 uppercase tracking-wider">
          Detail level
        </span>
        <span className="text-xs text-steel-400">
          {DETAIL_LABELS[value - 1]} ({value}/5)
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-steel-400">−</span>
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          className="flex-1 h-2 rounded-full appearance-none bg-steel-700 accent-brand-yellow cursor-pointer"
          aria-label="Detail level"
        />
        <span className="text-xs text-steel-400">+</span>
        <button
          onClick={onApply}
          disabled={disabled}
          className="text-xs font-semibold text-brand-yellow hover:text-amber-400 disabled:opacity-50 whitespace-nowrap"
        >
          Apply
        </button>
      </div>
    </div>
  )
}
