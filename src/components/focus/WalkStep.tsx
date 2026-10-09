'use client'

/**
 * One step, alone (D-07, FOC-04): progress, kind chip, 28 px text, the hazard /
 * PPE card, tip, images, a photo button where one is asked for, and ONE 60 px
 * primary. Labels come only from primaryLabel() in lib/sop/focus. The press is
 * handled by useWalk, which writes to the server before the screen moves.
 * Text renders as React children only.
 */
import { useEffect, useRef } from 'react'
import { AlertTriangle, Camera, Check, Lightbulb, ShieldCheck } from 'lucide-react'
import { primaryLabel, type WalkEntry } from '@/lib/sop/focus'
import type { FocusStepRow } from '@/lib/sop/focus-read'
import { KindChip } from '@/components/focus/KindChip'
import { StandardLabels } from '@/components/sop/StandardLabels'

/** Full class strings (Tailwind cannot see built-up names): the hazard / PPE card per kind. */
const CARD = {
  hazard: 'border-accent-hazard/40 border-l-accent-hazard bg-accent-hazard/10',
  ppe: 'border-accent-decision/40 border-l-accent-decision bg-accent-decision/10',
} as const

export interface WalkStepProps {
  entry: WalkEntry<FocusStepRow>
  total: number
  /** Finishing this step finishes the walk. */
  isLast: boolean
  standardNames: string[]
  /** Standards attached to the step's section, shown beside the group label. */
  groupStandardNames: string[]
  hasPhoto: boolean
  previewUrl?: string
  busy: boolean
  error: string | null
  hasPrevious: boolean
  onComplete(): void
  onPhoto(file: File): void
  onPrevious(): void
}

export function WalkStep({
  entry,
  total,
  isLast,
  standardNames,
  groupStandardNames,
  hasPhoto,
  previewUrl,
  busy,
  error,
  hasPrevious,
  onComplete,
  onPhoto,
  onPrevious,
}: WalkStepProps) {
  const { step } = entry
  const textRef = useRef<HTMLParagraphElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const needsPhoto = step.photo_required && !hasPhoto
  const blocked = busy || needsPhoto
  const label = primaryLabel(step.kind, isLast)

  // Focus follows the step (this effect never navigates).
  useEffect(() => {
    textRef.current?.focus({ preventScroll: true })
  }, [step.id])

  // Enter = primary, ← = previous; a focused control keeps its own Enter.
  const latest = useRef({ blocked, hasPrevious, onComplete, onPrevious })
  latest.current = { blocked, hasPrevious, onComplete, onPrevious }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t && t.matches('button, a, input, textarea, select, [contenteditable]')) return
      const cur = latest.current
      if (e.key === 'Enter' && !cur.blocked) cur.onComplete()
      else if (e.key === 'ArrowLeft' && cur.hasPrevious) cur.onPrevious()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const carded = step.kind === 'hazard' || step.kind === 'ppe'
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {step.kind === 'hazard' && <AlertTriangle className="size-4 text-accent-hazard" aria-hidden="true" />}
        {step.kind === 'ppe' && <ShieldCheck className="size-4 text-accent-decision" aria-hidden="true" />}
        <KindChip kind={step.kind} />
        <StandardLabels names={standardNames} />
      </div>
      <p ref={textRef} tabIndex={-1} data-testid="walk-step-text" className="text-step font-semibold text-ink-900 outline-none">
        {step.text}
      </p>
    </>
  )

  return (
    <div data-testid="walk-step" data-kind={step.kind} className="mx-auto flex min-h-full w-full max-w-205 flex-col px-4 pt-8 lg:px-8 lg:pb-8">
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="h-1 rounded-full bg-ink-100" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={entry.index}>
            <div className="h-1 rounded-full bg-accent-step" style={{ width: `${(entry.index / total) * 100}%` }} />
          </div>
          <p data-testid="walk-progress" className="mono text-meta text-ink-600">
            Step {entry.index} of {total}
          </p>
          <span className="sr-only" aria-live="polite">
            Step {entry.index} of {total}
          </span>
        </div>

        <p className="mono flex flex-wrap items-center gap-2 text-meta uppercase text-ink-600">
          {entry.groupLabel}
          <StandardLabels names={groupStandardNames} />
        </p>

        {carded ? (
          <div
            data-testid="walk-card"
            className={`flex flex-col gap-4 rounded-lg border border-l-4 p-4 ${CARD[step.kind as 'hazard' | 'ppe']}`}
          >
            {body}
          </div>
        ) : (
          <div className="flex flex-col gap-4">{body}</div>
        )}

        {step.tip && (
          <div className="flex items-start gap-2 rounded-lg border border-ink-200 bg-paper-2 p-4">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-ink-500" aria-hidden="true" />
            <p className="text-reading text-ink-900">
              <span className="mono mr-2 text-meta uppercase text-ink-600">Tip</span>
              {step.tip}
            </p>
          </div>
        )}

        {step.image_urls.map((img) => (
          <img key={img.path} src={img.url} alt="" loading="lazy" decoding="async" className="max-h-96 w-full rounded-lg object-contain" />
        ))}
      </div>

      <div
        data-testid="walk-dock"
        className="mt-6 flex flex-col gap-3 max-lg:sticky max-lg:bottom-0 max-lg:-mx-4 max-lg:border-t max-lg:border-ink-200 max-lg:bg-paper max-lg:px-4 max-lg:pt-4"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        {step.photo_required && (
          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              data-testid="step-photo-input"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (file) onPhoto(file)
              }}
            />
            {hasPhoto ? (
              <div className="flex items-center gap-3">
                {previewUrl ? (
                  <img data-testid="step-photo" src={previewUrl} alt="Your photo for this step" className="size-18 rounded-lg object-cover" />
                ) : (
                  <span data-testid="step-photo" className="flex size-18 items-center justify-center rounded-lg border border-ink-200 bg-paper-2">
                    <Check className="size-6 text-accent-ok" aria-hidden="true" />
                  </span>
                )}
                <button
                  type="button"
                  data-testid="step-photo-retake"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex min-h-tap-glove flex-1 items-center justify-center gap-2 rounded-lg border border-ink-300 bg-paper-1 text-reading text-ink-900"
                >
                  <Camera className="size-5" aria-hidden="true" />
                  Retake
                </button>
              </div>
            ) : (
              <button
                type="button"
                data-testid="step-photo-button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="inline-flex min-h-tap-glove w-full items-center justify-center gap-2 rounded-lg border border-ink-300 bg-paper-1 text-reading text-ink-900"
              >
                <Camera className="size-5" aria-hidden="true" />
                Add a photo
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          data-testid="walk-primary"
          disabled={blocked}
          aria-disabled={blocked}
          onClick={onComplete}
          className={`min-h-tap-glove w-full rounded-lg text-reading font-semibold ${blocked ? 'bg-ink-300 text-ink-500' : 'bg-ink-900 text-paper'}`}
        >
          {label}
        </button>
        {needsPhoto && <p className="text-ui text-ink-500">Add a photo to continue.</p>}
        {error && (
          <p role="alert" data-testid="walk-error" className="text-ui text-accent-escalate">
            {error}
          </p>
        )}

        {hasPrevious && (
          <button type="button" data-testid="walk-previous" onClick={onPrevious} className="min-h-tap text-ui text-ink-700">
            ← Previous step
          </button>
        )}
      </div>
    </div>
  )
}
