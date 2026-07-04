/**
 * Phase 26.5 D-06 — the four agent-layer signal sources.
 *
 * Each reader is independently try/caught (mirrors the ai-reviewer
 * orchestrator's per-job isolation, CLAUDE.md 2026-06-02): one failing
 * source returns a neutral/empty result and never blanks the whole
 * synthesis run. Every query uses createAdminClient() (service role) and
 * self-enforces org-scope explicitly — either via a direct
 * `organisation_id` column (sop_completions, parse_jobs) or, where the
 * table has no such column (sop_section_blocks), by first confirming the
 * SOP belongs to the caller's org (CLAUDE.md 2026-06-15/2026-06-26).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import type { AckTraceEntry } from '@/types/sop'
import type { ReviewerRunEnvelope } from '@/lib/parsers/ai-reviewer/types'

export type CompletionSignals = {
  totalCompletions: number
  /** stepId -> times acknowledged across all completions, in first-seen order */
  stepAckCounts: { stepId: string; count: number }[]
  error?: string
}

export type ReviewerSignals = {
  totalRuns: number
  flagCountsBySeverity: { critical: number; warning: number }
  /** all(job_status) === 'error' across every run — infra failure, not "no findings" (2026-06-02) */
  allRunsErrored: boolean
  error?: string
}

export type VerifySignals = {
  totalBlocks: number
  unverifiedCount: number
  recentlyOverriddenCount: number
  error?: string
}

export type VoiceSignals = {
  totalQuestions: number
  recentQuestions: string[]
  error?: string
}

export type SignalBundle = {
  completions: CompletionSignals
  reviewer: ReviewerSignals
  verify: VerifySignals
  voice: VoiceSignals
}

/** Self-enforced org-scope guard for tables with no direct organisation_id column. */
async function sopBelongsToOrg(
  admin: ReturnType<typeof createAdminClient>,
  organisationId: string,
  sopId: string,
): Promise<boolean> {
  const { data } = await admin
    .from('sops')
    .select('id')
    .eq('id', sopId)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  return !!data
}

export async function readCompletionSignals(
  organisationId: string,
  sopId: string,
): Promise<CompletionSignals> {
  const empty: CompletionSignals = { totalCompletions: 0, stepAckCounts: [] }
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('sop_completions')
      .select('step_ack_trace')
      .eq('organisation_id', organisationId)
      .eq('sop_id', sopId)
    if (error) return { ...empty, error: error.message }

    const counts = new Map<string, number>()
    for (const row of data ?? []) {
      const trace = (row.step_ack_trace as AckTraceEntry[] | null) ?? []
      for (const entry of trace) {
        counts.set(entry.stepId, (counts.get(entry.stepId) ?? 0) + 1)
      }
    }
    return {
      totalCompletions: data?.length ?? 0,
      stepAckCounts: Array.from(counts, ([stepId, count]) => ({ stepId, count })),
    }
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : 'unknown' }
  }
}

export async function readReviewerSignals(
  organisationId: string,
  sopId: string,
): Promise<ReviewerSignals> {
  const empty: ReviewerSignals = {
    totalRuns: 0,
    flagCountsBySeverity: { critical: 0, warning: 0 },
    allRunsErrored: false,
  }
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('parse_jobs')
      .select('ai_review_results')
      .eq('organisation_id', organisationId)
      .eq('sop_id', sopId)
    if (error) return { ...empty, error: error.message }

    const runs = (data ?? [])
      .map((row) => row.ai_review_results as unknown as ReviewerRunEnvelope | null)
      .filter((r): r is ReviewerRunEnvelope => !!r && Array.isArray(r.flags))

    const flagCountsBySeverity = { critical: 0, warning: 0 }
    for (const run of runs) {
      for (const flag of run.flags) flagCountsBySeverity[flag.severity]++
    }
    const allRunsErrored =
      runs.length > 0 &&
      runs.every((run) => Object.values(run.job_status ?? {}).every((s) => s === 'error'))

    return { totalRuns: runs.length, flagCountsBySeverity, allRunsErrored }
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : 'unknown' }
  }
}

export async function readVerifySignals(
  organisationId: string,
  sopId: string,
): Promise<VerifySignals> {
  const empty: VerifySignals = { totalBlocks: 0, unverifiedCount: 0, recentlyOverriddenCount: 0 }
  try {
    const admin = createAdminClient()
    if (!(await sopBelongsToOrg(admin, organisationId, sopId))) {
      return { ...empty, error: 'sop not found in organisation' }
    }
    const { data: sections, error: sectionsErr } = await admin
      .from('sop_sections')
      .select('id')
      .eq('sop_id', sopId)
    if (sectionsErr) return { ...empty, error: sectionsErr.message }
    const sectionIds = (sections ?? []).map((s) => s.id)
    if (sectionIds.length === 0) return empty

    const { data: blocks, error: blocksErr } = await admin
      .from('sop_section_blocks')
      .select('verified_at, overridden_at')
      .in('sop_section_id', sectionIds)
    if (blocksErr) return { ...empty, error: blocksErr.message }

    const rows = blocks ?? []
    return {
      totalBlocks: rows.length,
      unverifiedCount: rows.filter((b) => !b.verified_at).length,
      recentlyOverriddenCount: rows.filter((b) => !!b.overridden_at).length,
    }
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : 'unknown' }
  }
}

export async function readVoiceSignals(
  organisationId: string,
  sopId: string,
): Promise<VoiceSignals> {
  const empty: VoiceSignals = { totalQuestions: 0, recentQuestions: [] }
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('sop_voice_qa_log')
      .select('question, created_at')
      .eq('organisation_id', organisationId)
      .eq('sop_id', sopId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) return { ...empty, error: error.message }
    return {
      totalQuestions: data?.length ?? 0,
      recentQuestions: (data ?? []).slice(0, 10).map((r) => r.question),
    }
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : 'unknown' }
  }
}

export async function readAllSignals(organisationId: string, sopId: string): Promise<SignalBundle> {
  const [completions, reviewer, verify, voice] = await Promise.all([
    readCompletionSignals(organisationId, sopId),
    readReviewerSignals(organisationId, sopId),
    readVerifySignals(organisationId, sopId),
    readVoiceSignals(organisationId, sopId),
  ])
  return { completions, reviewer, verify, voice }
}
