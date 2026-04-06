import type { TranscriptSegment } from '@/types/sop'

// D-12: NZ industrial vocabulary for keyword boosting
const NZ_INDUSTRY_KEYWORDS = [
  'PPE', 'MSDS', 'SDS', 'LOTO', 'lockout tagout',
  'OTG', 'Tergo', 'Alkalox',
  'torque wrench', 'Newtons', 'kPa', 'kN', 'psi',
  'alkali', 'caustic soda', 'hydrochloric acid',
  'respirator', 'safety glasses', 'steel cap boots',
  'high-vis', 'harness', 'lanyard',
  'isolate', 'de-energise', 'earthing',
  'swarf', 'burr', 'deburr', 'chamfer',
  'micrometre', 'vernier', 'dial indicator',
]

interface DeepgramUtterance {
  start: number
  end: number
  transcript: string
}

interface DeepgramWord {
  word: string
  punctuated_word?: string
  start: number
  end: number
}

interface DeepgramResponse {
  results?: {
    utterances?: DeepgramUtterance[]
    channels?: Array<{
      alternatives?: Array<{
        transcript?: string
        words?: DeepgramWord[]
      }>
    }>
  }
}

export async function transcribeAudio(
  audioBuffer: ArrayBuffer,
  fileExt: string = 'mp3',
  mimeType: string = 'audio/mpeg',
): Promise<TranscriptSegment[]> {
  const apiKey = process.env.DEEPGRAM_API_KEY
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY is not set')
  }

  // Build query params
  const params = new URLSearchParams({
    model: 'nova-2',
    language: 'en-NZ',
    smart_format: 'true',
    punctuate: 'true',
    paragraphs: 'true',
    utterances: 'true',
  })
  // Add keyword boosting (each keyword:weight pair as separate param)
  for (const kw of NZ_INDUSTRY_KEYWORDS) {
    params.append('keywords', `${kw}:2`)
  }

  const res = await fetch(`https://api.deepgram.com/v1/listen?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': mimeType,
    },
    body: Buffer.from(audioBuffer),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText)
    throw new Error(`Deepgram transcription failed (${res.status}): ${errText}`)
  }

  const data: DeepgramResponse = await res.json()

  // Prefer utterances (natural speech segments with timestamps)
  const utterances = data.results?.utterances ?? []
  if (utterances.length > 0) {
    return utterances.map((u) => ({
      start: u.start,
      end: u.end,
      text: u.transcript.trim(),
    }))
  }

  // Fallback: word-level from channel alternatives
  const channels = data.results?.channels ?? []
  if (channels.length === 0 || !channels[0].alternatives?.[0]) {
    return []
  }

  const alt = channels[0].alternatives[0]
  const words = alt.words ?? []

  if (words.length === 0) {
    return alt.transcript
      ? [{ start: 0, end: 0, text: alt.transcript }]
      : []
  }

  // Group words into ~10s segments for review UI timeline
  const segments: TranscriptSegment[] = []
  let segStart = words[0].start
  let segWords: string[] = []

  for (const word of words) {
    segWords.push(word.punctuated_word ?? word.word)
    if (word.end - segStart >= 10 || word === words[words.length - 1]) {
      segments.push({
        start: segStart,
        end: word.end,
        text: segWords.join(' ').trim(),
      })
      segStart = word.end
      segWords = []
    }
  }

  return segments
}
