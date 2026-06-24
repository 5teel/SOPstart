'use client'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { SopWithSections } from '@/types/sop'
import { useViewport } from '@/hooks/useViewport'
import { MobileWalkthrough } from '@/components/sop/walkthrough/MobileWalkthrough'
import type { MobileWalkthroughHandle } from '@/components/sop/walkthrough/MobileWalkthrough'
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
 *
 * Phase 22 — voice bridge (D-01, D-02, D-22):
 *   `mwRef` is a React ref to the MobileWalkthrough imperative handle
 *   (MobileWalkthroughHandle). It bridges voice commands from
 *   WalkthroughVoiceModal to handleMarkComplete/handleStepChange inside
 *   MobileWalkthrough without hoisting state or breaking D-02 invariants.
 *
 *   `currentStepText` is a useState MIRROR of mwRef.current.currentStepText.
 *   Because mwRef.current is a REF (not state), reading it in JSX feeds the
 *   modal a STALE string and React does NOT re-render when the step advances.
 *   The mirror is set AFTER each ref advance call so the fresh value flows
 *   through the modal prop and re-triggers the modal's TTS read-aloud effect
 *   (CLAUDE.md 2026-06-08 non-reactive-source staleness trap; T-22-03-06).
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

  // ── Phase 22: voice bridge ────────────────────────────────────────────────
  // Ref to the MobileWalkthrough imperative handle.
  // Voice callbacks call the ref method THEN setCurrentStepText so React
  // re-renders with the fresh step text and the modal's TTS effect fires.
  const mwRef = useRef<MobileWalkthroughHandle>(null)

  // Reactive mirror of mwRef.current.currentStepText (set after each advance).
  // CRITICAL: never pass mwRef.current?.currentStepText directly in JSX — that
  // is the stale-ref bug this state exists to prevent (CLAUDE.md 2026-06-08).
  const [currentStepText, setCurrentStepText] = useState<string>('')

  // Seed currentStepText when the modal opens so the first step is read aloud
  // (VDW-LIT-03). The ref is populated by this point (modal-open is a user
  // gesture that fires after the component has mounted and the ref is attached).
  useEffect(() => {
    if (modalOpen) {
      setCurrentStepText(mwRef.current?.currentStepText ?? '')
    }
  }, [modalOpen])

  // Voice callback: advance the walkthrough via handleMarkComplete, then mirror
  // currentStepText so the modal's TTS effect fires on the NEW step text.
  const handleVoiceNext = () => {
    mwRef.current?.onVoiceNext()
    setCurrentStepText(mwRef.current?.currentStepText ?? '')
  }

  // Voice callback: navigate back via handleStepChange, then mirror.
  const handleVoicePrev = () => {
    mwRef.current?.onVoicePrev()
    setCurrentStepText(mwRef.current?.currentStepText ?? '')
  }

  return (
    <>
      {variant === 'desktop' ? (
        <DesktopWalkthrough sop={sop} />
      ) : (
        <MobileWalkthrough ref={mwRef} sop={sop} />
      )}

      <WalkthroughVoiceButton onOpen={() => setModalOpen(true)} />

      {modalOpen && (
        <WalkthroughVoiceModal
          sopId={sop.id}
          onClose={() => setModalOpen(false)}
          onVoiceNext={handleVoiceNext}
          onVoicePrev={handleVoicePrev}
          currentStepText={currentStepText}
          isAcknowledged={mwRef.current?.isAcknowledged ?? false}
        />
      )}
    </>
  )
}
