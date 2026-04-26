'use client'
import { useContext, useState } from 'react'
import { z } from 'zod'
import { VoiceCaptureControl } from '@/components/sop/VoiceCaptureControl'
import { SopBlockContext } from '@/components/sop/SopBlockContext'
import { createClient } from '@/lib/supabase/client'
import { saveVoiceNote } from '@/actions/voice-notes'

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
  const ctx = useContext(SopBlockContext)
  const [value, setValue] = useState('')

  const range = tolerance
    ? [
        tolerance.min != null ? `≥${tolerance.min}` : null,
        tolerance.max != null ? `≤${tolerance.max}` : null,
        tolerance.target != null ? `target ${tolerance.target}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : null

  const handleCaptured = async (payload: { blob: Blob; transcript: string; confidence: number; ext: string }) => {
    if (!ctx) return
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const raw = session?.access_token?.split('.')[1]
      const claims = raw
        ? (JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((raw.length + 3) % 4))) as { organisation_id?: string })
        : {}
      const orgId = claims.organisation_id
      if (!orgId) return
      const fileId = crypto.randomUUID()
      const storagePath = `${orgId}/voice/${ctx.sopId}/${fileId}.${payload.ext}`
      const { error: uploadErr } = await supabase.storage
        .from('sop-voice-notes')
        .upload(storagePath, payload.blob, { contentType: payload.blob.type })
      if (uploadErr) { console.error('[voice] storage upload failed', uploadErr); return }
      await saveVoiceNote({
        sopId: ctx.sopId,
        sectionId: ctx.sectionId,
        stepId: ctx.stepId,
        completionId: ctx.completionId,
        blockType: 'measurement',
        transcript: payload.transcript,
        confidence: payload.confidence,
        language: 'en-NZ',
        audioStoragePath: storagePath,
      })
    } catch (err) {
      console.error('[voice] online persist failed', err)
    }
  }

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
            <span className="text-xs mt-1" style={{ color: 'var(--ink-500, #6b7280)' }}>
              {range}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            aria-label={`${label} value`}
            className="w-24 px-2 py-1 border border-[var(--ink-300,#d1d5db)] rounded text-right font-mono bg-white"
          />
          <span className="text-sm" style={{ color: 'var(--ink-700, #374151)' }}>
            {unit}
          </span>
          {voiceEnabled && ctx && (
            <VoiceCaptureControl
              target="measurement"
              sopId={ctx.sopId}
              sectionId={ctx.sectionId}
              stepId={ctx.stepId}
              completionId={ctx.completionId}
              language="en-NZ"
              onTranscript={(text) => {
                // Deepgram numerals=true biases spoken numbers → digits
                const numeric = text.replace(/[^\d.-]/g, '')
                if (numeric) setValue(numeric)
              }}
              onCaptured={handleCaptured}
            />
          )}
          {voiceEnabled && !ctx && (
            // Fallback when no SopBlockContext — render static mic indicator
            <span
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--accent-measure)] text-base opacity-40"
              style={{ color: 'var(--accent-measure)' }}
              title="Voice capture requires SopBlockContext"
            >
              🎤
            </span>
          )}
        </div>
      </div>
      {hint && (
        <p className="text-xs mt-2" style={{ color: 'var(--ink-500, #6b7280)' }}>
          {hint}
        </p>
      )}
    </section>
  )
}
