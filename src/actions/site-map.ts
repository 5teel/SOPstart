'use server'

/**
 * ADR-0010 -- how the home site map packs its areas, for the session org. Its own module because
 * organisations has no update policy (as setObservationLabels), so this one write uses the
 * service-role client, scoped to the SESSION org only; site.ts stays session-client only.
 */
import { z } from 'zod'
import { requireAdminContext } from '@/lib/auth/guards'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordDecision } from '@/lib/decisions/record'

export async function setSiteMapPacking(packing: string): Promise<{ packing: 'balanced' | 'rows'; logged: boolean } | { error: string }> {
  const parsed = z.enum(['balanced', 'rows']).safeParse(packing)
  if (!parsed.success) return { error: 'Unknown packing' }
  const ctx = await requireAdminContext()
  if ('error' in ctx) return { error: ctx.error }
  if (!ctx.organisationId) return { error: 'No organisation' }
  const { data, error } = await createAdminClient()
    .from('organisations')
    .update({ site_map_packing: parsed.data } as never)
    .eq('id', ctx.organisationId)
    .select('id')
  if (error || !data?.length) {
    console.error('[setSiteMapPacking] update error', error)
    return { error: 'Could not save the map layout' }
  }
  const rec = await recordDecision({
    kind: 'site_change',
    subject: { kind: 'organisation', id: ctx.organisationId },
    summary: 'Changed how the site map is laid out',
    details: { action: 'packing', packing: parsed.data },
  })
  return { packing: parsed.data, logged: rec.ok }
}
