import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { ParsedSopSchema, type ParsedSop } from '@/lib/validators/sop'
import type { SourceFileType } from '@/types/sop'

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

/**
 * Format-specific hints appended to the user message (not the system prompt)
 * so the system prompt remains stable for all input types.
 */
const FORMAT_HINTS: Partial<Record<SourceFileType, string>> = {
  xlsx: '\n\nNote: This text was extracted from an Excel spreadsheet. Rows and columns represent tabular data — treat table headers as section titles where appropriate, preserve numerical tolerances exactly. Tables formatted as | col | col | are calibration/parameter data — preserve them in section content or step text using the same pipe-separated format.',
  pptx: '\n\nNote: This text was extracted from a PowerPoint presentation. Each slide title is a likely section heading. Speaker notes (if present) contain procedural detail. Combine slide text and notes to form a complete SOP.',
  txt: '\n\nNote: This is a plain text file. It may lack consistent formatting. Infer structure from numbering, indentation, blank lines, and keywords like HAZARD, PPE, WARNING, CAUTION, STEP, PROCEDURE, EMERGENCY.',
  image: '\n\nNote: This text was extracted via OCR from a photographed document. It may contain OCR errors, broken words, and missing punctuation. Be lenient with formatting but flag uncertain values (especially numerical tolerances, chemical names, PPE specifications) in parse_notes.',
}

export async function parseSopWithGPT(extractedText: string, inputType?: SourceFileType): Promise<ParsedSop> {
  const hint = inputType ? (FORMAT_HINTS[inputType] ?? '') : ''
  const userContent = `Parse this SOP document:\n\n${extractedText}${hint}`

  const completion = await openai.chat.completions.parse({
    model: 'gpt-4o-2024-08-06',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
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
