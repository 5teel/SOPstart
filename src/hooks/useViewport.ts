'use client'

import { useEffect, useState } from 'react'

const DESKTOP_BREAKPOINT = '(min-width: 1024px)'

/**
 * Phase 15 — SSR-safe viewport hook (D-04).
 *
 * Returns `'mobile'` on the first render (matches SSR output — server has no
 * `window`) and switches to `'desktop'` after mount when the viewport reports
 * ≥ 1024px. A brief mobile-render flash on desktop is acceptable for v1
 * (operators won't notice on a hot-reload-free production load).
 *
 * Implementation notes:
 * - CRITICAL: never read `window` during initial render — would throw on SSR.
 *   The `useEffect` runs only after hydration, so the initial render is
 *   deterministic (mobile).
 * - Listens to `change` events on the MediaQueryList so hot resize across the
 *   1024px boundary re-renders without polling.
 */
export function useViewport(): 'mobile' | 'desktop' {
  const [variant, setVariant] = useState<'mobile' | 'desktop'>('mobile')

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_BREAKPOINT)
    const update = () => setVariant(mql.matches ? 'desktop' : 'mobile')
    update() // sync once on mount
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  return variant
}
