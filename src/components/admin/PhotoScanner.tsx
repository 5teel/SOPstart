'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { X, GripVertical, Plus } from 'lucide-react'
import { checkImageQuality } from '@/lib/image/quality-checks'
import { detectPageNumber } from '@/lib/image/page-order-detect'
import { ImageQualityOverlay } from './ImageQualityOverlay'
import type { QualityResult } from '@/lib/image/quality-checks'

// ---------------------------------------------------------------------------
// IndexedDB persistence via idb-keyval (already installed)
// ---------------------------------------------------------------------------
async function getIdbKeyval() {
  return import('idb-keyval')
}

interface ScannedPage {
  id: string
  blob: Blob
  thumbnailUrl: string
  quality: QualityResult | null
  detectedPageNumber: number | null
}

interface PhotoScannerProps {
  open: boolean
  onClose: () => void
  onSubmit: (files: File[]) => void
}

// Unique session key per scanner mount so concurrent sessions don't collide
const SESSION_KEY = 'scanner-session-v1'

export function PhotoScanner({ open, onClose, onSubmit }: PhotoScannerProps) {
  const [pages, setPages] = useState<ScannedPage[]>([])
  const [currentCapture, setCurrentCapture] = useState<Blob | null>(null)
  const [currentThumbnail, setCurrentThumbnail] = useState<string | null>(null)
  const [qualityState, setQualityState] = useState<'idle' | 'checking' | 'pass' | 'warn'>('idle')
  const [qualityMessage, setQualityMessage] = useState<string>('')
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const scanButtonRef = useRef<HTMLButtonElement | null>(null)
  const sessionRestoredRef = useRef(false)

  // ---------------------------------------------------------------------------
  // Restore session from IndexedDB on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!open || sessionRestoredRef.current) return
    sessionRestoredRef.current = true

    getIdbKeyval().then(async ({ get }) => {
      try {
        const saved = await get(SESSION_KEY) as ScannedPage[] | undefined
        if (saved && saved.length > 0) {
          // Rebuild thumbnail URLs from saved blobs
          const restored: ScannedPage[] = saved.map((p) => ({
            ...p,
            thumbnailUrl: URL.createObjectURL(p.blob),
          }))
          setPages(restored)
        }
      } catch {
        // Session restore failed — start fresh
      }
    })
  }, [open])

  // ---------------------------------------------------------------------------
  // Persist pages to IndexedDB whenever they change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!open) return
    getIdbKeyval().then(async ({ set }) => {
      try {
        // Don't store thumbnailUrl (object URLs don't survive) — store blob + metadata
        const toStore: Omit<ScannedPage, 'thumbnailUrl'>[] = pages.map(({ thumbnailUrl: _url, ...rest }) => rest)
        await set(SESSION_KEY, toStore)
      } catch {
        // Best-effort — ignore persistence errors
      }
    })
  }, [pages, open])

  // ---------------------------------------------------------------------------
  // Clear session on unmount (done/discard)
  // ---------------------------------------------------------------------------
  const clearSession = useCallback(async () => {
    getIdbKeyval().then(async ({ del }) => {
      try {
        await del(SESSION_KEY)
      } catch {
        // ignore
      }
    })
  }, [])

  // ---------------------------------------------------------------------------
  // Focus trap
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!open) return
    const modal = modalRef.current
    if (!modal) return

    const focusable = modal.querySelectorAll<HTMLElement>(
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
    // Focus close button on open
    setTimeout(() => closeButtonRef.current?.focus(), 50)

    return () => document.removeEventListener('keydown', handleKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pages.length])

  // ---------------------------------------------------------------------------
  // Camera capture handling
  // ---------------------------------------------------------------------------
  const handleCapture = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const blob = new Blob([await file.arrayBuffer()], { type: file.type })
    const thumbnailUrl = URL.createObjectURL(blob)

    setCurrentCapture(blob)
    setCurrentThumbnail(thumbnailUrl)
    setQualityState('checking')
    setQualityMessage('')

    // Run quality check
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = reject
        el.src = thumbnailUrl
      })

      const result = await checkImageQuality(img)

      if (result.status === 'warn') {
        setQualityState('warn')
        setQualityMessage(result.issues.join('; '))
      } else {
        setQualityState('pass')
        setQualityMessage('')
      }
    } catch {
      // Quality check failed — treat as pass so user isn't blocked
      setQualityState('pass')
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Add page to strip
  // ---------------------------------------------------------------------------
  const handleAddPage = useCallback(async () => {
    if (!currentCapture || !currentThumbnail) return

    const id = `page-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const newPage: ScannedPage = {
      id,
      blob: currentCapture,
      thumbnailUrl: currentThumbnail,
      quality: null,
      detectedPageNumber: null,
    }

    setPages(prev => [...prev, newPage])
    setCurrentCapture(null)
    setCurrentThumbnail(null)
    setQualityState('idle')
    setQualityMessage('')

    // Run page number detection in background (non-blocking)
    detectPageNumber(currentCapture).then((num) => {
      if (num !== null) {
        setPages(prev => prev.map(p => p.id === id ? { ...p, detectedPageNumber: num } : p))
      }
    }).catch(() => {})

    // Re-open camera for next page
    setTimeout(() => cameraInputRef.current?.click(), 100)
  }, [currentCapture, currentThumbnail])

  // ---------------------------------------------------------------------------
  // Retake photo
  // ---------------------------------------------------------------------------
  const handleRetake = useCallback(() => {
    if (currentThumbnail) URL.revokeObjectURL(currentThumbnail)
    setCurrentCapture(null)
    setCurrentThumbnail(null)
    setQualityState('idle')
    setQualityMessage('')
    cameraInputRef.current?.click()
  }, [currentThumbnail])

  // ---------------------------------------------------------------------------
  // Delete page from strip
  // ---------------------------------------------------------------------------
  const handleDeletePage = useCallback((id: string) => {
    setPages(prev => {
      const page = prev.find(p => p.id === id)
      if (page) URL.revokeObjectURL(page.thumbnailUrl)
      return prev.filter(p => p.id !== id)
    })
  }, [])

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  const handleSubmit = useCallback(() => {
    const files = pages.map((page, i) => {
      return new File([page.blob], `scanned-page-${i + 1}.jpg`, { type: 'image/jpeg' })
    })
    clearSession()
    // Revoke all thumbnail URLs
    pages.forEach(p => URL.revokeObjectURL(p.thumbnailUrl))
    onSubmit(files)
  }, [pages, clearSession, onSubmit])

  // ---------------------------------------------------------------------------
  // Close with discard confirmation
  // ---------------------------------------------------------------------------
  const handleClose = useCallback(() => {
    if (pages.length > 0 || currentCapture) {
      setShowDiscardConfirm(true)
    } else {
      onClose()
    }
  }, [pages.length, currentCapture, onClose])

  const handleDiscard = useCallback(() => {
    clearSession()
    pages.forEach(p => URL.revokeObjectURL(p.thumbnailUrl))
    if (currentThumbnail) URL.revokeObjectURL(currentThumbnail)
    setPages([])
    setCurrentCapture(null)
    setCurrentThumbnail(null)
    setQualityState('idle')
    setShowDiscardConfirm(false)
    sessionRestoredRef.current = false
    onClose()
  }, [clearSession, pages, currentThumbnail, onClose])

  // ---------------------------------------------------------------------------
  // Drag-to-reorder (horizontal)
  // ---------------------------------------------------------------------------
  const dragSourceIndex = useRef<number | null>(null)

  const handleDragStart = useCallback((index: number) => {
    dragSourceIndex.current = index
    setDragIndex(index)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (dragSourceIndex.current === null || dragSourceIndex.current === index) return
    const from = dragSourceIndex.current
    setPages(prev => {
      const updated = [...prev]
      const [moved] = updated.splice(from, 1)
      updated.splice(index, 0, moved)
      return updated
    })
    dragSourceIndex.current = index
    setDragIndex(index)
  }, [])

  const handleDragEnd = useCallback(() => {
    dragSourceIndex.current = null
    setDragIndex(null)
  }, [])

  // ---------------------------------------------------------------------------
  // Keyboard reorder (ArrowLeft/ArrowRight)
  // ---------------------------------------------------------------------------
  const handleThumbnailKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      setPages(prev => {
        const updated = [...prev]
        ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
        return updated
      })
      setFocusedIndex(index - 1)
    } else if (e.key === 'ArrowRight' && index < pages.length - 1) {
      e.preventDefault()
      setPages(prev => {
        const updated = [...prev]
        ;[updated[index], updated[index + 1]] = [updated[index + 1], updated[index]]
        return updated
      })
      setFocusedIndex(index + 1)
    }
  }, [pages.length])

  const hasDetectedPageNumbers = pages.some(p => p.detectedPageNumber !== null)
  const pageCount = pages.length
  const inCapture = currentCapture !== null

  if (!open) return null

  const discardCount = pages.length + (currentCapture ? 1 : 0)

  return (
    <>
      {/* Backdrop (desktop only) */}
      <div
        className="fixed inset-0 z-50 flex items-start justify-center sm:items-center sm:bg-black/70"
        onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
      >
        {/* Modal */}
        <div
          ref={modalRef}
          className="fixed inset-0 z-50 flex flex-col bg-steel-900 sm:relative sm:inset-auto sm:w-full sm:max-w-lg sm:rounded-2xl sm:max-h-[90vh] sm:overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Scan document"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-steel-700">
            <span className="text-base font-semibold text-steel-100">Scan document</span>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={handleClose}
              className="h-[44px] w-[44px] flex items-center justify-center text-steel-400 hover:text-steel-100 transition-colors rounded-lg"
              aria-label="Close scanner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Viewfinder / Preview area */}
          <div className="flex-1 bg-black flex items-center justify-center min-h-[200px] overflow-hidden">
            {currentThumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentThumbnail}
                alt="Captured page preview"
                className="max-w-full max-h-full object-contain"
              />
            ) : pageCount === 0 ? (
              <p className="text-steel-600 text-sm">Tap &quot;Add page&quot; to capture your first page</p>
            ) : (
              // Show last page thumbnail in viewfinder when strip has pages and no current capture
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pages[pages.length - 1].thumbnailUrl}
                alt={`Last captured page`}
                className="max-w-full max-h-full object-contain opacity-50"
              />
            )}
          </div>

          {/* Quality overlay */}
          <ImageQualityOverlay state={qualityState} message={qualityMessage || undefined} />

          {/* Thumbnail strip */}
          <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-steel-700 min-h-[88px] items-center">
            {pages.map((page, index) => (
              <div
                key={page.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onKeyDown={(e) => handleThumbnailKeyDown(e, index)}
                tabIndex={0}
                role="img"
                aria-label={`Page ${index + 1}${page.detectedPageNumber ? ` (detected: page ${page.detectedPageNumber})` : ''}`}
                className={[
                  'relative shrink-0 w-[56px] h-[72px] rounded-lg overflow-hidden cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-brand-yellow',
                  dragIndex === index ? 'opacity-60 scale-95' : '',
                  focusedIndex === index ? 'ring-2 ring-brand-yellow' : 'border border-steel-700',
                ].join(' ')}
                style={{ border: focusedIndex === index ? undefined : '1px solid #374151' }}
              >
                {/* Grip handle */}
                <div className="absolute left-0 top-0 bottom-0 flex items-center px-0.5 text-steel-600 z-10">
                  <GripVertical className="w-3 h-3" />
                </div>
                {/* Thumbnail image */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.thumbnailUrl}
                  alt={`Page ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                {/* Page number badge */}
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center leading-4">
                  {index + 1}
                </div>
                {/* Delete button */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDeletePage(page.id) }}
                  className="absolute top-0.5 right-0.5 w-6 h-6 flex items-center justify-center bg-black/70 rounded-full text-white hover:bg-red-500/80 transition-colors z-20"
                  aria-label={`Remove page ${index + 1}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}

            {/* Add-page placeholder */}
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="shrink-0 w-[56px] h-[72px] rounded-lg border border-dashed border-steel-700 flex items-center justify-center text-steel-600 hover:text-steel-400 hover:border-steel-500 transition-colors"
              aria-label="Capture another page"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Page order hint */}
          {hasDetectedPageNumbers && (
            <p className="text-xs text-steel-400 px-4 pt-2 pb-0">Page order detected -- drag to reorder</p>
          )}

          {/* Action bar */}
          <div className="flex gap-3 px-4 py-4">
            {inCapture ? (
              <>
                {/* Retake */}
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex-1 h-[72px] bg-steel-700 text-steel-100 font-semibold rounded-xl hover:bg-steel-600 active:bg-steel-500 transition-colors"
                >
                  Retake photo
                </button>
                {/* Add page */}
                <button
                  type="button"
                  onClick={handleAddPage}
                  className="flex-1 h-[72px] bg-brand-yellow text-steel-900 font-semibold rounded-xl hover:bg-amber-400 active:bg-amber-500 transition-colors"
                >
                  Add page
                </button>
              </>
            ) : pageCount > 0 ? (
              <>
                {/* Done */}
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex-1 h-[72px] bg-brand-yellow text-steel-900 font-semibold rounded-xl hover:bg-amber-400 active:bg-amber-500 transition-colors"
                >
                  Done -- submit {pageCount} {pageCount === 1 ? 'page' : 'pages'}
                </button>
              </>
            ) : (
              <>
                {/* No pages yet — show capture button */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 h-[72px] bg-brand-yellow text-steel-900 font-semibold rounded-xl hover:bg-amber-400 active:bg-amber-500 transition-colors"
                >
                  Capture first page
                </button>
              </>
            )}
          </div>

          {/* Hidden camera input */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleCapture}
          />
        </div>
      </div>

      {/* Discard confirmation dialog */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
          <div className="bg-steel-800 rounded-2xl p-6 w-full max-w-sm border border-steel-700">
            <p className="text-base font-semibold text-steel-100 mb-4">
              Discard {discardCount} scanned {discardCount === 1 ? 'page' : 'pages'}?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="flex-1 h-[72px] bg-steel-700 text-steel-400 font-semibold rounded-xl hover:bg-steel-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDiscard}
                className="flex-1 h-[72px] bg-steel-700 text-red-400 font-semibold rounded-xl hover:bg-steel-600 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
