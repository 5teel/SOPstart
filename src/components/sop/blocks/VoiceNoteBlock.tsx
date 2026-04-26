import { z } from 'zod'

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
      data-wave4-wiring="VoiceCaptureControl"
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
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          aria-label={`Record voice note (${language}, max ${maxDurationSec}s)`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium"
          style={{
            borderColor: 'var(--accent-voice)',
            color: 'var(--accent-voice)',
            background: 'white',
          }}
          data-voice-target="note"
        >
          🎤 Record
        </button>
        <span
          className="text-xs"
          style={{ color: 'var(--ink-500, #6b7280)' }}
        >
          {language} · up to {maxDurationSec}s
        </span>
      </div>
    </section>
  )
}
