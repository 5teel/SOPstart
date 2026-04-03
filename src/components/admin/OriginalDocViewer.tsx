'use client'

import { FileText } from 'lucide-react'
import type { SourceFileType } from '@/types/sop'

interface OriginalDocViewerProps {
  sourceFileType: SourceFileType
  presignedUrl: string | null
  sourceFileName: string
}

export default function OriginalDocViewer({
  sourceFileType,
  presignedUrl,
  sourceFileName,
}: OriginalDocViewerProps) {
  return (
    <div className="flex flex-col h-full">
      <p className="text-xs font-semibold text-steel-400 uppercase tracking-wide mb-2">
        ORIGINAL DOCUMENT
      </p>

      {sourceFileType === 'pdf' && presignedUrl ? (
        <div className="relative flex-1 overflow-hidden rounded-lg border border-steel-700 bg-steel-900 min-h-[400px]">
          <iframe
            src={presignedUrl}
            className="w-full h-full border-0 rounded-lg bg-steel-900"
            title="Original SOP document"
          />
        </div>
      ) : sourceFileType === 'image' && presignedUrl ? (
        <div className="flex flex-col gap-3 overflow-y-auto p-4 bg-steel-900 rounded-lg border border-steel-700 flex-1 min-h-[400px]">
          <img
            src={presignedUrl}
            alt={sourceFileName}
            className="rounded-md shadow-sm max-w-full border border-steel-700"
          />
        </div>
      ) : (
        // .docx or no presigned URL
        <div className="flex flex-col items-center justify-center gap-3 p-8 bg-steel-900 rounded-lg border border-steel-700 flex-1 min-h-[200px] text-center">
          <FileText size={40} className="text-steel-400" />
          <p className="text-sm text-steel-400">
            Word document — preview not available
          </p>
          {presignedUrl && (
            <a
              href={presignedUrl}
              download={sourceFileName}
              className="text-brand-yellow text-sm hover:text-amber-400 underline"
            >
              Download original
            </a>
          )}
        </div>
      )}
    </div>
  )
}
