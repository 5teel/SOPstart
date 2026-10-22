import Anthropic from '@anthropic-ai/sdk'
import { aiModel } from '@/lib/ai/registry'

// Lazy singleton — same pattern as llm.ts.
let anthropic: Anthropic | null = null
function getAnthropicClient(): Anthropic {
  if (!anthropic) anthropic = new Anthropic()
  return anthropic
}

// Without this, models summarise or refuse SOPs footed "CONFIDENTIAL / TRADE SECRETS" (OCR bake-off 2026-10-23).
export const OWNERSHIP_CONTEXT =
  'The organisation that owns this standard operating procedure uploaded its own copy so its workers can follow it in the SOPstart safety app.'

const SYSTEM = `You are the OCR step in SOPstart, a safety app for industrial sites. ${OWNERSHIP_CONTEXT} A full, faithful transcription is required: summarising or skipping text would drop safety steps.`

const PROMPT =
  'Transcribe every word of this scanned document exactly as written, in reading order, page by page. ' +
  'Render tables as Markdown tables and keep tick marks (X) in their cells. ' +
  'Output only the transcription: no commentary, no summary, nothing left out.'

// ponytail: opening-line check only; a summary that doesn't announce itself still gets through.
const REFUSAL = /^\s*(I can['’]?not|I can['’]t|I['’]m (not able|unable)|I am (not able|unable)|I won['’]t|Sorry)/i

/**
 * Transcribes a scanned PDF or a photographed page with Claude reading it natively.
 * Throws on a refusal, a summary that announces itself, or a cut-off transcription:
 * a partial SOP must fail the parse, not reach workers.
 */
export async function transcribeScan(buffer: ArrayBuffer | Buffer, mediaType: 'application/pdf' | 'image/jpeg'): Promise<string> {
  const data = Buffer.from(buffer as ArrayBuffer).toString('base64')
  const source =
    mediaType === 'application/pdf'
      ? ({ type: 'document', source: { type: 'base64', media_type: mediaType, data } } as const)
      : ({ type: 'image', source: { type: 'base64', media_type: mediaType, data } } as const)

  const res = await getAnthropicClient()
    .messages.stream({
      model: aiModel('ocr-fallback'),
      max_tokens: 64000,
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [{ role: 'user', content: [source, { type: 'text', text: PROMPT }] }],
    })
    .finalMessage()

  const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim()
  if (res.stop_reason === 'refusal' || REFUSAL.test(text)) {
    throw new Error('The scan could not be read: the AI would not transcribe it. Upload the Word or text version instead.')
  }
  if (res.stop_reason === 'max_tokens') {
    throw new Error('The scan is too long to read in one go. Split it into smaller files and upload each.')
  }
  return text
}
