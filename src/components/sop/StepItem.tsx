'use client'
import { AlertTriangle, CheckCircle2, Circle } from 'lucide-react'
import type { SopStep, SopImage } from '@/types/sop'
import type { QueuedPhoto } from '@/lib/offline/db'
import { SopImageInline } from './SopImageInline'
import { StepPhotoZone } from './StepPhotoZone'

type StepStatus = 'upcoming' | 'active' | 'completed'

interface StepItemProps {
  step: SopStep
  status: StepStatus
  images: SopImage[]
  onToggle: () => void
  // Photo zone props — provided when a completion is active
  completionLocalId: string | null
  stepPhotos: QueuedPhoto[]
  onAddPhoto: (file: File) => Promise<void>
  onRemovePhoto: (localId: string) => void
}

const borderByStatus: Record<StepStatus, string> = {
  active: 'border-brand-yellow bg-steel-800/60',
  completed: 'border-green-500/40 bg-green-500/5',
  upcoming: 'border-transparent opacity-80',
}

export function StepItem({
  step,
  status,
  images,
  onToggle,
  completionLocalId,
  stepPhotos,
  onAddPhoto,
  onRemovePhoto,
}: StepItemProps) {
  function handleClick() {
    if ('vibrate' in navigator) navigator.vibrate(30)
    onToggle()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() }}
      className={[
        'flex items-start gap-4 px-4 py-5',
        'border-l-4 transition-all duration-150',
        'min-h-[72px] cursor-pointer',
        borderByStatus[status],
      ].join(' ')}
    >
      {/* Left: step number or check */}
      <div className="flex-shrink-0 w-8 pt-0.5">
        {status === 'completed' ? (
          <CheckCircle2 size={20} className="text-green-400" />
        ) : (
          <span className="text-[13px] font-bold tabular-nums text-steel-400">
            {step.step_number}
          </span>
        )}
      </div>

      {/* Centre: step content */}
      <div className="flex-1 min-w-0">
        <p className="text-lg font-normal text-steel-100 leading-relaxed">{step.text}</p>

        {/* Warning annotation */}
        {step.warning && (
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-brand-orange/20 text-brand-orange text-xs font-bold uppercase tracking-wide rounded border border-brand-orange/30 mt-2">
            <AlertTriangle size={12} />
            {step.warning}
          </div>
        )}

        {/* Caution annotation */}
        {step.caution && (
          <div className="inline-flex items-center gap-1 px-2 py-1 bg-brand-orange/20 text-brand-orange text-xs font-bold uppercase tracking-wide rounded border border-brand-orange/30 mt-2 ml-1">
            <AlertTriangle size={12} />
            {step.caution}
          </div>
        )}

        {/* Inline images */}
        {images.map((img) => (
          <SopImageInline
            key={img.id}
            src={img.storage_path}
            alt={img.alt_text ?? 'Step image'}
          />
        ))}

        {/* Photo zone — only when a completion is active */}
        {completionLocalId && (
          <StepPhotoZone
            step={step}
            completionLocalId={completionLocalId}
            photos={stepPhotos}
            onAddPhoto={onAddPhoto}
            onRemovePhoto={onRemovePhoto}
          />
        )}
      </div>

      {/* Right: tap target */}
      <div className="flex-shrink-0 min-w-[44px] min-h-[72px] flex items-center justify-center">
        {status === 'completed' ? (
          <CheckCircle2 size={28} className="text-green-400" />
        ) : (
          <Circle size={28} className="text-steel-600 hover:text-brand-yellow" />
        )}
      </div>
    </div>
  )
}
