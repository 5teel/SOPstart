'use client'
/**
 * PhotoThumbnail — 72x72 thumbnail with upload status overlay.
 *
 * Per UI-SPEC C-02:
 * - Orange border + dot = queued (not yet uploaded)
 * - Green border + dot = uploaded to storage
 * - Remove button (X) shown for pending photos only
 */
import { useMemo, useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { QueuedPhoto } from '@/lib/offline/db'

interface PhotoThumbnailProps {
  photo: QueuedPhoto
  onRemove?: () => void
}

export function PhotoThumbnail({ photo, onRemove }: PhotoThumbnailProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    const url = URL.createObjectURL(photo.blob)
    setObjectUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [photo.blob])

  const borderColor = photo.uploaded ? 'border-green-500/40' : 'border-brand-orange'
  const dotColor = photo.uploaded ? 'bg-green-500' : 'bg-brand-orange'

  return (
    <div className="relative w-[72px] h-[72px] flex-shrink-0">
      {objectUrl ? (
        <img
          src={objectUrl}
          alt="Captured photo"
          className={`w-full h-full rounded-lg object-cover border-2 ${borderColor}`}
        />
      ) : (
        <div className={`w-full h-full rounded-lg bg-steel-700 border-2 ${borderColor}`} />
      )}

      {/* Upload status dot — top-right corner */}
      <span
        className={`absolute top-1 right-1 w-3 h-3 rounded-full border border-steel-900 ${dotColor}`}
        aria-label={photo.uploaded ? 'Uploaded' : 'Queued for upload'}
      />

      {/* Remove button — top-left corner, only for unuploaded photos */}
      {!photo.uploaded && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="absolute top-1 left-1 w-5 h-5 rounded-full bg-steel-900/80 flex items-center justify-center hover:bg-steel-900 transition-colors"
          aria-label="Remove photo"
        >
          <X size={10} className="text-steel-100" />
        </button>
      )}
    </div>
  )
}
