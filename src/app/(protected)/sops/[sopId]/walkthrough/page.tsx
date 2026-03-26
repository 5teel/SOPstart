'use client'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import { X, ArrowLeft, ArrowRight, CloudUpload, ClipboardCheck, CheckCircle2, AlertTriangle } from 'lucide-react'
import { useSopDetail } from '@/hooks/useSopDetail'
import { useWalkthroughStore } from '@/stores/walkthrough'
import { useCompletionStore } from '@/stores/completionStore'
import { usePhotoQueue, addPhotoToQueue, removePhoto } from '@/hooks/usePhotoQueue'
import { SafetyAcknowledgement } from '@/components/sop/SafetyAcknowledgement'
import { StepProgress } from '@/components/sop/StepProgress'
import { WalkthroughList } from '@/components/sop/WalkthroughList'
import { submitCompletion } from '@/actions/completions'
import { flushPhotoQueue } from '@/lib/offline/sync-engine'
import { createClient } from '@/lib/supabase/client'
import { db } from '@/lib/offline/db'
import type { SopSection, SopStep, SopImage } from '@/types/sop'

type SectionWithChildren = SopSection & { sop_steps: SopStep[]; sop_images: SopImage[] }

// ---------------------------------------------------------------
// Content hash: SHA-256 of canonical step texts (client-side)
// ---------------------------------------------------------------
async function computeContentHash(steps: SopStep[]): Promise<string> {
  const canonical = [...steps]
    .sort((a, b) => a.step_number - b.step_number)
    .map((s) => `${s.step_number}:${s.text}`)
    .join('|')
  const data = new TextEncoder().encode(canonical)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export default function WalkthroughPage() {
  const params = useParams()
  const router = useRouter()
  const sopId = params.sopId as string

  const { data: sop, isLoading } = useSopDetail(sopId)
  const store = useWalkthroughStore()
  const completionStore = useCompletionStore()

  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Restore in-progress completion from Dexie on mount (D-02 resume)
  useEffect(() => {
    completionStore.restoreFromDexie(sopId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sopId])

  const activeCompletion = completionStore.getActiveCompletion(sopId)
  const completionLocalId = activeCompletion?.localId ?? null

  // Photo queue state for this completion
  const photoQueue = usePhotoQueue(completionLocalId)

  // Build photosByStep map for WalkthroughList
  const photosByStep: Record<string, typeof photoQueue.photos> = {}
  for (const photo of photoQueue.photos) {
    if (!photosByStep[photo.stepId]) photosByStep[photo.stepId] = []
    photosByStep[photo.stepId].push(photo)
  }

  // Attempt photo flush when going online
  useEffect(() => {
    async function flushOnline() {
      const supabase = createClient()
      await flushPhotoQueue(supabase)
    }

    window.addEventListener('online', flushOnline)
    return () => window.removeEventListener('online', flushOnline)
  }, [])

  // ---------------------------------------------------------------
  // Photo callbacks
  // ---------------------------------------------------------------
  const handleAddPhoto = useCallback(
    async (stepId: string, file: File) => {
      // Ensure completion is started before adding a photo
      let localId = completionLocalId
      if (!localId) {
        if (sop) {
          await completionStore.startCompletion(sopId, sop.version)
          const fresh = completionStore.getActiveCompletion(sopId)
          localId = fresh?.localId ?? null
        }
      }
      if (!localId) return

      await addPhotoToQueue({ completionLocalId: localId, stepId, file })

      // Attempt immediate upload if online
      if (navigator.onLine) {
        const supabase = createClient()
        flushPhotoQueue(supabase).catch(() => {})
      }
    },
    [completionLocalId, completionStore, sop, sopId]
  )

  const handleRemovePhoto = useCallback(async (localId: string) => {
    await removePhoto(localId)
  }, [])

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-shrink-0 h-[56px] bg-steel-900 border-b border-steel-700 px-4 flex items-center gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-steel-700" />
          <div className="flex-1 h-4 rounded bg-steel-700" />
        </div>
        <div className="flex-shrink-0 px-4 pt-3 pb-4 bg-steel-900 animate-pulse">
          <div className="h-2 bg-steel-700 rounded-full mb-2" />
          <div className="flex justify-between">
            <div className="h-3 w-24 bg-steel-700 rounded" />
            <div className="h-3 w-16 bg-steel-700 rounded" />
          </div>
        </div>
        <div className="flex-1 px-4 pt-4 space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[72px] bg-steel-800 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (!sop) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-4 gap-4">
        <p className="text-xl font-semibold text-steel-100">SOP not found</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-steel-400 hover:text-steel-100 underline"
        >
          Go back
        </button>
      </div>
    )
  }

  // Extract sections by type
  const sections = sop.sop_sections as SectionWithChildren[]
  const hazardsSection = sections.find((s) => s.section_type === 'hazards')
  const ppeSection = sections.find((s) => s.section_type === 'ppe')
  const emergencySection = sections.find((s) => s.section_type === 'emergency')
  const stepsSection = sections.find((s) => s.section_type === 'steps')

  // Collect all images across all sections
  const allImages: SopImage[] = sections.flatMap((s) => s.sop_images)

  // All steps (sorted)
  const allSteps = stepsSection
    ? [...stepsSection.sop_steps].sort((a, b) => a.step_number - b.step_number)
    : []

  const totalSteps = allSteps.length
  const completedSteps = store.getCompletedSteps(sopId)
  const completedCount = completedSteps.size
  const allDone = totalSteps > 0 && completedCount >= totalSteps

  // Current active step (first non-completed)
  const activeStep = allSteps.find((s) => !completedSteps.has(s.id))
  const activeIndex = activeStep ? allSteps.indexOf(activeStep) : allSteps.length

  const acknowledged = store.isAcknowledged(sopId)

  // Photo-required gate: is the active step requiring a photo that hasn't been taken?
  const activeStepPhotos = activeStep ? (photosByStep[activeStep.id] ?? []) : []
  const photoRequired = !!(activeStep?.photo_required && activeStepPhotos.length === 0)

  function handleAcknowledge() {
    store.acknowledgeSafety(sopId)
  }

  async function handleMarkActive() {
    if (allDone) return // Button replaced by Submit Completion
    if (!activeStep) return

    // Start completion record if not already started
    if (!completionLocalId) {
      await completionStore.startCompletion(sopId, sop!.version)
    }

    // Mark in both stores (memory + durable)
    store.markStepComplete(sopId, activeStep.id)
    await completionStore.markStepCompleted(sopId, activeStep.id)
  }

  function handlePrevious() {
    if (activeIndex > 0) {
      const prevStep = allSteps[activeIndex - 1]
      if (prevStep) {
        const el = document.getElementById(`step-${prevStep.id}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  function handleSkip() {
    if (activeStep && activeIndex < allSteps.length - 1) {
      const nextStep = allSteps[activeIndex + 1]
      if (nextStep) {
        const el = document.getElementById(`step-${nextStep.id}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  async function handleSubmitCompletion() {
    if (!sop || !activeCompletion) return
    setSubmitLoading(true)
    try {
      // Compute content hash from step texts
      const contentHash = await computeContentHash(allSteps)

      // Gather uploaded photo storage paths from Dexie
      const uploadedPhotos = await db.photoQueue
        .where('completionLocalId')
        .equals(activeCompletion.localId)
        .and((p) => p.uploaded && p.storagePath !== null)
        .toArray()

      const photoStoragePaths = uploadedPhotos.map((p) => ({
        localId: p.localId,
        stepId: p.stepId,
        storagePath: p.storagePath as string,
        contentType: p.contentType,
      }))

      // Update completion record status in Dexie before calling server
      await db.completions.update(activeCompletion.localId, {
        contentHash,
        status: 'submitted',
      })

      const result = await submitCompletion({
        localId: activeCompletion.localId,
        sopId,
        sopVersion: sop.version,
        contentHash,
        stepData: activeCompletion.stepCompletions,
        photoStoragePaths,
      })

      if (result.success) {
        // Clear completion from store (Dexie cleanup handled by sync-engine on next flush)
        await completionStore.clearCompletion(sopId)
        setSubmitted(true)
      } else {
        // Re-enable button on error (restore status in Dexie)
        await db.completions.update(activeCompletion.localId, { status: 'in_progress' })
        console.error('Submit completion error:', result.error)
      }
    } catch (err) {
      console.error('Submit completion exception:', err)
      if (activeCompletion) {
        await db.completions.update(activeCompletion.localId, { status: 'in_progress' }).catch(() => {})
      }
    } finally {
      setSubmitLoading(false)
    }
  }

  // Short title for top bar
  const displayTitle = sop.title ?? 'Walkthrough'
  const stepCountLabel = `${completedCount}/${totalSteps}`

  // ---------------------------------------------------------------
  // Submitted success state
  // ---------------------------------------------------------------
  if (submitted) {
    return (
      <>
        <div className="flex-shrink-0 fixed top-0 left-0 right-0 z-30 bg-steel-900 border-b border-steel-700 px-4 flex items-center gap-3 h-[56px]">
          <button
            type="button"
            onClick={() => router.push(`/sops/${sopId}`)}
            className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-steel-800 text-steel-400 hover:text-steel-100 transition-colors flex-shrink-0"
            aria-label="Back to SOP"
          >
            <X size={20} />
          </button>
          <span className="flex-1 text-base font-semibold text-steel-100 truncate">
            {displayTitle}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center h-full px-6 pt-[56px] gap-6 text-center">
          <CheckCircle2 size={64} className="text-green-400" />
          <div>
            <p className="text-2xl font-bold text-steel-100 mb-2">Completion submitted</p>
            <p className="text-sm text-steel-400">Your supervisor has been notified.</p>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/sops/${sopId}`)}
            className="px-6 py-3 rounded-xl bg-steel-800 text-steel-100 text-sm font-semibold hover:bg-steel-700 transition-colors"
          >
            Back to SOP
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      {/* Safety acknowledgement gate */}
      {!acknowledged && (
        <SafetyAcknowledgement
          sopId={sopId}
          hazardsSection={hazardsSection}
          ppeSection={ppeSection}
          emergencySection={emergencySection}
          onAcknowledge={handleAcknowledge}
        />
      )}

      {/* Fixed top bar */}
      <div className="flex-shrink-0 fixed top-0 left-0 right-0 z-30 bg-steel-900 border-b border-steel-700 px-4 flex items-center gap-3 h-[56px]">
        <button
          type="button"
          onClick={() => router.push(`/sops/${sopId}`)}
          className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-steel-800 text-steel-400 hover:text-steel-100 transition-colors flex-shrink-0"
          aria-label="Exit walkthrough"
        >
          <X size={20} />
        </button>
        <span className="flex-1 text-base font-semibold text-steel-100 truncate">
          {displayTitle}
        </span>
        {/* Photo queue indicator (replaces step counter when photos pending) */}
        {photoQueue.queueCount > 0 ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-brand-orange/20 border border-brand-orange/40 flex-shrink-0">
            <CloudUpload size={14} className="text-brand-orange" />
            <span className="text-[12px] font-semibold text-brand-orange tabular-nums">
              {photoQueue.queueCount} photo{photoQueue.queueCount !== 1 ? 's' : ''} queued
            </span>
          </div>
        ) : (
          <span className="text-sm font-mono text-steel-400 tabular-nums flex-shrink-0">
            {stepCountLabel}
          </span>
        )}
      </div>

      {/* Progress strip — sits below fixed top bar */}
      <div className="flex-shrink-0 pt-[56px]">
        <StepProgress completedCount={completedCount} totalSteps={totalSteps} />
      </div>

      {/* Scrollable step list */}
      <div className="flex-1 overflow-y-auto px-4 pb-[160px]">
        {stepsSection ? (
          <WalkthroughList
            sopId={sopId}
            stepsSection={stepsSection}
            allImages={allImages}
            hazardsSection={hazardsSection}
            ppeSection={ppeSection}
            completionLocalId={completionLocalId}
            photosByStep={photosByStep}
            onAddPhoto={handleAddPhoto}
            onRemovePhoto={handleRemovePhoto}
          />
        ) : (
          <div className="py-12 text-center text-steel-400">
            <p>No steps found for this SOP.</p>
          </div>
        )}
      </div>

      {/* Fixed bottom action area */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-steel-900 border-t border-steel-700 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">

        {allDone ? (
          <>
            {/* Photos-still-uploading warning */}
            {photoQueue.queueCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-brand-orange/10 border border-brand-orange/30">
                <AlertTriangle size={14} className="text-brand-orange flex-shrink-0" />
                <span className="text-xs text-brand-orange font-medium">
                  {photoQueue.queueCount} photo{photoQueue.queueCount !== 1 ? 's' : ''} still uploading — your completion will include all photos once synced
                </span>
              </div>
            )}
            {/* Submit Completion button */}
            <button
              type="button"
              onClick={handleSubmitCompletion}
              disabled={submitLoading}
              className={[
                'w-full h-[80px] rounded-xl font-bold text-lg transition-all flex flex-col items-center justify-center gap-1',
                submitLoading
                  ? 'bg-brand-yellow/50 text-steel-900/60 cursor-not-allowed'
                  : 'bg-brand-yellow text-steel-900 hover:bg-amber-400',
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <ClipboardCheck size={22} />
                {submitLoading ? 'Submitting...' : 'Submit Completion'}
              </div>
              <span className="text-xs font-normal opacity-75">
                Records your sign-off with a timestamp and all photos
              </span>
            </button>
          </>
        ) : (
          <>
            {/* Photo-required gate label */}
            {photoRequired && !allDone && (
              <p className="text-xs text-brand-orange font-medium text-center mb-2">
                Take the required photo before marking complete
              </p>
            )}
            {/* Mark Step Complete button */}
            <button
              type="button"
              onClick={handleMarkActive}
              disabled={photoRequired}
              aria-disabled={photoRequired}
              className={[
                'w-full h-[72px] rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2',
                photoRequired
                  ? 'bg-steel-700 text-steel-500 cursor-not-allowed'
                  : 'bg-brand-yellow text-steel-900 hover:bg-amber-400',
              ].join(' ')}
            >
              {`Mark step ${activeIndex + 1} complete`}
            </button>
          </>
        )}

        {/* Secondary row */}
        <div className="flex items-center justify-between h-[44px]">
          <button
            type="button"
            onClick={handlePrevious}
            className={[
              'flex items-center gap-1.5 px-3 h-full text-sm font-medium text-steel-400 hover:text-steel-100 transition-colors',
              activeIndex === 0 ? 'opacity-30 pointer-events-none' : '',
            ].join(' ')}
            disabled={activeIndex === 0}
            aria-disabled={activeIndex === 0}
          >
            <ArrowLeft size={16} />
            Previous
          </button>

          <button
            type="button"
            onClick={handleSkip}
            className="flex items-center gap-1.5 px-3 h-full text-sm font-medium text-steel-400 hover:text-steel-100 transition-colors"
          >
            Skip this step
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </>
  )
}
