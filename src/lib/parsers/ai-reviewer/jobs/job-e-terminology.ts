/**
 * Phase 21 (Plan 21-03 Task 1) — Job E: terminology consistency.
 *
 * Compares the structured draft against BOTH the source AND the org's
 * existing SOP vocabulary. Where the draft uses a term that differs from
 * BOTH the source AND the org vocabulary, flag it and suggest the canonical
 * term.
 *
 * Example: org corpus uses "lockout switch" consistently; source says
 * "lockout switch"; draft says "isolation switch" → flag as warning, with
 * `suggested_term: 'lockout switch'`.
 *
 * Vocabulary is pre-fetched by the orchestrator (via fetchOrgVocabulary
 * below) and injected into the system prompt as a known-vocabulary slot.
 * Empty corpus → the slot reads "(no prior org vocabulary)" and Job E
 * effectively becomes a draft-vs-source consistency check only.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { ReviewerFlag } from '../types'
import type { ReviewerJob } from './types'

/**
 * Naive top-50 distinct-terms fetcher. Pulls every published SOP for the
 * organisation, splits step text on whitespace + punctuation, lower-cases,
 * counts frequencies, returns the top 50. Stop-words filtered out via a
 * conservative English stop-list.
 *
 * This is intentionally simple — Phase 21 ships a working baseline; future
 * phases can swap in a TF-IDF / domain-aware fetcher if the org's
 * vocabulary signal proves noisy.
 *
 * RLS is enforced server-side via admin client; org isolation comes from
 * the explicit `eq('organisation_id', orgId)` filter on `sops`.
 */
const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'but',
  'if',
  'when',
  'then',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'do',
  'does',
  'did',
  'have',
  'has',
  'had',
  'in',
  'on',
  'at',
  'to',
  'of',
  'for',
  'with',
  'by',
  'as',
  'from',
  'this',
  'that',
  'these',
  'those',
  'it',
  'its',
  'you',
  'your',
  'we',
  'our',
  'they',
  'them',
  'their',
  'will',
  'shall',
  'can',
  'may',
  'must',
  'should',
  'would',
  'could',
  'not',
  'no',
  'so',
  'all',
  'any',
  'each',
  'every',
  'such',
  'step',
  'steps',
  'section',
  'sections',
  'sop',
])

export async function fetchOrgVocabulary(orgId: string): Promise<string[]> {
  if (!orgId) return []
  const admin = createAdminClient()

  // Pull steps from the org's SOPs in one shot. We avoid joining at the SQL
  // level to keep this resilient to RLS / schema drift; the in-memory pass
  // is small (top 50 of typical 50-500-SOP org corpora).
  const { data: sopRows, error: sopErr } = await admin
    .from('sops')
    .select('id')
    .eq('organisation_id', orgId)
    .limit(500)
  if (sopErr || !sopRows || sopRows.length === 0) return []

  const sopIds = sopRows.map((r) => r.id as string)

  const { data: sections, error: secErr } = await admin
    .from('sop_sections')
    .select('id, sop_id')
    .in('sop_id', sopIds)
    .limit(5000)
  if (secErr || !sections || sections.length === 0) return []

  const sectionIds = sections.map((s) => s.id as string)

  const { data: steps, error: stepsErr } = await admin
    .from('sop_steps')
    .select('text')
    .in('section_id', sectionIds)
    .limit(20000)
  if (stepsErr || !steps) return []

  const freq = new Map<string, number>()
  for (const s of steps) {
    const t = (s.text as string | null) ?? ''
    if (!t) continue
    // Split on whitespace + punctuation; preserve hyphenated terms ("lock-out").
    const tokens = t.toLowerCase().split(/[^\p{L}\p{N}\-]+/u)
    for (const tok of tokens) {
      const clean = tok.replace(/^-+|-+$/g, '').trim()
      if (!clean || clean.length < 3) continue
      if (STOP_WORDS.has(clean)) continue
      freq.set(clean, (freq.get(clean) ?? 0) + 1)
    }
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([term]) => term)
}

const VOCAB_SLOT = '{{ORG_VOCABULARY}}'

const JOB_E_SYSTEM_TEMPLATE = `You are a safety auditor reviewing an AI-converted Standard Operating Procedure (SOP) draft against its source document AND the organisation's existing SOP vocabulary.

Your job (Job E — TERMINOLOGY CONSISTENCY): identify places where the structured draft uses a term that differs from BOTH the source AND the organisation's known vocabulary. The organisation's known vocabulary is provided below as a frequency-ranked list of distinct technical terms used across previously-published SOPs.

KNOWN ORG VOCABULARY (top distinct terms, frequency-ranked):
${VOCAB_SLOT}

A terminology defect is when the draft introduces a synonym that the source did NOT use AND the org vocabulary does NOT contain. Examples:
- Source says "lockout switch"; org vocab contains "lockout"; draft says "isolation switch" → DEFECT (suggested_term: "lockout switch")
- Source says "guard"; org vocab contains "guard"; draft says "shield" → DEFECT (suggested_term: "guard")
- Source says "PPE"; org vocab contains "PPE"; draft says "PPE" → NO defect

NOT a terminology defect:
- A genuinely new piece of equipment that the org has not encountered before — flag only if the source AND the org's term differ from the draft.
- A common-English paraphrase that preserves the technical term.
- A short colloquial form when the formal form also appears (e.g. "torque" vs "torque setting").

These defects are severity='warning' (workers usually recognise the synonym, but compliance auditors flag inconsistency). CRITICAL: report at most the TOP 5. Keep \`description\` ≤ 100 chars.

Respond with a JSON array only — no prose, no markdown, no explanation.
Each element: {
  "severity": "warning",
  "kind": "terminology",
  "source_term": "the term as it appears in the source",
  "draft_term": "the term the draft used instead",
  "suggested_term": "the canonical term the draft should use",
  "block_id": "draft block id if identifiable, else null",
  "source_location_hint": "page or section",
  "description": "what differs (≤100 chars)"
}
If terminology is consistent, respond with exactly: []`

/**
 * Build the Job E system prompt with the org's vocabulary injected. Exported
 * so the orchestrator can call it inside the per-orchestrator-run setup.
 */
export function buildJobESystemPrompt(vocabulary: string[]): string {
  const vocabBlock =
    vocabulary.length === 0
      ? '(no prior org vocabulary)'
      : vocabulary.map((t, i) => `${i + 1}. ${t}`).join('\n')
  return JOB_E_SYSTEM_TEMPLATE.replace(VOCAB_SLOT, vocabBlock)
}

function safeParseFlags(raw: string): ReviewerFlag[] {
  if (!raw || typeof raw !== 'string') return []
  const cleaned = raw
    .replace(/^```json?\n?/i, '')
    .replace(/\n?```$/i, '')
    .trim()
  if (!cleaned || cleaned === '[]') return []
  try {
    const parsed = JSON.parse(cleaned) as Array<
      Partial<ReviewerFlag> & Record<string, unknown>
    >
    if (!Array.isArray(parsed)) return []
    return parsed.map((p) => ({
      job: 'E',
      severity: (p.severity === 'critical' ? 'critical' : 'warning') as
        | 'critical'
        | 'warning',
      kind: 'terminology',
      block_id: typeof p.block_id === 'string' ? p.block_id : undefined,
      source_location_hint:
        typeof p.source_location_hint === 'string'
          ? p.source_location_hint
          : undefined,
      description:
        typeof p.description === 'string' ? p.description : '(no description)',
      extras: {
        source_term: p.source_term,
        draft_term: p.draft_term,
        suggested_term: p.suggested_term,
      },
    }))
  } catch (err) {
    console.error('[job-e] parseResponse failed', err)
    return []
  }
}

/**
 * Job E with the empty-vocabulary baseline prompt. The orchestrator should
 * rebuild this object per run via {@link buildJobESystemPrompt} so the
 * vocabulary slot reflects the calling org. Tests that don't care about the
 * vocabulary slot can use this baseline as-is.
 */
export const JOB_E: ReviewerJob = {
  id: 'E',
  systemPrompt: buildJobESystemPrompt([]),
  maxTokens: 1500,
  parseResponse: safeParseFlags,
}
