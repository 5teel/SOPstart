import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { ParsedSopSchema, type ParsedSop } from '@/lib/validators/sop'

const openai = new OpenAI() // reads OPENAI_API_KEY from env

const SYSTEM_PROMPT = `You are an expert at parsing Standard Operating Procedure (SOP) documents used in industrial and manufacturing settings.

Your job is to extract ALL sections present in the document and produce structured output. Detect section types from their headings and content.

Common section types include: Hazards, PPE, Steps/Procedure, Emergency Procedures, Scope, Training, Maintenance, References, Competency Assessment — but include ANY section the document contains. Do not limit yourself to a fixed set of section types.

For sections that contain step-by-step instructions, populate the "steps" array. For narrative/prose sections (like Hazards, PPE, Scope), populate the "content" field instead.

Assign confidence scores honestly:
- 1.0 = very clean extraction, text was clear and well-structured
- 0.7-0.9 = good extraction with minor ambiguities
- 0.5-0.7 = some guesswork required, document structure unclear
- Below 0.5 = significant issues, likely OCR errors or poor document quality

If the source text appears to be OCR output (spelling errors, garbled words, broken formatting), set parse_notes to describe the quality issues you observed.`

export async function parseSopWithGPT(extractedText: string): Promise<ParsedSop> {
  const completion = await openai.chat.completions.parse({
    model: 'gpt-4o-2024-08-06',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Parse this SOP document:\n\n${extractedText}` },
    ],
    response_format: zodResponseFormat(ParsedSopSchema, 'parsed_sop'),
    temperature: 0.1, // low temp for consistent extraction
  })

  const parsed = completion.choices[0].message.parsed
  if (!parsed) {
    throw new Error('GPT-4o returned no parsed content — check response_format schema')
  }

  return parsed
}
