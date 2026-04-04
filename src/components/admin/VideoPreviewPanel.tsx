'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createVideoUploadSession } from '@/actions/sops'
import { tusUpload } from '@/lib/upload/tus-upload'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PreviewState = 'reviewing' | 'uploading' | 'upload-error'

interface VideoPreviewPanelProps {
  videoBlob: Blob
  audioFile: File
  onRetake: () => void
  onClose: () => void
  onSubmitComplete: (sopId: string) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VideoPreviewPanel({
  videoBlob,
  audioFile,
  onRetake,
  onClose,
  onSubmitComplete,
}: VideoPreviewPanelProps) {
  const [panelState, setPanelState] = useState<PreviewState>('reviewing')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [duration, setDuration] = useState<number | null>(null)
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // ---------------------------------------------------------------------------
  // Object URL lifecycle
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const url = URL.createObjectURL(videoBlob)
    setObjectUrl(url)
    return () => {
      URL.revokeObjectURL(url)
    }
  }, [videoBlob])

  // ---------------------------------------------------------------------------
  // Duration from video metadata
  // ---------------------------------------------------------------------------

  const handleLoadedMetadata = useCallback(() => {
    if (videoRef.current && !isNaN(videoRef.current.duration)) {
      setDuration(videoRef.current.duration)
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Focus trap
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return

    const focusable = overlay.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last?.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first?.focus()
          }
        }
      }
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    setTimeout(() => closeButtonRef.current?.focus(), 50)

    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // ---------------------------------------------------------------------------
  // Toast
  // ---------------------------------------------------------------------------

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 5000)
  }, [])

  // ---------------------------------------------------------------------------
  // Submit flow
  // ---------------------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    setPanelState('uploading')
    setUploadProgress(0)

    // Create upload session using audio file metadata
    const sessionResult = await createVideoUploadSession({
      name: 'recording.mp3',
      size: String(audioFile.size),
      type: 'audio/mpeg',
    })

    if ('error' in sessionResult) {
      showToast(sessionResult.error ?? 'Failed to create upload session. Please try again.')
      setPanelState('upload-error')
      return
    }

    const { sopId, path, token } = sessionResult

    // TUS upload the extracted audio
    await new Promise<void>((resolve) => {
      const upload = tusUpload({
        file: audioFile,
        storagePath: path,
        accessToken: token,
        bucketName: 'sop-videos',
        onProgress: (pct) => {
          setUploadProgress(pct)
        },
        onSuccess: () => {
          // Trigger transcription pipeline
          fetch('/api/sops/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sopId }),
          }).catch(console.error)

          resolve()
          onSubmitComplete(sopId)
        },
        onError: () => {
          showToast('Upload failed -- please check your connection and try again.')
          setPanelState('upload-error')
          resolve()
        },
      })
      upload.start()
    })
  }, [audioFile, showToast, onSubmitComplete])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isUploading = panelState === 'uploading'

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-steel-900 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Review your recording"
    >
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between bg-steel-900">
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          disabled={isUploading}
          className="w-12 h-12 flex items-center justify-center rounded-full bg-steel-800 hover:bg-steel-700 text-steel-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X className="w-5 h-5" />
        </button>
        <span className="text-base font-semibold text-steel-100">Preview</span>
        <div className="w-12" aria-hidden="true" />
      </div>

      {/* Playback area */}
      <div className="flex-1 relative bg-steel-900">
        {objectUrl && (
          <video
            ref={videoRef}
            src={objectUrl}
            controls
            playsInline
            onLoadedMetadata={handleLoadedMetadata}
            aria-label="Recording preview"
            className="w-full h-full object-contain"
          />
        )}

        {/* Duration badge */}
        {duration !== null && (
          <div className="absolute bottom-4 right-4 bg-steel-900/80 rounded px-2 py-1 text-xs font-semibold text-steel-100 tabular-nums pointer-events-none">
            {formatDuration(duration)}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="bg-steel-800 py-6 px-6 flex gap-4">
        <button
          type="button"
          onClick={onRetake}
          disabled={isUploading}
          className="flex-1 h-[72px] bg-steel-700 text-steel-100 font-semibold text-lg rounded-lg hover:bg-steel-600 active:bg-steel-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Retake
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isUploading}
          aria-busy={isUploading}
          className="flex-[2] h-[72px] bg-brand-yellow text-steel-900 font-semibold text-lg rounded-lg hover:bg-amber-400 active:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Uploading... {uploadProgress}%
            </>
          ) : (
            'Submit for transcription'
          )}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-steel-800 border border-steel-700 rounded-lg shadow-xl text-sm text-steel-100 max-w-sm">
          {toast}
        </div>
      )}
    </div>
  )
}
