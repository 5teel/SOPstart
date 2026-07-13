'use server'
import { z } from 'zod'
import { getSessionContext } from '@/lib/auth/session-context'
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

  const { supabase, userId, role, organisationId } = await getSessionContext()
  if (!userId) return { error: 'Not authenticated' }

  // Role gate — only admin and safety_manager may write flow graphs.
  // Role + org come from getSessionContext (server-controlled, same table the
  // JWT claims are minted from), never user_metadata, which is
  // end-user-writable via supabase.auth.updateUser (24-REVIEW.md WR-02).
  if (!role || !['admin', 'safety_manager'].includes(role)) {
    return { error: 'Admin access required' }
  }
  if (!organisationId) return { error: 'No organisation found' }

  // .select('id') so RLS-filtered zero-row updates surface as an error instead
  // of silent success (24-REVIEW.md WR-01): without it Supabase reports 0
  // affected rows as { error: null } and the editor clears its error banner
  // even though nothing was written.
  const { data, error } = await supabase
    .from('sops')
    .update({ flow_graph: parsed.data.graph as unknown as import('@/types/database.types').Json })
    .eq('id', parsed.data.sopId)
    .eq('organisation_id', organisationId)
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return { error: 'SOP not found or you do not have permission to edit it' }
  }
  return { success: true as const }
}
