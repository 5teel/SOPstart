'use client'

import { useState, useRef, useCallback } from 'react'
import type { TranscriptSegment } from '@/types/sop'

interface VideoReviewPanelProps {
  presignedUrl: string | null      // For file uploads — HTML5 video src
  youtubeVideoId: string | null    // For YouTube — embed iframe
  segments: TranscriptSegment[]    // Transcript segments with timestamps
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function VideoReviewPanel({
  presignedUrl,
  youtubeVideoId,
  segments,
}: VideoReviewPanelProps) {
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number | null>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const videoRef = useRef<HTMLVideoElement>(null)
  const ytPlayerRef = useRef<YTPlayer | null>(null)
  const transcriptContainerRef = useRef<HTMLDivElement>(null)
  const lastManualScrollTime = useRef<number>(0)

  // Load YouTube IFrame API lazily when youtubeVideoId is set
  const youtubeContainerRef = useRef<HTMLDivElement>(null)
  const ytApiLoaded = useRef(false)

  const initYouTubePlayer = useCallback(() => {
    if (ytApiLoaded.current || !youtubeVideoId) return
    ytApiLoaded.current = true

    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    const firstScript = document.getElementsByTagName('script')[0]
    firstScript.parentNode?.insertBefore(tag, firstScript)

    ;(window as unknown as Record<string, unknown>)['onYouTubeIframeAPIReady'] = () => {
      const YT = (window as unknown as { YT: { Player: new (id: string, opts: object) => YTPlayer } }).YT
      ytPlayerRef.current = new YT.Player('youtube-player', {
        events: {
          onStateChange: () => {},
        },
      })
    }
  }, [youtubeVideoId])

  const scrollToSegment = useCallback((index: number) => {
    const container = transcriptContainerRef.current
    if (!container) return
    const child = container.children[index] as HTMLElement | undefined
    child?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  function handleSegmentClick(index: number) {
    setActiveSegmentIndex(index)
    const seg = segments[index]

    if (videoRef.current) {
      videoRef.current.currentTime = seg.start
    } else if (ytPlayerRef.current?.seekTo) {
      ytPlayerRef.current.seekTo(seg.start, true)
    }
  }

  function handleTimeUpdate() {
    if (!videoRef.current) return
    const time = videoRef.current.currentTime
    const index = segments.findIndex((s, i) => {
      const next = segments[i + 1]
      return time >= s.start && (!next || time < next.start)
    })
    if (index !== -1 && index !== activeSegmentIndex) {
      setActiveSegmentIndex(index)
      if (autoScroll) {
        scrollToSegment(index)
      }
    }
  }

  function handleManualScroll() {
    lastManualScrollTime.current = Date.now()
    setAutoScroll(false)
    // Re-enable auto-scroll after 5s of no manual scrolling
    setTimeout(() => {
      if (Date.now() - lastManualScrollTime.current >= 5000) {
        setAutoScroll(true)
      }
    }, 5000)
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <p className="text-xs font-semibold text-steel-400 uppercase tracking-wide">
        VIDEO SOURCE
      </p>

      {/* Video player */}
      <div className="bg-steel-900 rounded-lg overflow-hidden border border-steel-700 max-h-[280px]">
        {youtubeVideoId ? (
          <iframe
            id="youtube-player"
            src={`https://www.youtube.com/embed/${youtubeVideoId}?enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`}
            title="SOP source video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            className="w-full aspect-video rounded-lg"
            onLoad={initYouTubePlayer}
          />
        ) : presignedUrl ? (
          <video
            ref={videoRef}
            src={presignedUrl}
            controls
            preload="metadata"
            aria-label="SOP source video"
            className="w-full rounded-lg"
            onTimeUpdate={handleTimeUpdate}
          />
        ) : (
          <div className="flex items-center justify-center h-[180px] text-steel-400 text-sm">
            No video available.
          </div>
        )}
      </div>

      {/* Transcript header */}
      <p className="text-xs font-semibold text-steel-400 uppercase tracking-wide">
        TRANSCRIPT
      </p>

      {/* Read-only note */}
      <p className="text-xs text-steel-600 italic px-3 py-2">
        Read only — edit the structured SOP on the right.
      </p>

      {/* Transcript lines — scrollable */}
      <div
        ref={transcriptContainerRef}
        role="list"
        className="flex-1 overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 12rem)' }}
        onScroll={handleManualScroll}
      >
        {segments.length === 0 ? (
          <p className="text-sm text-steel-400 px-3 py-4">No transcript available for this video.</p>
        ) : (
          segments.map((seg, i) => (
            <div
              key={i}
              role="listitem"
              aria-pressed={activeSegmentIndex === i}
              onClick={() => handleSegmentClick(i)}
              className={`flex items-start gap-3 px-3 py-2 rounded-lg cursor-pointer min-h-[44px] ${
                activeSegmentIndex === i
                  ? 'bg-steel-800 border-l-2 border-brand-yellow'
                  : 'hover:bg-steel-800'
              }`}
            >
              <span className="text-xs text-steel-400 font-semibold tabular-nums w-[48px] shrink-0 pt-1">
                {formatTimestamp(seg.start)}
              </span>
              <span className="text-sm text-steel-100 leading-relaxed flex-1">
                {seg.text}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// Minimal type for the YouTube IFrame API Player
interface YTPlayer {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
}
