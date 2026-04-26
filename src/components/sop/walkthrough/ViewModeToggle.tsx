'use client'
import { useWalkthroughModeStore } from '@/stores/walkthroughMode'

export function ViewModeToggle({ className = '' }: { className?: string }) {
  const mode = useWalkthroughModeStore((s) => s.mode)
  const setMode = useWalkthroughModeStore((s) => s.setMode)
  return (
    <div
      role="group"
      aria-label="Walkthrough view mode"
      data-view-mode-toggle
      className={`inline-flex border border-[var(--ink-300)] rounded hide-below-430 ${className}`}
    >
      <button
        type="button"
        aria-pressed={mode === 'immersive'}
        onClick={() => setMode('immersive')}
        className="px-3 py-1 text-[11px] mono uppercase tracking-wider"
        style={{
          background: mode === 'immersive' ? 'var(--ink-900)' : 'transparent',
          color: mode === 'immersive' ? 'var(--paper)' : 'var(--ink-700)',
        }}
      >
        Immersive
      </button>
      <button
        type="button"
        aria-pressed={mode === 'list'}
        onClick={() => setMode('list')}
        className="px-3 py-1 text-[11px] mono uppercase tracking-wider border-l border-[var(--ink-300)]"
        style={{
          background: mode === 'list' ? 'var(--ink-900)' : 'transparent',
          color: mode === 'list' ? 'var(--paper)' : 'var(--ink-700)',
        }}
      >
        List
      </button>
    </div>
  )
}
