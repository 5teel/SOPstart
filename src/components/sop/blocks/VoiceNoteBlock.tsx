'use client'
import { useContext, useState } from 'react'
import { z } from 'zod'
import { VoiceCaptureControl } from '@/components/sop/VoiceCaptureControl'
import { SopBlockContext } from '@/components/sop/SopBlockContext'
import { createClient } from '@/lib/supabase/client'
import { saveVoiceNote } from '@/actions/voice-notes'

export const VoiceNoteBlockPropsSchema = z.object({
  prompt: z.string().min(1).max(200),
  language: z.enum(['en-NZ', 'en-AU', 'en-US']).default('en-NZ'),
  maxDurationSec: z.number().int().min(5).max(300).default(60),
})
export type VoiceNoteBlockProps = z.infer<typeof VoiceNoteBlockPropsSchema>

export function VoiceNoteBlock({
  prompt,
  language = 'en-NZ',
  maxDurationSec = 60,
}: VoiceNoteBlockProps) {
  const ctx = useContext(SopBlockContext)
  const [saved, setSaved] = useState<string | null>(null)

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
        blockType: 'note',
        transcript: payload.transcript,
        confidence: payload.confidence,
        language,
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
        borderColor: 'var(--accent-voice)',
        background: 'color-mix(in srgb, var(--accent-voice) 6%, white)',
      }}
      data-block="voice-note"
      data-language={language}
      data-max-duration={maxDurationSec}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className="text-[11px] font-mono uppercase tracking-wider"
          style={{ color: 'var(--accent-voice)' }}
        >
          Voice note
        </span>
      </div>
      <p className="text-base font-semibold">{prompt}</p>
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        {ctx ? (
          <VoiceCaptureControl
            target="note"
            sopId={ctx.sopId}
            sectionId={ctx.sectionId}
            stepId={ctx.stepId}
            completionId={ctx.completionId}
            language={language}
            onTranscript={(transcript) => {
              setSaved(transcript)
            }}
            onCaptured={handleCaptured}
          />
        ) : (
          // Fallback when no SopBlockContext available (e.g. admin preview)
          <button
            type="button"
            aria-label={`Record voice note (${language}, max ${maxDurationSec}s)`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium opacity-40"
            style={{
              borderColor: 'var(--accent-voice)',
              color: 'var(--accent-voice)',
              background: 'white',
            }}
            disabled
          >
            🎤 Record
          </button>
        )}
        <span className="text-xs" style={{ color: 'var(--ink-500, #6b7280)' }}>
          {language} · up to {maxDurationSec}s
        </span>
      </div>
      {saved && (
        <p className="text-sm mt-3 p-2 bg-white rounded border border-[var(--ink-100)]">
          &ldquo;{saved}&rdquo;
        </p>
      )}
    </section>
  )
}
