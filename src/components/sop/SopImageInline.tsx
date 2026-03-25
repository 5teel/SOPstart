'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import { ZoomIn } from 'lucide-react'
import 'yet-another-react-lightbox/styles.css'
import type { LightboxExternalProps, Plugin } from 'yet-another-react-lightbox'

// Dynamically import the Lightbox component (ssr: false) to avoid server-render issues
const Lightbox = dynamic<LightboxExternalProps>(
  () => import('yet-another-react-lightbox'),
  { ssr: false }
)

// Zoom is a plugin function (not a React component) — import it at module level
// It's safe to import here since the whole component file is client-only ('use client')
let ZoomPlugin: Plugin | null = null
if (typeof window !== 'undefined') {
  // Lazy-assign after first render to satisfy SSR bundle (plugin code itself is fine server-side,
  // but we only use it in the client Lightbox render)
  import('yet-another-react-lightbox/plugins/zoom').then((m) => {
    ZoomPlugin = m.default
  })
}

interface SopImageInlineProps {
  src: string
  alt: string
}

export function SopImageInline({ src, alt }: SopImageInlineProps) {
  const [open, setOpen] = useState(false)

  const plugins: Plugin[] = ZoomPlugin ? [ZoomPlugin] : []

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative mt-3 rounded-xl overflow-hidden bg-steel-700 cursor-zoom-in max-h-[240px] border border-steel-600 w-full text-left"
        aria-label={`Tap to zoom: ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="w-full object-contain max-h-[240px]"
        />
        <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 bg-steel-900/80 rounded-lg text-xs font-medium text-steel-100">
          <ZoomIn size={12} />
          Tap to zoom
        </div>
      </button>

      {open && (
        <Lightbox
          open={open}
          close={() => setOpen(false)}
          slides={[{ src, alt }]}
          plugins={plugins}
        />
      )}
    </>
  )
}
