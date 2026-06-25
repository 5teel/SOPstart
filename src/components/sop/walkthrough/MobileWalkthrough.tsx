'use client'
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, ClipboardCheck, Camera } from 'lucide-react'
import type { SopWithSections, SopSection } from '@/types/sop'
import { ImmersiveStepCard } from '@/components/sop/walkthrough/ImmersiveStepCard'
import { ViewModeToggle } from '@/components/sop/walkthrough/ViewModeToggle'
import { useWalkthroughModeStore } from '@/stores/walkthroughMode'
import { useWalkthroughStore } from '@/stores/walkthrough'
import { useCompletionStore } from '@/stores/completionStore'
import { SafetyAcknowledgement } from '@/components/sop/SafetyAcknowledgement'
import { submitCompletion } from '@/actions/completions'
import { usePhotoQueue, addPhotoToQueue } from '@/hooks/usePhotoQueue'
import { flushPhotoQueue } from '@/lib/offline/sync-engine'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/offline/db'
import { upsertWalkthroughProgress } from '@/actions/walkthrough-progress'
import React from 'react'

/**
 * Phase 22 — MobileWalkthroughHandle
 *
 * Imperative handle exposed via useImperativeHandle (forwardRef) so that
 * WalkthroughSwitcher can bridge voice commands from WalkthroughVoiceModal
 * into the walkthrough state machine WITHOUT hoisting state (D-22 additive option).
 *
 * Voice "next" always routes through onVoiceNext → handleMarkComplete, never
 * directly through the store — preserving the D-02 safety-ack invariant and
 * the completion audit trail (T-22-03-02).
 */
export interface MobileWalkthroughHandle {
  /** Advance the walkthrough exactly as the tap "I've done this — Next" button does. */
  onVoiceNext: () => void
  /** Navigate to the previous step (voice "back"/"previous"). */
  onVoicePrev: () => void
  /** Text of the currently-displayed step (for TTS read-aloud; VDW-LIT-03). */
  currentStepText: string
  /** Whether the safety section has been acknowledged this session (D-02 gate). */
  isAcknowledged: boolean
}

/**
 * Phase 15 — MobileWalkthrough.
 *
 * Near-byte-identical extract of the Phase 12.5 WalkthroughTab. The only
 * behavioural changes versus the 12.5 baseline are:
 *
 * 1. The primary CTA now reads "I've done this — Next" and wires
 *    `markStepAcknowledged(sopId, currentStepId)` on click (D-19). The
 *    button is min-h-[60px] (glove-friendly tap target).
 * 2. A forward-jump guard effect calls `router.replace(?step=…)` when a
 *    deep-link bypasses the highest-acked step (D-20, Pitfall 4 — strict
 *    `>` check + `router.replace` to avoid infinite loops).
 * 3. On submit, the ack trace is passed to `submitCompletion` so the
 *    completion record's `step_ack_trace` JSONB column is populated.
 *
 * Phase 22 additions:
 * 4. Converted to `forwardRef<MobileWalkthroughHandle>` — exposes an
 *    imperative handle so WalkthroughSwitcher can wire voice commands into
 *    the existing handleMarkComplete/handleStepChange paths. This is purely
 *    additive: no existing callbacks are modified.
 *
 * Everything else (photo capture, immersive card, sticky action bar,
 * desktop list view above 430px, ViewModeToggle) is preserved verbatim
 * so existing mobile UAT continues to pass (SPEC constraint #1).
 */
export const MobileWalkthrough = React.forwardRef<
  MobileWalkthroughHandle,
  {
    sop: SopWithSections
    /**
     * Phase 22 (CR-01/CR-02 fix): reactive push of voice-relevant state to the
     * host. Fires whenever the current step OR the acknowledgement flag changes,
     * so the voice modal always reads the CURRENT step text + ack status. This
     * replaces the host's stale synchronous `mwRef.current.currentStepText` read
     * taken right after an imperative advance (which returned the PRE-advance
     * step because React had not re-rendered yet → new step never read aloud).
     */
    onVoiceStateChange?: (s: { stepText: string; isAcknowledged: boolean }) => void
  }
>(function MobileWalkthrough({ sop, onVoiceStateChange }, ref) {
  const router = useRouter()
  const search = useSearchParams()
  const mode = useWalkthroughModeStore((s) => s.mode)
  const walkthroughStore = useWalkthroughStore()
  const completionStore = useCompletionStore()

  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Restore in-progress completion from Dexie on mount (D-02 resume)
  useEffect(() => {
    void completionStore.restoreFromDexie(sop.id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sop.id])

  // Flush photo queue on reconnect
  useEffect(() => {
    async function flush() {
      const supabase = createClient()
      await flushPhotoQueue(supabase)
    }
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [])

  const sopId = sop.id
  const acknowledged = walkthroughStore.isAcknowledged(sopId)
  const completedSteps = walkthroughStore.getCompletedSteps(sopId)
  const activeCompletion = completionStore.getActiveCompletion(sopId)

  const allSteps = sop.sop_sections.flatMap((s) => s.sop_steps ?? [])
  const totalSteps = allSteps.length
  const completedCount = completedSteps.size
  const allDone = totalSteps > 0 && completedCount >= totalSteps
  const pct = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0

  // PERF: drive currentStep from local state, not the URL. router.push on
  // a search-param change triggers an RSC payload fetch for the route
  // segment, which (with the service worker layered on top) was the visible
  // unresponsiveness on "I've done this — Next". Local state gives an
  // instant React re-render; the URL is synced as a side effect via
  // window.history.replaceState (no fetch, no Next.js routing).
  const [localStepId, setLocalStepId] = useState<string | null>(
    () => search.get('step') ?? allSteps[0]?.id ?? null
  )

  // Keep local state in sync with browser navigation (back/forward) and
  // with router-driven URL changes that originate outside the walkthrough.
  useEffect(() => {
    const urlStep = search.get('step')
    if (urlStep && urlStep !== localStepId) {
      setLocalStepId(urlStep)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.toString()])

  const currentId = localStepId ?? allSteps[0]?.id
  const currentIdx = Math.max(0, allSteps.findIndex((s) => s.id === currentId))
  const currentStep = allSteps[currentIdx]
  const prevStep = allSteps[currentIdx - 1]
  const nextStep = allSteps[currentIdx + 1]
  const currentDone = !!(currentStep && completedSteps.has(currentStep.id))

  // ── Phase 15 D-19 / D-20: sequential ack-trace forward-jump guard ────
  // If a user deep-links to a step further ahead than (highest-acked + 1),
  // bounce them back to (highest-acked + 1). Strict `>` + `router.replace`
  // (NOT `router.push`) prevents the Pitfall 4 infinite-redirect loop.
  const allStepIds = allSteps.map((s) => s.id)
  const highestAckIdx = useWalkthroughStore((s) =>
    s.getHighestAckIndex(sopId, allStepIds)
  )
  useEffect(() => {
    if (!currentStep) return
    const requestedIdx = allSteps.findIndex((s) => s.id === currentStep.id)
    if (requestedIdx > highestAckIdx + 1) {
      const targetId = allSteps[highestAckIdx + 1]?.id ?? allSteps[0]?.id
      if (targetId && targetId !== currentStep.id) {
        // Use the same local-state path as handleStepChange so the guard
        // is just as instant as a normal next-click. Pitfall 4 (infinite
        // loop) is still mitigated because setLocalStepId is a state set
        // and the effect dep on currentStep.id changes only once.
        setLocalStepId(targetId)
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search)
          params.set('step', targetId)
          const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`
          window.history.replaceState(window.history.state, '', newUrl)
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep?.id, highestAckIdx])

  // Photo queue for the active completion
  const { photosForStep, queueCount } = usePhotoQueue(activeCompletion?.localId ?? null)
  const currentStepPhotos = currentStep ? photosForStep(currentStep.id) : []
  const photoGateMet = !currentStep?.photo_required || currentStepPhotos.length > 0

  const sections = sop.sop_sections
  const hazardsSection = sections.find((s) => s.section_type.includes('hazard')) as SopSection | undefined
  const ppeSection = sections.find((s) =>
    s.section_type.includes('ppe') || s.section_type.includes('protective')
  ) as SopSection | undefined
  const emergencySection = sections.find((s) => s.section_type.includes('emergency')) as SopSection | undefined

  const handleStepChange = useCallback(
    (stepId: string) => {
      // PERF: local state first (instant re-render of this subtree only).
      setLocalStepId(stepId)
      // URL sync — replaceState bypasses Next.js client routing and the
      // RSC fetch entirely, so it doesn't compete with the React render.
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search)
        params.set('step', stepId)
        const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`
        window.history.replaceState(window.history.state, '', newUrl)
      }
      // Fire-and-forget server-side progress upsert (does not block UI).
      void upsertWalkthroughProgress({ sopId: sop.id, stepId })
    },
    [sop.id]
  )

  // Auto-starts a completion if none is active, then queues the photo
  const handleCapturePhoto = useCallback(
    async (stepId: string, file: File) => {
      let localId = activeCompletion?.localId
      if (!localId) {
        await completionStore.startCompletion(sopId, sop.version)
        localId = useCompletionStore.getState().getActiveCompletion(sopId)?.localId
      }
      if (!localId) return
      await addPhotoToQueue({ completionLocalId: localId, stepId, file })
    },
    [activeCompletion?.localId, completionStore, sopId, sop.version]
  )

  const handleMarkComplete = useCallback(
    (stepId: string) => {
      // PERF: do all in-memory updates + navigation synchronously so the
      // UI reacts on the next frame. Persistence (Dexie writes via
      // completionStore + walkthrough-progress server action) is fired in
      // the background — the user does not block on IndexedDB.
      walkthroughStore.markStepAcknowledged(sopId, stepId)
      walkthroughStore.markStepComplete(sopId, stepId)
      const idx = allSteps.findIndex((s) => s.id === stepId)
      const next = allSteps.slice(idx + 1).find((s) => !completedSteps.has(s.id))
      if (next) void handleStepChange(next.id)
      // Fire-and-forget persistence. startCompletion is idempotent and the
      // completionStore sets in-memory state synchronously, so the order
      // here is safe even on the first click.
      if (!activeCompletion) {
        void completionStore.startCompletion(sopId, sop.version)
      }
      void completionStore.markStepCompleted(sopId, stepId)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeCompletion, completionStore, walkthroughStore, sopId, sop.version, allSteps, completedSteps]
  )

  // ── Phase 22: Imperative handle for voice callbacks ───────────────────────
  // Exposes a stable handle via useImperativeHandle so WalkthroughSwitcher
  // can bridge voice commands from WalkthroughVoiceModal into the existing
  // state machine WITHOUT hoisting state or breaking D-02 invariants.
  //
  // onVoiceNext calls handleMarkComplete — the SAME path as the tap button —
  // so the safety-ack gate, completion audit trail, and store writes are
  // all preserved (T-22-03-01, T-22-03-02).
  //
  // The ref that WalkthroughSwitcher reads is a REF (not state), so the
  // caller MUST mirror currentStepText into useState after each advance call
  // to make it reactive (CLAUDE.md 2026-06-08 non-reactive-source trap;
  // T-22-03-06).
  const handleMarkCompleteRef = useRef(handleMarkComplete)
  handleMarkCompleteRef.current = handleMarkComplete
  const handleStepChangeRef = useRef(handleStepChange)
  handleStepChangeRef.current = handleStepChange

  // [CR-01/CR-02] Reactive push of voice state. Fires AFTER each render in which
  // the current step or ack flag changed — i.e. after an advance has actually
  // taken effect — so the host always mirrors the fresh step text / ack status.
  useEffect(() => {
    onVoiceStateChange?.({ stepText: currentStep?.text ?? '', isAcknowledged: acknowledged })
  }, [currentStep?.id, currentStep?.text, acknowledged, onVoiceStateChange])

  useImperativeHandle(
    ref,
    () => ({
      onVoiceNext: () => {
        if (currentStep) handleMarkCompleteRef.current(currentStep.id)
      },
      onVoicePrev: () => {
        if (prevStep) handleStepChangeRef.current(prevStep.id)
      },
      get currentStepText() {
        return currentStep?.text ?? ''
      },
      get isAcknowledged() {
        return acknowledged
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentStep, prevStep, acknowledged]
  )

  async function handleSubmit() {
    if (!activeCompletion) return
    if (queueCount > 0) {
      const proceed = window.confirm(
        `${queueCount} photo${queueCount === 1 ? '' : 's'} still uploading. ` +
          'These will not be attached to your completion if you submit now. Submit anyway?'
      )
      if (!proceed) return
    }
    setSubmitLoading(true)
    setSubmitError(null)
    try {
      const canonical = [...allSteps]
        .sort((a, b) => a.step_number - b.step_number)
        .map((s) => `${s.step_number}:${s.text}`)
        .join('|')
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
      const contentHash = Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')

      const uploadedPhotos = await db.photoQueue
        .where('completionLocalId')
        .equals(activeCompletion.localId)
        .and((p) => p.uploaded && p.storagePath !== null)
        .toArray()

      await db.completions.update(activeCompletion.localId, { contentHash, status: 'submitted' })

      // Phase 15 D-21: pass step_ack_trace evidence to the server action
      const stepAckTrace = walkthroughStore.getAckTrace(sopId)

      const result = await submitCompletion({
        localId: activeCompletion.localId,
        sopId,
        sopVersion: sop.version,
        contentHash,
        stepData: activeCompletion.stepCompletions,
        photoStoragePaths: uploadedPhotos.map((p) => ({
          localId: p.localId,
          stepId: p.stepId,
          storagePath: p.storagePath as string,
          contentType: p.contentType,
        })),
        stepAckTrace,
      })

      if (result.success) {
        await completionStore.clearCompletion(sopId)
        // Phase 15 polish: do NOT reset walkthrough state on submit. We mark
        // the SOP as submitted so the worker can re-enter and re-read any
        // step freely (highest-acked is now the last step, so the forward
        // jump guard is permissive). resetWalkthrough is reserved for the
        // explicit "Start another walkthrough" action.
        walkthroughStore.markWalkthroughSubmitted(sopId)
        setSubmitted(true)
      } else {
        await db.completions.update(activeCompletion.localId, { status: 'in_progress' })
        setSubmitError(result.error)
      }
    } catch (err) {
      if (activeCompletion) {
        await db.completions.update(activeCompletion.localId, { status: 'in_progress' }).catch(() => {})
      }
      setSubmitError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitLoading(false)
    }
  }

  // ── Success state ──────────────────────────────────────────────
  if (submitted) {
    const firstStepId = allSteps[0]?.id
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[60vh] px-6 gap-6 text-center"
        data-walkthrough="mobile"
      >
        <CheckCircle2 size={64} className="text-green-500" />
        <div>
          <p className="text-2xl font-bold text-[var(--ink-900)] mb-2">Completion submitted</p>
          <p className="text-sm text-[var(--ink-500)]">Your supervisor has been notified.</p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            type="button"
            data-testid="reread-steps"
            onClick={() => {
              setSubmitted(false)
              if (firstStepId) {
                const params = new URLSearchParams(search.toString())
                params.set('step', firstStepId)
                router.push(`?${params.toString()}`, { scroll: false })
              }
            }}
            className="px-6 py-3 rounded-xl bg-[var(--ink-900)] text-[var(--paper)] font-semibold hover:opacity-90 transition-opacity"
          >
            Re-read steps
          </button>
          <button
            type="button"
            onClick={() => { setSubmitted(false); walkthroughStore.resetWalkthrough(sopId) }}
            className="px-6 py-3 rounded-xl border border-[var(--ink-300)] text-sm font-medium text-[var(--ink-700)] hover:border-[var(--ink-900)] transition-colors"
          >
            Start another walkthrough
          </button>
        </div>
      </div>
    )
  }

  const isSubmittedSop = walkthroughStore.isSubmitted(sopId)

  // ── Main layout ────────────────────────────────────────────────
  return (
    <div className="responsive-walkthrough-root pb-[144px]" data-walkthrough="mobile">
      {/* Safety acknowledgement gate */}
      {!acknowledged && (
        <SafetyAcknowledgement
          sopId={sopId}
          hazardsSection={hazardsSection}
          ppeSection={ppeSection}
          emergencySection={emergencySection}
          onAcknowledge={() => walkthroughStore.acknowledgeSafety(sopId)}
        />
      )}

      {/* Progress bar (paper/ink themed) */}
      {totalSteps > 0 && (
        <div className="px-4 pt-3 pb-3 border-b border-[var(--ink-100)]">
          <div className="h-1.5 bg-[var(--ink-100)] rounded-full overflow-hidden mb-1.5">
            <div
              className="h-full bg-[var(--accent-decision)] rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="mono text-[11px] uppercase tracking-wider text-[var(--ink-500)]">
              {allDone ? `All ${totalSteps} steps done` : `Step ${completedCount + 1} of ${totalSteps}`}
            </span>
            <div className="flex items-center gap-2">
              {queueCount > 0 && (
                <span
                  className="mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--accent-decision)]/15 text-[var(--accent-decision)] flex items-center gap-1"
                  title={`${queueCount} photo${queueCount === 1 ? '' : 's'} waiting to upload`}
                >
                  <Camera size={10} />
                  {queueCount} queued
                </span>
              )}
              <span className="mono text-[11px] text-[var(--ink-400)]">{pct}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Desktop-only mode toggle */}
      <div className="flex items-center justify-end px-4 py-2 hide-below-430">
        <ViewModeToggle />
      </div>

      {/* Immersive card — above 430px respects mode preference */}
      {mode === 'immersive' ? (
        <div className="walkthrough-list-only-above-430">
          <ImmersiveStepCard
            sop={sop}
            currentStepId={localStepId}
            onStepChange={handleStepChange}
            completedSteps={completedSteps}
            stepPhotos={currentStepPhotos}
            onCapturePhoto={handleCapturePhoto}
          />
        </div>
      ) : (
        <div className="walkthrough-list-only-above-430">
          <ol className="walkthrough-list">
            {allSteps.map((step, idx) => {
              const done = completedSteps.has(step.id)
              return (
                <li key={step.id} className={`blueprint-frame ${done ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <span className="mono text-[11px] uppercase tracking-wider text-[var(--ink-500)]">
                        Step {idx + 1}
                      </span>
                      <p className="text-sm mt-1">{step.text}</p>
                      {step.photo_required && !done && (
                        <p className="flex items-center gap-1 text-xs text-[var(--accent-decision)] mt-1">
                          <Camera size={12} /> Photo required
                        </p>
                      )}
                    </div>
                    {done && <CheckCircle2 size={18} className="text-green-500 flex-shrink-0 mt-1" />}
                  </div>
                  {!done && (
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        className="evidence-btn text-xs"
                        onClick={() => handleStepChange(step.id)}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="evidence-btn text-xs"
                        onClick={() => handleMarkComplete(step.id)}
                      >
                        Mark done
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      )}

      {/* Below 430px: always immersive */}
      <div className="immersive-only-below-430">
        <ImmersiveStepCard
          sop={sop}
          onStepChange={handleStepChange}
          completedSteps={completedSteps}
          stepPhotos={currentStepPhotos}
          onCapturePhoto={handleCapturePhoto}
        />
      </div>

      {/* Sticky action bar — shown after safety acknowledgement */}
      {acknowledged && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-[var(--paper)] border-t border-[var(--ink-100)] px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
          {submitError && (
            <p className="text-xs text-[var(--accent-escalate)] text-center mb-2">{submitError}</p>
          )}

          {/* Primary action */}
          {isSubmittedSop ? (
            <div
              data-testid="walkthrough-already-submitted"
              className="w-full min-h-[60px] h-[64px] rounded-xl border border-[var(--ink-200)] bg-[var(--ink-50)] flex flex-col items-center justify-center gap-0.5 text-[var(--ink-700)]"
            >
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 size={20} className="text-green-500" />
                Already submitted — re-reading
              </div>
              <span className="text-xs font-normal opacity-75">Use Prev / Next to browse any step</span>
            </div>
          ) : allDone ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitLoading}
              className={[
                'w-full min-h-[60px] h-[64px] rounded-xl font-bold text-base transition-all flex flex-col items-center justify-center gap-0.5',
                submitLoading
                  ? 'bg-[var(--accent-decision)]/40 text-white/60 cursor-not-allowed'
                  : 'bg-[var(--accent-decision)] text-white hover:opacity-90',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <ClipboardCheck size={20} />
                {submitLoading ? 'Submitting…' : 'Sign off & submit'}
              </div>
              <span className="text-xs font-normal opacity-75">Records your sign-off with a timestamp</span>
            </button>
          ) : currentDone ? (
            <div className="flex items-center justify-center gap-2 h-[64px] text-sm text-[var(--ink-500)]">
              <CheckCircle2 size={16} className="text-green-500" />
              Step {currentIdx + 1} done — go to next
            </div>
          ) : (
            <>
              {/* Photo gate bar */}
              {currentStep?.photo_required && !photoGateMet && (
                <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-[var(--accent-decision)]/10 border border-[var(--accent-decision)]/30 text-sm text-[var(--accent-decision)]">
                  <Camera size={14} className="flex-shrink-0" />
                  Capture a photo in the step above to mark complete
                </div>
              )}
              {/* Phase 15 D-19: explicit "I've done this — Next" gate.
                  min-h-[60px] for glove-friendly tap target.
                  active:scale-[0.97] gives instant tap feedback while the
                  optimistic store updates + navigation kick in (no awaits
                  block the click handler — see handleMarkComplete). */}
              <button
                type="button"
                data-testid="ack-next"
                onClick={() => currentStep && handleMarkComplete(currentStep.id)}
                disabled={!photoGateMet}
                className={[
                  'w-full min-h-[60px] h-[64px] rounded-xl font-bold text-base flex items-center justify-center gap-2',
                  'transition-transform duration-100 active:scale-[0.97]',
                  !photoGateMet
                    ? 'bg-[var(--ink-200)] text-[var(--ink-400)] cursor-not-allowed active:scale-100'
                    : 'bg-[var(--ink-900)] text-[var(--paper)] hover:opacity-90',
                ].join(' ')}
              >
                I&apos;ve done this — Next
              </button>
            </>
          )}

          {/* Prev / Next nav */}
          <div className="flex items-center justify-between h-[44px] mt-1">
            <button
              type="button"
              disabled={!prevStep}
              onClick={() => prevStep && handleStepChange(prevStep.id)}
              className="flex items-center gap-1.5 px-3 h-full text-sm font-medium text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              ← Prev
            </button>
            <button
              type="button"
              disabled={!nextStep}
              onClick={() => nextStep && handleStepChange(nextStep.id)}
              className="flex items-center gap-1.5 px-3 h-full text-sm font-medium text-[var(--ink-500)] hover:text-[var(--ink-900)] transition-colors disabled:opacity-30 disabled:pointer-events-none"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
})
