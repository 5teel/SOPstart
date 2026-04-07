'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import VideoVersionList from '@/components/admin/VideoVersionList'
import { generateNewVersion } from '@/actions/video'
import type { VideoFormat, VideoGenerationJob } from '@/types/sop'

interface SopSummary {
  id: string
  title: string
  updated_at: string
  version: number
}

interface VideoGeneratePanelProps {
  sop: SopSummary
  versions: VideoGenerationJob[]
  archivedVersions: VideoGenerationJob[]
}

export default function VideoGeneratePanel({ sop, versions, archivedVersions }: VideoGeneratePanelProps) {
  const router = useRouter()
  const [selectedFormat, setSelectedFormat] = useState<VideoFormat | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check if any version is currently generating for the selected format
  const hasActiveGeneration = (format: VideoFormat | null) => {
    if (!format) return false
    return versions.some(
      (v) =>
        v.format === format &&
        ['queued', 'analyzing', 'generating_audio', 'rendering'].includes(v.status),
    )
  }

  const handleGenerate = async () => {
    if (!selectedFormat || generating) return
    setGenerating(true)
    setError(null)

    const result = await generateNewVersion(sop.id, selectedFormat)

    if ('error' in result) {
      setError(result.error)
      setGenerating(false)
      return
    }

    // Success — refresh to show new version in list
    setGenerating(false)
    setSelectedFormat(null)
    router.refresh()
  }

  const handleMutate = () => {
    router.refresh()
  }

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
        {/* Generate new version section */}
        <h1 className="text-base font-semibold text-steel-100 mb-4">Generate new version</h1>

        {/* Format selector */}
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
              onChange={() => setSelectedFormat('narrated_slideshow')}
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
              <p className="text-xs text-steel-500 mt-1">~5-15 slides - best for training and induction</p>
            </div>
          </label>

          {/* Screen recording card */}
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
              onChange={() => setSelectedFormat('screen_recording')}
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
              <p className="text-xs text-steel-500 mt-1">Continuous scroll - best for quick reference</p>
            </div>
          </label>
        </fieldset>

        {/* Generate CTA - orange per UI-SPEC (D-06: "Generate new version" not "Re-generate") */}
        <button
          onClick={handleGenerate}
          disabled={!selectedFormat || generating || hasActiveGeneration(selectedFormat)}
          className="mt-6 h-[72px] w-full bg-brand-orange text-steel-900 font-semibold text-lg rounded-xl hover:bg-orange-500 active:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? 'Starting...' : 'Generate new version'}
        </button>

        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}

        {/* Version list */}
        <div className="mt-8 border-t border-steel-700 pt-6">
          <h2 className="text-sm font-semibold text-steel-100 mb-4">Video versions</h2>
          <VideoVersionList
            versions={versions}
            archivedVersions={archivedVersions}
            sopId={sop.id}
            onMutate={handleMutate}
          />
        </div>
      </div>
    </div>
  )
}
