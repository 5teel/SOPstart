import OpenAI from 'openai'
import type { TranscriptSegment } from '@/types/sop'

// Lazy-initialized to avoid throwing at module load time during Next.js static analysis
let openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI() // reads OPENAI_API_KEY from env
  }
  return openai
}

// D-12: Global NZ industrial vocabulary for improved transcription accuracy
const NZ_INDUSTRY_VOCABULARY = [
  'PPE', 'MSDS', 'SDS', 'LOTO', 'lockout tagout',
  'OTG', 'Tergo Alkalox', 'IRI CSV',
  'torque wrench', 'Newtons', 'kPa', 'kN', 'psi',
  'alkali', 'caustic soda', 'hydrochloric acid',
  'respirator', 'safety glasses', 'steel cap boots',
  'high-vis', 'harness', 'lanyard',
  'isolate', 'de-energise', 'earthing',
  'swarf', 'burr', 'deburr', 'chamfer',
  'micrometre', 'vernier', 'dial indicator',
].join(', ')

// Max audio file size for single API call (20MB — 5MB safety margin below 25MB limit)
const MAX_SINGLE_CALL_SIZE = 20 * 1024 * 1024

export async function transcribeAudio(audioBuffer: ArrayBuffer): Promise<TranscriptSegment[]> {
  const audioFile = new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' })

  if (audioFile.size > MAX_SINGLE_CALL_SIZE) {
    // For now, throw with a clear message. Chunking can be added in a future iteration.
    throw new Error(
      `Audio file is ${Math.round(audioFile.size / 1024 / 1024)}MB — exceeds 20MB limit. ` +
      'Please use a shorter video (under ~20 minutes) or compress the audio.'
    )
  }

  const transcription = await getOpenAI().audio.transcriptions.create({
    file: audioFile,
    model: 'gpt-4o-transcribe',
    response_format: 'verbose_json',
    prompt: `Industrial SOP recording from a New Zealand workplace. Technical vocabulary includes: ${NZ_INDUSTRY_VOCABULARY}`,
  })

  // Map OpenAI segments to our TranscriptSegment type
  return (transcription.segments ?? []).map((seg) => ({
    start: seg.start,
    end: seg.end,
    text: seg.text.trim(),
  }))
}
