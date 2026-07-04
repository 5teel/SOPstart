/**
 * Phase 26.5 D-03 — cross-SOP vector similarity search.
 *
 * PostgREST cannot express pgvector's `<=>` operator over `.select()`/
 * `.filter()` (RESEARCH Pitfall 3) — every similarity query MUST go through
 * the `match_sop_agent_metadata` SECURITY DEFINER RPC (migration 00040),
 * which self-enforces `organisation_id` inside its body since SECURITY
 * DEFINER bypasses RLS. Never call `.select()` with a raw vector operator.
 */
import { createAdminClient } from '@/lib/supabase/admin'

export type SopSimilarityMatch = {
  sop_id: string
  similarity: number
}

export async function matchSopAgentMetadata(
  organisationId: string,
  queryEmbedding: number[],
  matchCount = 10,
): Promise<SopSimilarityMatch[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('match_sop_agent_metadata', {
    p_organisation_id: organisationId,
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: matchCount,
  })
  if (error) throw error
  return (data ?? []) as SopSimilarityMatch[]
}
