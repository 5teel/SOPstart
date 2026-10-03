'use client'
import dynamic from 'next/dynamic'
import type { SopWithSections } from '@/types/sop'
import { useViewport } from '@/hooks/useViewport'
import { MobileWalkthrough } from '@/components/sop/walkthrough/MobileWalkthrough'

/**
 * Viewport-aware walkthrough host.
 *
 * Why dynamic:
 *   DesktopWalkthrough is loaded ONLY on viewports >= 1024px so the mobile
 *   worker bundle stays small (SB-LINE-06).
 *
 * Bundle isolation contract:
 *   This file is the SOLE allowed reference site for `DesktopWalkthrough`,
 *   and only via `next/dynamic`. `tests/lint/no-static-desktop-import.spec.ts`
 *   enforces this; any static import elsewhere fails the suite.
 *
 * SSR strategy:
 *   `useViewport()` returns 'mobile' on the first render (matches SSR output,
 *   the server has no `window`) and switches to 'desktop' after mount on
 *   viewports >= 1024px.
 */
const DesktopWalkthrough = dynamic(
  () =>
    import('./DesktopWalkthrough').then((m) => ({ default: m.DesktopWalkthrough })),
  { ssr: false, loading: () => null }
)

export function WalkthroughSwitcher({ sop }: { sop: SopWithSections }) {
  const variant = useViewport()

  return variant === 'desktop' ? <DesktopWalkthrough sop={sop} /> : <MobileWalkthrough sop={sop} />
}
