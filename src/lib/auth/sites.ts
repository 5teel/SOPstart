import { createAdminClient } from '@/lib/supabase/admin'

export interface MySite { id: string; name: string; hidden: boolean }

/** The sites a person keeps out of their own picker (user metadata, set by setSiteHidden). */
export function hiddenSiteIds(meta: unknown): string[] {
  const v = (meta as { hidden_site_ids?: unknown } | null | undefined)?.hidden_site_ids
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
}

/** Every site the person belongs to, by name, each marked hidden or not. */
export async function mySites(userId: string, meta: unknown): Promise<MySite[]> {
  const hidden = new Set(hiddenSiteIds(meta))
  const { data } = await createAdminClient().from('organisation_members').select('organisations ( id, name )').eq('user_id', userId)
  return (data ?? [])
    .map((m) => m.organisations as unknown as { id: string; name: string } | null)
    .filter((o): o is { id: string; name: string } => !!o)
    .map((o) => ({ ...o, hidden: hidden.has(o.id) }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
