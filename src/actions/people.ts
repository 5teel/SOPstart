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

/**
 * Link or unlink a supervisor and a worker (the rows supervisor sign-off is gated on). Admin only,
 * as the 00002 insert/delete policies are; both people must be members of the session organisation.
 */
export async function setSupervision(input: { supervisorId: string; workerId: string; linked: boolean }): Promise<{ success: true } | { error: string }> {
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  if (ctx.role !== 'admin') return { error: 'Only an admin can link supervisors.' }
  if (!ctx.organisationId) return { error: 'No organisation' }
  const { supervisorId, workerId, linked } = input
  if (typeof supervisorId !== 'string' || typeof workerId !== 'string' || typeof linked !== 'boolean' || supervisorId === workerId) {
    return { error: 'Invalid input' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = ctx.supabase as any
  const org = ctx.organisationId
  const { data: people } = await db
    .from('organisation_members')
    .select('user_id, role')
    .eq('organisation_id', org)
    .in('user_id', [supervisorId, workerId])
  const sup = (people ?? []).find((p: { user_id: string }) => p.user_id === supervisorId)
  if (!sup || !(people ?? []).some((p: { user_id: string }) => p.user_id === workerId)) return { error: 'Member not found' }
  if (linked && sup.role !== 'supervisor') return { error: 'Only a supervisor can be linked to workers.' }

  const res = linked
    ? await db
        .from('supervisor_assignments')
        .upsert({ organisation_id: org, supervisor_id: supervisorId, worker_id: workerId }, { onConflict: 'organisation_id,supervisor_id,worker_id', ignoreDuplicates: true })
        .select('id')
    : await db
        .from('supervisor_assignments')
        .delete()
        .eq('organisation_id', org)
        .eq('supervisor_id', supervisorId)
        .eq('worker_id', workerId)
        .select('id')
  if (res.error) return { error: "That didn't save." }
  return { success: true }
}
