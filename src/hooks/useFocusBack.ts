'use client'

/**
 * Phase 58 -- Back and Esc for the focus screen (D-26).
 *
 * Navigation happens only inside event handlers: Next 16.2.1 orphans the server
 * action queue when a navigation starts from a mount effect while mount-time
 * actions are in flight (CLAUDE.md 2026-09-29). The effect below only adds and
 * removes the key listener.
 *
 * Esc order: the topmost registered overlay closes first, then a text field
 * being edited is left, then Back.
 */
import { createContext, useCallback, useContext, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { backHref } from '@/lib/sop/focus-path'

const SAVE_WAIT_MS = 3000

type Overlay = () => void
export const FocusOverlayContext = createContext<(close: Overlay) => () => void>(() => () => {})

/** A dialog, popover or the rail sheet registers while open so Esc closes it before anything else. */
export function useRegisterOverlay(open: boolean, close: Overlay): void {
  const register = useContext(FocusOverlayContext)
  const closeRef = useRef(close)
  closeRef.current = close
  useEffect(() => {
    if (!open) return
    return register(() => closeRef.current())
  }, [open, register])
}

/** Lets a child of the frame (the "sent" panel) trigger the same Back as the top bar. */
export const FocusBackContext = createContext<() => void>(() => {})
export const useFocusGoBack = () => useContext(FocusBackContext)

const isField = (el: Element | null): el is HTMLElement =>
  !!el && (el.matches('input, textarea, select') || (el as HTMLElement).isContentEditable)

export function useFocusBack({ from, beforeBack }: { from: string | null; beforeBack?: () => Promise<unknown> }) {
  const router = useRouter()
  const overlays = useRef<Overlay[]>([])
  const going = useRef(false)

  const goBack = useCallback(async () => {
    if (going.current) return
    going.current = true
    try {
      if (beforeBack) {
        await Promise.race([beforeBack().catch(() => {}), new Promise((r) => setTimeout(r, SAVE_WAIT_MS))])
      }
      router.push(backHref(from))
    } finally {
      going.current = false
    }
  }, [router, from, beforeBack])

  const registerOverlay = useCallback((close: Overlay) => {
    overlays.current.push(close)
    return () => {
      overlays.current = overlays.current.filter((c) => c !== close)
    }
  }, [])

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      const top = overlays.current[overlays.current.length - 1]
      if (top) {
        top()
        return
      }
      const active = document.activeElement
      if (isField(active)) {
        active.blur()
        return
      }
      void goBack()
    },
    [goBack],
  )

  useEffect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKey])

  return { goBack, registerOverlay }
}
