'use client'
import { useEffect, useState } from 'react'
import { Monitor, Smartphone } from 'lucide-react'

type View = 'desktop' | 'mobile'

/**
 * D-01: Persistent DESKTOP | MOBILE viewport preview toggle in the builder
 * top bar. Writes `document.body.dataset.view` so the sketch-ported CSS in
 * `builder-preview.css` can clamp the canvas to a 430px phone frame without
 * any JS-based viewport branching inside block components.
 */
export function PreviewToggle() {
  const [view, setView] = useState<View>('desktop')

  useEffect(() => {
    document.body.dataset.view = view
    return () => {
      // Reset to desktop on unmount so the rest of the app isn't left in a
      // clamped preview state when the admin leaves the builder.
      document.body.dataset.view = 'desktop'
    }
  }, [view])

  return (
    <div
      role="group"
      aria-label="Preview viewport"
      className="inline-flex items-center gap-0 rounded-md border border-steel-600 bg-steel-800/60 p-0.5 font-mono text-[10px] uppercase tracking-wider"
    >
      <button
        type="button"
        data-view-btn="desktop"
        aria-pressed={view === 'desktop'}
        onClick={() => setView('desktop')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded ${
          view === 'desktop'
            ? 'bg-steel-700 text-brand-yellow'
            : 'text-steel-400 hover:text-steel-200'
        }`}
      >
        <Monitor size={10} />
        DESKTOP
      </button>
      <button
        type="button"
        data-view-btn="mobile"
        aria-pressed={view === 'mobile'}
        onClick={() => setView('mobile')}
        className={`flex items-center gap-1 px-2.5 py-1 rounded ${
          view === 'mobile'
            ? 'bg-steel-700 text-brand-yellow'
            : 'text-steel-400 hover:text-steel-200'
        }`}
      >
        <Smartphone size={10} />
        MOBILE
      </button>
    </div>
  )
}
