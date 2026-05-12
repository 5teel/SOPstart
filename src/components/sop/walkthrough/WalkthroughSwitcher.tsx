'use client'
import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { SopWithSections } from '@/types/sop'
import { useViewport } from '@/hooks/useViewport'
import { MobileWalkthrough } from '@/components/sop/walkthrough/MobileWalkthrough'
import { WalkthroughVoiceButton } from '@/components/sop/voice/WalkthroughVoiceButton'

/**
 * Phase 15 — viewport-aware walkthrough host (D-01..D-04, D-14).
 *
 * Why dynamic:
 *   - DesktopWalkthrough is loaded ONLY on viewports ≥ 1024px so the
 *     mobile worker bundle stays small (SB-LINE-06).
 *   - WalkthroughVoiceModal is loaded ONLY when the mic button is
 *     clicked (most walkthroughs never open it). Mounting at switcher
 *     level so the floating mic-pill works across both Mobile and
 *     Desktop variants without duplication (D-14, RESEARCH A10).
 *
 * Bundle isolation contract:
 *   This file is the SOLE allowed reference site for
 *   `DesktopWalkthrough` and `WalkthroughVoiceModal` — and only via
 *   `next/dynamic`. Wave 0's lint guard
 *   (`tests/lint/no-static-desktop-import.spec.ts`) enforces this; any
 *   future static import outside this file fails the test suite.
 *
 * SSR strategy (D-04):
 *   `useViewport()` returns 'mobile' on the first render (matches SSR
 *   output — server has no `window`) and switches to 'desktop' after
 *   mount on ≥ 1024px viewports. A brief mobile-render flash on
 *   desktop is acceptable for v1 (operators won't notice on a
 *   hot-reload-free production load).
 */
const DesktopWalkthrough = dynamic(
  () =>
    import('./DesktopWalkthrough').then((m) => ({ default: m.DesktopWalkthrough })),
  { ssr: false, loading: () => null }
)

const WalkthroughVoiceModal = dynamic(
  () =>
    import('@/components/sop/voice/WalkthroughVoiceModal').then((m) => ({
      default: m.WalkthroughVoiceModal,
    })),
  { ssr: false, loading: () => null }
)

export function WalkthroughSwitcher({ sop }: { sop: SopWithSections }) {
  const variant = useViewport()
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      {variant === 'desktop' ? (
        <DesktopWalkthrough sop={sop} />
      ) : (
        <MobileWalkthrough sop={sop} />
      )}

      <WalkthroughVoiceButton onOpen={() => setModalOpen(true)} />

      {modalOpen && (
        <WalkthroughVoiceModal
          sopId={sop.id}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
