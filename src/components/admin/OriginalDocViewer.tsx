'use client'

import { FileText } from 'lucide-react'
import type { SourceFileType, TranscriptSegment } from '@/types/sop'
import VideoReviewPanel from '@/components/admin/VideoReviewPanel'

interface OriginalDocViewerProps {
  sourceFileType: SourceFileType
  presignedUrl: string | null
  sourceFileName: string
  // New video-specific props (optional — only set for video SOPs)
  transcriptSegments?: TranscriptSegment[]
  youtubeVideoId?: string | null
}

export default function OriginalDocViewer({
  sourceFileType,
  presignedUrl,
  sourceFileName,
  transcriptSegments,
  youtubeVideoId,
}: OriginalDocViewerProps) {
  if (sourceFileType === 'video') {
    return (
      <VideoReviewPanel
        presignedUrl={presignedUrl}
        youtubeVideoId={youtubeVideoId ?? null}
        segments={transcriptSegments ?? []}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      <p className="text-xs font-semibold text-[var(--ink-500)] uppercase tracking-wide mb-2">
        ORIGINAL DOCUMENT
      </p>

      {sourceFileType === 'pdf' && presignedUrl ? (
        <div className="relative flex-1 overflow-hidden rounded-lg border border-[var(--ink-100)] bg-[var(--paper)] min-h-[400px]">
          <iframe
            src={presignedUrl}
            className="w-full h-full border-0 rounded-lg bg-[var(--paper)]"
            title="Original SOP document"
          />
        </div>
      ) : sourceFileType === 'image' && presignedUrl ? (
        <div className="flex flex-col gap-3 overflow-y-auto p-4 bg-[var(--paper)] rounded-lg border border-[var(--ink-100)] flex-1 min-h-[400px]">
          <img
            src={presignedUrl}
            alt={sourceFileName}
            className="rounded-md shadow-sm max-w-full border border-[var(--ink-100)]"
          />
        </div>
      ) : (
        // .docx or no presigned URL
        <div className="flex flex-col items-center justify-center gap-3 p-8 bg-[var(--paper)] rounded-lg border border-[var(--ink-100)] flex-1 min-h-[200px] text-center">
          <FileText size={40} className="text-[var(--ink-500)]" />
          <p className="text-sm text-[var(--ink-500)]">
            Word document — preview not available
          </p>
          {presignedUrl && (
            <a
              href={presignedUrl}
              download={sourceFileName}
              className="text-[var(--ink-900)] text-sm hover:text-[var(--ink-700)] underline"
            >
              Download original
            </a>
          )}
        </div>
      )}
    </div>
  )
}
