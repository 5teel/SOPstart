import OpenAI from 'openai'
import { zodResponseFormat } from 'openai/helpers/zod'
import { ParsedSopSchema, type ParsedSop } from '@/lib/validators/sop'
import type { SourceFileType } from '@/types/sop'

// Lazy-initialized to avoid throwing at module load time during Next.js static analysis
let openai: OpenAI | null = null
function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI() // reads OPENAI_API_KEY from env
  }
  return openai
}

const SYSTEM_PROMPT = `You are an expert SOP (Standard Operating Procedure) analyst and safety consultant. Your role is not just to transcribe — you actively IMPROVE and STRUCTURE content into a professional, safety-conscious SOP.

## Your responsibilities:

### 1. STRUCTURE — Organise into logical SOP sections
Every SOP you produce MUST include these sections (create them even if the source doesn't explicitly mention them):

- **Hazards** — Identify ALL risks. Look for explicit mentions ("be careful", "don't get hurt", "watch out for") AND infer implicit hazards from the task itself. If someone is working with animals, chemicals, machinery, heights, electricity, heat, sharp objects, heavy loads, or confined spaces — there ARE hazards. List each hazard clearly.
- **PPE** — Based on the hazards you identified, recommend appropriate personal protective equipment. If the source mentions any protective gear, include it. If hazards exist but no PPE is mentioned, recommend appropriate PPE based on industry standards.
- **Scope** — Who is this procedure for? What does it cover? What doesn't it cover?
- **Steps/Procedure** — The main procedural steps, grouped into logical phases. Each step should be a clear, actionable instruction.
- **Emergency Procedures** — What to do if something goes wrong. Infer from the task: chemical spills, injuries, equipment failure, animal incidents, etc.

Also include any other relevant sections: Training Requirements, Tools/Equipment Needed, Maintenance, Quality Checks, Cleanup, References.

### 2. ENHANCE — Improve the instructions
- Convert casual speech into clear, professional procedural language
- Add detail where the source is vague ("do the thing" → specific actionable instruction)
- Group related steps into named phases/stages (e.g., "Preparation", "Execution", "Cleanup")
- Add warnings (⚠️) and cautions to steps where safety is relevant
- Include time estimates where you can reasonably infer them
- Add "tools needed" to steps that require specific equipment

### 3. ANALYSE — Extract safety intelligence
- Flag hazards the speaker mentioned directly (even casually, e.g., "make sure you don't get bitten")
- Infer hazards from context (working with water → slip hazard; working with animals → bite/scratch risk; using chemicals → exposure risk)
- Rate each hazard by severity: Low / Medium / High / Critical
- For each hazard, recommend a mitigation in the Hazards section

### 4. CONFIDENCE — Score honestly
- 1.0 = comprehensive SOP with clear structure
- 0.7-0.9 = good SOP, some sections inferred
- 0.5-0.7 = significant inference required, source was incomplete
- Below 0.5 = source quality too poor for reliable SOP

Set parse_notes to describe what you inferred vs what was explicitly stated.`

const FORMAT_HINTS: Partial<Record<SourceFileType, string>> = {
  xlsx: '\n\nNote: This text was extracted from an Excel spreadsheet. Rows and columns represent tabular data — treat table headers as section titles where appropriate, preserve numerical tolerances exactly. Tables formatted as | col | col | are calibration/parameter data — preserve them in section content or step text using the same pipe-separated format.',
  pptx: '\n\nNote: This text was extracted from a PowerPoint presentation. Each slide title is a likely section heading. Speaker notes (if present) contain procedural detail. Combine slide text and notes to form a complete SOP.',
  txt: '\n\nNote: This is a plain text file. It may lack consistent formatting. Infer structure from numbering, indentation, blank lines, and keywords like HAZARD, PPE, WARNING, CAUTION, STEP, PROCEDURE, EMERGENCY.',
  image: '\n\nNote: This text was extracted via OCR from a photographed document. It may contain OCR errors, broken words, and missing punctuation. Be lenient with formatting but flag uncertain values (especially numerical tolerances, chemical names, PPE specifications) in parse_notes.',
  video: `\n\nIMPORTANT: This is a transcript from a video recording of someone demonstrating a procedure. Apply MAXIMUM interpretation:

1. The speaker is showing how to do something — extract every action as a numbered step
2. Casual safety mentions ("be careful not to...", "watch out for...", "make sure you don't...") are HAZARDS — extract them into a dedicated Hazards section with severity ratings
3. Group the procedure into logical phases based on what the speaker is doing (e.g., Setup → Main Task → Finishing → Cleanup)
4. The speaker may not mention PPE — but based on the hazards and task, RECOMMEND appropriate PPE
5. Informal language should be converted to professional SOP language (keep the meaning, improve the clarity)
6. If the speaker mentions tools, products, or equipment — create a "Tools & Equipment" section
7. Add an Emergency Procedures section based on what could go wrong with this task
8. If the speaker corrects themselves, use the corrected value
9. Numerical values (measurements, temperatures, durations, dosages) are safety-critical — preserve exact numbers`,
}

export async function parseSopWithGPT(extractedText: string, inputType?: SourceFileType): Promise<ParsedSop> {
  const hint = inputType ? (FORMAT_HINTS[inputType] ?? '') : ''
  const userContent = `Analyse this source material and produce a comprehensive, professional SOP:\n\n${extractedText}${hint}`

  const completion = await getOpenAI().chat.completions.parse({
    model: 'gpt-4o-2024-08-06',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    response_format: zodResponseFormat(ParsedSopSchema, 'parsed_sop'),
    temperature: 0.3, // slightly higher for creative enhancement while staying structured
  })

  const parsed = completion.choices[0].message.parsed
  if (!parsed) {
    throw new Error('GPT-4o returned no parsed content — check response_format schema')
  }

  return parsed
}
