'use server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { FlowGraphSchema } from '@/lib/validators/flow-graph'

const MAX_BYTES = 256 * 1024  // 256KB

const Input = z.object({
  sopId: z.string().uuid(),
  graph: FlowGraphSchema,
})

export async function updateSopFlowGraph(input: z.infer<typeof Input>) {
  const parsed = Input.safeParse(input)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const jsonStr = JSON.stringify(parsed.data.graph)
  if (Buffer.byteLength(jsonStr, 'utf8') > MAX_BYTES) {
    return { error: `Flow graph exceeds ${MAX_BYTES / 1024}KB limit` }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Role gate — only admin and safety_manager may write flow graphs
  const rawRole = (user.user_metadata?.['user_role'] as string | undefined)
    ?? (user as unknown as { app_metadata?: { user_role?: string } }).app_metadata?.user_role
    ?? ''
  const role = (user as unknown as { user_role?: string }).user_role ?? rawRole
  if (!['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }

  const { error } = await supabase
    .from('sops')
    .update({ flow_graph: parsed.data.graph as unknown as import('@/types/database.types').Json })
    .eq('id', parsed.data.sopId)

  if (error) return { error: error.message }
  return { success: true as const }
}
