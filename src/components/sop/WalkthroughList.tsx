'use client'
import { useState } from 'react'
import { ShieldAlert, ChevronDown, AlertTriangle, ShieldCheck } from 'lucide-react'
import { useWalkthroughStore } from '@/stores/walkthrough'
import type { SopSection, SopStep, SopImage } from '@/types/sop'
import { StepItem } from './StepItem'

type SectionWithChildren = SopSection & { sop_steps: SopStep[]; sop_images: SopImage[] }

interface WalkthroughListProps {
  sopId: string
  stepsSection: SectionWithChildren
  allImages: SopImage[]
  hazardsSection?: SopSection
  ppeSection?: SopSection
}

function parseListItems(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)
}

export function WalkthroughList({
  sopId,
  stepsSection,
  allImages,
  hazardsSection,
  ppeSection,
}: WalkthroughListProps) {
  const [safetyExpanded, setSafetyExpanded] = useState(false)
  const store = useWalkthroughStore()
  const completedSteps = store.getCompletedSteps(sopId)

  const sortedSteps = [...stepsSection.sop_steps].sort((a, b) => a.step_number - b.step_number)

  function handleToggle(stepId: string) {
    if (completedSteps.has(stepId)) {
      store.markStepIncomplete(sopId, stepId)
    } else {
      store.markStepComplete(sopId, stepId)
    }
  }

  // Determine the first non-completed step id
  const firstActiveId = sortedSteps.find((s) => !completedSteps.has(s.id))?.id ?? null

  return (
    <div>
      {/* Collapsible safety summary strip */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setSafetyExpanded((v) => !v)}
          className="flex items-center gap-3 px-4 py-3 bg-brand-orange/10 border border-brand-orange/30 rounded-xl w-full text-left cursor-pointer"
        >
          <ShieldAlert size={18} className="text-brand-orange flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-brand-orange">Safety summary</span>
            <span className="text-xs text-steel-400 ml-1">Tap to review</span>
          </div>
          <ChevronDown
            size={16}
            className={`text-steel-400 flex-shrink-0 transition-transform duration-200 ${safetyExpanded ? 'rotate-180' : ''}`}
          />
        </button>

        {safetyExpanded && (
          <div className="mt-3 flex flex-col gap-4">
            {hazardsSection?.content && (
              <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-red-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-red-400">
                    Hazards
                  </span>
                </div>
                <ul className="list-none space-y-2">
                  {parseListItems(hazardsSection.content).map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-steel-100">
                      <span className="text-red-400">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {ppeSection?.content && (
              <div className="bg-blue-500/10 border border-blue-500/40 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={16} className="text-blue-400" />
                  <span className="text-xs font-bold uppercase tracking-widest text-blue-400">
                    PPE Required
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {parseListItems(ppeSection.content).map((item, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 text-blue-300 text-sm font-medium rounded-lg border border-blue-500/30"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setSafetyExpanded(false)}
              className="text-sm text-steel-400 hover:text-steel-100 py-2 text-center"
            >
              Close
            </button>
          </div>
        )}
      </div>

      {/* Steps list */}
      <div className="flex flex-col">
        {sortedSteps.map((step) => {
          const isCompleted = completedSteps.has(step.id)
          const isActive = !isCompleted && step.id === firstActiveId
          const status = isCompleted ? 'completed' : isActive ? 'active' : 'upcoming'
          const stepImages = allImages.filter((img) => img.step_id === step.id)

          return (
            <StepItem
              key={step.id}
              step={step}
              status={status}
              images={stepImages}
              onToggle={() => handleToggle(step.id)}
            />
          )
        })}
      </div>
    </div>
  )
}
