import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { notify } from '@/lib/notifications/write'
import { dedupeKey, notificationTitle } from '@/lib/notifications/kinds'
import { notificationPlace } from '@/lib/notifications/places'
import { reviewDueTargets, type ReviewDueRow } from '@/lib/notifications/review-due'
import { machinesWithoutSops } from '@/lib/sop/admin-health'
import { raiseRequestAsAgent } from '@/lib/requests/agent'
import { DEFAULT_AGENT_NAME } from '@/lib/decisions/shape'
import type { SopMachineLink } from '@/lib/validators/site'

/**
 * Phase 60 (A-08) -- the daily sweeps behind the cron routes.
 *
 * Plain server module, no directive: no browser can call it. There is no
 * session, so organisation ids come from the organisations read (or the
 * validated body behind the secret) and every query carries one. No sweep
 * writes the ledger: a notification and a request raised by the agent are not
 * decisions, and the ledger writer reads a session these routes never have.
 * Every sweep is idempotent: a repeat run writes nothing new.
 */
// ponytail: one cron run covers the first 50 organisations and 2000 rows each;
// add paging by id if the platform ever outgrows a single run.
const MAX_ORGS_PER_SWEEP = 50
const MAX_ROWS_PER_ORG = 2000

async function orgIds(only?: string): Promise<string[]> {
  if (only) return [only]
  const { data, error } = await createAdminClient().from('organisations').select('id').limit(MAX_ORGS_PER_SWEEP)
  if (error) {
    console.error('[cron] organisations read error', error)
    return []
  }
  return (data ?? []).map((o) => o.id as string)
}

export async function runReviewDueSweep(opts: { now?: Date; organisationId?: string } = {}): Promise<{ notified: number }> {
  const now = opts.now ?? new Date()
  const admin = createAdminClient()
  let notified = 0
  for (const org of await orgIds(opts.organisationId)) {
    const { data, error } = await admin
      .from('sops')
      .select('id, title, version, parent_sop_id, status, owner_user_id, review_due_at')
      .eq('organisation_id', org)
      .eq('status', 'published')
      .not('review_due_at', 'is', null)
      .limit(MAX_ROWS_PER_ORG)
    if (error) {
      console.error('[review-due] read error', error)
      continue
    }
    const targets = reviewDueTargets((data ?? []) as ReviewDueRow[], now)
    notified += await notify(
      org,
      targets.map((t) => ({
        userId: t.ownerId,
        kind: 'review_due' as const,
        title: notificationTitle({ kind: 'review_due', sop: t.title, dueAt: t.reviewDueAt }, now),
        place: notificationPlace('review_due'),
        subjectType: 'sop',
        subjectId: t.sopId,
        dedupeKey: dedupeKey({ kind: 'review_due', sopId: t.sopId, dueAt: t.reviewDueAt }),
      })),
    )
  }
  return { notified }
}

/** D-05: one agent-raised new-SOP request per machine with no SOP; raiseRequestAsAgent skips an open or recently answered one. */
export async function runMachinesWithoutSopsSweep(opts: { organisationId?: string } = {}): Promise<{ raised: number; skipped: number }> {
  // ponytail: site_machines / sop_machines are not in the generated types, so this read goes through a loose client.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  let raised = 0
  let skipped = 0
  for (const org of await orgIds(opts.organisationId)) {
    const [machines, links] = await Promise.all([
      admin.from('site_machines').select('id').eq('organisation_id', org).limit(MAX_ROWS_PER_ORG),
      admin.from('sop_machines').select('sop_id, machine_id').eq('organisation_id', org).limit(MAX_ROWS_PER_ORG),
    ])
    if (machines.error || links.error) {
      console.error('[machines-without-sops] read error', machines.error ?? links.error)
      continue
    }
    const bare = machinesWithoutSops((machines.data ?? []) as { id: string }[], (links.data ?? []) as SopMachineLink[])
    for (const m of bare) {
      const result = await raiseRequestAsAgent({
        organisationId: org,
        agent: DEFAULT_AGENT_NAME,
        subject: { type: 'machine', id: m.id },
        note: 'This machine has no SOPs yet.',
      })
      if ('raised' in result) raised++
      else skipped++
    }
  }
  return { raised, skipped }
}
