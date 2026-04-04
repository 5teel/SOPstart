/**
 * TTS module — generates per-section narration audio using gpt-4o-mini-tts.
 * Uses lazy client init to prevent build failure without OPENAI_API_KEY set.
 * NZ industrial pronunciation guidance is embedded in the instructions parameter.
 */

import OpenAI from 'openai'

// Lazy-initialized to avoid throwing at module load time during Next.js static analysis
let openai: OpenAI | null = null
function getClient(): OpenAI {
  if (!openai) openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return openai
}

const BASE_INSTRUCTIONS = [
  'Speak clearly and at a measured pace suitable for an industrial safety procedure in New Zealand.',
  'Pronounce: PPE as P-P-E, kPa as kilopascals, SCBA as S-C-B-A, MSDS as M-S-D-S.',
].join(' ')

const SECTION_INSTRUCTIONS: Partial<Record<string, string>> = {
  hazards: 'Use a calm but serious tone for hazards.',
  emergency: 'Use a clear and urgent tone for emergency procedures.',
}

/**
 * Generate a narrated audio buffer for a single SOP section.
 *
 * @param sectionText  Plain text content of the section (used for TTS input)
 * @param sectionType  Section type slug (e.g. 'hazards', 'ppe', 'steps', 'emergency')
 * @returns Buffer containing MP3 audio and an estimated duration in seconds
 */
export async function generateSectionAudio(
  sectionText: string,
  sectionType: string,
): Promise<{ buffer: Buffer; durationEstimateSeconds: number }> {
  const sectionInstruction = SECTION_INSTRUCTIONS[sectionType.toLowerCase()] ?? ''
  const instructions = sectionInstruction
    ? `${BASE_INSTRUCTIONS} ${sectionInstruction}`
    : BASE_INSTRUCTIONS

  const response = await getClient().audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice: 'nova', // Clear, authoritative voice per research recommendation (D-08)
    input: sectionText,
    instructions,
    response_format: 'mp3',
  })

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Approximate duration for MP3 at ~32kbps.
  // Precision can be improved later if chapter timestamps need to be exact.
  const durationEstimateSeconds = buffer.length / 4000

  return { buffer, durationEstimateSeconds }
}
