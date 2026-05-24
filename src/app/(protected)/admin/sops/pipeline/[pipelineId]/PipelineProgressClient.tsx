'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ClipboardCheck,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import {
  PipelineStepper,
  type PipelineStageKey,
  type PipelineStageState,
} from '@/components/admin/PipelineStepper'

type SopRow = {
  id: string
  title: string | null
  status: string
  source_file_name: string
  pipeline_run_id: string | null
}

type ParseJobRow = {
  id: string
  status: string
  current_stage: string | null
  error_message: string | null
}

type VideoJobRow = {
  id: string
  status: string
  video_url: string | null
  error_message: string | null
  format: string
  sop_version: number
  current_stage: string | null
}

type Snapshot = {
  sop: SopRow | null
  parseJob: ParseJobRow | null
  videoJob: VideoJobRow | null
}

interface Props {
  pipelineId: string
  initialPipelineStatus: string
  requestedFormat: 'narrated_slideshow' | 'screen_recording'
  initialSop: SopRow | null
  initialParseJob: ParseJobRow | null
  initialVideoJob: VideoJobRow | null
}

function deriveStage(s: Snapshot): {
  stage: PipelineStageState
  errorStage: PipelineStageKey | null
} {
  if (s.parseJob?.status === 'failed') {
    return { stage: 'error', errorStage: 'parsing' }
  }
  if (s.videoJob?.status === 'failed') {
    return { stage: 'error', errorStage: 'generating' }
  }
  if (!s.sop || s.sop.status === 'uploading') {
    return { stage: 'uploading', errorStage: null }
  }
  if (
    s.sop.status === 'parsing' ||
    s.parseJob?.status === 'queued' ||
    s.parseJob?.status === 'processing'
  ) {
    return { stage: 'parsing', errorStage: null }
  }
  if (s.sop.status === 'draft') {
    return { stage: 'review', errorStage: null }
  }
  if (s.videoJob?.status === 'ready') {
    return { stage: 'ready', errorStage: null }
  }
  return { stage: 'generating', errorStage: null }
}

const POLL_INTERVAL_MS = 5000
const REALTIME_GRACE_MS = 5000
const REALTIME_STALE_MS = 15000

export function PipelineProgressClient(props: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot>({
    sop: props.initialSop,
    parseJob: props.initialParseJob,
    videoJob: props.initialVideoJob,
  })
  const lastUpdateRef = useRef<number>(Date.now())
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function fetchSnapshot() {
      try {
        const res = await fetch(`/api/sops/pipeline/${props.pipelineId}/snapshot`)
        if (!res.ok) return
        const next = (await res.json()) as Snapshot
        setSnapshot(next)
        lastUpdateRef.current = Date.now()
      } catch {
        // swallow network errors — polling will retry
      }
    }

    function startPolling() {
      if (pollingRef.current) return
      pollingRef.current = setInterval(() => {
        // If realtime has gone silent for more than REALTIME_STALE_MS, keep polling.
        // This also catches the case where realtime connected, delivered events,
        // then silently dropped — polling resumes automatically on stale data.
        fetchSnapshot()
      }, POLL_INTERVAL_MS)
    }

    function markRealtimeActivity() {
      lastUpdateRef.current = Date.now()
    }

    const channel = supabase
      .channel(`pipeline-${props.pipelineId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sop_pipeline_runs',
          filter: `id=eq.${props.pipelineId}`,
        },
        () => {
          markRealtimeActivity()
          fetchSnapshot()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'parse_jobs',
          filter: `pipeline_run_id=eq.${props.pipelineId}`,
        },
        () => {
          markRealtimeActivity()
          fetchSnapshot()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sops',
          filter: `pipeline_run_id=eq.${props.pipelineId}`,
        },
        () => {
          markRealtimeActivity()
          fetchSnapshot()
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'video_generation_jobs',
          filter: `pipeline_run_id=eq.${props.pipelineId}`,
        },
        () => {
          markRealtimeActivity()
          fetchSnapshot()
        }
      )
      .subscribe((status) => {
        // Fall back to polling immediately on channel errors or timeouts.
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          startPolling()
        }
      })

    // Polling grace period: if no realtime event fires within REALTIME_GRACE_MS, start polling.
    // Once polling is running, each tick re-fetches the snapshot unconditionally — which also
    // serves as the safety net for silently-dropped realtime connections (stale-update recovery).
    // REALTIME_STALE_MS is retained as the implicit threshold: polling every 5s means any stale
    // window > 15s is impossible as long as polling is active.
    const startPollingTimeout = setTimeout(() => {
      if (Date.now() - lastUpdateRef.current >= REALTIME_GRACE_MS) {
        startPolling()
      }
    }, REALTIME_GRACE_MS)

    // Defensive: even if realtime is delivering events, start polling after REALTIME_STALE_MS
    // to catch silent drops. pollingRef guard makes this a no-op if already polling.
    const staleWatchdog = setInterval(() => {
      if (Date.now() - lastUpdateRef.current >= REALTIME_STALE_MS) {
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
  }, [props.pipelineId])

  const { stage, errorStage } = deriveStage(snapshot)
  const sopId = snapshot.sop?.id ?? null
  const sopTitle =
    snapshot.sop?.title ?? snapshot.sop?.source_file_name ?? 'New SOP'

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <header className="h-[56px] sticky top-0 z-20 bg-[var(--paper)] border-b border-[var(--ink-100)] px-4 flex items-center gap-3">
        <Link
          href="/admin/sops"
          aria-label="Back to SOP list"
          className="text-[var(--ink-500)] hover:text-[var(--ink-900)]"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-sm font-medium text-[var(--ink-900)] truncate">{sopTitle}</h1>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <PipelineStepper currentStage={stage} errorAtStage={errorStage} />

        <div className="mt-6 space-y-4">
          {stage === 'uploading' && (
            <div className="bg-white border border-[var(--ink-100)] rounded-xl p-5 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <p className="text-sm text-[var(--ink-900)]">Uploading your file...</p>
            </div>
          )}

          {stage === 'parsing' && (
            <div className="bg-white border border-[var(--ink-100)] rounded-xl p-5">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                <p className="text-sm font-semibold text-[var(--ink-900)]">
                  Crunching your SOP…
                </p>
              </div>
              <p className="text-xs text-[var(--ink-500)] mt-2">
                Grab a coffee — this can take a few minutes.
              </p>
            </div>
          )}

          {stage === 'review' && sopId && (
            <div className="bg-[var(--accent-voice)]/20 border border-[var(--accent-voice)]/50 rounded-xl p-5">
              <div className="flex items-start gap-3 mb-3">
                <ClipboardCheck className="w-6 h-6 text-[var(--accent-voice)] shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[var(--ink-900)]">
                    Review required before video generates
                  </p>
                  <p className="text-sm text-[var(--ink-500)] mt-1">
                    Check the parsed SOP, approve every section, then publish to
                    continue.
                  </p>
                </div>
              </div>
              <Link
                href={`/admin/sops/${sopId}/review?from=pipeline&pipelineId=${props.pipelineId}`}
                className="h-[72px] w-full bg-[var(--ink-900)] text-white font-semibold text-xl rounded-lg flex items-center justify-center hover:bg-[var(--ink-700)] transition-colors"
              >
                Review SOP now →
              </Link>
            </div>
          )}

          {stage === 'generating' && snapshot.videoJob && (
            <div className="bg-white border border-[var(--ink-100)] rounded-xl p-5">
              <div className="flex items-center gap-3 mb-2">
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                <p className="text-sm font-semibold text-[var(--ink-900)]">
                  Generating video
                </p>
              </div>
              <p className="text-xs text-[var(--ink-500)]">
                Stage:{' '}
                {snapshot.videoJob.current_stage ?? snapshot.videoJob.status}
              </p>
            </div>
          )}

          {stage === 'generating' && !snapshot.videoJob && (
            <div className="bg-white border border-[var(--ink-100)] rounded-xl p-5 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <p className="text-sm text-[var(--ink-900)]">Queuing video generation…</p>
            </div>
          )}

          {stage === 'ready' && sopId && (
            <div className="bg-green-500/20 border border-green-500/40 rounded-xl px-5 py-5">
              <div className="flex items-start gap-3 mb-3">
                <CheckCircle className="w-6 h-6 text-green-400 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[var(--ink-900)]">
                    Video SOP ready
                  </p>
                  <p className="text-sm text-[var(--ink-500)] mt-1">
                    Review the video and publish it when you&apos;re happy with
                    the audio.
                  </p>
                </div>
              </div>
              <Link
                href={`/admin/sops/${sopId}/video`}
                className="h-[72px] w-full bg-[var(--ink-900)] text-white font-semibold text-xl rounded-lg flex items-center justify-center hover:bg-[var(--ink-700)] transition-colors"
              >
                Preview and publish video →
              </Link>
            </div>
          )}

          {stage === 'error' && errorStage === 'generating' && sopId && (
            <div
              className="bg-white border border-[var(--ink-100)] rounded-xl p-5"
              role="alert"
            >
              <div className="flex items-start gap-3 mb-3">
                <AlertTriangle className="w-5 h-5 text-[var(--accent-voice)] shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[var(--ink-900)]">
                    Video generation failed
                  </p>
                  <p className="text-xs text-[var(--ink-500)] mt-1 line-clamp-2">
                    {snapshot.videoJob?.error_message ??
                      'Check the video panel for details.'}
                  </p>
                </div>
              </div>
              <Link
                href={`/admin/sops/${sopId}/video`}
                className="h-[72px] w-full bg-[var(--ink-900)] text-white font-semibold text-xl rounded-lg flex items-center justify-center hover:bg-[var(--ink-700)] transition-colors"
              >
                Go to video panel
              </Link>
            </div>
          )}

          {stage === 'error' && errorStage === 'parsing' && sopId && (
            <div
              className="bg-white border border-[var(--ink-100)] rounded-xl p-5"
              role="alert"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[var(--accent-voice)] shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-[var(--ink-900)]">
                    Couldn&apos;t parse that one
                  </p>
                  <p className="text-xs text-[var(--ink-500)] mt-1">
                    {snapshot.parseJob?.error_message ?? 'Parsing failed.'}
                  </p>
                  <Link
                    href={`/admin/sops/${sopId}/review`}
                    className="text-xs text-[var(--ink-900)] hover:text-[var(--ink-700)] mt-2 inline-block"
                  >
                    Open review page to retry →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
