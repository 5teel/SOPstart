'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import VideoGenerationStatus from '@/components/admin/VideoGenerationStatus'
import VideoAdminPreview from '@/components/admin/VideoAdminPreview'
import type { VideoFormat, VideoGenerationJob, VideoGenStatus } from '@/types/sop'

type PanelState =
  | 'no-video'
  | 'format-selected'
  | 'generating'
  | 'completed-unpublished'
  | 'completed-published'
  | 'failed'

interface SopSummary {
  id: string
  title: string
  updated_at: string
  version: number
}

interface VideoGeneratePanelProps {
  sop: SopSummary
  existingJob: VideoGenerationJob | null
}

function deriveInitialState(job: VideoGenerationJob | null): PanelState {
  if (!job) return 'no-video'
  if (job.status === 'ready' && job.published) return 'completed-published'
  if (job.status === 'ready') return 'completed-unpublished'
  if (job.status === 'failed') return 'failed'
  if (job.status === 'queued' || job.status === 'analyzing' || job.status === 'generating_audio' || job.status === 'rendering') return 'generating'
  return 'no-video'
}

function isOutdated(sop: SopSummary, job: VideoGenerationJob | null): boolean {
  if (!job || !job.completed_at) return false
  return new Date(sop.updated_at) > new Date(job.completed_at)
}

export default function VideoGeneratePanel({ sop, existingJob }: VideoGeneratePanelProps) {
  const [panelState, setPanelState] = useState<PanelState>(deriveInitialState(existingJob))
  const [selectedFormat, setSelectedFormat] = useState<VideoFormat | null>(existingJob?.format ?? null)
  const [activeJobId, setActiveJobId] = useState<string | null>(existingJob?.id ?? null)
  const [activeJob, setActiveJob] = useState<VideoGenerationJob | null>(existingJob)
  const [errorMessage, setErrorMessage] = useState<string | null>(existingJob?.error_message ?? null)
  const [generating, setGenerating] = useState(false)

  const outdated = isOutdated(sop, activeJob)

  const handleGenerate = async () => {
    if (!selectedFormat || generating) return
    setGenerating(true)

    try {
      const res = await fetch('/api/sops/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sopId: sop.id, format: selectedFormat }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Request failed: ${res.status}`)
      }

      const { jobId } = await res.json()
      setActiveJobId(jobId)
      setPanelState('generating')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start generation'
      alert(message)
      setGenerating(false)
    }
  }

  const handleComplete = (job: VideoGenerationJob) => {
    setActiveJob(job)
    setPanelState(job.published ? 'completed-published' : 'completed-unpublished')
  }

  const handleFailed = (error: string) => {
    setErrorMessage(error)
    setPanelState('failed')
  }

  const showFormatSelector = panelState === 'no-video' || panelState === 'format-selected'

  return (
    <div>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-steel-900 border-b border-steel-700 px-4 flex items-center gap-3 h-[56px]">
        <Link
          href={`/admin/sops/${sop.id}/review`}
          className="text-steel-400 hover:text-steel-100 transition-colors"
          aria-label="Back to review"
        >
          <ArrowLeft size={20} />
        </Link>
        <span className="text-sm font-medium text-steel-100 truncate">{sop.title}</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Format selector (no-video / format-selected states) */}
        {showFormatSelector && (
          <>
            <h1 className="text-base font-semibold text-steel-100 mb-4">Choose a video format</h1>

            <fieldset className="flex flex-col gap-3">
              <legend className="sr-only">Video format</legend>

              {/* Narrated slideshow card */}
              <label
                className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                  selectedFormat === 'narrated_slideshow'
                    ? 'border-brand-yellow bg-steel-800'
                    : 'border-steel-700 bg-steel-800 hover:border-steel-600'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value="narrated_slideshow"
                  checked={selectedFormat === 'narrated_slideshow'}
                  onChange={() => {
                    setSelectedFormat('narrated_slideshow')
                    setPanelState('format-selected')
                  }}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                    selectedFormat === 'narrated_slideshow'
                      ? 'border-brand-yellow'
                      : 'border-steel-600'
                  }`}
                >
                  {selectedFormat === 'narrated_slideshow' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-brand-yellow" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-steel-100">Narrated slideshow</p>
                  <p className="text-sm text-steel-400 mt-1">
                    One slide per SOP section with AI voiceover. Hazards and PPE appear first.
                  </p>
                  <p className="text-xs text-steel-500 mt-1">~5–15 slides · best for training and induction</p>
                </div>
              </label>

              {/* Screen-recording-style card */}
              <label
                className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-colors ${
                  selectedFormat === 'screen_recording'
                    ? 'border-brand-yellow bg-steel-800'
                    : 'border-steel-700 bg-steel-800 hover:border-steel-600'
                }`}
              >
                <input
                  type="radio"
                  name="format"
                  value="screen_recording"
                  checked={selectedFormat === 'screen_recording'}
                  onChange={() => {
                    setSelectedFormat('screen_recording')
                    setPanelState('format-selected')
                  }}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                    selectedFormat === 'screen_recording'
                      ? 'border-brand-yellow'
                      : 'border-steel-600'
                  }`}
                >
                  {selectedFormat === 'screen_recording' && (
                    <div className="w-2.5 h-2.5 rounded-full bg-brand-yellow" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-steel-100">Screen-recording style</p>
                  <p className="text-sm text-steel-400 mt-1">
                    Scrolling SOP text synced to AI narration, like a screen recording.
                  </p>
                  <p className="text-xs text-steel-500 mt-1">Continuous scroll · best for quick reference</p>
                </div>
              </label>
            </fieldset>

            {/* Generate CTA */}
            <button
              onClick={handleGenerate}
              disabled={!selectedFormat || generating}
              className="mt-6 h-[72px] w-full bg-brand-yellow text-steel-900 font-semibold text-lg rounded-xl hover:bg-amber-400 active:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generating ? 'Starting...' : 'Generate video'}
            </button>
          </>
        )}

        {/* Generating state */}
        {panelState === 'generating' && activeJobId && (
          <>
            <VideoGenerationStatus
              jobId={activeJobId}
              initialStatus={activeJob?.status as VideoGenStatus | undefined}
              initialStage={activeJob?.current_stage}
              onComplete={handleComplete}
              onFailed={handleFailed}
            />
            <p className="text-xs text-steel-400 mt-3 text-center">
              Generating your video — this usually takes 2–5 minutes.
            </p>
          </>
        )}

        {/* Completed-unpublished state */}
        {panelState === 'completed-unpublished' && activeJobId && activeJob?.video_url && (
          <>
            <VideoGenerationStatus
              jobId={activeJobId}
              initialStatus="ready"
            />
            <VideoAdminPreview
              videoUrl={activeJob.video_url}
              jobId={activeJobId}
              sopId={sop.id}
              format={activeJob.format}
              isPublished={false}
              isOutdated={outdated}
            />
          </>
        )}

        {/* Completed-published state */}
        {panelState === 'completed-published' && activeJobId && activeJob?.video_url && (
          <>
            <VideoGenerationStatus
              jobId={activeJobId}
              initialStatus="ready"
            />
            <VideoAdminPreview
              videoUrl={activeJob.video_url}
              jobId={activeJobId}
              sopId={sop.id}
              format={activeJob.format}
              isPublished={true}
              isOutdated={outdated}
            />
          </>
        )}

        {/* Failed state */}
        {panelState === 'failed' && activeJobId && (
          <>
            <VideoGenerationStatus
              jobId={activeJobId}
              initialStatus="failed"
              initialStage={activeJob?.current_stage}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => {
                  setActiveJob(null)
                  setActiveJobId(null)
                  setErrorMessage(null)
                  setSelectedFormat(null)
                  setPanelState('no-video')
                }}
                className="flex-1 h-[72px] bg-steel-700 text-steel-100 font-semibold text-lg rounded-lg hover:bg-steel-600 transition-colors"
              >
                Re-generate
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
