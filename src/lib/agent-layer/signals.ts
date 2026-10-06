/**
 * Phase 26.5 D-06 — the four agent-layer signal sources.
 *
 * Each reader is independently try/caught (mirrors the ai-reviewer
 * orchestrator's per-job isolation, CLAUDE.md 2026-06-02): one failing
 * source returns a neutral/empty result and never blanks the whole
 * synthesis run. Every query uses createAdminClient() (service role) and
 * self-enforces org-scope explicitly — either via a direct
 * `organisation_id` column (sop_completions, parse_jobs, sop_focus_steps) or,
 * where a table has no such column, by first confirming the SOP belongs to the
 * caller's org (CLAUDE.md 2026-06-15/2026-06-26).
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { lineageRoot } from '@/lib/sop/lineage-current'
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
  /** Focus steps on the SOP and how many an admin has not ticked (Phase 58). */
  totalSteps: number
  unverifiedCount: number
  needsRecheckCount: number
  error?: string
}

export type VoiceSignals = {
  totalQuestions: number
  recentQuestions: string[]
  error?: string
}

export type ObjectiveSignals = {
  /** "Objective · <text> · set by <agent or 'a person'>[ · unconfirmed]" -- no names or emails. */
  lines: string[]
  error?: string
}

export type SignalBundle = {
  completions: CompletionSignals
  reviewer: ReviewerSignals
  verify: VerifySignals
  voice: VoiceSignals
  objectives: ObjectiveSignals
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
    // WR-04 (review fix): .every() on an empty array is vacuously true — a
    // run with a missing/empty job_status (legacy envelope shape) must NOT
    // count as "all jobs errored", or we manufacture a fake infra failure
    // (the exact inverse of the 2026-06-02 lesson this flag exists for).
    const allRunsErrored =
      runs.length > 0 &&
      runs.every((run) => {
        const statuses = Object.values(run.job_status ?? {})
        return statuses.length > 0 && statuses.every((s) => s === 'error')
      })

    return { totalRuns: runs.length, flagCountsBySeverity, allRunsErrored }
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : 'unknown' }
  }
}

export async function readVerifySignals(
  organisationId: string,
  sopId: string,
): Promise<VerifySignals> {
  const empty: VerifySignals = { totalSteps: 0, unverifiedCount: 0, needsRecheckCount: 0 }
  try {
    const admin = createAdminClient()
    if (!(await sopBelongsToOrg(admin, organisationId, sopId))) {
      return { ...empty, error: 'sop not found in organisation' }
    }
    const { data, error } = await admin
      .from('sop_focus_steps')
      .select('verified_at, needs_recheck')
      .eq('organisation_id', organisationId)
      .eq('sop_id', sopId)
    if (error) return { ...empty, error: error.message }

    const rows = data ?? []
    return {
      totalSteps: rows.length,
      unverifiedCount: rows.filter((r) => !r.verified_at).length,
      needsRecheckCount: rows.filter((r) => r.needs_recheck).length,
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

/**
 * Phase 60 (60-10, F-10): the objectives in force for a SOP -- its own (keyed on the
 * lineage root), those of the machines it is linked to, and the site's. Delivered as
 * a signal; the byte-pinned SOP pack is not touched.
 */
export async function readObjectiveSignals(
  organisationId: string,
  sopId: string,
): Promise<ObjectiveSignals> {
  const empty: ObjectiveSignals = { lines: [] }
  try {
    const admin = createAdminClient()
    const { data: sop } = await admin
      .from('sops')
      .select('id, parent_sop_id')
      .eq('id', sopId)
      .eq('organisation_id', organisationId)
      .maybeSingle()
    if (!sop) return { ...empty, error: 'sop not found in organisation' }
    // ponytail: sop_machines is not in database.types, so this one read goes through an untyped client.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: links } = await (admin as any)
      .from('sop_machines')
      .select('machine_id')
      .eq('organisation_id', organisationId)
      .eq('sop_id', sopId)
    const machineIds = ((links ?? []) as { machine_id: string }[]).map((l) => l.machine_id)

    const { data, error } = await admin
      .from('objectives')
      .select('subject_type, subject_id, text, set_by_agent, confirmed_by')
      .eq('organisation_id', organisationId)
      .in('subject_type', ['site', 'machine', 'sop'])
    if (error) return { ...empty, error: error.message }

    const mine = new Set<string>([lineageRoot(sop), ...machineIds])
    const lines = (data ?? [])
      .filter((o) => o.subject_type === 'site' || (o.subject_id !== null && mine.has(o.subject_id)))
      .map((o) => {
        const by = o.set_by_agent ?? 'a person'
        const open = o.set_by_agent && !o.confirmed_by ? ' · unconfirmed' : ''
        return `Objective · ${o.text} · set by ${by}${open}`
      })
    return { lines }
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : 'unknown' }
  }
}

export async function readAllSignals(organisationId: string, sopId: string): Promise<SignalBundle> {
  const [completions, reviewer, verify, voice, objectives] = await Promise.all([
    readCompletionSignals(organisationId, sopId),
    readReviewerSignals(organisationId, sopId),
    readVerifySignals(organisationId, sopId),
    readVoiceSignals(organisationId, sopId),
    readObjectiveSignals(organisationId, sopId),
  ])
  return { completions, reviewer, verify, voice, objectives }
}
