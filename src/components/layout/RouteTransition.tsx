'use client'
import { useEffect, useRef, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Replays the page-shell-enter animation each time the pathname changes.
 *
 * Placed once in (protected)/layout.tsx so every authenticated route gets
 * a consistent ~180ms fade-up on entry. No per-page wrappers required.
 *
 * Notes:
 *  - Only the pathname is tracked, not search params — re-firing on every
 *    `?tab=…` or `?step=…` change would be distracting inside the walkthrough.
 *  - The walkthrough itself has its own internal cross-fade on step swap
 *    (see globals.css `.step-fade-in`), so we deliberately don't double up.
 *  - Animation is CSS-driven, no JS animation library. Respects
 *    prefers-reduced-motion via globals.css media query.
 */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const innerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    el.classList.remove('page-shell-enter')
    // Force a reflow so the animation restarts rather than being deduped.
    void el.offsetWidth
    el.classList.add('page-shell-enter')
  }, [pathname])

  return (
    <div ref={innerRef} className="page-shell-enter h-full">
      {children}
    </div>
  )
}
