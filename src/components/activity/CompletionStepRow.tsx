'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { CheckCircle2 } from 'lucide-react'
import 'yet-another-react-lightbox/styles.css'
import type { LightboxExternalProps } from 'yet-another-react-lightbox'

const Lightbox = dynamic<LightboxExternalProps>(
  () => import('yet-another-react-lightbox'),
  { ssr: false }
)

interface Photo {
  id: string
  storagePath: string
  signedUrl: string
  contentType: string
}

export interface CompletionStepRowProps {
  stepNumber: number
  stepText: string
  completedAt: number | null
  photos: Photo[]
}

function formatTime(ms: number): string {
  const date = new Date(ms)
  return date.toLocaleTimeString('en-NZ', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function CompletionStepRow({
  stepNumber,
  stepText,
  completedAt,
  photos,
}: CompletionStepRowProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const slides = photos.map((p) => ({ src: p.signedUrl, alt: `Step ${stepNumber} photo` }))

  function openPhoto(index: number) {
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  return (
    <div className="flex flex-col gap-3 py-5 border-b border-[var(--ink-100)] last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 rounded-full bg-[var(--paper-2)] border border-[var(--ink-100)] flex items-center justify-center text-xs font-bold text-[var(--ink-700)] flex-shrink-0">
          {stepNumber}
        </div>
        <CheckCircle2 size={18} className="text-[var(--accent-signoff)] flex-shrink-0" />
        {completedAt !== null && (
          <span className="mono text-xs text-[var(--ink-500)] ml-auto tabular-nums">
            {formatTime(completedAt)}
          </span>
        )}
      </div>

      <p className="text-base text-[var(--ink-900)] leading-relaxed ml-9">
        {stepText}
      </p>

      {photos.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap ml-9 mt-1">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => openPhoto(index)}
              className="w-[80px] h-[80px] rounded-lg overflow-hidden border border-[var(--ink-100)] hover:border-[var(--ink-300)] cursor-pointer flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-[var(--ink-900)]/20"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.signedUrl}
                alt={`Step ${stepNumber} photo ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {lightboxOpen && slides.length > 0 && (
        <Lightbox
          open={lightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={slides}
          index={lightboxIndex}
        />
      )}
    </div>
  )
}
