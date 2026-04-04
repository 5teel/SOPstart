'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { X, RotateCcw, Circle, Square, Loader2, AlertTriangle } from 'lucide-react'
import { extractAudioFromVideo } from '@/lib/parsers/extract-video-audio'
import { TusUploadProgress } from './TusUploadProgress'
import { VideoPreviewPanel } from './VideoPreviewPanel'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RecorderState =
  | 'requesting-permission'
  | 'permission-denied'
  | 'ready'
  | 'recording'
  | 'stopping'
  | 'extracting-audio'
  | 'preview'
  | 'error'
  | 'discard-confirm'

interface VideoRecorderProps {
  open: boolean
  onClose: () => void
  onSubmitComplete: (sopId: string) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function selectMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ]
  return candidates.find(t => MediaRecorder.isTypeSupported(t)) ?? ''
}

const MAX_SECONDS = 15 * 60   // 900
const WARN_SECONDS = 13 * 60  // 780

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function VideoRecorder({ open, onClose, onSubmitComplete }: VideoRecorderProps) {
  const [recorderState, setRecorderState] = useState<RecorderState>('requesting-permission')
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [extractionPct, setExtractionPct] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')

  // Recorded data
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const objectUrlsRef = useRef<string[]>([])
  const overlayRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // ---------------------------------------------------------------------------
  // Cleanup helpers
  // ---------------------------------------------------------------------------

  const stopAllTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
  }, [])

  const revokeObjectUrls = useCallback(() => {
    objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url))
    objectUrlsRef.current = []
  }, [])

  // ---------------------------------------------------------------------------
  // Camera acquisition
  // ---------------------------------------------------------------------------

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    stopAllTracks()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: true,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setRecorderState('ready')
    } catch (err) {
      const name = err instanceof Error ? err.name : ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setRecorderState('permission-denied')
      } else {
        setErrorMessage('Could not access camera. Please check your device settings.')
        setRecorderState('error')
      }
    }
  }, [stopAllTracks])

  // ---------------------------------------------------------------------------
  // Mount / unmount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!open) return
    setRecorderState('requesting-permission')
    setElapsedSeconds(0)
    setExtractionPct(0)
    setRecordedBlob(null)
    setAudioFile(null)
    startCamera(facingMode)

    return () => {
      stopAllTracks()
      clearTimer()
      revokeObjectUrls()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // ---------------------------------------------------------------------------
  // Focus trap
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!open || recorderState === 'preview') return
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
        handleClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    setTimeout(() => closeButtonRef.current?.focus(), 50)

    return () => document.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, recorderState])

  // ---------------------------------------------------------------------------
  // Switch camera
  // ---------------------------------------------------------------------------

  const handleSwitchCamera = useCallback(async () => {
    if (recorderState !== 'ready') return
    const newFacing = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(newFacing)
    setRecorderState('requesting-permission')
    await startCamera(newFacing)
  }, [facingMode, recorderState, startCamera])

  // ---------------------------------------------------------------------------
  // Internal toast
  // ---------------------------------------------------------------------------

  const [internalToast, setInternalToast] = useState<string | null>(null)
  const showToastInternal = useCallback((msg: string) => {
    setInternalToast(msg)
    setTimeout(() => setInternalToast(null), 5000)
  }, [])
  // Stable ref so setInterval closure doesn't capture stale version
  const showToastInternalRef = useRef(showToastInternal)
  useEffect(() => { showToastInternalRef.current = showToastInternal }, [showToastInternal])

  // ---------------------------------------------------------------------------
  // Start recording
  // ---------------------------------------------------------------------------

  const handleStartRecording = useCallback(() => {
    if (!streamRef.current || recorderState !== 'ready') return

    const mime = selectMimeType()
    chunksRef.current = []

    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: mime || undefined,
      videoBitsPerSecond: 2_500_000,
      audioBitsPerSecond: 128_000,
    })

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data)
      }
    }

    recorder.onstop = async () => {
      clearTimer()
      setElapsedSeconds(prev => prev) // keep value for display
      const blob = new Blob(chunksRef.current, { type: mime || 'video/webm' })
      setRecordedBlob(blob)
      setRecorderState('extracting-audio')

      // Extract audio
      try {
        const videoFile = new File([blob], 'recording.webm', { type: mime || 'video/webm' })
        const audio = await extractAudioFromVideo(videoFile, (pct) => {
          setExtractionPct(pct)
        })
        setAudioFile(audio)
        setRecorderState('preview')
      } catch {
        setErrorMessage('Audio extraction failed. Please try recording again.')
        setRecorderState('error')
      }
    }

    recorder.start(1000) // collect data every second
    mediaRecorderRef.current = recorder
    setElapsedSeconds(0)
    setRecorderState('recording')

    // Start timer
    timerIntervalRef.current = setInterval(() => {
      setElapsedSeconds(prev => {
        const next = prev + 1
        if (next >= MAX_SECONDS) {
          // Auto-stop
          if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop()
          }
          clearTimer()
          showToastInternalRef.current('Maximum recording length reached (15 minutes).')
        }
        return next
      })
    }, 1000)
  }, [recorderState, clearTimer])

  // ---------------------------------------------------------------------------
  // Stop recording
  // ---------------------------------------------------------------------------

  const handleStopRecording = useCallback(() => {
    if (recorderState !== 'recording') return
    clearTimer()
    setRecorderState('stopping')
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [recorderState, clearTimer])

  // ---------------------------------------------------------------------------
  // Close handling
  // ---------------------------------------------------------------------------

  const handleClose = useCallback(() => {
    if (recorderState === 'recording') {
      setRecorderState('discard-confirm')
      return
    }
    stopAllTracks()
    clearTimer()
    revokeObjectUrls()
    onClose()
  }, [recorderState, stopAllTracks, clearTimer, revokeObjectUrls, onClose])

  const handleDiscardConfirm = useCallback(() => {
    clearTimer()
    if (mediaRecorderRef.current?.state === 'recording') {
      // Detach handlers before stopping to prevent onstop -> extracting-audio
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
    }
    mediaRecorderRef.current = null
    chunksRef.current = []
    setRecordedBlob(null)
    stopAllTracks()
    revokeObjectUrls()
    onClose()
  }, [clearTimer, stopAllTracks, revokeObjectUrls, onClose])

  const handleKeepRecording = useCallback(() => {
    setRecorderState('recording')
  }, [])

  // ---------------------------------------------------------------------------
  // Retake (from preview)
  // ---------------------------------------------------------------------------

  const handleRetake = useCallback(() => {
    setRecordedBlob(null)
    setAudioFile(null)
    setExtractionPct(0)
    setElapsedSeconds(0)
    chunksRef.current = []
    setRecorderState('requesting-permission')
    startCamera(facingMode)
  }, [facingMode, startCamera])

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------

  const remainingSeconds = MAX_SECONDS - elapsedSeconds
  const isWarning = elapsedSeconds >= WARN_SECONDS
  const isRecording = recorderState === 'recording'
  const cameraLabel = facingMode === 'user' ? 'Front camera' : 'Rear camera'
  const switchCameraLabel = facingMode === 'user' ? 'Switch to rear camera' : 'Switch to front camera'

  // ---------------------------------------------------------------------------
  // Render: preview state delegates to VideoPreviewPanel
  // ---------------------------------------------------------------------------

  if (!open) return null

  if (recorderState === 'preview' && recordedBlob && audioFile) {
    return (
      <VideoPreviewPanel
        videoBlob={recordedBlob}
        audioFile={audioFile}
        onRetake={handleRetake}
        onClose={() => {
          stopAllTracks()
          clearTimer()
          revokeObjectUrls()
          onClose()
        }}
        onSubmitComplete={onSubmitComplete}
      />
    )
  }

  // ---------------------------------------------------------------------------
  // Viewfinder content per state
  // ---------------------------------------------------------------------------

  const renderViewfinderOverlay = () => {
    if (recorderState === 'requesting-permission') {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
        </div>
      )
    }
    if (recorderState === 'permission-denied') {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <AlertTriangle className="w-10 h-10 text-brand-orange" />
          <p className="text-sm text-brand-orange leading-relaxed">
            Camera access required — please allow camera access in your browser settings and reload.
          </p>
        </div>
      )
    }
    if (recorderState === 'error') {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <AlertTriangle className="w-10 h-10 text-red-400" />
          <p className="text-sm text-brand-orange leading-relaxed">{errorMessage}</p>
        </div>
      )
    }
    return null
  }

  // ---------------------------------------------------------------------------
  // Controls bar content per state
  // ---------------------------------------------------------------------------

  const renderControlsContent = () => {
    if (recorderState === 'discard-confirm') {
      return (
        <div className="flex flex-col items-center gap-4 text-center w-full px-6 py-6">
          <p className="text-base font-semibold text-steel-100">Stop recording and discard?</p>
          <p className="text-sm text-steel-400">Your recording will be lost.</p>
          <div className="flex gap-3 w-full">
            <button
              type="button"
              onClick={handleDiscardConfirm}
              aria-label="Discard recording and close"
              className="flex-1 h-[72px] bg-steel-800 border border-red-500/50 text-red-400 rounded-lg font-semibold text-sm hover:bg-steel-700 transition-colors"
            >
              Discard recording
            </button>
            <button
              type="button"
              onClick={handleKeepRecording}
              aria-label="Keep recording and continue"
              className="flex-1 h-[72px] bg-steel-700 text-steel-100 rounded-lg font-semibold text-sm hover:bg-steel-600 transition-colors"
            >
              Keep recording
            </button>
          </div>
        </div>
      )
    }

    if (recorderState === 'extracting-audio' || recorderState === 'stopping') {
      return (
        <div className="flex flex-col items-center gap-3 w-full px-8 py-6">
          {recorderState === 'extracting-audio' ? (
            <>
              <TusUploadProgress percentage={extractionPct} />
              <p className="text-sm text-steel-100">Extracting audio... {extractionPct}%</p>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <p className="text-sm text-steel-100">Stopping...</p>
            </div>
          )}
        </div>
      )
    }

    if (recorderState === 'permission-denied') {
      return (
        <div className="flex flex-col items-center gap-3 w-full px-8 py-6 text-center">
          <a
            href="https://support.google.com/chrome/answer/2693767"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open browser camera settings"
            className="text-brand-yellow text-sm font-semibold hover:underline"
          >
            Open Settings
          </a>
          <p className="text-xs text-steel-400 leading-relaxed mt-2">
            In your browser&apos;s address bar, tap the camera icon or go to Settings &gt; Privacy &gt; Camera and allow access for this site.
          </p>
        </div>
      )
    }

    if (recorderState === 'error') {
      return (
        <div className="flex flex-col items-center gap-3 w-full px-8 py-6">
          <button
            type="button"
            onClick={() => {
              setErrorMessage('')
              setRecorderState('requesting-permission')
              startCamera(facingMode)
            }}
            className="h-[72px] px-8 bg-steel-700 text-steel-100 font-semibold rounded-lg hover:bg-steel-600 transition-colors"
          >
            Try again
          </button>
        </div>
      )
    }

    return (
      <>
        {/* Switch camera — mobile only */}
        <button
          type="button"
          onClick={handleSwitchCamera}
          disabled={isRecording}
          aria-label={switchCameraLabel}
          className={`md:hidden w-[72px] h-[72px] rounded-full bg-steel-700 flex items-center justify-center text-steel-100 hover:bg-steel-600 active:bg-steel-500 transition-colors ${
            isRecording ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          <RotateCcw className="w-6 h-6" />
        </button>

        {/* Record / Stop button */}
        {!isRecording ? (
          <button
            type="button"
            onClick={handleStartRecording}
            aria-label="Start recording"
            aria-pressed={false}
            className="w-20 h-20 rounded-full border-4 border-brand-yellow bg-steel-800 flex items-center justify-center hover:bg-steel-700 transition-colors"
          >
            <Circle className="w-8 h-8 fill-white text-white" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleStopRecording}
            aria-label="Stop recording"
            aria-pressed={true}
            className="w-20 h-20 rounded-full border-4 border-red-500 bg-red-500 flex items-center justify-center ring-4 ring-red-500/30"
          >
            <Square className="w-8 h-8 fill-white text-white" />
          </button>
        )}

        {/* Right spacer (desktop) — keeps record button centered */}
        <div className="hidden md:block w-[72px]" aria-hidden="true" />
        {/* Mobile spacer when not showing switch button — keeps centered */}
        <div className="md:hidden w-[72px]" aria-hidden="true" />
      </>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 bg-steel-900 flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label="Record video"
    >
      {/* Header */}
      <div className="h-14 px-4 flex items-center justify-between bg-steel-900">
        <button
          ref={closeButtonRef}
          type="button"
          onClick={handleClose}
          aria-label="Close recording overlay"
          className="w-12 h-12 flex items-center justify-center rounded-full bg-steel-800 hover:bg-steel-700 text-steel-100"
        >
          <X className="w-5 h-5" />
        </button>
        <span className="text-xs text-steel-400 font-semibold">{cameraLabel}</span>
      </div>

      {/* Viewfinder */}
      <div className="flex-1 relative bg-steel-900 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          aria-label="Camera preview"
          className="w-full h-full object-cover"
          style={facingMode === 'user' ? { transform: 'scaleX(-1)' } : undefined}
        />

        {/* Viewfinder overlay for non-live states */}
        {renderViewfinderOverlay()}

        {/* Recording indicator */}
        {isRecording && (
          <div
            className="absolute top-4 left-4 flex items-center gap-2"
            aria-live="polite"
          >
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
            <span className="text-xs font-semibold text-steel-100 tabular-nums">REC</span>
            <span
              className={`text-xs font-semibold tabular-nums ${isWarning ? 'text-red-400' : 'text-steel-400'}`}
              aria-label={`Recording duration: ${formatTime(elapsedSeconds)}`}
            >
              {formatTime(elapsedSeconds)}
              {isWarning && (
                <span className="ml-1 text-red-400">
                  ({formatTime(remainingSeconds)} left)
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className={`bg-steel-800 ${
        recorderState === 'discard-confirm' ? '' : 'py-6 px-8 flex items-center justify-between'
      }`}>
        {renderControlsContent()}

        {/* "Requesting camera access..." label below button in requesting-permission state */}
        {recorderState === 'requesting-permission' && (
          <p className="sr-only">Requesting camera access...</p>
        )}
      </div>

      {/* Internal toast */}
      {internalToast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-steel-800 border border-steel-700 rounded-lg shadow-xl text-sm text-steel-100 max-w-sm">
          {internalToast}
        </div>
      )}
    </div>
  )
}
