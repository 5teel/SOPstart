'use server'
import { z } from 'zod'
import { getSessionContext } from '@/lib/auth/session-context'

const Input = z.object({
  sopId: z.string().uuid(),
  stepId: z.string().uuid(),
})

export async function upsertWalkthroughProgress(input: z.infer<typeof Input>) {
  const parsed = Input.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const { supabase, userId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }

  const now = new Date().toISOString()
  const { error } = await supabase.from('walkthrough_progress').upsert(
    {
      sop_id: parsed.data.sopId,
      user_id: userId,
      step_id: parsed.data.stepId,
      updated_at: now,
    },
    { onConflict: 'sop_id,user_id' }
  )
  if (error) return { error: error.message }
  return { success: true as const }
}
