'use client'

import React, { useEffect, useRef, useState } from 'react'
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { VideoGenerationJob, VideoGenStatus } from '@/types/sop'

const VIDEO_GEN_STAGES = [
  { key: 'analyzing', label: 'Analysing' },
  { key: 'generating_audio', label: 'Slides' },
  { key: 'narrating', label: 'Narration' },
  { key: 'rendering', label: 'Rendering' },
  { key: 'ready', label: 'Ready' },
] as const

type StageKey = typeof VIDEO_GEN_STAGES[number]['key']

function statusToStageIndex(status: VideoGenStatus, currentStage: string | null): number {
  if (status === 'ready') return VIDEO_GEN_STAGES.length - 1
  if (status === 'rendering') return 3
  if (status === 'generating_audio') {
    // If stage info suggests narration is in progress
    if (currentStage && currentStage.includes('narrat')) return 2
    return 1
  }
  if (status === 'analyzing') return 0
  return 0
}

interface VideoGenerationStatusProps {
  jobId: string
  initialStatus?: VideoGenStatus
  initialStage?: string | null
  onComplete?: (job: VideoGenerationJob) => void
  onFailed?: (error: string) => void
}

export default function VideoGenerationStatus({
  jobId,
  initialStatus,
  initialStage,
  onComplete,
  onFailed,
}: VideoGenerationStatusProps) {
  const [status, setStatus] = useState<VideoGenStatus>(initialStatus ?? 'queued')
  const [currentStage, setCurrentStage] = useState<string | null>(initialStage ?? null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const realtimeConnectedRef = useRef(false)

  useEffect(() => {
    const supabase = createClient()

    const handleJobData = async (data: VideoGenerationJob) => {
      setStatus(data.status)
      setCurrentStage(data.current_stage)
      if (data.error_message) setErrorMessage(data.error_message)

      if (data.status === 'ready') {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
        onComplete?.(data)
      } else if (data.status === 'failed') {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
        onFailed?.(data.error_message ?? 'Generation failed')
      } else if (data.current_stage === 'rendering_pending' || (data.status === 'rendering' && data.current_stage === 'rendering_pending')) {
        // Pipeline timed out but Shotstack may have finished — try to finalize
        try {
          const res = await fetch('/api/sops/generate-video/finalize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId }),
          })
          const result = await res.json()
          if (result.status === 'ready' || result.status === 'failed') {
            // Re-poll to get updated data
            const { data: updated } = await supabase
              .from('video_generation_jobs')
              .select('*')
              .eq('id', jobId)
              .single()
            if (updated) handleJobData(updated as unknown as VideoGenerationJob)
          }
        } catch {
          // Finalize call failed — keep polling, will retry next cycle
        }
      }
    }

    const pollJob = async () => {
      const { data } = await supabase
        .from('video_generation_jobs')
        .select('*')
        .eq('id', jobId)
        .single()
      if (data) {
        handleJobData(data as unknown as VideoGenerationJob)
      }
    }

    // Start polling fallback after 5s if Realtime hasn't fired
    const pollingTimeout = setTimeout(() => {
      if (!realtimeConnectedRef.current) {
        pollJob()
        pollingIntervalRef.current = setInterval(async () => {
          const { data } = await supabase
            .from('video_generation_jobs')
            .select('*')
            .eq('id', jobId)
            .single()
          if (data) {
            handleJobData(data as unknown as VideoGenerationJob)
          }
        }, 5000)
      }
    }, 5000)

    const channel = supabase
      .channel(`video-gen-job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'video_generation_jobs',
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          realtimeConnectedRef.current = true
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
          handleJobData(payload.new as unknown as VideoGenerationJob)
        }
      )
      .subscribe(() => {
        realtimeConnectedRef.current = true
      })

    return () => {
      clearTimeout(pollingTimeout)
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
      supabase.removeChannel(channel)
    }
  }, [jobId, onComplete, onFailed])

  const activeStageIndex = statusToStageIndex(status, currentStage)

  const stageCopy: Record<string, string> = {
    analyzing: 'Analysing SOP structure...',
    generating_audio: 'Generating slides...',
    narrating: 'Generating narration...',
    rendering: 'Rendering video...',
    queued: 'Queued for generation...',
  }

  return (
    <div className="bg-steel-800 border border-steel-700 rounded-lg p-4">
      {/* Stage stepper */}
      <div
        className="flex items-center gap-1 mb-4 overflow-x-auto"
        role="group"
        aria-label="Generation stages"
      >
        {VIDEO_GEN_STAGES.map((stage, i) => {
          const isCompleted = i < activeStageIndex
          const isActive = i === activeStageIndex && status !== 'ready' && status !== 'failed'
          const isPending = i > activeStageIndex

          return (
            <React.Fragment key={stage.key}>
              <span
                className={`text-xs whitespace-nowrap px-1 ${
                  status === 'ready' ? 'text-green-400' :
                  status === 'failed' ? 'text-red-400' :
                  isCompleted ? 'text-green-400' :
                  isActive ? 'text-brand-yellow font-semibold' :
                  isPending ? 'text-steel-600' :
                  'text-steel-600'
                }`}
                aria-current={isActive ? 'step' : undefined}
              >
                {stage.label}
              </span>
              {i < VIDEO_GEN_STAGES.length - 1 && (
                <div
                  className={`h-px flex-1 min-w-[8px] ${
                    status === 'ready' ? 'bg-brand-yellow' :
                    isCompleted ? 'bg-brand-yellow' :
                    'bg-steel-700'
                  }`}
                />
              )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Status content */}
      {status === 'ready' ? (
        <div className="flex items-center gap-3">
          <CheckCircle className="text-green-400 flex-shrink-0" size={20} />
          <p className="text-sm font-semibold text-steel-100">Video ready to preview and publish</p>
        </div>
      ) : status === 'failed' ? (
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-brand-orange flex-shrink-0" size={20} />
          <p className="text-sm font-semibold text-steel-100">Generation failed — {errorMessage ?? 'unknown error'}</p>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Loader2 className="text-blue-400 animate-spin flex-shrink-0" size={20} />
          <p className="text-sm font-semibold text-steel-100">
            {stageCopy[currentStage ?? status] ?? 'Generating video...'}
          </p>
        </div>
      )}
    </div>
  )
}
