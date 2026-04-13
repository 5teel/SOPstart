'use client'

export type PipelineStageKey = 'uploading' | 'parsing' | 'review' | 'generating' | 'ready'
export type PipelineStageState = PipelineStageKey | 'error'

const STAGES: { key: PipelineStageKey; label: string }[] = [
  { key: 'uploading', label: 'Uploading' },
  { key: 'parsing', label: 'Parsing' },
  { key: 'review', label: 'Review' },
  { key: 'generating', label: 'Generating video' },
  { key: 'ready', label: 'Ready' },
]

interface PipelineStepperProps {
  currentStage: PipelineStageState
  errorAtStage?: PipelineStageKey | null
}

export function PipelineStepper({ currentStage, errorAtStage = null }: PipelineStepperProps) {
  const currentIndex =
    currentStage === 'error'
      ? STAGES.findIndex((s) => s.key === errorAtStage)
      : STAGES.findIndex((s) => s.key === currentStage)

  return (
    <div
      role="group"
      aria-label="Pipeline stages"
      className="flex items-center gap-1 overflow-x-auto"
    >
      {STAGES.map((stage, idx) => {
        const isError = errorAtStage === stage.key
        const isActive = !isError && idx === currentIndex && currentStage !== 'error'
        const isComplete = !isError && idx < currentIndex

        const labelClass = isError
          ? 'text-xs text-red-400 font-semibold whitespace-nowrap px-1'
          : isActive
            ? 'text-xs text-brand-yellow font-semibold whitespace-nowrap px-1'
            : isComplete
              ? 'text-xs text-green-400 whitespace-nowrap px-1'
              : 'text-xs text-steel-600 whitespace-nowrap px-1'

        const connectorClass =
          isComplete || (isActive && !isError)
            ? 'h-px flex-1 min-w-[8px] bg-brand-yellow'
            : 'h-px flex-1 min-w-[8px] bg-steel-700'

        return (
          <div key={stage.key} className="flex items-center gap-1 shrink-0">
            <span className={labelClass} aria-current={isActive ? 'step' : undefined}>
              {stage.label}
            </span>
            {idx < STAGES.length - 1 && <span aria-hidden="true" className={connectorClass} />}
          </div>
        )
      })}
    </div>
  )
}
