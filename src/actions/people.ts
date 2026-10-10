'use server'

/**
 * The reads behind the People board's authority marks: the approval chains and who supervises
 * whom. Admin and safety manager only (the People section's audience); session client under RLS,
 * filtered to the session organisation. Read-only: nothing here grants anything.
 */
import { requireAdminContext } from '@/lib/auth/guards'
import type { ChainStep } from '@/lib/governance/approvals'

export interface PeopleAuthorityData {
  chains: Array<{ category: string; steps: ChainStep[] }>
  supervision: Array<{ supervisor_id: string; worker_id: string }>
}

export async function getPeopleAuthorityData(): Promise<PeopleAuthorityData | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = ctx.supabase as any
  const [chains, supervision] = await Promise.all([
    db.from('approval_chains').select('category, steps').eq('organisation_id', ctx.organisationId),
    db.from('supervisor_assignments').select('supervisor_id, worker_id').eq('organisation_id', ctx.organisationId),
  ])
  if (chains.error || supervision.error) return { error: "That didn't load." }
  return {
    chains: (chains.data ?? []) as PeopleAuthorityData['chains'],
    supervision: (supervision.data ?? []) as PeopleAuthorityData['supervision'],
  }
}
