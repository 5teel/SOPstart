'use client'

/**
 * Phase 60 -- the recessed-screen dialog shell shared by ReasonDialog and the request
 * composer (59 A-12 idiom). Scrim, panel, local Esc and focus in / return live here once.
 * No stylesheet import: it rides only inside lazy chunks.
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react'

export function DialogShell({
  labelledBy,
  testId,
  onEscape,
  children,
}: {
  labelledBy: string
  testId: string
  /** Called on Esc; the key never leaves this dialog. */
  onEscape(): void
  children: ReactNode
}) {
  const escapeRef = useRef(onEscape)
  useLayoutEffect(() => {
    escapeRef.current = onEscape
  })

  // Layout effects run before any child's passive focus call, so the opener is still the active element.
  useLayoutEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return () => {
      if (opener && opener.isConnected) opener.focus()
    }
  }, [])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    escapeRef.current()
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-4" onKeyDown={onKeyDown}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        data-testid={testId}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-paper-1 p-6"
      >
        {children}
      </div>
    </div>
  )
}
