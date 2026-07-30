'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ClipboardCheck,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react'
import ParseJobStatus from '@/components/admin/ParseJobStatus'
import { AdminPageShell } from '@/components/admin/AdminPageShell'
import { derivePipelineStage, type Snapshot } from '@/lib/admin/job-stages'

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

interface Props {
  pipelineId: string
  initialPipelineStatus: string
  requestedFormat: 'narrated_slideshow' | 'screen_recording'
  initialSop: SopRow | null
  initialParseJob: ParseJobRow | null
  initialVideoJob: VideoJobRow | null
}

export function PipelineProgressClient(props: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot>({
    sop: props.initialSop,
    parseJob: props.initialParseJob,
    videoJob: props.initialVideoJob,
  })

  const { plainKey, errorAt } = derivePipelineStage(snapshot)
  const sopId = snapshot.sop?.id ?? null
  const sopTitle =
    snapshot.sop?.title ?? snapshot.sop?.source_file_name ?? 'New SOP'

  return (
    <AdminPageShell
      title={sopTitle}
      backLink={
        sopId
          ? { href: `/admin/sops/builder/${sopId}`, label: 'Back to SOP' }
          : { href: '/admin/sops', label: 'Back to SOPs' }
      }
    >
      <div className="space-y-4">
        <ParseJobStatus pipelineId={props.pipelineId} initialSnapshot={snapshot} onSnapshot={setSnapshot} />

        <div className="mt-6 space-y-4">
          {!errorAt && plainKey === 'upload' && (
            <div className="bg-white border border-[var(--ink-100)] rounded-xl p-5 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <p className="text-sm text-[var(--ink-900)]">Uploading your file...</p>
            </div>
          )}

          {!errorAt && plainKey === 'read' && (
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

          {!errorAt && plainKey === 'check' && sopId && (
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
                href={`/admin/sops/builder/${sopId}`}
                className="h-[72px] w-full bg-[var(--ink-900)] text-white font-semibold text-xl rounded-lg flex items-center justify-center hover:bg-[var(--ink-700)] transition-colors"
              >
                Review SOP now →
              </Link>
            </div>
          )}

          {!errorAt && plainKey === 'render' && snapshot.videoJob && (
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

          {!errorAt && plainKey === 'render' && !snapshot.videoJob && (
            <div className="bg-white border border-[var(--ink-100)] rounded-xl p-5 flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <p className="text-sm text-[var(--ink-900)]">Queuing video generation…</p>
            </div>
          )}

          {!errorAt && plainKey === 'ready' && sopId && (
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

          {errorAt === 'render' && sopId && (
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

          {errorAt === 'read' && sopId && (
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
                    href={`/admin/sops/builder/${sopId}`}
                    className="text-xs text-[var(--ink-900)] hover:text-[var(--ink-700)] mt-2 inline-block"
                  >
                    Open builder to retry →
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminPageShell>
  )
}
