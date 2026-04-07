'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import VideoOutdatedBanner from '@/components/admin/VideoOutdatedBanner'
import { publishVersionExclusive, unpublishVideo, generateNewVersion, deleteVideoJob } from '@/actions/video'

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
        router.push('/admin/sops')
      } else if (confirmAction === 'unpublish') {
        await unpublishVideo(jobId)
        router.refresh()
      } else if (confirmAction === 'regenerate') {
        await generateNewVersion(sopId, format)
        router.refresh()
      } else if (confirmAction === 'delete') {
        await deleteVideoJob(jobId)
        router.push('/admin/sops')
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
      <p className="text-xs font-semibold text-steel-400 uppercase tracking-wide mb-2">Preview</p>

      {/* Video player */}
      <div className="bg-steel-900 rounded-lg border border-steel-700 overflow-hidden">
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
          className="mt-4 bg-steel-800 border border-steel-700 rounded-lg p-4"
        >
          <p className="text-sm text-steel-100 mb-4">
            {confirmAction === 'regenerate' && 'Re-generate this video? The current video will be replaced.'}
            {confirmAction === 'publish' && 'Publish this video? Workers will see it in the SOP video tab.'}
            {confirmAction === 'unpublish' && 'Unpublish this video? Workers will no longer see it.'}
            {confirmAction === 'delete' && 'Delete this generated video? Workers will no longer see a video for this SOP.'}
          </p>
          <div className="flex gap-3">
            {confirmAction === 'regenerate' && (
              <button
                onClick={handleConfirm}
                disabled={pending}
                className="flex-1 h-[44px] bg-brand-orange text-steel-100 font-semibold rounded-lg hover:bg-orange-500 transition-colors disabled:opacity-50"
              >
                {pending ? 'Re-generating...' : 'Yes, re-generate'}
              </button>
            )}
            {confirmAction === 'publish' && (
              <button
                onClick={handleConfirm}
                disabled={pending}
                className="flex-1 h-[44px] bg-brand-yellow text-steel-900 font-semibold rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50"
              >
                {pending ? 'Publishing...' : 'Yes, publish'}
              </button>
            )}
            {confirmAction === 'unpublish' && (
              <button
                onClick={handleConfirm}
                disabled={pending}
                className="flex-1 h-[44px] bg-steel-600 text-steel-100 font-semibold rounded-lg hover:bg-steel-500 transition-colors disabled:opacity-50"
              >
                {pending ? 'Unpublishing...' : 'Yes, unpublish'}
              </button>
            )}
            {confirmAction === 'delete' && (
              <button
                onClick={handleConfirm}
                disabled={pending}
                className="flex-1 h-[44px] bg-red-600 text-steel-100 font-semibold rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {pending ? 'Deleting...' : 'Yes, delete'}
              </button>
            )}
            <button
              onClick={handleCancel}
              disabled={pending}
              className="flex-1 h-[44px] bg-steel-700 text-steel-100 font-semibold rounded-lg hover:bg-steel-600 transition-colors disabled:opacity-50"
            >
              {confirmAction === 'regenerate' ? 'Keep current video' :
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
            className="flex-1 h-[72px] bg-steel-700 text-steel-100 font-semibold text-lg rounded-lg hover:bg-steel-600 transition-colors"
          >
            Re-generate
          </button>
          {isPublished ? (
            <button
              onClick={() => openConfirm('unpublish')}
              className="flex-[2] h-[72px] bg-steel-700 text-steel-100 font-semibold text-lg rounded-lg hover:bg-steel-600 transition-colors"
            >
              Unpublish
            </button>
          ) : (
            <button
              onClick={() => openConfirm('publish')}
              className="flex-[2] h-[72px] bg-brand-yellow text-steel-900 font-semibold text-lg rounded-lg hover:bg-amber-400 transition-colors"
            >
              Publish video
            </button>
          )}
        </div>
      )}
    </div>
  )
}
