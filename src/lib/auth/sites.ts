import { createAdminClient } from '@/lib/supabase/admin'

export interface MySite { id: string; name: string; hidden: boolean; admin: boolean }

/** Every site the person belongs to, by name: whether an admin hid it, and whether this person is one of its admins. */
export async function mySites(userId: string): Promise<MySite[]> {
  const { data } = await createAdminClient()
    .from('organisation_members')
    .select('role, organisations ( id, name, hidden_from_picker )')
    .eq('user_id', userId)
    .eq('status', 'active')
  return (data ?? [])
    .flatMap((m) => {
      const o = m.organisations as unknown as { id: string; name: string; hidden_from_picker: boolean } | null
      return o ? [{ id: o.id, name: o.name, hidden: o.hidden_from_picker, admin: m.role === 'admin' || m.role === 'safety_manager' }] : []
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}
