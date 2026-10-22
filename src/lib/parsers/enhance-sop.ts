// ADR-0015: the clear version of a SOP. The direct translation (parseSop with faithful: true) is the
// record of what the source says; this pass rewrites it for the worker under the enhancement rules,
// then a model from a different family checks the result against the direct translation.
import type { ParsedSop } from '@/lib/validators/sop'
import { aiModel } from '@/lib/ai/registry'
import { llmToolCall, type LlmTool } from '@/lib/ai/llm'
import { SOP_TOOL, toParsedSop } from './sop-parser'
import { ENHANCE_RULES, ORDER_JUDGEMENT, ENHANCE_RISKS } from './enhance-rules'
import { runJevChecks, type JevSummary } from './jev-checks'
import { pictogramLabels, placeSigns, type Pictogram } from './clear-signs'
import { OWNERSHIP_CONTEXT } from './ocr-fallback'

export interface EnhanceChange {
  kind: 'split' | 'moved' | 'grouped' | 'reworded' | 'deduplicated' | 'relocated' | 'removed_boilerplate' | 'placeholder' | 'conflict_flagged' | 'other'
  detail: string
}
export interface EnhanceCheckIssue {
  severity: 'critical' | 'major' | 'minor'
  kind: 'missing' | 'altered' | 'weakened' | 'reordered' | 'invented' | 'unflagged_placeholder' | 'other'
  direct: string | null
  clear: string | null
  note: string
}
export interface EnhancedSop {
  sop: ParsedSop
  changes: EnhanceChange[]
  openItems: string[]
  orderLocked: Array<{ steps: string[]; reason: string }>
  check: { model: string; passed: boolean; issues: EnhanceCheckIssue[] } | null
  /** ADR-0022: Jev's fact, number and step checks; its flags were handed to the check model. */
  jev: JevSummary | null
  model: string
}

const AUDIENCE = `The reader is a worker at a New Zealand glass or packaging plant: a forming operator, job-change crew member, quality or maintenance technician. They read on a phone or a shared screen at the machine, often in gloves, sometimes mid-task, with mixed literacy and English as a second language for some. SOPstart shows a SOP as sections of numbered steps that the worker ticks off as a checklist, with photos on their step. A step's \`warning\` shows as a yellow hazard triangle, PPE as a blue circle (AS 1319 colours), \`caution\` as a plain caution line, \`tip\` as a note. Metric units only.`

const ENHANCE_TOOL: LlmTool = {
  name: 'create_clear_sop',
  description: 'Output the clear version of the SOP, the changes made, the order-locked sequences and the open items.',
  input_schema: {
    type: 'object',
    required: ['sop', 'changes', 'order_locked', 'open_items'],
    properties: {
      sop: { ...SOP_TOOL.input_schema, description: 'The clear version, in the same shape as the direct translation.' },
      changes: {
        type: 'array',
        description: 'Every change from the direct translation that a reviewer should know about: each split, move, grouping, relocation, deduplication, removal of boilerplate, placeholder and flagged conflict.',
        items: {
          type: 'object',
          required: ['kind', 'detail'],
          properties: {
            kind: { type: 'string', enum: ['split', 'moved', 'grouped', 'reworded', 'deduplicated', 'relocated', 'removed_boilerplate', 'placeholder', 'conflict_flagged', 'other'] },
            detail: { type: 'string' },
          },
        },
      },
      order_locked: {
        type: 'array',
        description: 'Every order-locked sequence you kept, in order, with the reason.',
        items: { type: 'object', required: ['steps', 'reason'], properties: { steps: { type: 'array', items: { type: 'string' } }, reason: { type: 'string' } } },
      },
      open_items: { type: 'array', items: { type: 'string' }, description: 'Every [Site to confirm/add/define: …] placeholder and source conflict, for the document owner.' },
    },
  },
}

const ENHANCE_SYSTEM = `You write the clear version of an industrial SOP. You are given the source document and its direct translation (a faithful, line-by-line structured copy). Rewrite the direct translation so the worker understands it quickly and does the job correctly and safely. ${OWNERSHIP_CONTEXT}

${AUDIENCE}

## Non-negotiable
- Every safety fact, hazard, PPE item, number, unit, direction, condition, wait, prohibition and reference in the direct translation must appear in the clear version with the same meaning and strength. Moving is allowed; losing is not.
- Never invent a fact, value, tool, method or step. A gap becomes a visible placeholder "[Site to confirm: …]" / "[Site to add: …]" / "[Site to define: …]", never a guess.
- Order-locked sequences keep their order unless the order procedure below allows a move; every move is recorded in changes ("moved: … — source listed this after …").
- Keep each step's image_indexes with the step that shows that image. Each image index on at most one step.
- Strength stays exact: "should", "recommended", "not recommended" stay advice ("You should…", "Not recommended:"); only "must", "shall", "do not", "never" become commands.
- A control goes in or before the step whose exposure it guards — never in a later step.
- Keep every value the source gives, including an imperial equivalent the source states alongside the metric one.
- A CHECK step lists only conditions the source states, in the source's words. Do not widen them ("tools", "nobody in the area", "has stopped") and do not add a "do not reach in" rule the source does not state.
- A placeholder may name only devices, actions and people the source names, phrased as a question for the site ("[Site to confirm: remove the blank hinge lock and the ring arm T-bar lock before restart?]"). Never write a placeholder as an instruction.
- Choices: offer a choice table only where the source says the options are alternatives; if it does not say they exclude each other, keep each instruction and say when it applies.

## Worker-facing text (overrides rules E6, E9, E10 and E19 where they conflict)
The steps are read by a worker, and every gap is already handed to the document owner through open_items. So:
- Never put "[Site to …]" placeholders, "[Source conflict: …]" notes or questions for the owner inside sections or steps. Put each one in open_items instead, naming the step it concerns.
- Never add a step the source lacks (restore, restart, emergency). List the missing step in open_items.
- Where a vague source word has no criterion in the source, keep the source word as written.
- "[Moved: …]" markers do not go in the step text either; record each move in changes.
- A CHECK step lists source-stated controls only. Do not add "do not reach in" or "do not go on" wording unless the source states it.

## Enhancement rules
${ENHANCE_RULES}

## Deciding whether order is locked
${ORDER_JUDGEMENT}

## Before you answer, check your draft against these failure modes
${ENHANCE_RISKS}

Then call create_clear_sop. Section types use the same vocabulary as the direct translation (hazards, ppe, procedure, emergency, scope, tools, cleanup, references).`

const CHECK_TOOL: LlmTool = {
  name: 'report_check',
  description: 'Report every problem found when comparing the clear version against the direct translation.',
  input_schema: {
    type: 'object',
    required: ['issues'],
    properties: {
      issues: {
        type: 'array',
        items: {
          type: 'object',
          required: ['severity', 'kind', 'note'],
          properties: {
            severity: { type: 'string', enum: ['critical', 'major', 'minor'], description: 'critical = a worker following the clear version could be hurt or damage equipment; major = a fact, number or condition lost or changed; minor = wording drift with no effect on what the worker does.' },
            kind: { type: 'string', enum: ['missing', 'altered', 'weakened', 'reordered', 'invented', 'unflagged_placeholder', 'other'] },
            direct: { type: 'string', nullable: true, description: 'The text in the direct translation.' },
            clear: { type: 'string', nullable: true, description: 'The text in the clear version.' },
            note: { type: 'string' },
          },
        },
      },
    },
  },
}

const CHECK_SYSTEM = `You audit a rewrite of an industrial SOP for safety. You get the DIRECT translation (the faithful record of the source) and the CLEAR version (a rewrite for workers). The clear version is allowed to split, regroup, reword, deduplicate, drop form boilerplate (approvals, revision tables, risk-matrix legends, unticked grid items) and turn controls into their own action steps placed before the exposure they guard, add "CHECK before you …" steps that only restate controls already in the direct translation, repeat a hazard or PPE reminder at later exposure steps, move document details (dates, reviewers, risk ratings) to a details section, and leave gaps to the owner's open-items list rather than the steps.

Report every place where the clear version:
- drops a safety fact, hazard, PPE item, number, unit, direction, wait, condition, prohibition or reference (missing);
- changes a value, direction or meaning (altered);
- softens a mandatory instruction or hardens a recommendation (weakened);
- changes the order of an order-locked sequence without a matching "moved" entry in the CHANGES list, or moves protection after the exposure it guards (reordered);
- adds a fact, value, tool, method or step that is not in the direct translation (invented);
- leaves an owner placeholder, conflict note or [Moved] marker in worker-facing text (unflagged_placeholder).
Do not report allowed changes. When a FAST CLASSIFIER FLAGS list is given, settle every flag from the texts: report it as an issue only if it is a real problem, and still check everything else. Then call report_check with an empty list if there are no problems.`

/** Writes the clear version from the direct translation, then checks it with a model from another family. */
export async function enhanceSop(
  sourceText: string,
  direct: ParsedSop,
  opts: { model?: string; checkModel?: string | null; jev?: boolean } = {},
): Promise<EnhancedSop> {
  const model = opts.model ?? aiModel('parse-enhance')
  const raw = (await llmToolCall({
    model,
    maxTokens: 32000,
    system: ENHANCE_SYSTEM,
    messages: [{ role: 'user', content: `SOURCE DOCUMENT:\n${sourceText}\n\nDIRECT TRANSLATION (JSON):\n${JSON.stringify(direct)}` }],
    tool: ENHANCE_TOOL,
  })) as { sop?: Record<string, unknown>; changes?: EnhanceChange[]; order_locked?: EnhancedSop['orderLocked']; open_items?: string[] }
  if (!raw?.sop) throw new Error('clear version: no sop in the tool result')
  const sop = toParsedSop(raw.sop, `[Clear version by ${model}]`)

  // ADR-0022: Jev runs first (seconds, fractions of a cent); its flags point the check model at what to settle.
  const jev = opts.jev === false ? null : await runJevChecks(direct, sop)
  if (jev?.error) console.error('[clear version] Jev checks failed:', jev.error)
  const checkModel = opts.checkModel === undefined ? aiModel('parse-enhance-check') : opts.checkModel
  let check: EnhancedSop['check'] = null
  if (checkModel) {
    const r = (await llmToolCall({
      model: checkModel,
      maxTokens: 16000,
      system: CHECK_SYSTEM,
      messages: [{ role: 'user', content: `DIRECT TRANSLATION:\n${JSON.stringify(direct)}\n\nCLEAR VERSION:\n${JSON.stringify(sop)}\n\nCHANGES the writer recorded:\n${JSON.stringify(raw.changes ?? [])}${jevFlagsText(jev)}` }],
      tool: CHECK_TOOL,
    })) as { issues?: EnhanceCheckIssue[] }
    const issues = r?.issues ?? []
    check = { model: checkModel, passed: !issues.some((i) => i.severity !== 'minor'), issues }
  }
  return { sop, changes: raw.changes ?? [], openItems: raw.open_items ?? [], orderLocked: raw.order_locked ?? [], check, jev, model }
}

function jevFlagsText(jev: JevSummary | null): string {
  if (!jev || (!jev.factFlags.length && !jev.numberFlags.length)) return ''
  const why = { not_covered: 'judged', unsure: 'unsure it is covered', condition: 'condition may be dropped' } as const
  const facts = jev.factFlags.map((f) => `- [${f.label}, ${why[f.reason]}${f.reason === 'not_covered' ? ` ${f.verdict}` : ''}] "${f.text}"`)
  const nums = jev.numberFlags.map((n) => `- the value ${n.value} is ${n.side === 'missing' ? 'in the direct translation but not the clear version' : 'in the clear version but not the direct translation'}: "${n.context}"`)
  return `\n\nFAST CLASSIFIER FLAGS (direct-translation facts and values to settle):\n${[...facts, ...nums].join('\n')}`
}

/** What sops.clear_version holds (ADR-0015). Read-only: runs, photos and sign-offs stay on the direct translation. */
export interface ClearVersion {
  model: string
  createdAt: string
  sections: Array<{
    type: string
    title: string
    content: string | null
    /** ADR-0023: the source's hazard pictograms, on the hazards section. */
    image_paths?: string[]
    steps: Array<{ text: string; warning: string | null; caution: string | null; tip: string | null; image_paths: string[]; signs?: Pictogram[] }>
  }>
  changes: EnhanceChange[]
  openItems: string[]
  orderLocked: EnhancedSop['orderLocked']
  check: EnhancedSop['check']
  jev?: JevSummary | null
}

/**
 * Writes the clear version beside a SOP and clears any earlier approval, so workers never see a rewrite
 * an admin has not read. `images` maps the extraction's image indexes to their storage paths.
 */
export async function writeClearVersion(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  args: { organisationId: string; sopId: string; sourceText: string; direct: ParsedSop; images: Array<{ index: number; storagePath: string }>; model?: string; checkModel?: string | null },
): Promise<ClearVersion> {
  const e = await enhanceSop(args.sourceText, args.direct, { model: args.model, checkModel: args.checkModel })
  const path = new Map(args.images.map((i) => [i.index, i.storagePath]))
  const used = new Set<number>()
  const clear: ClearVersion = {
    model: e.model,
    createdAt: new Date().toISOString(),
    sections: [...e.sop.sections].sort((a, b) => a.order - b.order).map((s) => ({
      type: s.type,
      title: s.title,
      content: s.content ?? null,
      steps: [...(s.steps ?? [])].sort((a, b) => a.order - b.order).map((st) => ({
        text: st.text,
        warning: st.warning ?? null,
        caution: st.caution ?? null,
        tip: st.tip ?? null,
        // Each picture on one step only, as in the direct translation.
        image_paths: (st.image_indexes ?? []).flatMap((n) => (path.has(n) && !used.has(n) ? (used.add(n), [path.get(n)!]) : [])),
      })),
    })),
    changes: e.changes,
    openItems: e.openItems,
    orderLocked: e.orderLocked,
    check: e.check,
    jev: e.jev,
  }
  // ADR-0023: the hazard sections' pictograms (parse attaches them to the section), signs placed on steps by Jev.
  const labels = pictogramLabels(args.sourceText)
  const pictos = args.direct.sections
    .filter((s) => s.type === 'hazards')
    .flatMap((s) => s.image_indexes ?? [])
    .flatMap((n) => (path.has(n) ? [{ label: labels.get(n) ?? null, path: path.get(n)! }] : []))
  await placeSigns(clear, pictos)
  const { error } = await admin
    .from('sops')
    .update({ clear_version: clear, clear_approved_at: null, clear_approved_by: null })
    .eq('id', args.sopId)
    .eq('organisation_id', args.organisationId)
  if (error) throw new Error(`clear version not saved: ${error.message}`)
  return clear
}
