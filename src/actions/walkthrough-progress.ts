'use server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const Input = z.object({
  sopId: z.string().uuid(),
  stepId: z.string().uuid(),
})

export async function upsertWalkthroughProgress(input: z.infer<typeof Input>) {
  const parsed = Input.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const now = new Date().toISOString()
  const { error } = await supabase.from('walkthrough_progress').upsert(
    {
      sop_id: parsed.data.sopId,
      user_id: user.id,
      step_id: parsed.data.stepId,
      updated_at: now,
    },
    { onConflict: 'sop_id,user_id' }
  )
  if (error) return { error: error.message }
  return { success: true as const }
}
