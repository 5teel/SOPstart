'use client'

/**
 * Phase 21 (Plan 21-02, Task 2) — Video source renderer.
 *
 * HTML5 `<video>` element with a side transcript pane. On
 * `activeProvenance.kind === 'video'`, seeks `video.currentTime` to
 * `region.timestamp_start` and marks the transcript line whose range
 * contains that timestamp with `data-active="true"` (mirrors Phase 6
 * VideoReviewPanel pattern).
 *
 * Reverse channel: clicking a transcript line emits
 * `onSourceClick(lineId)` so the builder can highlight the corresponding
 * block. The line id is whatever the parser stamped on the transcript
 * segment (`block_provenance.kind = 'video'` doesn't carry a stable
 * block ID — it carries a timestamp range — so the source-side click
 * resolves the closest block by timestamp containment in the BuilderClient
 * registered handler).
 *
 * Transcript fetching: this v1 receives transcript segments via props.
 * The pane DOES NOT re-parse — Phase 6 / Phase 8 already own transcript
 * persistence. Wrapping component (`SourceViewerPane`) is responsible
 * for sourcing the transcript array via the existing parse_jobs row.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useSelectionSync } from './useSelectionSync'

export type TranscriptSegment = {
  /** Stable identifier (Phase 6 stamps this). */
  id: string
  /** Seconds from start of video. */
  start: number
  /** Seconds from start of video. */
  end: number
  text: string
}

export type VideoSourcePreviewProps = {
  /** Signed-URL pointer to the video file. May be null for YouTube SOPs. */
  url: string | null
  /** Pre-fetched transcript segments. Pane owns rendering, not fetching. */
  segments: TranscriptSegment[]
  className?: string
}

export function VideoSourcePreview({ url, segments, className }: VideoSourcePreviewProps): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  const { activeProvenance, onSourceClick } = useSelectionSync()

  const activeRange = useMemo(() => {
    if (!activeProvenance || activeProvenance.kind !== 'video') return null
    return [activeProvenance.timestamp_start, activeProvenance.timestamp_end] as const
  }, [activeProvenance])

  // 1. Seek video to timestamp_start when active range changes.
  useEffect(() => {
    if (!activeRange || !videoRef.current) return
    const video = videoRef.current
    try {
      video.currentTime = activeRange[0]
    } catch {
      // some browsers throw if metadata not yet loaded; ignore
    }
  }, [activeRange])

  // 2. Mark matching transcript line + scroll it into view.
  useEffect(() => {
    if (!activeRange || !transcriptRef.current) return
    const container = transcriptRef.current
    const lines = container.querySelectorAll<HTMLElement>('[data-transcript-line]')
    let activeLine: HTMLElement | null = null
    lines.forEach((line) => {
      const start = Number(line.dataset.start ?? 'NaN')
      const end = Number(line.dataset.end ?? 'NaN')
      if (
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        activeRange[0] >= start &&
        activeRange[0] <= end
      ) {
        line.setAttribute('data-active', 'true')
        activeLine = line
      } else {
        line.setAttribute('data-active', 'false')
      }
    })
    if (activeLine) {
      requestAnimationFrame(() => {
        ;(activeLine as HTMLElement).scrollIntoView({ behavior: 'auto', block: 'center' })
      })
    }
  }, [activeRange])

  // 3. Reverse channel — click on a transcript line.
  function handleTranscriptClick(e: React.MouseEvent) {
    let node = e.target as HTMLElement | null
    while (node && node !== transcriptRef.current) {
      const id = node.getAttribute?.('data-transcript-line')
      if (id) {
        onSourceClick(id)
        // Also: seek video on click for nicer UX
        const start = Number(node.dataset.start ?? 'NaN')
        if (videoRef.current && Number.isFinite(start)) {
          videoRef.current.currentTime = start
        }
        return
      }
      node = node.parentElement
    }
  }

  return (
    <div
      className={className}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <style>{`
        [data-transcript-line] {
          padding: 6px 10px;
          border-left: 3px solid transparent;
          cursor: pointer;
          font-size: 13px;
          line-height: 1.5;
        }
        [data-transcript-line]:hover {
          background: rgba(0,0,0,0.04);
        }
        [data-transcript-line][data-active="true"] {
          background: rgba(250, 204, 21, 0.18);
          border-left-color: #facc15;
        }
        [data-transcript-line] .ts {
          font-family: var(--font-mono, ui-monospace, SFMono-Regular, monospace);
          font-size: 11px;
          color: #888;
          margin-right: 8px;
        }
      `}</style>
      <div style={{ flex: '0 0 auto', background: '#000' }}>
        {url ? (
          <video
            ref={videoRef}
            src={url}
            controls
            preload="metadata"
            style={{ width: '100%', maxHeight: 320, display: 'block' }}
          />
        ) : (
          <div style={{ padding: 24, color: '#bbb', fontSize: 12 }}>
            video unavailable (YouTube source — open original to watch)
          </div>
        )}
      </div>
      <div
        ref={transcriptRef}
        data-testid="source-viewer-transcript"
        onClick={handleTranscriptClick}
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          padding: '8px 4px',
          background: '#ffffff',
        }}
      >
        {segments.length === 0 && (
          <div style={{ padding: 16, fontSize: 12, color: '#666' }}>no transcript available</div>
        )}
        {segments.map((seg) => (
          <div
            key={seg.id}
            data-transcript-line={seg.id}
            data-start={seg.start}
            data-end={seg.end}
            data-active="false"
          >
            <span className="ts">{formatTimestamp(seg.start)}</span>
            {seg.text}
          </div>
        ))}
      </div>
    </div>
  )
}

function formatTimestamp(s: number): string {
  const mins = Math.floor(s / 60)
  const secs = Math.floor(s % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
