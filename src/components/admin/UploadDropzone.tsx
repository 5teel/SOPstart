'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload,
  FileText,
  Image as ImageIcon,
  X,
  CheckCircle,
  Loader2,
  ScanLine,
  TableProperties,
  FileType2,
  Video,
  Smartphone,
  Film,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createUploadSession, createVideoUploadSession } from '@/actions/sops'
import { tusUpload, TUS_THRESHOLD } from '@/lib/upload/tus-upload'
import { ACCEPT_ATTR, INTAKE_HINT, validateIntakeFile } from '@/lib/upload/file-intake'
import { startVideoSopUpload } from '@/lib/upload/start-video-sop-upload'
import { TusUploadProgress } from './TusUploadProgress'
import { VideoRecorder } from './VideoRecorder'
import { VideoFormatSelectionModal } from './VideoFormatSelectionModal'

type FileStatus = 'queued' | 'uploading' | 'uploaded' | 'error'

interface QueuedFile {
  id: string
  file: File
  status: FileStatus
  error?: string
  tusProgress?: number   // 0-100, only set for TUS uploads
  useTus?: boolean       // true if file > TUS_THRESHOLD
  isVideo?: boolean      // true for video/mp4, video/quicktime
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType === 'video/mp4' || mimeType === 'video/quicktime') {
    return <Video size={20} className="text-purple-400 shrink-0" />
  }
  if (mimeType === 'application/pdf') {
    return <FileText className="w-5 h-5 text-red-400 shrink-0" />
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return <FileText className="w-5 h-5 text-blue-400 shrink-0" />
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return <TableProperties className="w-5 h-5 text-blue-400 shrink-0" />
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation') {
    return <ScanLine className="w-5 h-5 text-orange-400 shrink-0" />
  }
  if (mimeType === 'text/plain') {
    return <FileType2 className="w-5 h-5 text-[var(--ink-500)] shrink-0" />
  }
  return <ImageIcon className="w-5 h-5 text-green-400 shrink-0" />
}

export function UploadDropzone() {
  const router = useRouter()
  const [dragOver, setDragOver] = useState(false)
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [uploadedSopIds, setUploadedSopIds] = useState<string[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [mode, setMode] = useState<'upload' | 'youtube' | 'record'>('upload')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [termsChecked, setTermsChecked] = useState(false)
  const [youtubeError, setYoutubeError] = useState<string | null>(null)
  const [youtubeFetching, setYoutubeFetching] = useState(false)
  const [recorderOpen, setRecorderOpen] = useState(false)
  const [mediaRecorderSupported, setMediaRecorderSupported] = useState<boolean | null>(null)
  const [pipelineModalOpen, setPipelineModalOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  // ---------------------------------------------------------------------------
  // MediaRecorder capability detection (D-05)
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const supported = typeof window !== 'undefined'
      && typeof window.MediaRecorder !== 'undefined'
      && MediaRecorder.isTypeSupported('video/webm')
    setMediaRecorderSupported(supported)
  }, [])

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 4000)
  }, [])

  const validateAndAddFiles = useCallback(async (files: File[]) => {
    const newItems: QueuedFile[] = []
    for (const file of files) {
      const result = await validateIntakeFile(file)
      if (!result.ok) {
        showToast(result.message)
        continue
      }

      newItems.push({
        id: `${result.file.name}-${result.file.size}-${Date.now()}-${Math.random()}`,
        file: result.file,
        status: 'queued',
        useTus: result.file.size > TUS_THRESHOLD,
        isVideo: result.isVideo,
      })
    }
    if (newItems.length > 0) {
      setSuccess(false)
      setQueue(prev => [...prev, ...newItems])
    }
  }, [showToast])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    validateAndAddFiles(Array.from(e.dataTransfer.files))
  }, [validateAndAddFiles])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files)
      validateAndAddFiles(files)
      // If picking from the iOS fallback video input, switch to upload tab so queue is visible
      if (e.target === videoInputRef.current && mode === 'record') {
        setMode('upload')
      }
      e.target.value = ''
    }
  }, [validateAndAddFiles, mode])

  const removeFile = useCallback((id: string) => {
    setQueue(prev => prev.filter(f => f.id !== id))
  }, [])

  async function handleYoutubeSubmit() {
    setYoutubeError(null)

    if (!youtubeUrl.trim()) {
      setYoutubeError('Please enter a YouTube URL')
      return
    }
    if (!termsChecked) {
      setYoutubeError('Please confirm rights before proceeding.')
      return
    }

    // Client-side URL validation
    try {
      const u = new URL(youtubeUrl)
      const validHosts = ['www.youtube.com', 'youtube.com', 'youtu.be', 'm.youtube.com']
      if (!validHosts.includes(u.hostname)) {
        setYoutubeError('Only YouTube URLs are supported. Upload the video file directly, or paste a YouTube link.')
        return
      }
    } catch {
      setYoutubeError("That doesn't look like a YouTube URL. Check the link and try again.")
      return
    }

    setYoutubeFetching(true)
    try {
      const res = await fetch('/api/sops/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: youtubeUrl,
          termsAccepted: termsChecked,
        }),
      })
      const data = await res.json()

      if (data.noCaption) {
        setYoutubeError(data.message)
        return
      }

      if (data.error) {
        setYoutubeError(data.error)
        return
      }

      if (data.sopId) {
        // Navigate to builder (review folded into builder — Phase 21.5)
        window.location.href = `/admin/sops/builder/${data.sopId}`
      }
    } catch {
      setYoutubeError('Network error — please try again.')
    } finally {
      setYoutubeFetching(false)
    }
  }

  const handleUpload = useCallback(async () => {
    const pendingFiles = queue.filter(f => f.status === 'queued')
    if (pendingFiles.length === 0) return

    setUploading(true)

    const supabase = createClient()

    for (const item of pendingFiles) {
      // Mark as uploading
      setQueue(prev => prev.map(f =>
        f.id === item.id ? { ...f, status: 'uploading' as FileStatus } : f
      ))

      if (item.isVideo) {
        // Video upload: extract audio client-side, then TUS upload to sop-videos bucket
        setQueue(prev => prev.map(f =>
          f.id === item.id ? { ...f, tusProgress: 0 } : f
        ))

        // Get video upload session (sopId + storage path + token)
        const sessionResult = await createVideoUploadSession({
          name: item.file.name,
          size: String(item.file.size),
          type: item.file.type,
        })

        if ('error' in sessionResult) {
          setQueue(prev => prev.map(f =>
            f.id === item.id ? { ...f, status: 'error' as FileStatus, error: sessionResult.error } : f
          ))
          continue
        }

        const result = await startVideoSopUpload({
          file: item.file,
          session: sessionResult,
          onProgress: (pct) => {
            setQueue(prev => prev.map(f =>
              f.id === item.id ? { ...f, tusProgress: pct } : f
            ))
          },
        })

        setQueue(prev => prev.map(f =>
          f.id === item.id
            ? result.ok
              ? { ...f, status: 'uploaded' as FileStatus }
              : { ...f, status: 'error' as FileStatus, error: result.error || 'Upload failed' }
            : f
        ))
        // The success panel renders on `uploadedSopIds.length > 0`; both
        // document branches below feed it, and the video branch didn't —
        // so a video-only upload finished at 100% with no confirmation and
        // no link to the draft.
        if (result.ok) setUploadedSopIds(prev => [...prev, sessionResult.sopId])
        continue
      }

      // Non-video: batch via createUploadSession
      const fileMeta = [{ name: item.file.name, size: item.file.size, type: item.file.type }]
      const result = await createUploadSession(fileMeta)

      if ('error' in result) {
        setQueue(prev => prev.map(f =>
          f.id === item.id ? { ...f, status: 'error' as FileStatus, error: result.error } : f
        ))
        continue
      }

      const session = result.sessions[0]
      if (!session) continue

      if (item.useTus) {
        // Large file: use TUS resumable upload
        const { data: { session: authSession } } = await supabase.auth.getSession()
        if (!authSession) {
          setQueue(prev => prev.map(f =>
            f.id === item.id ? { ...f, status: 'error' as FileStatus, error: 'Not authenticated' } : f
          ))
          continue
        }

        await new Promise<void>((resolve) => {
          const upload = tusUpload({
            file: item.file,
            storagePath: session.path,
            accessToken: authSession.access_token,
            onProgress: (pct) => {
              setQueue(prev => prev.map(f =>
                f.id === item.id ? { ...f, tusProgress: pct } : f
              ))
            },
            onSuccess: () => {
              // Trigger async parse
              fetch('/api/sops/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sopId: session.sopId }),
              }).catch(console.error)

              setQueue(prev => prev.map(f =>
                f.id === item.id ? { ...f, status: 'uploaded' as FileStatus } : f
              ))
              setUploadedSopIds(prev => [...prev, session.sopId])
              resolve()
            },
            onError: (err) => {
              setQueue(prev => prev.map(f =>
                f.id === item.id ? { ...f, status: 'error' as FileStatus, error: err.message || 'Upload failed' } : f
              ))
              resolve()
            },
          })
          upload.start()
        })
      } else {
        // Small file: use presigned URL upload
        const { error: uploadError } = await supabase.storage
          .from('sop-documents')
          .uploadToSignedUrl(session.path, session.token, item.file, {
            contentType: item.file.type,
          })

        if (uploadError) {
          setQueue(prev => prev.map(f =>
            f.id === item.id ? { ...f, status: 'error' as FileStatus, error: 'Upload failed' } : f
          ))
          continue
        }

        // Trigger async parse — call API directly from client
        // (server action fire-and-forget fetch gets aborted by Next.js)
        fetch('/api/sops/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sopId: session.sopId }),
        }).catch(console.error)

        // Mark as uploaded
        setQueue(prev => prev.map(f =>
          f.id === item.id ? { ...f, status: 'uploaded' as FileStatus } : f
        ))
        setUploadedSopIds(prev => [...prev, session.sopId])
      }
    }

    setUploading(false)
    setSuccess(true)
  }, [queue])

  const hasFiles = queue.length > 0
  const queuedCount = queue.filter(f => f.status === 'queued').length
  const hasErrors = queue.some(f => f.status === 'error')

  return (
    <div>
      {/* Mode tab bar */}
      <div role="tablist" className="flex gap-6 mb-4 border-b border-[var(--ink-100)]">
        <button
          role="tab"
          aria-selected={mode === 'upload'}
          onClick={() => setMode('upload')}
          className={`pb-3 text-sm font-semibold cursor-pointer ${
            mode === 'upload'
              ? 'text-[var(--ink-900)] border-b-2 border-[var(--ink-900)] -mb-px'
              : 'text-[var(--ink-500)]'
          }`}
        >
          Upload file
        </button>
        <button
          role="tab"
          aria-selected={mode === 'youtube'}
          onClick={() => setMode('youtube')}
          className={`pb-3 text-sm font-semibold cursor-pointer ${
            mode === 'youtube'
              ? 'text-[var(--ink-900)] border-b-2 border-[var(--ink-900)] -mb-px'
              : 'text-[var(--ink-500)]'
          }`}
        >
          YouTube URL
        </button>
        <button
          role="tab"
          aria-selected={mode === 'record'}
          onClick={() => setMode('record')}
          className={`pb-3 text-sm font-semibold cursor-pointer ${
            mode === 'record'
              ? 'text-[var(--ink-900)] border-b-2 border-[var(--ink-900)] -mb-px'
              : 'text-[var(--ink-500)]'
          }`}
        >
          Record video
        </button>
      </div>

      {mode === 'youtube' ? (
        /* YouTube URL tab panel */
        <div role="tabpanel" className="flex flex-col gap-3 py-4">
          <input
            type="url"
            placeholder="Paste YouTube URL..."
            value={youtubeUrl}
            onChange={(e) => { setYoutubeUrl(e.target.value); setYoutubeError(null) }}
            className="w-full bg-white border border-[var(--ink-100)] rounded-lg px-4 h-[52px] text-sm text-[var(--ink-900)] placeholder:text-[var(--ink-500)] focus:border-[var(--ink-900)] focus:outline-none"
          />
          {youtubeError && (
            <p role="alert" className="text-xs text-red-400">{youtubeError}</p>
          )}

          <label className="flex items-start gap-3 text-sm text-[var(--ink-500)] py-3 cursor-pointer">
            <input
              type="checkbox"
              checked={termsChecked}
              onChange={(e) => setTermsChecked(e.target.checked)}
              className="w-5 h-5 accent-[var(--ink-900)] mt-0.5"
              required
              aria-required="true"
            />
            I confirm I have rights to use this content for SOP creation.
          </label>

          <button
            onClick={handleYoutubeSubmit}
            disabled={!youtubeUrl || !termsChecked || youtubeFetching}
            className="h-[72px] w-full rounded-lg bg-[var(--ink-900)] text-white text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--ink-700)] transition-colors"
          >
            {youtubeFetching ? 'Fetching captions...' : 'Transcribe from YouTube'}
          </button>
        </div>
      ) : mode === 'record' ? (
        /* Record video tab panel */
        <div role="tabpanel" className="py-4">
          {mediaRecorderSupported === null ? (
            /* Detection in progress — effectively instant, show nothing */
            null
          ) : mediaRecorderSupported ? (
            /* Capable device — show Start recording button */
            <>
              <button
                type="button"
                onClick={() => setRecorderOpen(true)}
                className="h-[72px] w-full bg-white border border-[var(--ink-100)] border-dashed rounded-xl text-[var(--ink-900)] font-semibold text-base flex items-center justify-center gap-3 hover:bg-[var(--paper-2)] transition-colors"
              >
                <Video className="w-6 h-6" />
                Start recording
              </button>
              <p className="text-xs text-[var(--ink-500)] text-center mt-2">
                Records up to 15 minutes. Audio only is uploaded — video stays on your device.
              </p>
            </>
          ) : (
            /* iOS / unsupported device fallback (D-04, D-05) */
            <div
              role="status"
              className="flex flex-col items-center text-center p-6 bg-[var(--accent-voice)]/20 border border-[var(--accent-voice)]/50 rounded-xl"
            >
              <Smartphone className="w-8 h-8 text-[var(--accent-voice)] mx-auto mb-3" />
              <p className="text-sm font-semibold text-[var(--accent-voice)] text-center">
                Recording isn&apos;t supported on this device yet.
              </p>
              <p className="text-sm text-[var(--ink-500)] text-center mt-1 leading-relaxed">
                Use your camera app to record the procedure, then upload the file here.
              </p>
              <button
                type="button"
                aria-label="Choose a video file from your device"
                onClick={() => videoInputRef.current?.click()}
                className="h-[72px] w-full bg-[var(--ink-900)] text-white font-semibold text-lg rounded-lg hover:bg-[var(--ink-700)] transition-colors mt-4"
              >
                Choose video file
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Upload file tab panel */
        <>
          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={[
              'border-2 border-dashed rounded-xl transition-colors',
              hasFiles ? 'min-h-[120px]' : 'min-h-[200px]',
              'flex flex-col items-center justify-center gap-4 p-8 text-center',
              dragOver
                ? 'border-[var(--ink-900)] bg-[var(--ink-900)]/10'
                : 'border-[var(--ink-100)] bg-white',
            ].join(' ')}
          >
            {dragOver ? (
              <>
                <Upload className="w-8 h-8 text-[var(--ink-900)]" />
                <p className="text-lg font-semibold text-[var(--ink-900)]">Drop it -- we&apos;ll handle the rest</p>
              </>
            ) : hasFiles ? (
              <p className="text-sm text-[var(--ink-500)] font-medium">+ Add more files</p>
            ) : (
              <>
                <Upload className="w-10 h-10 text-[var(--ink-500)]" />
                <div>
                  <p className="text-base font-semibold text-[var(--ink-900)]">Drop your SOPs here</p>
                  <p className="text-sm text-[var(--ink-500)] mt-1">{INTAKE_HINT}</p>
                </div>
              </>
            )}

            <div className="flex gap-3 flex-wrap justify-center">
              {/* Browse files button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-[var(--ink-900)] text-white font-semibold px-6 h-[72px] rounded-lg hover:bg-[var(--ink-700)] active:bg-[var(--ink-700)] transition-colors"
              >
                Browse files
              </button>

              {/* Take a photo button */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="bg-[var(--paper-2)] text-[var(--ink-900)] font-semibold px-6 h-[72px] rounded-lg hover:bg-[var(--ink-300)] active:bg-[var(--ink-500)] transition-colors"
              >
                Take a photo
              </button>

              {/* Scan document button */}
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="bg-[var(--paper-2)] text-[var(--ink-900)] font-semibold px-6 h-[72px] rounded-lg hover:bg-[var(--ink-300)] active:bg-[var(--ink-500)] transition-colors flex items-center gap-2"
              >
                <ScanLine className="w-5 h-5" />
                Scan document
              </button>

              {/* Browse video button */}
              <button
                type="button"
                onClick={() => videoInputRef.current?.click()}
                className="bg-[var(--paper-2)] text-[var(--ink-900)] font-semibold px-6 h-[72px] rounded-lg hover:bg-[var(--ink-300)] active:bg-[var(--ink-500)] transition-colors flex items-center gap-2"
              >
                <Video size={20} />
                Browse video
              </button>

              {/* Generate video SOP button (Phase 9 pipeline entry) */}
              <button
                type="button"
                onClick={() => setPipelineModalOpen(true)}
                className="bg-[var(--paper-2)] text-[var(--ink-900)] font-semibold px-6 h-[72px] rounded-lg hover:bg-[var(--ink-300)] active:bg-[var(--ink-500)] transition-colors flex items-center gap-2"
              >
                <Film size={20} />
                Generate video SOP
              </button>
            </div>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={ACCEPT_ATTR}
              multiple
              onChange={handleFileInput}
            />
            <input
              ref={cameraInputRef}
              type="file"
              className="hidden"
              accept="image/*"
              capture="environment"
              onChange={handleFileInput}
            />
            <input
              ref={videoInputRef}
              type="file"
              className="hidden"
              accept={ACCEPT_ATTR}
              onChange={handleFileInput}
            />
          </div>

          {/* Upload queue */}
          {queue.length > 0 && (
            <ul className="mt-4 space-y-2">
              {queue.map(item => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-white rounded-lg min-h-[72px] border border-[var(--ink-100)]"
                >
                  <FileIcon mimeType={item.file.type} />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--ink-900)] truncate">{item.file.name}</p>
                    <p className="text-xs text-[var(--ink-500)]">{formatFileSize(item.file.size)}</p>
                    {item.error && (
                      <p className="text-xs text-red-400 mt-0.5">{item.error}</p>
                    )}
                  </div>

                  {/* Status indicator */}
                  {item.status === 'queued' && (
                    <button
                      type="button"
                      onClick={() => removeFile(item.id)}
                      className="shrink-0 text-[var(--ink-500)] hover:text-red-400 transition-colors p-1"
                      aria-label="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {item.status === 'uploading' && (item.useTus || item.isVideo) && item.tusProgress !== undefined ? (
                    <TusUploadProgress percentage={item.tusProgress} />
                  ) : item.status === 'uploading' ? (
                    <Loader2 className="w-5 h-5 text-blue-400 animate-spin shrink-0" />
                  ) : null}
                  {item.status === 'uploaded' && (
                    <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                  )}
                  {item.status === 'error' && (
                    <X className="w-5 h-5 text-red-400 shrink-0" />
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Upload button */}
          {queuedCount > 0 && (
            <button
              type="button"
              onClick={handleUpload}
              disabled={uploading || hasErrors}
              className="w-full h-[72px] bg-[var(--ink-900)] text-white font-bold text-lg rounded-lg hover:bg-[var(--ink-700)] active:bg-[var(--ink-700)] transition-colors mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading
                ? 'Uploading...'
                : `Upload ${queuedCount} ${queuedCount === 1 ? 'file' : 'files'}`}
            </button>
          )}

          {/* Success banner */}
          {success && uploadedSopIds.length > 0 && (
            <div className="mt-4 bg-green-500/20 border border-green-500/40 rounded-lg px-4 py-4">
              <p className="text-green-400 text-sm mb-3">
                {uploadedSopIds.length === 1
                  ? 'File uploaded — AI parsing is running now.'
                  : `${uploadedSopIds.length} files uploaded — AI parsing continues in the background. You can leave this page; drafts appear in the library as they finish.`}
              </p>
              <div className="flex gap-2">
                {uploadedSopIds.length === 1 ? (
                  <button
                    type="button"
                    onClick={() => router.push(`/admin/sops/builder/${uploadedSopIds[0]}`)}
                    className="flex-1 min-h-[44px] px-4 bg-[var(--ink-900)] text-white font-semibold rounded-lg hover:bg-[var(--ink-700)] active:bg-[var(--ink-700)] transition-colors"
                  >
                    Review parsed SOP
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push('/admin/sops?status=draft')}
                    className="flex-1 min-h-[44px] px-4 bg-[var(--ink-900)] text-white font-semibold rounded-lg hover:bg-[var(--ink-700)] active:bg-[var(--ink-700)] transition-colors"
                  >
                    Review drafts
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSuccess(false)
                    setQueue([])
                    setUploadedSopIds([])
                  }}
                  className="min-h-[44px] px-4 bg-[var(--paper-2)] text-[var(--ink-900)] rounded-lg hover:bg-[var(--ink-300)] transition-colors"
                >
                  Upload more
                </button>
              </div>
            </div>
          )}

          {/* Scan document placeholder modal */}
          {scannerOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
              <div className="bg-[var(--paper)] rounded-2xl p-8 max-w-lg text-center">
                <p className="text-[var(--ink-900)]">Scanner coming soon</p>
                <button onClick={() => setScannerOpen(false)} className="mt-4 px-4 py-2 bg-[var(--paper-2)] text-[var(--ink-900)] rounded-lg">Close</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-white border border-[var(--ink-100)] rounded-lg shadow-xl text-sm text-[var(--ink-900)] max-w-sm">
          {toast}
        </div>
      )}

      {/* VideoRecorder overlay */}
      {recorderOpen && (
        <VideoRecorder
          open={recorderOpen}
          onClose={() => setRecorderOpen(false)}
          onSubmitComplete={(sopId) => {
            setRecorderOpen(false)
            window.location.href = `/admin/sops/builder/${sopId}`
          }}
        />
      )}

      {/* Video SOP pipeline entry modal (Phase 9) */}
      <VideoFormatSelectionModal
        open={pipelineModalOpen}
        onClose={() => setPipelineModalOpen(false)}
      />
    </div>
  )
}
