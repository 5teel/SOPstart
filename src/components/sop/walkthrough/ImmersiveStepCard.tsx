'use client'
import { useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle2, Camera, X } from 'lucide-react'
import { useWalkthroughStore } from '@/stores/walkthrough'
import { removePhoto } from '@/hooks/usePhotoQueue'
import type { SopWithSections } from '@/types/sop'
import type { QueuedPhoto } from '@/lib/offline/db'

interface Props {
  sop: SopWithSections
  onStepChange: (stepId: string) => void
  completedSteps?: Set<string>
  stepPhotos: QueuedPhoto[]
  onCapturePhoto: (stepId: string, file: File) => Promise<void>
}

export function ImmersiveStepCard({ sop, onStepChange, completedSteps, stepPhotos, onCapturePhoto }: Props) {
  const search = useSearchParams()
  const lockedSteps = useWalkthroughStore((s) => s.lockedSteps)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const steps = sop.sop_sections.flatMap((s) => s.sop_steps ?? [])
  const currentId = search.get('step') ?? steps[0]?.id
  const currentIdx = Math.max(0, steps.findIndex((s) => s.id === currentId))
  const current = steps[currentIdx]
  if (!current) return null

  const prev = steps[currentIdx - 1]
  const next = steps[currentIdx + 1]
  const sectionTitle =
    sop.sop_sections.find((s) => (s.sop_steps ?? []).some((st) => st.id === current.id))?.title ??
    'Section'
  const locked = !!lockedSteps[current.id]
  const done = completedSteps?.has(current.id) ?? false

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    await onCapturePhoto(current.id, file)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <article className="immersive-step-card bg-grid flex flex-col" data-immersive="true">
      <header className="px-4 py-3 border-b border-[var(--ink-100)] flex items-center justify-between">
        <div className="mono text-[11px] uppercase tracking-wider text-[var(--ink-500)] truncate">
          {sectionTitle} · Step {currentIdx + 1}/{steps.length}
        </div>
        {done && (
          <div className="flex items-center gap-1 text-green-600 flex-shrink-0">
            <CheckCircle2 size={14} />
            <span className="mono text-[11px] uppercase tracking-wider">Done</span>
          </div>
        )}
      </header>

      <div className="flex-1 px-4 py-6 overflow-y-auto">
        <h2 className={`text-lg font-semibold mb-3 ${done ? 'line-through opacity-50' : ''}`}>
          {current.text}
        </h2>
        {current.warning && (
          <p className="text-sm text-[var(--accent-escalate)] mt-2">⚠ {current.warning}</p>
        )}
        {current.caution && (
          <p className="text-sm text-[var(--accent-decision)] mt-2">⚡ {current.caution}</p>
        )}
        {current.tip && (
          <p className="text-sm text-[var(--ink-500)] mt-2">💡 {current.tip}</p>
        )}
        {current.required_tools && current.required_tools.length > 0 && (
          <div className="mt-3">
            <span className="mono text-[11px] uppercase tracking-wider text-[var(--ink-500)]">
              Tools required:
            </span>
            <ul className="mt-1 space-y-1">
              {current.required_tools.map((tool, i) => (
                <li key={i} className="text-sm text-[var(--ink-700)]">• {tool}</li>
              ))}
            </ul>
          </div>
        )}
        {current.time_estimate_minutes != null && (
          <p className="text-xs text-[var(--ink-500)] mt-3">
            Est. {current.time_estimate_minutes} min
          </p>
        )}

        {/* Evidence capture grid — shown when step requires a photo and isn't complete */}
        {current.photo_required && !done && (
          <div className="mt-5 pt-4 border-t border-[var(--ink-100)]">
            <span className="mono text-[11px] uppercase tracking-wider text-[var(--ink-500)]">
              Evidence Required
            </span>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--ink-300)] text-sm text-[var(--ink-600)] cursor-pointer hover:border-[var(--ink-500)] transition-colors">
                <Camera size={15} />
                <span>Add photo</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </label>
              {stepPhotos.map((photo) => (
                <div
                  key={photo.localId}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[var(--ink-50)] border border-[var(--ink-100)] text-xs text-[var(--ink-600)]"
                >
                  {photo.uploaded ? (
                    <CheckCircle2 size={12} className="text-green-500 flex-shrink-0" />
                  ) : (
                    <div className="w-3 h-3 rounded-full border-2 border-[var(--accent-decision)] border-t-transparent animate-spin flex-shrink-0" />
                  )}
                  <span>{photo.uploaded ? 'Uploaded' : 'Queued'}</span>
                  {!photo.uploaded && (
                    <button
                      type="button"
                      onClick={() => void removePhoto(photo.localId)}
                      className="ml-0.5 text-[var(--ink-400)] hover:text-[var(--accent-escalate)] transition-colors"
                      aria-label="Remove photo"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {stepPhotos.length === 0 && (
              <p className="mt-1.5 text-xs text-[var(--ink-400)]">
                Required — tap to capture before marking step complete
              </p>
            )}
          </div>
        )}
      </div>

      {/* Gate bar — shown when an acknowledgement requirement locks this step */}
      {locked && (
        <div className="px-4 py-2.5 bg-[var(--accent-escalate)]/10 border-t border-[var(--accent-escalate)]/20 flex items-center gap-2 text-xs text-[var(--accent-escalate)]">
          🔒 Complete the required acknowledgement above to proceed
        </div>
      )}

      {/* Non-sticky footer — prev/next navigation only */}
      <footer className="bg-[var(--paper)] border-t border-[var(--ink-100)] px-4 py-3 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={!prev}
          onClick={() => prev && onStepChange(prev.id)}
          className="evidence-btn"
          style={{ opacity: prev ? 1 : 0.3 }}
          aria-label="Previous step"
        >
          ← Prev
        </button>
        <button
          type="button"
          disabled={!next || locked}
          onClick={() => next && !locked && onStepChange(next.id)}
          className="evidence-btn"
          style={{ opacity: next && !locked ? 1 : 0.3 }}
          aria-label="Next step"
        >
          Next →
        </button>
      </footer>
    </article>
  )
}
