'use client'
import { useParams, useRouter } from 'next/navigation'
import { X, PartyPopper, ArrowLeft, ArrowRight } from 'lucide-react'
import { useSopDetail } from '@/hooks/useSopDetail'
import { useWalkthroughStore } from '@/stores/walkthrough'
import { SafetyAcknowledgement } from '@/components/sop/SafetyAcknowledgement'
import { StepProgress } from '@/components/sop/StepProgress'
import { WalkthroughList } from '@/components/sop/WalkthroughList'
import type { SopSection, SopStep, SopImage } from '@/types/sop'

type SectionWithChildren = SopSection & { sop_steps: SopStep[]; sop_images: SopImage[] }

export default function WalkthroughPage() {
  const params = useParams()
  const router = useRouter()
  const sopId = params.sopId as string

  const { data: sop, isLoading } = useSopDetail(sopId)
  const store = useWalkthroughStore()

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        {/* Top bar skeleton */}
        <div className="flex-shrink-0 h-[56px] bg-steel-900 border-b border-steel-700 px-4 flex items-center gap-3 animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-steel-700" />
          <div className="flex-1 h-4 rounded bg-steel-700" />
        </div>
        {/* Progress skeleton */}
        <div className="flex-shrink-0 px-4 pt-3 pb-4 bg-steel-900 animate-pulse">
          <div className="h-2 bg-steel-700 rounded-full mb-2" />
          <div className="flex justify-between">
            <div className="h-3 w-24 bg-steel-700 rounded" />
            <div className="h-3 w-16 bg-steel-700 rounded" />
          </div>
        </div>
        {/* Content skeleton */}
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

  function handleAcknowledge() {
    store.acknowledgeSafety(sopId)
  }

  function handleMarkActive() {
    if (allDone) {
      router.push(`/sops/${sopId}`)
      return
    }
    if (activeStep) {
      store.markStepComplete(sopId, activeStep.id)
    }
  }

  function handlePrevious() {
    // Navigate to the previous step (highlight it) — does not undo completion
    if (activeIndex > 0) {
      // scroll to the step above active
      const prevStep = allSteps[activeIndex - 1]
      if (prevStep) {
        const el = document.getElementById(`step-${prevStep.id}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  function handleSkip() {
    // Advance past the active step without marking it complete
    if (activeStep && activeIndex < allSteps.length - 1) {
      // Temporarily mark the step to skip to the next one, then unmark it
      // Actually: just mark active step complete — semantically "skip" still advances
      // Per spec: "advances to next step without marking complete"
      // We do this by marking the NEXT step as the visual focus — no store mutation
      const nextStep = allSteps[activeIndex + 1]
      if (nextStep) {
        const el = document.getElementById(`step-${nextStep.id}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }

  // Short title for top bar
  const displayTitle = sop.title ?? 'Walkthrough'
  const stepCountLabel = `${completedCount}/${totalSteps}`

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
        <span className="text-sm font-mono text-steel-400 tabular-nums flex-shrink-0">
          {stepCountLabel}
        </span>
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
          />
        ) : (
          <div className="py-12 text-center text-steel-400">
            <p>No steps found for this SOP.</p>
          </div>
        )}
      </div>

      {/* Fixed bottom action area */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-steel-900 border-t border-steel-700 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))]">
        {/* Primary action button */}
        <button
          type="button"
          onClick={handleMarkActive}
          className={[
            'w-full h-[72px] rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2',
            allDone
              ? 'bg-green-500 text-white hover:bg-green-400'
              : 'bg-brand-yellow text-steel-900 hover:bg-amber-400',
          ].join(' ')}
        >
          {allDone ? (
            <>
              <PartyPopper size={22} />
              Finish SOP — all steps done
            </>
          ) : (
            `Mark step ${(activeIndex + 1)} complete`
          )}
        </button>

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
