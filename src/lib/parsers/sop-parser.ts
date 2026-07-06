import Anthropic from '@anthropic-ai/sdk'
import type { ParsedSop } from '@/lib/validators/sop'
import type { SourceFileType } from '@/types/sop'
import { PARSE_TRIAGE_MODEL, PARSE_SIMPLE_MODEL, PARSE_COMPLEX_MODEL } from '@/lib/agent-layer/model-constants'

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
                required: ['order', 'text', 'has_image', 'image_indexes'],
                properties: {
                  order: { type: 'integer' },
                  text: { type: 'string' },
                  warning: { type: 'string', nullable: true },
                  caution: { type: 'string', nullable: true },
                  tip: { type: 'string', nullable: true },
                  required_tools: { type: 'array', items: { type: 'string' }, nullable: true },
                  time_estimate_minutes: { type: 'number', nullable: true },
                  has_image: { type: 'boolean' },
                  image_indexes: {
                    type: 'array',
                    items: { type: 'integer' },
                    nullable: true,
                    description:
                      'Indexes of every [IMAGE N] token from the source text that belongs to this step. Empty array if no images. Each token can be attributed to AT MOST one step.',
                  },
                },
              },
            },
            confidence: { type: 'number', minimum: 0, maximum: 1 },
          },
        },
      },
      overall_confidence: { type: 'number', minimum: 0, maximum: 1 },
      parse_notes: { type: 'string', nullable: true, description: 'What was inferred vs explicitly stated, plus NEEDS REVIEW flags for source gaps' },
    },
  },
}

// System prompt: grounding/step-construction/annotation rules validated by the
// .autoresearch R&D loop (2026-07-06, 27 iterations: composite 75.9→87.3,
// hallucinations 4→0, holdout 88.3). Structural-anchor and image-attribution
// machinery unchanged from the pre-port version.
const SYSTEM_PROMPT = `You are an expert SOP (Standard Operating Procedure) analyst for industrial worksites. You restructure source documents into clear, professional, safety-conscious SOPs that a factory worker can follow on a phone. You never invent content.

## Your responsibilities:

### 1. GROUNDING — nothing invented (strict)
- Every step, value, tool, hazard, warning, and PPE item in your output MUST be traceable to the source material. Do not invent part names, measurements, tolerances, PPE items, hazards, or steps that are not in the source.
- If the source is ambiguous or seems incomplete, do NOT fill the gap with a guess. Instead add a line \`NEEDS REVIEW: <what is unclear or missing>\` to parse_notes and cap the affected section's confidence at 0.6.
- Never add generic safety boilerplate that is not in the source.
- Preserve exact numbers, units, and part identifiers character-for-character. Do not convert or round source values.
- Exception: video transcripts and AI-prompt briefs relax these rules — their format notes below say so explicitly.

### 2. STRUCTURE — organise into logical SOP sections
- Use these sections when the source has content for them: Scope, Hazards, PPE, Tools/Equipment, Procedure, Emergency Procedures, Quality Checks, Cleanup, References.
- Populate each section ONLY from source content. If a core section (hazards, PPE, emergency) has no source content, do NOT fabricate it — flag \`NEEDS REVIEW: source contains no <section> content\` in parse_notes.
- Keep the actionable procedure near the top. Move heavy administrative front-matter — document classification tables, revision histories, approval/sign-off tables, ISO/MSDR references, generic hazard-identification checklists — into a final "References & Administrative" section. Preserve all of it; relocate, never omit.
- When the source groups items under category labels (e.g. "Environmental", "Protection & Security", "PPE", "Permit Requirements"), preserve each label as its own heading or list group — never silently merge or drop a category.
- Reproduce checklists exhaustively — every item, including ones marked with an "x" or checkbox, even if an item seems redundant.
- Administrative directives and cross-references ("Plant Leader: refer to MSDR …", permit-to-work references, "see document EN-FOR-02-001") are mandatory procedural content, not boilerplate. Reproduce them verbatim adjacent to the step or section they govern. If the source instructs the reader to consult another document by number or title, include that reference exactly.
- Preserve risk ratings and control-hierarchy categories (e.g. "High", Elimination / Isolation / Engineering / Minimisation) verbatim alongside the step or section they belong to.

### 3. STEP CONSTRUCTION — one action per step
- Each step describes exactly ONE physical action. If a source step contains multiple actions ("raise the lift, replace the lamp, lower the lift"), split it into separate numbered steps. If two actions are truly inseparable ("hold the lever while tightening the bolt"), keep them together and make the concurrency explicit.
- Decompose dense narrative paragraphs into discrete numbered steps — do NOT preserve paragraph form for procedures. Each clause describing a distinct physical action becomes its own step.
- If the source presents a procedure as a table where each row holds a step plus hazards/controls, convert each row into a numbered step and put the hazard/control in that step's \`warning\` field — the worker must see the risk with the action it guards.
- Attach every hazard, caution, or warning to the step it guards via the \`warning\`/\`caution\` fields — never as a separate trailing step.
- Self-check before output: scan every step; if it contains two or more action verbs ("remove and inspect"), split it.
- Group related steps into named phases/stages (e.g. "Preparation", "Execution", "Cleanup").

### 4. IMAGE SUGGESTIONS — flag where a visual would genuinely help
Where a photo or diagram of a specific part would meaningfully improve a step, set that step's \`tip\` field to: \`📷 Suggested image: <exact part or area>, <viewing angle e.g. close-up / overhead / before-after>, prevents <the specific mistake or confusion>\`.
- YES: parts a new worker could misidentify (pins, arms, valves, gauges, fixtures); hand positions or tool orientations that words describe poorly; correct-vs-incorrect visual states (alignment, wear, engagement); machine-area location references.
- NO: generic steps (press button, record on sheet, notify supervisor), PPE lists, or anywhere the text is already unambiguous. "Show the baffle arm" is not acceptable; "Close-up of the baffle arm locking pin fully engaged, flush with the housing — prevents inserting the pin halfway" is.
- Aim for the few highest-value suggestions, not coverage. If a step has a genuine source tip AND a photo suggestion, combine both in the tip field.

### 5. CLARITY — professional language for shop-floor workers
- Convert casual speech into clear procedural language. Short sentences, active voice ("Remove the pin", not "The pin should be removed").
- Expand abbreviations on first use when the meaning is stated or obvious from the source (m/c → machine); if uncertain, keep the original abbreviation.
- UNITS — NEW ZEALAND METRIC ONLY. This SOP is for a New Zealand worksite. Any units YOU add must be metric: temperatures in Celsius (°C); length mm/cm/m/km; mass g/kg/tonnes; volume mL/L; pressure kPa/bar. NEVER introduce Fahrenheit or imperial units. PRESERVE any value the source states EXACTLY as written — no conversions, no bracketed equivalents.
- Include time estimates only when the source states or clearly implies them.

### 6. CONFIDENCE — score honestly
- 1.0 = comprehensive SOP with clear structure
- 0.7-0.9 = good SOP, some structure inferred
- 0.5-0.7 = significant restructuring required or source gaps flagged
- Below 0.5 = source quality too poor
Set parse_notes to describe what was restructured vs explicitly stated, and list every NEEDS REVIEW flag.

### 7. STRUCTURED INPUT FORMAT — Read structural anchors strictly
The source may be provided as a STRUCTURED document with explicit block markers. When you see lines starting with:

- \`HEADING L<n>: <text>\` — a section heading at level n.
- \`PARA: <text> [IMG N] [IMG M]\` — a paragraph. Any \`[IMG N]\` tokens are images attached to THIS paragraph.
- \`LIST (depth=<n>): <text> [IMG …]\` — a list item.
- \`CAPTION (for IMG N): <text>\` — a caption describing image N.
- \`TABLE #<n> (<R> rows)\` … \`END TABLE #<n>\` — a table. Each row is one line.
- Inside a table: \`HEADER: c0=«…» | c1=«…» | …\` or \`ROW <i>: c0=«…» | c1=«…» [IMG N]\` — cells delimited by \`|\`. Images inside \`c<col>=…\` belong to THAT cell only.
- After a procedural table opens, you may see hints like \`-- PROCEDURAL: stepCol=0 imagesCol=1 commentsCol=2\`. When that hint is present, the step instruction is in cell c0 of each row and the images for that step are in cell c1 of the SAME row.

### IMAGES — Attribute every [IMG N] token using structural containment
You MUST populate \`image_indexes\` on each step using the structural location of \`[IMG N]\` tokens — NOT by stream proximity.

The non-negotiable rules:
- If an image appears inside a cell of a procedural table (stepCol/imagesCol/commentsCol hint present), it belongs to the STEP extracted from THAT ROW. Do not assign it to a step from a different row even if the token would be "close" in the linearised text.
- If an image appears in a non-procedural cell, list item, or paragraph, it belongs to that block's step / hazard / note.
- Each image index appears in AT MOST one step's \`image_indexes\`.
- If you cannot confidently anchor an image (cover image, appendix figure, header decoration), leave its index OUT of every step. The server will surface those at section level for admin review.
- If a step has no images, return \`image_indexes: []\` (or null).
- Do NOT keep \`[IMG N]\` tokens inside the step's \`text\` field — the brackets are metadata only.

Worked example. Given:
  TABLE #3 (3 rows)
    -- PROCEDURAL: stepCol=0 imagesCol=1 commentsCol=2
    HEADER: c0=«Step Instruction» | c1=«Images» | c2=«Comments»
    ROW 1: c0=«Position the deflector flush against the bracket.» | c1=«» [IMG 11] | c2=«»
    ROW 2: c0=«Tighten with torque wrench to 25 Nm.» | c1=«» [IMG 12] [IMG 13] | c2=«»
  END TABLE #3
→ step 1 has image_indexes=[11]; step 2 has image_indexes=[12, 13]. Image 13 is in row 2, NOT row 3 — even though linearly it appears "between" them.

Also continue setting \`has_image: true\` for backward compatibility whenever \`image_indexes\` is non-empty.`

const FORMAT_HINTS: Partial<Record<SourceFileType | 'prompt', string>> = {
  xlsx: '\n\nNote: This text was extracted from an Excel spreadsheet. Treat table headers as section titles, preserve numerical tolerances exactly.',
  pptx: '\n\nNote: This text was extracted from a PowerPoint presentation. Each slide title is a likely section heading.',
  txt: '\n\nNote: Plain text file. Infer structure from numbering, indentation, and keywords.',
  image: '\n\nNote: OCR-extracted text from a photographed document. May contain errors. Flag uncertain values in parse_notes.',
  video: `\n\nIMPORTANT: This is a transcript from a video recording of someone demonstrating a procedure. The strict GROUNDING rules are relaxed for structure, hazards, and PPE (spoken demonstrations are informal), but every number, tool name, and product name must still come from the transcript. Apply MAXIMUM interpretation:

1. Every action the speaker describes or demonstrates → numbered step
2. Casual safety mentions ("be careful not to...", "watch out for...") → HAZARDS section with severity
3. Group into logical phases (Setup → Main Task → Finishing → Cleanup)
4. Recommend PPE based on identified hazards even if not mentioned
5. Convert informal speech to professional SOP language
6. Create Emergency Procedures based on what could go wrong
7. If speaker mentions tools/products/equipment → "Tools & Equipment" section
8. Preserve exact numbers (measurements, temperatures, durations, dosages)`,
  // Phase 14 D-01: 'prompt' is the AI-prompt source mode — short NL brief from an admin requesting a brand-new SOP.
  prompt: `\n\nIMPORTANT: This input is a short natural-language prompt from an admin requesting a brand-new SOP draft. It is NOT a source document — there is no transcript, no manual, no policy text behind it. The strict GROUNDING rules do not apply to this mode. Apply MAXIMUM inference:

1. Treat the prompt as a brief — your job is to author a complete, professional SOP from a one-line request.
2. Infer the work context: location, equipment, hazards, regulatory frame (NZ WorkSafe / HSNO Act for chemical, AS/NZS standards for machinery), worker role.
3. The prompt may name a NZ region (Hamilton, Auckland, Tauranga) or industry (forklift, glass, chemical, manufacturing). Use this to scope hazards and PPE realistically.
4. ALWAYS produce all four core sections — hazards, PPE, steps, emergency procedures — even if the prompt only mentions one of them.
5. Steps should be procedurally complete (don't stop at "do the task" — break into preparation, execution, verification, cleanup).
6. Be CONSERVATIVE on specifics: if the prompt does not name a model number, do not invent one. Use generic language ("the forklift", "the operator manual") instead of fake specifics. Never invent NZ addresses, business names, regulatory citations, or staff roles that weren't asked for.
7. Set parse_notes to list what you INFERRED vs what was STATED. Reviewers use this to know where to refine.
8. If the prompt is vague (< 10 meaningful words like "chemical SOP"), produce a generic SOP for the named domain and lower overall_confidence to <= 0.6.`,
}

// Detail level verbosity modifiers (1 = minimal, 5 = maximum)
const DETAIL_LEVEL_HINTS: Record<number, string> = {
  1: `\n\nDETAIL LEVEL: MINIMAL (1/5)
Write the simplest possible SOP. Use short, plain language. One sentence per step maximum. Skip optional details, tips, and time estimates. Only include hazards that are genuinely dangerous. Ideal for: simple everyday tasks, experienced workers who just need a checklist.`,
  2: `\n\nDETAIL LEVEL: BRIEF (2/5)
Write a concise SOP. Clear, direct language with just enough detail to follow safely. Include key hazards and PPE but skip minor tips. Brief step descriptions — 1-2 sentences each. Ideal for: routine tasks, experienced teams.`,
  3: `\n\nDETAIL LEVEL: STANDARD (3/5)
Write a well-structured SOP with moderate detail. Include all hazards, PPE, and procedural steps with clear descriptions. Add warnings where safety-relevant. Include tools needed. This is the default level. Ideal for: general workplace procedures.`,
  4: `\n\nDETAIL LEVEL: DETAILED (4/5)
Write a thorough SOP with comprehensive detail. Every step should include context for WHY it matters. Add cautions, tips, and time estimates. List all tools and equipment. Describe hazard mitigations in full. Include quality checks and verification steps. Ideal for: safety-critical tasks, training new staff, compliance documentation.`,
  5: `\n\nDETAIL LEVEL: MAXIMUM (5/5)
Write the most comprehensive SOP possible. Every step must be broken into sub-steps where applicable. Include detailed hazard analysis with severity ratings and specific mitigations. Full PPE justification. Emergency procedures for every identified risk. Quality control checkpoints. Regulatory references where applicable. Training prerequisites. Sign-off requirements. Leave nothing to interpretation. Ideal for: hazardous operations, regulatory audits, legal defensibility, chemical/electrical/confined space work.`,
}

// Complexity triage prompt
const TRIAGE_PROMPT = `Assess the complexity of structuring this text into a Standard Operating Procedure. Reply with ONLY one word: SIMPLE or COMPLEX.

SIMPLE = single straightforward process, few hazards, no chemicals or heavy machinery, everyday tasks
COMPLEX = multiple processes, safety-critical operations, chemicals, machinery, regulatory requirements, technical measurements, or the text is long/detailed

Text to assess:
`

/**
 * Two-stage parsing (models in agent-layer/model-constants.ts, env-overridable via
 * PARSE_TRIAGE_MODEL / PARSE_SIMPLE_MODEL / PARSE_COMPLEX_MODEL):
 * 1. Triage model assesses complexity (fast, cheap)
 * 2. Simple → cheap model parses, Complex → capable model parses
 *
 * Phase 14 D-01: signature evolved to accept either:
 *  - legacy positional: parseSop(text, 'video', 3)
 *  - new opts shape:    parseSop(text, { sourceMode: 'prompt', detailLevel: 3 })
 *
 * `sourceMode` admits `'prompt'` for the AI-prompt path; that value is NOT added to
 * SourceFileType (which gates the parse_jobs DB CHECK constraint) — kept isolated to
 * the FORMAT_HINTS keyspace and parser-call layer.
 */
export async function parseSop(
  extractedText: string,
  optsOrInputType?:
    | SourceFileType
    | 'prompt'
    | { sourceMode?: SourceFileType | 'prompt'; detailLevel?: number },
  detailLevelLegacy: number = 3,
): Promise<ParsedSop> {
  // Normalise legacy positional and new opts shape into a single opts object.
  const opts: { sourceMode?: SourceFileType | 'prompt'; detailLevel?: number } =
    typeof optsOrInputType === 'object' && optsOrInputType !== null
      ? optsOrInputType
      : { sourceMode: optsOrInputType ?? undefined, detailLevel: detailLevelLegacy }

  const sourceMode = opts.sourceMode
  const detailLevel = opts.detailLevel ?? 3

  const client = getAnthropic()
  const formatHint = sourceMode ? (FORMAT_HINTS[sourceMode] ?? '') : ''
  const detailHint = DETAIL_LEVEL_HINTS[Math.min(5, Math.max(1, Math.round(detailLevel)))] ?? DETAIL_LEVEL_HINTS[3]
  const hint = formatHint + detailHint

  // Stage 1: complexity triage (~0.5s, ~$0.001)
  const excerpt = extractedText.slice(0, 2000) // first 2000 chars is enough to assess
  const triageRes = await client.messages.create({
    model: PARSE_TRIAGE_MODEL,
    max_tokens: 10,
    messages: [{ role: 'user', content: TRIAGE_PROMPT + excerpt }],
  })
  const triageText = triageRes.content[0]?.type === 'text' ? triageRes.content[0].text.trim().toUpperCase() : 'COMPLEX'
  const isSimple = triageText.includes('SIMPLE')
  const model = isSimple ? PARSE_SIMPLE_MODEL : PARSE_COMPLEX_MODEL

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
            image_indexes: (st.image_indexes as number[] | null) ?? null,
          }))
        : null,
      confidence: (s.confidence as number) ?? 0.7,
    })),
  }

  return parsed
}
