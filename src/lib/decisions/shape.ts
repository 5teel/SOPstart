/**
 * Phase 56 / DEC-01, DEC-04 -- pure shape of one decision-ledger row.
 *
 * Plain module (no 'use server', no server-only, no I/O) so a spec can import
 * it. buildDecisionRow is the only place a row is assembled; record.ts feeds it
 * the session and inserts the result. There is deliberately no organisation or
 * actor field on DecisionInput: both come from the session (T-56-02).
 */

// Mirrors the kind CHECK in supabase/migrations/00070_decisions_ledger.sql, widened by 00073_office_ledger.sql.
export const DECISION_KINDS = [
  'approve', 'reject', 'sign_off', 'countersign', 'assign', 'unassign', 'publish',
  'owner_change', 'review', 'observation', 'verify', 'verify_withdrawn',
  'ai_finding_cleared', 'cadence_change', 'ai_field_write',
  'role_change', 'member_invited', 'member_removed',
] as const
export type DecisionKind = (typeof DECISION_KINDS)[number]

// An agent decision must name its agent (DEC-04). The allowlist is the type.
export const AGENT_NAMES = ['SOPstart assistant'] as const
export type AgentName = (typeof AGENT_NAMES)[number]
export const DEFAULT_AGENT_NAME: AgentName = 'SOPstart assistant'

export interface DecisionInput {
  kind: DecisionKind
  subject: { kind: string; id: string | null }
  sopId?: string | null
  /** Plain words from code literals and enums only. Free text goes in details. */
  summary: string
  details?: Record<string, unknown>
  /** Set when an agent, not the signed-in person, made the decision. */
  agent?: AgentName
  supersedes?: string
}

export interface DecisionSession {
  userId: string | null
  userEmail: string | null
  organisationId: string | null
}

export interface DecisionRow {
  organisation_id: string
  kind: DecisionKind
  actor_kind: 'person' | 'agent'
  actor_id: string | null
  actor_name: string | null
  subject_kind: string
  subject_id: string | null
  sop_id: string | null
  summary: string
  details: Record<string, unknown>
  source: 'live'
  supersedes_decision_id: string | null
}

export function buildDecisionRow(
  session: DecisionSession,
  input: DecisionInput,
): { ok: true; row: DecisionRow } | { ok: false; error: string } {
  if (!session.organisationId) return { ok: false, error: 'No organisation in session' }
  if (!(DECISION_KINDS as readonly string[]).includes(input.kind)) {
    return { ok: false, error: `Unknown decision kind: ${String(input.kind)}` }
  }
  const summary = typeof input.summary === 'string' ? input.summary : ''
  if (summary.length < 1 || summary.length > 200) {
    return { ok: false, error: 'Summary must be 1 to 200 characters' }
  }

  const details: Record<string, unknown> = { ...(input.details ?? {}) }
  let actor: Pick<DecisionRow, 'actor_kind' | 'actor_id' | 'actor_name'>

  if (input.agent !== undefined) {
    if (!(AGENT_NAMES as readonly string[]).includes(input.agent)) {
      return { ok: false, error: 'Agent decision needs a named agent' }
    }
    actor = { actor_kind: 'agent', actor_id: null, actor_name: input.agent }
    details.invoked_by = session.userId
  } else {
    if (!session.userId) return { ok: false, error: 'No signed-in person for a person decision' }
    actor = { actor_kind: 'person', actor_id: session.userId, actor_name: session.userEmail }
  }

  return {
    ok: true,
    row: {
      organisation_id: session.organisationId,
      kind: input.kind,
      ...actor,
      subject_kind: input.subject.kind,
      subject_id: input.subject.id,
      sop_id: input.sopId ?? null,
      summary,
      details,
      source: 'live',
      supersedes_decision_id: input.supersedes ?? null,
    },
  }
}
