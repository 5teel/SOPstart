'use server'

/**
 * Phase 63 (R4, T-63-16, T-59-30): the owner's name for the home's Read view.
 *
 * Supervisor and up only; a worker is refused before any read. The SOP is read with
 * the session client under RLS and filtered to the session organisation. The name
 * comes from the shared label helper, which holds the only service-role access; this
 * file never imports the service-role client. Async exports only.
 */
import { z } from 'zod'
import { getSessionContext } from '@/lib/auth/session-context'
import { memberLabel, userLabels } from '@/lib/members/labels'

const OWNER_ROLES = new Set(['supervisor', 'admin', 'safety_manager'])
const idSchema = z.string().uuid()

export async function getSopOwner(sopId: string): Promise<{ label: string | null } | { error: string }> {
  const parsed = idSchema.safeParse(sopId)
  if (!parsed.success) return { error: 'Not found' }
  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId || !organisationId || !role || !OWNER_ROLES.has(role)) return { error: 'Not allowed' }

  const { data } = await supabase
    .from('sops')
    .select('owner_user_id')
    .eq('id', parsed.data)
    .eq('organisation_id', organisationId)
    .maybeSingle()
  const ownerId = (data as { owner_user_id: string | null } | null)?.owner_user_id ?? null
  if (!ownerId) return { label: null }
  return { label: memberLabel((await userLabels([ownerId])).get(ownerId)) }
}
