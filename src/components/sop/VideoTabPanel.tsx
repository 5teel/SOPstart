'use client'
import { useRef, useState, useEffect, useCallback } from 'react'
import { ChevronRight } from 'lucide-react'
import { recordVideoView } from '@/actions/video'
import VideoOutdatedBanner from '@/components/admin/VideoOutdatedBanner'
import type { ChapterMarker } from '@/types/sop'

interface VideoTabPanelProps {
  videoUrl: string
  chapters: ChapterMarker[]
  videoJobId: string
  sopId: string
  sopVersion: number
  isOutdated: boolean
}

const SPEED_OPTIONS = [0.5, 1, 1.5, 2] as const

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const paddedSecs = secs.toString().padStart(2, '0')
  if (mins >= 10) {
    return `${mins.toString().padStart(2, '0')}:${paddedSecs}`
  }
  return `${mins}:${paddedSecs}`
}

export function VideoTabPanel({
  videoUrl,
  chapters,
  videoJobId,
  sopId,
  sopVersion,
  isOutdated,
}: VideoTabPanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hasRecordedView = useRef<boolean>(false)
  const [playbackRate, setPlaybackRate] = useState<number>(1)
  const [activeChapterId, setActiveChapterId] = useState<string | null>(
    chapters.length > 0 ? chapters[0].sectionId : null,
  )

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate)
    if (videoRef.current) {
      videoRef.current.playbackRate = rate
    }
  }

  const handleChapterClick = (timestamp: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp
    }
  }

  const tryRecordView = useCallback(() => {
    if (hasRecordedView.current) return
    const video = videoRef.current
    if (!video || !video.duration) return
    if (video.currentTime / video.duration >= 0.8) {
      hasRecordedView.current = true
      // Fire-and-forget — no await, no error handling to user
      void recordVideoView({ sopId, sopVersion, videoJobId })
    }
  }, [sopId, sopVersion, videoJobId])

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    // Active chapter tracking: find chapter with largest timestamp <= currentTime
    const currentTime = video.currentTime
    let activeId: string | null = null
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (chapters[i].timestamp <= currentTime) {
        activeId = chapters[i].sectionId
        break
      }
    }
    setActiveChapterId(activeId)

    // Completion tracking at 80%
    tryRecordView()
  }, [chapters, tryRecordView])

  const handleEnded = useCallback(() => {
    tryRecordView()
  }, [tryRecordView])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
    }
  }, [handleTimeUpdate, handleEnded])

  return (
    <div className="flex flex-col">
      {/* Outdated banner */}
      {isOutdated && <VideoOutdatedBanner variant="worker" />}

      {/* Video player area */}
      <div className="relative bg-steel-900 rounded-lg border border-steel-700 mb-4 overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          controls
          playsInline
          preload="metadata"
          className="w-full rounded-lg"
          aria-label="SOP procedure video"
        />
      </div>

      {/* Playback speed selector */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-steel-400">Speed:</span>
        <div className="flex gap-2 flex-wrap">
          {SPEED_OPTIONS.map((rate) => {
            const isActive = playbackRate === rate
            return (
              <button
                key={rate}
                type="button"
                onClick={() => handleSpeedChange(rate)}
                aria-label={`${rate}x playback speed`}
                aria-pressed={isActive}
                className={[
                  'px-3 h-[36px] rounded-lg text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-brand-yellow text-steel-900'
                    : 'bg-steel-700 text-steel-100 hover:bg-steel-600',
                ].join(' ')}
              >
                {rate}x
              </button>
            )
          })}
        </div>
      </div>

      {/* Chapter list */}
      {chapters.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-steel-400 uppercase tracking-wide mb-2">
            Chapters
          </p>
          <div
            className="bg-steel-800 rounded-xl overflow-hidden divide-y divide-steel-700"
            role="list"
          >
            {chapters.map((chapter) => {
              const isActive = chapter.sectionId === activeChapterId
              const timeLabel = formatTimestamp(chapter.timestamp)
              return (
                <div key={chapter.sectionId} role="listitem">
                  <button
                    type="button"
                    onClick={() => handleChapterClick(chapter.timestamp)}
                    aria-label={`${chapter.title} - jump to ${timeLabel}`}
                    aria-current={isActive ? 'true' : undefined}
                    className={[
                      'flex items-center gap-3 px-4 py-3 w-full min-h-[44px] hover:bg-steel-700 transition-colors text-left',
                      isActive ? 'border-l-2 border-brand-yellow bg-steel-800' : '',
                    ].join(' ')}
                  >
                    <span className="text-xs text-steel-400 font-semibold tabular-nums w-[40px] shrink-0">
                      {timeLabel}
                    </span>
                    <span className="text-sm text-steel-100 font-semibold flex-1 leading-snug">
                      {chapter.title}
                    </span>
                    <ChevronRight size={16} className="text-steel-400 shrink-0" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
