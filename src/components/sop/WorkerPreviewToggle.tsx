'use client'
import type { ReactNode } from 'react'
import { usePreviewStore } from '@/stores/preview'

export function WorkerPreviewToggle({ className = '' }: { className?: string }) {
  const viewport = usePreviewStore((s) => s.viewport)
  const setViewport = usePreviewStore((s) => s.setViewport)
  return (
    <div
      role="group"
      aria-label="Preview viewport"
      className={`inline-flex items-stretch border border-[var(--ink-300)] rounded ${className}`}
    >
      <button
        type="button"
        aria-pressed={viewport === 'desktop'}
        onClick={() => setViewport('desktop')}
        className="px-3 py-1 text-[11px] mono uppercase tracking-wider"
        style={{
          background: viewport === 'desktop' ? 'var(--ink-900)' : 'transparent',
          color: viewport === 'desktop' ? 'var(--paper)' : 'var(--ink-700)',
        }}
      >
        Desktop
      </button>
      <button
        type="button"
        aria-pressed={viewport === 'mobile'}
        onClick={() => setViewport('mobile')}
        className="px-3 py-1 text-[11px] mono uppercase tracking-wider border-l border-[var(--ink-300)]"
        style={{
          background: viewport === 'mobile' ? 'var(--ink-900)' : 'transparent',
          color: viewport === 'mobile' ? 'var(--paper)' : 'var(--ink-700)',
        }}
      >
        Mobile
      </button>
    </div>
  )
}

/** Wrap tab bodies with this to apply the 430px clamp in mobile preview. */
export function WorkerPreviewClamp({ children }: { children: ReactNode }) {
  const viewport = usePreviewStore((s) => s.viewport)
  return (
    <div
      style={{
        maxWidth: viewport === 'mobile' ? 430 : '100%',
        margin: '0 auto',
        transition: 'max-width 150ms ease',
      }}
    >
      {children}
    </div>
  )
}
