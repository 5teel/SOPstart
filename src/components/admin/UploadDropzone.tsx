'use client'

import { useRef, useState, useCallback } from 'react'
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
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createUploadSession } from '@/actions/sops'
import { tusUpload, TUS_THRESHOLD } from '@/lib/upload/tus-upload'
import { TusUploadProgress } from './TusUploadProgress'

const ACCEPTED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'text/plain',                                                               // .txt
  'image/heic',                                                               // iPhone HEIC
  'image/heif',                                                               // HEIF variant
]

const BLOCKED_EXTENSIONS = ['.xlsm', '.xlsb', '.xltm', '.pptm', '.potm', '.ppam']

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

type FileStatus = 'queued' | 'uploading' | 'uploaded' | 'error'

interface QueuedFile {
  id: string
  file: File
  status: FileStatus
  error?: string
  tusProgress?: number   // 0-100, only set for TUS uploads
  useTus?: boolean       // true if file > TUS_THRESHOLD
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FileIcon({ mimeType }: { mimeType: string }) {
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
    return <FileType2 className="w-5 h-5 text-steel-400 shrink-0" />
  }
  return <ImageIcon className="w-5 h-5 text-green-400 shrink-0" />
}

export function UploadDropzone() {
  const [dragOver, setDragOver] = useState(false)
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 4000)
  }, [])

  const validateAndAddFiles = useCallback(async (files: File[]) => {
    const newItems: QueuedFile[] = []
    for (const file of files) {
      // Check blocked macro-enabled extensions first
      const lowerName = file.name.toLowerCase()
      if (BLOCKED_EXTENSIONS.some(ext => lowerName.endsWith(ext))) {
        showToast(`${file.name} is not supported -- macro-enabled Office files are blocked for security. Save as .xlsx or .pptx and try again.`)
        continue
      }

      if (file.size > MAX_FILE_SIZE) {
        showToast(`${file.name} is over 50MB and cannot be uploaded.`)
        continue
      }

      // Handle HEIC/HEIF conversion
      if (file.type === 'image/heic' || file.type === 'image/heif') {
        try {
          const heic2any = (await import('heic2any')).default
          const blob = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 }) as Blob
          const jpgName = file.name.replace(/\.(heic|heif)$/i, '.jpg')
          const convertedFile = new File([blob], jpgName, { type: 'image/jpeg' })
          newItems.push({
            id: `${convertedFile.name}-${convertedFile.size}-${Date.now()}-${Math.random()}`,
            file: convertedFile,
            status: 'queued',
            useTus: convertedFile.size > TUS_THRESHOLD,
          })
          continue
        } catch {
          showToast(`Failed to convert ${file.name}. Please try a different format.`)
          continue
        }
      }

      if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
        showToast(`${file.name} is not a supported format. Use Word, PDF, Excel (.xlsx), PowerPoint (.pptx), plain text (.txt), or a photo.`)
        continue
      }

      newItems.push({
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        status: 'queued',
        useTus: file.size > TUS_THRESHOLD,
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
      validateAndAddFiles(Array.from(e.target.files))
      e.target.value = ''
    }
  }, [validateAndAddFiles])

  const removeFile = useCallback((id: string) => {
    setQueue(prev => prev.filter(f => f.id !== id))
  }, [])

  const handleUpload = useCallback(async () => {
    const pendingFiles = queue.filter(f => f.status === 'queued')
    if (pendingFiles.length === 0) return

    setUploading(true)

    const fileMeta = pendingFiles.map(f => ({
      name: f.file.name,
      size: f.file.size,
      type: f.file.type,
    }))

    const result = await createUploadSession(fileMeta)

    if ('error' in result) {
      showToast(result.error)
      setUploading(false)
      return
    }

    const supabase = createClient()

    for (let i = 0; i < pendingFiles.length; i++) {
      const item = pendingFiles[i]
      const session = result.sessions[i]

      if (!session) continue

      // Mark as uploading
      setQueue(prev => prev.map(f =>
        f.id === item.id ? { ...f, status: 'uploading' as FileStatus } : f
      ))

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
        // Small file: use existing presigned URL upload
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
      }
    }

    setUploading(false)
    setSuccess(true)
  }, [queue, showToast])

  const hasFiles = queue.length > 0
  const queuedCount = queue.filter(f => f.status === 'queued').length
  const hasErrors = queue.some(f => f.status === 'error')

  return (
    <div>
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
            ? 'border-brand-yellow bg-brand-yellow/10'
            : 'border-steel-700 bg-steel-800',
        ].join(' ')}
      >
        {dragOver ? (
          <>
            <Upload className="w-8 h-8 text-brand-yellow" />
            <p className="text-lg font-semibold text-brand-yellow">Drop it -- we&apos;ll handle the rest</p>
          </>
        ) : hasFiles ? (
          <p className="text-sm text-steel-400 font-medium">+ Add more files</p>
        ) : (
          <>
            <Upload className="w-10 h-10 text-steel-400" />
            <div>
              <p className="text-base font-semibold text-steel-100">Drop your SOPs here</p>
              <p className="text-sm text-steel-400 mt-1">Word (.docx), PDF, Excel (.xlsx), PowerPoint (.pptx), plain text (.txt), or photos up to 50MB</p>
            </div>
          </>
        )}

        <div className="flex gap-3 flex-wrap justify-center">
          {/* Browse files button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-brand-yellow text-steel-900 font-semibold px-6 h-[72px] rounded-lg hover:bg-amber-400 active:bg-amber-500 transition-colors"
          >
            Browse files
          </button>

          {/* Take a photo button */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="bg-steel-700 text-steel-100 font-semibold px-6 h-[72px] rounded-lg hover:bg-steel-600 active:bg-steel-500 transition-colors"
          >
            Take a photo
          </button>

          {/* Scan document button */}
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="bg-steel-700 text-steel-100 font-semibold px-6 h-[72px] rounded-lg hover:bg-steel-600 active:bg-steel-500 transition-colors flex items-center gap-2"
          >
            <ScanLine className="w-5 h-5" />
            Scan document
          </button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".docx,.pdf,.xlsx,.pptx,.txt,image/jpeg,image/png,image/heic,image/heif"
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
      </div>

      {/* Upload queue */}
      {queue.length > 0 && (
        <ul className="mt-4 space-y-2">
          {queue.map(item => (
            <li
              key={item.id}
              className="flex items-center gap-3 p-3 bg-steel-800 rounded-lg min-h-[72px] border border-steel-700"
            >
              <FileIcon mimeType={item.file.type} />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-steel-100 truncate">{item.file.name}</p>
                <p className="text-xs text-steel-400">{formatFileSize(item.file.size)}</p>
                {item.error && (
                  <p className="text-xs text-red-400 mt-0.5">{item.error}</p>
                )}
              </div>

              {/* Status indicator */}
              {item.status === 'queued' && (
                <button
                  type="button"
                  onClick={() => removeFile(item.id)}
                  className="shrink-0 text-steel-400 hover:text-red-400 transition-colors p-1"
                  aria-label="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              {item.status === 'uploading' && item.useTus && item.tusProgress !== undefined ? (
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
          className="w-full h-[72px] bg-brand-yellow text-steel-900 font-bold text-lg rounded-lg hover:bg-amber-400 active:bg-amber-500 transition-colors mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading
            ? 'Uploading...'
            : `Upload ${queuedCount} ${queuedCount === 1 ? 'file' : 'files'}`}
        </button>
      )}

      {/* Success banner */}
      {success && (
        <div className="mt-4 bg-green-500/20 border border-green-500/40 text-green-400 rounded-lg px-4 py-3 text-sm">
          Files uploaded successfully. Parsing will begin shortly.
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 bg-steel-800 border border-steel-700 rounded-lg shadow-xl text-sm text-steel-100 max-w-sm">
          {toast}
        </div>
      )}

      {/* Scan document placeholder modal (Plan 03 implements the real scanner) */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-steel-900 rounded-2xl p-8 max-w-lg text-center">
            <p className="text-steel-100">Scanner coming soon</p>
            <button onClick={() => setScannerOpen(false)} className="mt-4 px-4 py-2 bg-steel-700 text-steel-100 rounded-lg">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
