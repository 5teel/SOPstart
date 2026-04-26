import { z } from 'zod'

export const MeasurementBlockPropsSchema = z.object({
  label: z.string().min(1).max(120),
  unit: z.string().min(1).max(20),
  tolerance: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      target: z.number().optional(),
    })
    .optional(),
  voiceEnabled: z.boolean().default(true),
  hint: z.string().max(200).optional(),
})
export type MeasurementBlockProps = z.infer<typeof MeasurementBlockPropsSchema>

export function MeasurementBlock({
  label,
  unit,
  tolerance,
  voiceEnabled = true,
  hint,
}: MeasurementBlockProps) {
  const range = tolerance
    ? [
        tolerance.min != null ? `≥${tolerance.min}` : null,
        tolerance.max != null ? `≤${tolerance.max}` : null,
        tolerance.target != null ? `target ${tolerance.target}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null
  return (
    <section
      className="mb-4 border rounded-xl p-5"
      style={{
        borderColor: 'var(--accent-measure)',
        background: 'color-mix(in srgb, var(--accent-measure) 8%, white)',
      }}
      data-block="measurement"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <span
            className="text-[11px] font-mono uppercase tracking-wider"
            style={{ color: 'var(--accent-measure)' }}
          >
            Measurement
          </span>
          <strong className="text-base font-semibold">{label}</strong>
          {range && (
            <span
              className="text-xs mt-1"
              style={{ color: 'var(--ink-500, #6b7280)' }}
            >
              {range}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            type="text"
            inputMode="decimal"
            aria-label={`${label} value`}
            className="w-24 px-2 py-1 border border-[var(--ink-300,#d1d5db)] rounded text-right font-mono bg-white"
          />
          <span
            className="text-sm"
            style={{ color: 'var(--ink-700, #374151)' }}
          >
            {unit}
          </span>
          {voiceEnabled && (
            <button
              type="button"
              aria-label={`Capture ${label} by voice`}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--accent-measure)] text-base"
              style={{ color: 'var(--accent-measure)' }}
              data-voice-target="measurement"
              data-wave4-wiring="VoiceCaptureControl"
            >
              🎤
            </button>
          )}
        </div>
      </div>
      {hint && (
        <p
          className="text-xs mt-2"
          style={{ color: 'var(--ink-500, #6b7280)' }}
        >
          {hint}
        </p>
      )}
    </section>
  )
}
