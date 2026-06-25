'use client'
import { useCallback, useRef, useState } from 'react'
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
 *   mount on ≥ 1024px viewports.
 *
 * Phase 22 — voice bridge (D-01, D-02, D-22):
 *   `mwRef` is a React ref to the MobileWalkthrough imperative handle. It is
 *   used ONLY to INVOKE imperative commands (onVoiceNext / onVoicePrev). It is
 *   NOT read for state — the original code read `mwRef.current.currentStepText`
 *   synchronously right after the advance, which returned the PRE-advance step
 *   (React had not re-rendered), so the new step was never read aloud (CR-01)
 *   and the ack flag could be stale (CR-02). Instead, MobileWalkthrough PUSHES
 *   its voice state via `onVoiceStateChange`, which lands in `voiceState` and
 *   flows reactively to the modal — always fresh.
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
  // Ref to the MobileWalkthrough imperative handle — used to INVOKE commands only.
  const mwRef = useRef<MobileWalkthroughHandle>(null)

  // Reactive voice state, PUSHED from MobileWalkthrough's onVoiceStateChange
  // whenever the step or ack flag changes (CR-01/CR-02 fix). Never derived from
  // a synchronous ref read.
  const [voiceState, setVoiceState] = useState<{ stepText: string; isAcknowledged: boolean }>({
    stepText: '',
    isAcknowledged: false,
  })
  // Stable callback so MobileWalkthrough's push effect doesn't re-fire each render.
  const handleVoiceStateChange = useCallback(
    (s: { stepText: string; isAcknowledged: boolean }) => setVoiceState(s),
    [],
  )

  // Voice callbacks: invoke the imperative advance. The fresh step text is
  // mirrored reactively via handleVoiceStateChange after the advance re-renders,
  // which re-fires the modal's TTS read-aloud effect on the NEW step (VDW-LIT-03).
  const handleVoiceNext = () => {
    mwRef.current?.onVoiceNext()
  }
  const handleVoicePrev = () => {
    mwRef.current?.onVoicePrev()
  }

  return (
    <>
      {variant === 'desktop' ? (
        <DesktopWalkthrough sop={sop} />
      ) : (
        <MobileWalkthrough ref={mwRef} sop={sop} onVoiceStateChange={handleVoiceStateChange} />
      )}

      <WalkthroughVoiceButton onOpen={() => setModalOpen(true)} />

      {modalOpen && (
        <WalkthroughVoiceModal
          sopId={sop.id}
          onClose={() => setModalOpen(false)}
          onVoiceNext={handleVoiceNext}
          onVoicePrev={handleVoicePrev}
          currentStepText={voiceState.stepText}
          isAcknowledged={voiceState.isAcknowledged}
        />
      )}
    </>
  )
}
