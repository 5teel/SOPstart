import { createAdminClient } from '@/lib/supabase/admin'

/**
 * AI findings the latest review raised against one junction (flags carry the
 * junction id). Plain module, not a server action: the service-role read lives
 * here so src/actions/sop-section-blocks.ts stays free of the admin client
 * (tests/lint guard, Phase 46 CR-01). Org scope is the caller's session org.
 */
export async function findingsFor(
  sopId: string | null,
  organisationId: string | null,
  blockId: string,
): Promise<Array<{ job: string; kind: string; severity: string; description: string }>> {
  if (!sopId || !organisationId) return []
  const { data } = await createAdminClient()
    .from('parse_jobs')
    .select('ai_review_results')
    .eq('sop_id', sopId)
    .eq('organisation_id', organisationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const flags = (data?.ai_review_results as { flags?: unknown } | null)?.flags
  if (!Array.isArray(flags)) return []
  return flags
    .filter((f) => f && typeof f === 'object' && (f as { block_id?: string }).block_id === blockId)
    .map((f) => {
      const x = f as Record<string, unknown>
      return {
        job: String(x.job ?? ''),
        kind: String(x.kind ?? ''),
        severity: String(x.severity ?? ''),
        description: String(x.description ?? ''),
      }
    })
}
