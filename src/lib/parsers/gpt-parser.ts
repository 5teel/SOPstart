import Anthropic from '@anthropic-ai/sdk'
import type { ParsedSop } from '@/lib/validators/sop'
import type { SourceFileType } from '@/types/sop'

// Lazy-initialized to avoid throwing at module load time during Next.js static analysis
let anthropic: Anthropic | null = null
function getAnthropic(): Anthropic {
  if (!anthropic) {
    anthropic = new Anthropic() // reads ANTHROPIC_API_KEY from env
  }
  return anthropic
}

// Claude tool definition matching ParsedSopSchema for structured output
const SOP_TOOL: Anthropic.Tool = {
  name: 'create_sop',
  description: 'Create a structured SOP from the analysed source material',
  input_schema: {
    type: 'object' as const,
    required: ['title', 'sections', 'overall_confidence'],
    properties: {
      title: { type: 'string', description: 'Clear, professional SOP title' },
      sop_number: { type: 'string', nullable: true },
      revision_date: { type: 'string', nullable: true },
      author: { type: 'string', nullable: true },
      category: { type: 'string', nullable: true, description: 'e.g. Animal Care, Manufacturing, Safety' },
      related_sops: { type: 'array', items: { type: 'string' }, nullable: true },
      applicable_equipment: { type: 'array', items: { type: 'string' }, nullable: true },
      required_certifications: { type: 'array', items: { type: 'string' }, nullable: true },
      sections: {
        type: 'array',
        items: {
          type: 'object',
          required: ['order', 'type', 'title', 'confidence'],
          properties: {
            order: { type: 'integer' },
            type: { type: 'string', description: 'e.g. hazards, ppe, procedure, emergency, scope, tools, cleanup' },
            title: { type: 'string' },
            content: { type: 'string', nullable: true, description: 'For narrative sections (Hazards, PPE, Scope)' },
            steps: {
              type: 'array',
              nullable: true,
              description: 'For procedural sections with numbered steps',
              items: {
                type: 'object',
                required: ['order', 'text', 'has_image'],
                properties: {
                  order: { type: 'integer' },
                  text: { type: 'string' },
                  warning: { type: 'string', nullable: true },
                  caution: { type: 'string', nullable: true },
                  tip: { type: 'string', nullable: true },
                  required_tools: { type: 'array', items: { type: 'string' }, nullable: true },
                  time_estimate_minutes: { type: 'number', nullable: true },
                  has_image: { type: 'boolean' },
                },
              },
            },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
        },
      },
      overall_confidence: { type: 'number', minimum: 0, maximum: 1 },
      parse_notes: { type: 'string', nullable: true, description: 'What was inferred vs explicitly stated' },
    },
  },
}

const SYSTEM_PROMPT = `You are an expert SOP (Standard Operating Procedure) analyst and safety consultant. Your role is not just to transcribe — you actively IMPROVE and STRUCTURE content into a professional, safety-conscious SOP.

## Your responsibilities:

### 1. STRUCTURE — Organise into logical SOP sections
Every SOP you produce MUST include these sections (create them even if the source doesn't explicitly mention them):

- **Hazards** — Identify ALL risks. Look for explicit mentions ("be careful", "don't get hurt", "watch out for") AND infer implicit hazards from the task itself. If someone is working with animals, chemicals, machinery, heights, electricity, heat, sharp objects, heavy loads, or confined spaces — there ARE hazards. List each hazard clearly with severity (Low/Medium/High/Critical).
- **PPE** — Based on the hazards you identified, recommend appropriate personal protective equipment. If hazards exist but no PPE is mentioned, recommend appropriate PPE based on industry standards.
- **Scope** — Who is this procedure for? What does it cover? What doesn't it cover?
- **Steps/Procedure** — The main procedural steps, grouped into logical phases. Each step should be a clear, actionable instruction.
- **Emergency Procedures** — What to do if something goes wrong. Infer from the task.

Also include any other relevant sections: Training Requirements, Tools/Equipment Needed, Maintenance, Quality Checks, Cleanup, References.

### 2. ENHANCE — Improve the instructions
- Convert casual speech into clear, professional procedural language
- Add detail where the source is vague
- Group related steps into named phases/stages (e.g., "Preparation", "Execution", "Cleanup")
- Add warnings and cautions to steps where safety is relevant
- Include time estimates where you can reasonably infer them

### 3. ANALYSE — Extract safety intelligence
- Flag hazards the speaker mentioned directly (even casually)
- Infer hazards from context (working with water → slip hazard; animals → bite/scratch risk)
- For each hazard, recommend a mitigation

### 4. CONFIDENCE — Score honestly
- 1.0 = comprehensive SOP with clear structure
- 0.7-0.9 = good SOP, some sections inferred
- 0.5-0.7 = significant inference required
- Below 0.5 = source quality too poor

Set parse_notes to describe what you inferred vs what was explicitly stated.`

const FORMAT_HINTS: Partial<Record<SourceFileType, string>> = {
  xlsx: '\n\nNote: This text was extracted from an Excel spreadsheet. Treat table headers as section titles, preserve numerical tolerances exactly.',
  pptx: '\n\nNote: This text was extracted from a PowerPoint presentation. Each slide title is a likely section heading.',
  txt: '\n\nNote: Plain text file. Infer structure from numbering, indentation, and keywords.',
  image: '\n\nNote: OCR-extracted text from a photographed document. May contain errors. Flag uncertain values in parse_notes.',
  video: `\n\nIMPORTANT: This is a transcript from a video recording of someone demonstrating a procedure. Apply MAXIMUM interpretation:

1. Every action the speaker describes or demonstrates → numbered step
2. Casual safety mentions ("be careful not to...", "watch out for...") → HAZARDS section with severity
3. Group into logical phases (Setup → Main Task → Finishing → Cleanup)
4. Recommend PPE based on identified hazards even if not mentioned
5. Convert informal speech to professional SOP language
6. Create Emergency Procedures based on what could go wrong
7. If speaker mentions tools/products/equipment → "Tools & Equipment" section
8. Preserve exact numbers (measurements, temperatures, durations, dosages)`,
}

// Complexity triage prompt for Haiku
const TRIAGE_PROMPT = `Assess the complexity of structuring this text into a Standard Operating Procedure. Reply with ONLY one word: SIMPLE or COMPLEX.

SIMPLE = single straightforward process, few hazards, no chemicals or heavy machinery, everyday tasks
COMPLEX = multiple processes, safety-critical operations, chemicals, machinery, regulatory requirements, technical measurements, or the text is long/detailed

Text to assess:
`

/**
 * Two-stage Claude parsing:
 * 1. Haiku triages complexity (fast, cheap)
 * 2. Simple → Haiku parses, Complex → Sonnet parses
 */
export async function parseSopWithGPT(extractedText: string, inputType?: SourceFileType): Promise<ParsedSop> {
  const client = getAnthropic()
  const hint = inputType ? (FORMAT_HINTS[inputType] ?? '') : ''

  // Stage 1: Haiku complexity triage (~0.5s, ~$0.001)
  const excerpt = extractedText.slice(0, 2000) // first 2000 chars is enough to assess
  const triageRes = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 10,
    messages: [{ role: 'user', content: TRIAGE_PROMPT + excerpt }],
  })
  const triageText = triageRes.content[0]?.type === 'text' ? triageRes.content[0].text.trim().toUpperCase() : 'COMPLEX'
  const isSimple = triageText.includes('SIMPLE')
  const model = isSimple ? 'claude-haiku-4-5-20251001' : 'claude-sonnet-4-6-20250514'

  console.log(`[SOP Parser] Triage: ${triageText} → routing to ${model}`)

  // Stage 2: Full parse with selected model
  const userContent = `Analyse this source material and produce a comprehensive, professional SOP. Use the create_sop tool to output the structured result.\n\n${extractedText}${hint}`

  const parseRes = await client.messages.create({
    model,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
    tools: [SOP_TOOL],
    tool_choice: { type: 'tool', name: 'create_sop' },
  })

  // Extract structured output from tool_use block
  const toolBlock = parseRes.content.find((b) => b.type === 'tool_use' && b.name === 'create_sop')
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('Claude returned no structured SOP output — tool_use block missing')
  }

  const raw = toolBlock.input as Record<string, unknown>

  // Map to ParsedSop type (ensure defaults for nullable fields)
  const parsed: ParsedSop = {
    title: (raw.title as string) ?? 'Untitled SOP',
    sop_number: (raw.sop_number as string) ?? null,
    revision_date: (raw.revision_date as string) ?? null,
    author: (raw.author as string) ?? null,
    category: (raw.category as string) ?? null,
    related_sops: (raw.related_sops as string[]) ?? null,
    applicable_equipment: (raw.applicable_equipment as string[]) ?? null,
    required_certifications: (raw.required_certifications as string[]) ?? null,
    overall_confidence: (raw.overall_confidence as number) ?? 0.7,
    parse_notes: `${(raw.parse_notes as string) ?? ''} [Parsed by ${model}, triage: ${triageText}]`.trim(),
    sections: ((raw.sections as Array<Record<string, unknown>>) ?? []).map((s, i) => ({
      order: (s.order as number) ?? i + 1,
      type: (s.type as string) ?? 'procedure',
      title: (s.title as string) ?? 'Untitled Section',
      content: (s.content as string) ?? null,
      steps: s.steps
        ? (s.steps as Array<Record<string, unknown>>).map((st, j) => ({
            order: (st.order as number) ?? j + 1,
            text: (st.text as string) ?? '',
            warning: (st.warning as string) ?? null,
            caution: (st.caution as string) ?? null,
            tip: (st.tip as string) ?? null,
            required_tools: (st.required_tools as string[]) ?? null,
            time_estimate_minutes: (st.time_estimate_minutes as number) ?? null,
            has_image: (st.has_image as boolean) ?? false,
          }))
        : null,
      confidence: (s.confidence as number) ?? 0.7,
    })),
  }

  return parsed
}
