/**
 * ADR-0022: fast, calibrated checks of a SOP with TypeSafe Jev. Jev never writes text; it labels.
 *
 *  - checkFacts: every unit of the direct translation (one sentence, warning, caution or note) is
 *    judged covered / altered / missing in the clear version. Editor-only text (approvals, revision
 *    history, template guidance) is skipped, as rule E14 removes it. A unit is flagged unless Jev says
 *    covered at >= FACT_BAR; a unit with a condition (if, when, only, before...) also gets its own
 *    "same condition?" question, because Jev misses a dropped condition in a single coverage question
 *    (planted-error test, .autoresearch/analogue/jev-mutate.ts).
 *  - checkNumbers: code finds every number that is in one version but not the other; Jev only decides
 *    whether its context is a value the worker must meet (kept) or an identifier (dropped).
 *  - checkSteps: per clear step, "more than one action", "information only", "exposed with no warning".
 *  - textOnlyProcedures: procedure sections of a parse that hold instructions as text, not steps.
 * The flags go to the cross-family LLM check, which confirms or dismisses them (enhance-sop.ts).
 */
import type { ParsedSop } from '@/lib/validators/sop'
import { aiModel } from '@/lib/ai/registry'
import { jevAsk, jevPool, type JevAnswer, type JevQuestion, type JevUsage } from '@/lib/ai/jev'

export const FACT_BAR = 0.9 // planted-error test: 99-100% of answers at >= 0.9 matched both LLM judges
const STEP_BAR = 0.8
const PRICE_PER_M_IN = 0.042

export interface FactUnit { label: string; section: string; text: string; conditional: boolean }
export interface FactFlag { label: string; text: string; verdict: string; confidence: number; reason: 'not_covered' | 'unsure' | 'condition' }
export interface NumberFlag { value: string; side: 'missing' | 'added'; context: string }
export interface StepNote { section: string; step: number; text: string; problem: 'more_than_one_action' | 'information_only' | 'no_warning_where_exposed' }
export interface JevSummary {
  model: string
  facts: number
  factFlags: FactFlag[]
  numberFlags: NumberFlag[]
  stepNotes: StepNote[]
  costUsd: number
  error?: string
}

const sorted = (p: ParsedSop) => [...p.sections].sort((a, b) => a.order - b.order).map((s) => ({ ...s, steps: [...(s.steps ?? [])].sort((a, b) => a.order - b.order) }))
const sentences = (s: string) => s.split(/\n+|(?<=[.;!?])\s+(?=[A-Z(•-])/).map((x) => x.replace(/^[-•\s]+/, '').trim()).filter((x) => x.split(/\s+/).length >= 3)
const CONDITION = /\b(if|when|unless|only|until|before|after|except|once|while)\b/i

/** The direct translation cut into atomic units, labelled S<section>.<step> (S<section> for section text). */
export function factUnits(direct: ParsedSop): FactUnit[] {
  const out: FactUnit[] = []
  const seen = new Set<string>()
  const add = (label: string, section: string, text: string) => {
    const k = text.toLowerCase()
    if (seen.has(k)) return
    seen.add(k)
    out.push({ label, section, text, conditional: CONDITION.test(text) })
  }
  sorted(direct).forEach((s, si) => {
    for (const t of sentences(s.content ?? '')) add(`S${si + 1}`, s.title, t)
    s.steps.forEach((st, i) => {
      for (const t of sentences(st.text)) add(`S${si + 1}.${i + 1}`, s.title, t)
      for (const [k, v] of [['WARNING', st.warning], ['CAUTION', st.caution], ['NOTE', st.tip]] as const) if (v?.trim()) add(`S${si + 1}.${i + 1}`, s.title, `${k}: ${v.trim()}`)
    })
  })
  return out
}

/** What a worker reads in a SOP version: titles, section text, numbered steps and their callouts. */
export function workerText(p: ParsedSop): string {
  return sorted(p).flatMap((s) => [`## ${s.title}`, s.content ?? '', ...s.steps.map((st, i) => [`${i + 1}. ${st.text}`, st.warning && `WARNING: ${st.warning}`, st.caution && `CAUTION: ${st.caution}`, st.tip && `NOTE: ${st.tip}`].filter(Boolean).join('\n'))]).filter(Boolean).join('\n')
}

const choiceOf = (a: JevAnswer | undefined) => (a?.type === 'choice' ? a : null)
const noulOf = (a: JevAnswer | undefined) => (a?.type === 'noul' ? a.noul : 0)

export async function checkFacts(units: FactUnit[], clear: ParsedSop, usage: JevUsage): Promise<FactFlag[]> {
  const state = `WORK INSTRUCTION (as the worker sees it):\n${workerText(clear)}`
  const qs: Array<[string, JevQuestion]> = []
  units.forEach((u, i) => {
    qs.push([`f${i}`, {
      type: 'choice',
      instructions: `Compare this fact from the original document with the WORK INSTRUCTION: "${u.text}". Rewording, splitting or moving it is fine.`,
      criteria: {
        covered: 'The work instruction states this fact with the same meaning, values, conditions and strength',
        altered: 'The work instruction states it but a number, unit, condition, device, location or must/should strength differs',
        missing: 'The work instruction does not state this fact',
        other: 'Cannot tell',
      },
    }])
    if (u.conditional) qs.push([`c${i}`, {
      type: 'noul',
      instructions: `The original says: "${u.text}". In the WORK INSTRUCTION, is the same action limited by the same condition (the same "if", "when", "only", "before" or "after"), on the step itself or in a check right next to it?`,
      criteria: { true: 'The condition is kept with the action', false: 'The action is written without its condition, or the condition changed' },
    }])
  })
  // Editor-only lines, judged on their own (a question about the original asked against the clear
  // version as state is answered poorly): what the worker needs vs approvals, history, template notes.
  const editorOnly = new Set<number>()
  await jevPool(units.map((u, i) => ({ u, i })), 12, async ({ u, i }) => {
    const a = await jevAsk(`SECTION OF AN INDUSTRIAL WORK INSTRUCTION: ${u.section}
LINE: ${u.text}`, {
      worker: { type: 'noul', instructions: 'Does a worker doing the job need this LINE?', criteria: { true: 'The worker needs it', false: 'Only document editors, approvers or auditors need it (approvals, revision history, template guidance, document classification)' } },
    }, usage)
    if (noulOf(a.worker) < 0.5) editorOnly.add(i)
  })
  const answers: Record<string, JevAnswer> = {}
  const chunks: Array<Array<[string, JevQuestion]>> = []
  for (let i = 0; i < qs.length; i += 40) chunks.push(qs.slice(i, i + 40)) // ponytail: 40 per call stays well inside the 64k cap; the state is re-sent per chunk
  await jevPool(chunks, 4, async (c) => { Object.assign(answers, await jevAsk(state, Object.fromEntries(c), usage)) })
  const flags: FactFlag[] = []
  units.forEach((u, i) => {
    const a = choiceOf(answers[`f${i}`])
    const verdict = a?.choice ?? 'other'
    const confidence = a?.confidence ?? 0
    if (editorOnly.has(i)) return // the clear version is meant to drop it (E14)
    if (verdict !== 'covered') flags.push({ label: u.label, text: u.text, verdict, confidence, reason: 'not_covered' })
    else if (confidence < FACT_BAR) flags.push({ label: u.label, text: u.text, verdict, confidence, reason: 'unsure' })
    else if (u.conditional && noulOf(answers[`c${i}`]) < 0.5) flags.push({ label: u.label, text: u.text, verdict: 'condition', confidence: 1 - noulOf(answers[`c${i}`]), reason: 'condition' })
  })
  return flags
}

// ---- numbers -----------------------------------------------------------------------
const NUM = /(?<![\w.,])(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?!\d)/g
/** Every number with its sentence; step numbers and doc codes (EN-FOR-03-043, HM-EXT-02-001-F03) are left out. */
function numbersIn(text: string) {
  const out = new Map<string, string>()
  for (const s of text.replace(/^\d+\.\s/gm, '').split(/\n+|(?<=[.;!?])\s+/)) {
    const clean = s.replace(/\b[A-Za-z]{1,8}\d*(?:[-_][A-Za-z0-9]+)+\b/g, ' ')
    for (const m of clean.matchAll(NUM)) {
      const v = m[1].replace(/,/g, '')
      if (!out.has(v)) out.set(v, s.trim().slice(0, 300))
    }
  }
  return out
}

export async function checkNumbers(direct: ParsedSop, clear: ParsedSop, usage: JevUsage): Promise<NumberFlag[]> {
  const d = numbersIn(workerText(direct))
  const c = numbersIn(workerText(clear))
  const diff: NumberFlag[] = [
    ...[...d].filter(([v]) => !c.has(v)).map(([value, context]) => ({ value, side: 'missing' as const, context })),
    ...[...c].filter(([v]) => !d.has(v)).map(([value, context]) => ({ value, side: 'added' as const, context })),
  ]
  const kept: NumberFlag[] = []
  await jevPool(diff, 8, async (f) => {
    const a = await jevAsk(`SENTENCE FROM A WORK INSTRUCTION: ${f.context}`, {
      kind: {
        type: 'choice',
        instructions: `What is the number ${f.value} in this sentence?`,
        criteria: {
          spec: 'A value the worker must set, meet, wait for, count or check (temperature, time, pressure, distance, quantity, limit, range)',
          identifier: 'Part of a name, code, model, software version, screen or display number, step, section, page or figure number',
          other: 'Anything else',
        },
      },
    }, usage)
    const k = choiceOf(a.kind)
    if (k?.choice === 'spec' && k.confidence >= 0.6) kept.push(f)
  })
  return kept
}

// ---- step quality ----------------------------------------------------------------------
export async function checkSteps(clear: ParsedSop, usage: JevUsage): Promise<StepNote[]> {
  // Hazard, PPE and reference lists are information by design; only the doing sections are checked.
  const steps = sorted(clear).filter((s) => ['procedure', 'cleanup', 'emergency'].includes(s.type)).flatMap((s) => s.steps.map((st, i) => ({ section: s.title, step: i + 1, st })))
  const notes: StepNote[] = []
  await jevPool(steps, 8, async ({ section, step, st }) => {
    const state = [`SECTION: ${section}`, `STEP: ${st.text}`, st.warning && `WARNING ON THIS STEP: ${st.warning}`, st.caution && `CAUTION ON THIS STEP: ${st.caution}`].filter(Boolean).join('\n')
    const a = await jevAsk(state, {
      multi: { type: 'noul', instructions: 'Does the STEP ask the worker to do two or more separate physical actions?', criteria: { true: 'Two or more separate actions', false: 'One action (with its details)' } },
      info: { type: 'noul', instructions: 'Is the STEP only information (an explanation, a fact, or what the machine or screen does) with nothing for the worker to do?', criteria: { true: 'Only information', false: 'The worker does something' } },
      exposed: { type: 'noul', instructions: 'At this STEP does the worker touch, reach into or work right next to hot, moving, pressurised or live equipment?', criteria: { true: 'The worker is exposed at this step', false: 'The worker is not exposed at this step' } },
    }, usage)
    const text = st.text.slice(0, 160)
    if (noulOf(a.multi) >= STEP_BAR) notes.push({ section, step, text, problem: 'more_than_one_action' })
    if (noulOf(a.info) >= STEP_BAR) notes.push({ section, step, text, problem: 'information_only' })
    if (noulOf(a.exposed) >= STEP_BAR && !st.warning && !st.caution) notes.push({ section, step, text, problem: 'no_warning_where_exposed' })
  })
  return notes.sort((a, b) => a.section.localeCompare(b.section) || a.step - b.step)
}

/** All Jev checks of a clear version against its direct translation. Never throws: errors are recorded. */
export async function runJevChecks(direct: ParsedSop, clear: ParsedSop): Promise<JevSummary> {
  const usage: JevUsage = { inputTokens: 0, calls: 0 }
  const units = factUnits(direct)
  const base = { model: aiModel('clear-fact-check'), facts: units.length }
  try {
    const [factFlags, numberFlags, stepNotes] = await Promise.all([checkFacts(units, clear, usage), checkNumbers(direct, clear, usage), checkSteps(clear, usage)])
    return { ...base, factFlags, numberFlags, stepNotes, costUsd: (usage.inputTokens * PRICE_PER_M_IN) / 1e6 }
  } catch (e) {
    return { ...base, factFlags: [], numberFlags: [], stepNotes: [], costUsd: (usage.inputTokens * PRICE_PER_M_IN) / 1e6, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Procedure sections of a parse that hold instructions as text with no steps (a half-hollow parse). */
export async function textOnlyProcedures(p: ParsedSop): Promise<string[]> {
  const cands = p.sections.filter((s) => s.type === 'procedure' && !s.steps?.length && (s.content ?? '').trim().length > 40)
  const hits: string[] = []
  await jevPool(cands, 4, async (s) => {
    const a = await jevAsk(`SECTION "${s.title}":\n${(s.content ?? '').slice(0, 6000)}`, {
      actions: { type: 'noul', instructions: 'Does this section tell a worker to carry out actions in order (do this, then that)?', criteria: { true: 'It gives actions to carry out', false: 'It only gives information, rules or references' } },
    })
    if (noulOf(a.actions) >= STEP_BAR) hits.push(s.title)
  })
  return hits
}
