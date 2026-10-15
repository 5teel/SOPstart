'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionContext } from '@/lib/auth/session-context'
import { recordDecision } from '@/lib/decisions/record'

/**
 * ADR-0018: a platform admin approves or turns down a new account. The caller is
 * re-checked with is_platform_admin() on their own session; the write is service role
 * (user_approvals has no authenticated write policy).
 */
export async function decideNewUser(userId: string, approve: boolean): Promise<{ error?: string; logged?: boolean }> {
  const parsed = z.object({ userId: z.string().uuid(), approve: z.boolean() }).safeParse({ userId, approve })
  if (!parsed.success) return { error: 'Invalid input' }
  const { supabase, userId: me } = await getSessionContext()
  if (!me) return { error: 'Sign in first.' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isPlatform } = await (supabase as any).rpc('is_platform_admin')
  if (isPlatform !== true) return { error: 'Only a SOPstart admin can approve accounts.' }
  if (parsed.data.userId === me) return { error: 'You cannot decide your own account.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const { data, error } = await admin
    .from('user_approvals')
    .update({ status: parsed.data.approve ? 'approved' : 'declined', decided_at: new Date().toISOString(), decided_by: me })
    .eq('user_id', parsed.data.userId)
    .select('user_id')
  if (error || !data?.length) return { error: "That didn't save. Try again." }

  const rec = await recordDecision({
    kind: parsed.data.approve ? 'approve' : 'reject',
    subject: { kind: 'user', id: parsed.data.userId },
    summary: parsed.data.approve ? 'Approved a new account' : 'Turned down a new account',
  })
  revalidatePath('/approvals')
  return { logged: rec.ok }
}
