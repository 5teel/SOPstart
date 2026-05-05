'use client'
import { useCallback, useEffect, useState } from 'react'
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

export function WalkthroughTab({ sop }: { sop: SopWithSections }) {
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

  const currentId = search.get('step') ?? allSteps[0]?.id
  const currentIdx = Math.max(0, allSteps.findIndex((s) => s.id === currentId))
  const currentStep = allSteps[currentIdx]
  const prevStep = allSteps[currentIdx - 1]
  const nextStep = allSteps[currentIdx + 1]
  const currentDone = !!(currentStep && completedSteps.has(currentStep.id))

  // Photo queue for the active completion
  const { photosForStep } = usePhotoQueue(activeCompletion?.localId ?? null)
  const currentStepPhotos = currentStep ? photosForStep(currentStep.id) : []
  const photoGateMet = !currentStep?.photo_required || currentStepPhotos.length > 0

  const sections = sop.sop_sections
  const hazardsSection = sections.find((s) => s.section_type.includes('hazard')) as SopSection | undefined
  const ppeSection = sections.find((s) =>
    s.section_type.includes('ppe') || s.section_type.includes('protective')
  ) as SopSection | undefined
  const emergencySection = sections.find((s) => s.section_type.includes('emergency')) as SopSection | undefined

  const handleStepChange = useCallback(
    async (stepId: string) => {
      const params = new URLSearchParams(search.toString())
      params.set('step', stepId)
      router.push(`?${params.toString()}`, { scroll: false })
      void upsertWalkthroughProgress({ sopId: sop.id, stepId })
    },
    [router, search, sop.id]
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
    async (stepId: string) => {
      if (!activeCompletion) {
        await completionStore.startCompletion(sopId, sop.version)
      }
      walkthroughStore.markStepComplete(sopId, stepId)
      await completionStore.markStepCompleted(sopId, stepId)
      // Auto-advance to next uncompleted step
      const idx = allSteps.findIndex((s) => s.id === stepId)
      const next = allSteps.slice(idx + 1).find((s) => !completedSteps.has(s.id))
      if (next) void handleStepChange(next.id)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeCompletion, completionStore, walkthroughStore, sopId, sop.version, allSteps, completedSteps]
  )

  async function handleSubmit() {
    if (!activeCompletion) return
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
      })

      if (result.success) {
        await completionStore.clearCompletion(sopId)
        walkthroughStore.resetWalkthrough(sopId)
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
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 gap-6 text-center">
        <CheckCircle2 size={64} className="text-green-500" />
        <div>
          <p className="text-2xl font-bold text-[var(--ink-900)] mb-2">Completion submitted</p>
          <p className="text-sm text-[var(--ink-500)]">Your supervisor has been notified.</p>
        </div>
        <button
          type="button"
          onClick={() => { setSubmitted(false); walkthroughStore.resetWalkthrough(sopId) }}
          className="px-6 py-3 rounded-xl border border-[var(--ink-300)] text-sm font-medium text-[var(--ink-700)] hover:border-[var(--ink-900)] transition-colors"
        >
          Start another walkthrough
        </button>
      </div>
    )
  }

  // ── Main layout ────────────────────────────────────────────────
  return (
    <div className="responsive-walkthrough-root pb-[144px]">
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
            <span className="mono text-[11px] text-[var(--ink-400)]">{pct}%</span>
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
          {allDone ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitLoading}
              className={[
                'w-full h-[64px] rounded-xl font-bold text-base transition-all flex flex-col items-center justify-center gap-0.5',
                submitLoading
                  ? 'bg-[var(--accent-decision)]/40 text-white/60 cursor-not-allowed'
                  : 'bg-[var(--accent-decision)] text-white hover:opacity-90',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <ClipboardCheck size={20} />
                {submitLoading ? 'Submitting…' : 'Submit Completion'}
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
              <button
                type="button"
                onClick={() => currentStep && void handleMarkComplete(currentStep.id)}
                disabled={!photoGateMet}
                className={[
                  'w-full h-[64px] rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2',
                  !photoGateMet
                    ? 'bg-[var(--ink-200)] text-[var(--ink-400)] cursor-not-allowed'
                    : 'bg-[var(--ink-900)] text-[var(--paper)] hover:opacity-90',
                ].join(' ')}
              >
                Mark step {currentIdx + 1} complete
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
}
