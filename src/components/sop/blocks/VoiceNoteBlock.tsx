import { z } from 'zod'

export const VoiceNoteBlockPropsSchema = z.object({
  prompt: z.string().min(1).max(200),
  language: z.enum(['en-NZ', 'en-AU', 'en-US']).default('en-NZ'),
  maxDurationSec: z.number().int().min(5).max(300).default(60),
})
export type VoiceNoteBlockProps = z.infer<typeof VoiceNoteBlockPropsSchema>

// Old SOPs can still carry this section. It renders its prompt as plain text:
// there is nothing to record any more, but the section must not crash the page.
export function VoiceNoteBlock({
  prompt,
  language = 'en-NZ',
  maxDurationSec = 60,
}: VoiceNoteBlockProps) {
  return (
    <section
      className="mb-4 border rounded-lg p-5"
      style={{
        borderColor: 'var(--accent-voice)',
        background: 'color-mix(in srgb, var(--accent-voice) 6%, white)',
      }}
      data-block="voice-note"
      data-language={language}
      data-max-duration={maxDurationSec}
    >
      <p className="text-base font-semibold">{prompt}</p>
    </section>
  )
}
