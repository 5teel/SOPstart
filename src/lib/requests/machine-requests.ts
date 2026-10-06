import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { DEFAULT_AGENT_NAME } from '@/lib/decisions/shape'
import { machinesWithoutSops } from '@/lib/sop/admin-health'
import { raiseRequestAsAgent } from '@/lib/requests/agent'
import type { SopMachineLink } from '@/lib/validators/site'

/**
 * ADR-0002 (replaces the Phase 60 daily machines-without-SOPs sweep): the agent's
 * "this machine has no SOPs yet" request, kept in step with the links.
 *
 * Plain server module, no directive: no browser can call it. The caller passes
 * the SESSION organisation (a site-editor action or the Office read) and every
 * query carries it. Without ids it covers every machine of the organisation but
 * only raises (the read path); with ids it also withdraws the open agent request
 * of a machine that now has a SOP (the event path). Raising is idempotent
 * (raiseRequestAsAgent skips an open or recently answered one). No ledger row:
 * a request raised by the agent is not a decision. Never throws.
 */
// ponytail: first 2000 machines per call; page by id if a site ever has more.
const MAX_ROWS = 2000

export async function reconcileMachineRequests(organisationId: string, machineIds?: string[]): Promise<void> {
  try {
    if (machineIds && machineIds.length === 0) return
    // ponytail: site_machines / sop_machines are not in the generated types, so these reads go through a loose client.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const admin = createAdminClient() as any
    let machinesQ = admin.from('site_machines').select('id').eq('organisation_id', organisationId)
    let linksQ = admin.from('sop_machines').select('machine_id').eq('organisation_id', organisationId)
    if (machineIds) {
      machinesQ = machinesQ.in('id', machineIds)
      linksQ = linksQ.in('machine_id', machineIds)
    }
    const [machines, links, open] = await Promise.all([
      machinesQ.limit(MAX_ROWS),
      linksQ.limit(MAX_ROWS),
      admin
        .from('requests')
        .select('subject_id')
        .eq('organisation_id', organisationId)
        .eq('kind', 'new_sop')
        .eq('state', 'open')
        .not('raised_by_agent', 'is', null)
        .limit(MAX_ROWS),
    ])
    const failed = machines.error ?? links.error ?? open.error
    if (failed) {
      console.error('[reconcileMachineRequests] read error', failed)
      return
    }
    const all = (machines.data ?? []) as { id: string }[]
    const bare = machinesWithoutSops(all, (links.data ?? []) as SopMachineLink[])
    const hasOpen = new Set(((open.data ?? []) as { subject_id: string }[]).map((r) => r.subject_id))

    for (const m of bare) {
      if (hasOpen.has(m.id)) continue
      await raiseRequestAsAgent({
        organisationId,
        agent: DEFAULT_AGENT_NAME,
        subject: { type: 'machine', id: m.id },
        note: 'This machine has no SOPs yet.',
      })
    }

    if (!machineIds) return
    const bareIds = new Set(bare.map((m) => m.id))
    const linked = all.map((m) => m.id).filter((id) => !bareIds.has(id) && hasOpen.has(id))
    if (linked.length === 0) return
    const { error } = await admin
      .from('requests')
      .update({ state: 'withdrawn', decided_at: new Date().toISOString() })
      .eq('organisation_id', organisationId)
      .eq('kind', 'new_sop')
      .eq('state', 'open')
      .not('raised_by_agent', 'is', null)
      .in('subject_id', linked)
    if (error) console.error('[reconcileMachineRequests] withdraw error', error)
  } catch (err) {
    console.error('[reconcileMachineRequests] FAILED', err)
  }
}
