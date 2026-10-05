'use server'

import { createClient } from '@/lib/supabase/server'

// Phase 58 D-16 -- what the editor's bottom bar reads. Same three counts as
// assertPublishGates (src/lib/governance/publish-core.ts) so the button and the
// server never disagree; the server gate stays the authority. Session client,
// so RLS scopes every count to the caller's organisation.

export type PublishGateStatus = {
  ready: boolean
  total: number
  unchecked: number
  openFindings: number
  reasons: string[]
}

export async function getPublishGateStatus(sopId: string): Promise<PublishGateStatus | { error: string }> {
  if (!sopId) return { error: 'sopId required' }

  const supabase = await createClient()

  const steps = () => supabase.from('sop_focus_steps').select('*', { count: 'exact', head: true }).eq('sop_id', sopId)
  const [totalRes, uncheckedRes, findingsRes] = await Promise.all([
    steps(),
    steps().is('verified_by_admin_id', null),
    supabase
      .from('sop_ai_findings')
      .select('*', { count: 'exact', head: true })
      .eq('sop_id', sopId)
      .is('cleared_at', null),
  ])

  const err = totalRes.error ?? uncheckedRes.error ?? findingsRes.error
  if (err) return { error: err.message }

  const total = totalRes.count ?? 0
  const unchecked = uncheckedRes.count ?? 0
  const openFindings = findingsRes.count ?? 0

  const reasons: string[] = []
  if (total === 0) {
    reasons.push('Add at least one step')
  } else {
    if (unchecked > 0) reasons.push(`${unchecked} ${unchecked === 1 ? 'step' : 'steps'} still to check`)
    if (openFindings > 0) reasons.push(`${openFindings} AI ${openFindings === 1 ? 'finding' : 'findings'} open`)
  }

  return { ready: reasons.length === 0, total, unchecked, openFindings, reasons }
}
