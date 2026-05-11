'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import VideoOutdatedBanner from '@/components/admin/VideoOutdatedBanner'
import { publishVersionExclusive, unpublishVideo, generateNewVersion, permanentDeleteVersion } from '@/actions/video'

interface VideoAdminPreviewProps {
  videoUrl: string
  jobId: string
  sopId: string
  format: 'narrated_slideshow' | 'screen_recording'
  isPublished: boolean
  isOutdated: boolean
}

type ConfirmAction = 'regenerate' | 'publish' | 'unpublish' | 'delete' | null

export default function VideoAdminPreview({
  videoUrl,
  jobId,
  sopId,
  format,
  isPublished,
  isOutdated,
}: VideoAdminPreviewProps) {
  const router = useRouter()
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [pending, setPending] = useState(false)
  const confirmRef = useRef<HTMLDivElement>(null)

  const handleConfirm = async () => {
    if (!confirmAction) return
    setPending(true)
    try {
      if (confirmAction === 'publish') {
        await publishVersionExclusive(jobId, sopId)
        router.refresh()
      } else if (confirmAction === 'unpublish') {
        await unpublishVideo(jobId)
        router.refresh()
      } else if (confirmAction === 'regenerate') {
        await generateNewVersion(sopId, format)
        router.refresh()
      } else if (confirmAction === 'delete') {
        await permanentDeleteVersion(jobId)
        router.refresh()
      }
    } finally {
      setPending(false)
      setConfirmAction(null)
    }
  }

  const handleCancel = () => setConfirmAction(null)

  const openConfirm = (action: ConfirmAction) => {
    setConfirmAction(action)
    // Auto-focus the confirm area after state update
    setTimeout(() => {
      const firstBtn = confirmRef.current?.querySelector<HTMLButtonElement>('button')
      firstBtn?.focus()
    }, 50)
  }

  return (
    <div className="mt-6">
      {/* Outdated banner */}
      {isOutdated && <VideoOutdatedBanner variant="admin" sopId={sopId} />}

      {/* Preview heading */}
      <p className="text-xs font-semibold text-[var(--ink-500)] uppercase tracking-wide mb-2">Preview</p>

      {/* Video player */}
      <div className="bg-[var(--paper)] rounded-lg border border-[var(--ink-100)] overflow-hidden">
        <video
          src={videoUrl}
          controls
          preload="metadata"
          className="w-full rounded-lg"
        />
      </div>

      {/* Inline confirm area */}
      {confirmAction && (
        <div
          ref={confirmRef}
          role="alertdialog"
          aria-modal="true"
          className="mt-4 bg-white border border-[var(--ink-100)] rounded-lg p-4"
        >
          <p className="text-sm text-[var(--ink-900)] mb-4">
            {confirmAction === 'regenerate' && 'Generate a new version? The current version will be preserved.'}
            {confirmAction === 'publish' && 'Publish this version? Workers will see it in the SOP video tab. Any currently published version will be unpublished.'}
            {confirmAction === 'unpublish' && 'Unpublish this video? Workers will no longer see it.'}
            {confirmAction === 'delete' && 'Delete this generated video? Workers will no longer see a video for this SOP.'}
          </p>
          <div className="flex gap-3">
            {confirmAction === 'regenerate' && (
              <button
                onClick={handleConfirm}
                disabled={pending}
                className="flex-1 h-[44px] bg-[var(--accent-voice)] text-[var(--ink-900)] font-semibold rounded-lg hover:bg-orange-500 transition-colors disabled:opacity-50"
              >
                {pending ? 'Generating...' : 'Yes, generate new version'}
              </button>
            )}
            {confirmAction === 'publish' && (
              <button
                onClick={handleConfirm}
                disabled={pending}
                className="flex-1 h-[44px] bg-[var(--ink-900)] text-white font-semibold rounded-lg hover:bg-[var(--ink-700)] transition-colors disabled:opacity-50"
              >
                {pending ? 'Publishing...' : 'Yes, publish'}
              </button>
            )}
            {confirmAction === 'unpublish' && (
              <button
                onClick={handleConfirm}
                disabled={pending}
                className="flex-1 h-[44px] bg-[var(--ink-300)] text-[var(--ink-900)] font-semibold rounded-lg hover:bg-[var(--ink-500)] transition-colors disabled:opacity-50"
              >
                {pending ? 'Unpublishing...' : 'Yes, unpublish'}
              </button>
            )}
            {confirmAction === 'delete' && (
              <button
                onClick={handleConfirm}
                disabled={pending}
                className="flex-1 h-[44px] bg-red-600 text-[var(--ink-900)] font-semibold rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {pending ? 'Deleting...' : 'Yes, delete'}
              </button>
            )}
            <button
              onClick={handleCancel}
              disabled={pending}
              className="flex-1 h-[44px] bg-[var(--paper-2)] text-[var(--ink-900)] font-semibold rounded-lg hover:bg-[var(--paper-2)] transition-colors disabled:opacity-50"
            >
              {confirmAction === 'regenerate' ? 'Not now' :
               confirmAction === 'publish' ? 'Not yet' :
               confirmAction === 'delete' ? 'Keep video' :
               'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Action bar */}
      {!confirmAction && (
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => openConfirm('regenerate')}
            className="flex-1 h-[72px] bg-[var(--paper-2)] text-[var(--ink-900)] font-semibold text-lg rounded-lg hover:bg-[var(--paper-2)] transition-colors"
          >
            Generate new version
          </button>
          {isPublished ? (
            <button
              onClick={() => openConfirm('unpublish')}
              className="flex-[2] h-[72px] bg-[var(--paper-2)] text-[var(--ink-900)] font-semibold text-lg rounded-lg hover:bg-[var(--paper-2)] transition-colors"
            >
              Unpublish
            </button>
          ) : (
            <button
              onClick={() => openConfirm('publish')}
              className="flex-[2] h-[72px] bg-[var(--ink-900)] text-white font-semibold text-lg rounded-lg hover:bg-[var(--ink-700)] transition-colors"
            >
              Publish video
            </button>
          )}
        </div>
      )}
    </div>
  )
}
