import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { AGENT_NAMES, type AgentName } from '@/lib/decisions/shape'
import { subjectInOrg, type SubjectRef } from '@/lib/requests/core'

/**
 * Phase 60 (D-05, RQS-04) -- an agent raising a new-SOP request.
 *
 * Plain server module, no directive: nothing a browser can call reaches it. A caller
 * passes the SESSION organisation and every query here carries it. No ledger row:
 * raising is a request, not a decision, and the agent is not a session to record
 * under. No caller today: the machine-coverage producer was removed (ADR-0004 rule 4).
 */
const RECENT_DAYS = 30

export type AgentRaise = { raised: string } | { skipped: 'open' | 'recent' | 'not-found' }

export async function raiseRequestAsAgent(input: {
  organisationId: string
  agent: AgentName
  subject: SubjectRef
  note: string
}): Promise<AgentRaise> {
  const { organisationId, agent, subject, note } = input
  if (!(AGENT_NAMES as readonly string[]).includes(agent)) throw new Error('Unknown agent')
  if (subject.type !== 'machine' || !(await subjectInOrg(organisationId, subject))) return { skipped: 'not-found' }

  const admin = createAdminClient()
  const since = new Date(Date.now() - RECENT_DAYS * 86_400_000).toISOString()
  const { data: answered } = await admin
    .from('requests')
    .select('id')
    .eq('organisation_id', organisationId)
    .eq('kind', 'new_sop')
    .eq('subject_id', subject.id as string)
    .in('state', ['accepted', 'declined'])
    .gte('decided_at', since)
    .limit(1)
  if (answered && answered.length > 0) return { skipped: 'recent' }

  const { data, error } = await admin
    .from('requests')
    .insert({
      organisation_id: organisationId,
      kind: 'new_sop',
      state: 'open',
      raised_by_agent: agent,
      subject_type: 'machine',
      subject_id: subject.id,
      note: note.trim().slice(0, 500),
    })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') return { skipped: 'open' } // the partial unique index: already one open
    console.error('[raiseRequestAsAgent] insert error', error)
    return { skipped: 'not-found' }
  }
  return { raised: data.id }
}
