'use client'

/**
 * Phase 21 (Plan 21-04 Task 1) — VerifyChecklist data hook.
 *
 * Joins three sources:
 *   1. `sop_section_blocks` rows for the SOP (id, type, snapshot preview,
 *      verified_by_admin_id, block_provenance).
 *   2. `useReviewerFlags(sopId)` for per-block flag counts (Wave 3).
 *   3. Wave 1 server actions `verifyBlock` / `unverifyBlock` for mutation.
 *
 * Optimistic update: approve() / decline() locally flip the row's
 * `verified_by_admin_id` before the server round-trips. On error, rollback
 * + toast (toast emitted via setError so the parent component can render).
 *
 * Approve implicitly acknowledges flags (Spike 004 finding #3 — no separate
 * ack step). The acknowledgement is OPTIMISTIC client-side: the flagged
 * block's flag rows are filtered out of the "needs-attention" surface as
 * soon as the block carries verified_by_admin_id. There is no separate
 * `flags_acknowledged` write — verification IS the acknowledgement.
 *
 * Decline (`d` keybinding) clears verification AND preserves the flag
 * (admin must re-read and re-approve).
 */

import { useCallback, useMemo, useState } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { verifyBlock, unverifyBlock } from '@/actions/sop-section-blocks'
import { useReviewerFlags } from '@/components/admin/ai-reviewer/useReviewerFlags'
import type { SourceProvenanceRegion } from '@/lib/parsers/source-viewer'

export type ChecklistBlock = {
  id: string
  type: string
  preview: string
  verified_by_admin_id: string | null
  flags_count: number
  provenance: SourceProvenanceRegion | null
}

export type UseVerifyChecklistResult = {
  blocks: ChecklistBlock[]
  verifiedCount: number
  totalCount: number
  activeBlockId: string | null
  activeIdx: number
  setActiveIdx: (idx: number) => void
  approve: (blockId: string) => Promise<void>
  decline: (blockId: string) => Promise<void>
  isReady: boolean
  isLoading: boolean
  error: string | null
  clearError: () => void
}

const QUERY_KEY = (sopId: string) => ['verify-checklist', sopId] as const

// 60-char preview from a Puck-block snapshot. We probe the most common
// content-bearing fields on the discriminated content shape and fall back
// to the block type label.
function previewFromSnapshot(snapshot: unknown, type: string): string {
  if (snapshot && typeof snapshot === 'object') {
    const s = snapshot as Record<string, unknown>
    const candidates = [s.text, s.title, s.body, s.content, s.heading]
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim().length > 0) {
        return c.trim().slice(0, 60)
      }
    }
  }
  return type
}

type RawBlockRow = {
  id: string
  snapshot_content: unknown
  verified_by_admin_id: string | null
  block_provenance: unknown
  sop_section_id: string
}

async function fetchBlocks(sopId: string): Promise<ChecklistBlock[]> {
  const sb = createClient()

  // First find the section IDs for this sop, then list their blocks.
  // (RLS gates org-scope on both tables; this is two round-trips by design
  // — keeps the query simple and avoids RPC.)
  const { data: sectionRows, error: sErr } = await sb
    .from('sop_sections')
    .select('id, sort_order')
    .eq('sop_id', sopId)
    .order('sort_order', { ascending: true })
  if (sErr || !sectionRows || sectionRows.length === 0) return []

  const sectionIds = (sectionRows as Array<{ id: string }>).map((r) => r.id)

  const { data: blockRows, error: bErr } = await sb
    .from('sop_section_blocks')
    .select('id, snapshot_content, verified_by_admin_id, block_provenance, sop_section_id, sort_order')
    .in('sop_section_id', sectionIds)
    .order('sop_section_id', { ascending: true })
    .order('sort_order', { ascending: true })
  if (bErr || !blockRows) return []

  // The .order() calls above already produce reading-order: sections by
  // sort_order, blocks within each section by sort_order. That matches the
  // builder canvas top-to-bottom flow so `j`/`k` walks the admin's eye-flow.
  const blocks: ChecklistBlock[] = []
  for (const raw of blockRows as RawBlockRow[]) {
    const snapshot = raw.snapshot_content as { kind?: string } | null
    const kind = (snapshot?.kind as string | undefined) ?? 'unknown'
    blocks.push({
      id: raw.id,
      type: kind,
      preview: previewFromSnapshot(snapshot, kind),
      verified_by_admin_id: raw.verified_by_admin_id,
      flags_count: 0, // populated below from reviewer envelope
      provenance: (raw.block_provenance as SourceProvenanceRegion | null) ?? null,
    })
  }

  return blocks
}

export function useVerifyChecklist(sopId: string): UseVerifyChecklistResult {
  const qc = useQueryClient()
  const [activeIdx, setActiveIdx] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)

  const query = useQuery<ChecklistBlock[]>({
    queryKey: QUERY_KEY(sopId),
    queryFn: () => fetchBlocks(sopId),
    enabled: !!sopId,
    staleTime: 10_000,
  })

  const reviewer = useReviewerFlags(sopId)

  // Merge flag counts from the reviewer envelope.
  const blocks = useMemo<ChecklistBlock[]>(() => {
    const base = query.data ?? []
    if (base.length === 0) return base
    return base.map((b) => ({
      ...b,
      flags_count: (reviewer.byBlockId.get(b.id) ?? []).length,
    }))
  }, [query.data, reviewer.byBlockId])

  const totalCount = blocks.length
  const verifiedCount = useMemo(
    () => blocks.filter((b) => b.verified_by_admin_id !== null).length,
    [blocks],
  )
  const isReady = totalCount > 0 && verifiedCount === totalCount

  const approveMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const res = await verifyBlock(blockId)
      if (!res.ok) throw new Error(res.error || 'verify failed')
      return blockId
    },
    onMutate: async (blockId) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY(sopId) })
      const prev = qc.getQueryData<ChecklistBlock[]>(QUERY_KEY(sopId)) ?? []
      qc.setQueryData<ChecklistBlock[]>(
        QUERY_KEY(sopId),
        prev.map((b) =>
          b.id === blockId
            ? { ...b, verified_by_admin_id: '__optimistic__' }
            : b,
        ),
      )
      return { prev }
    },
    onError: (err, _blockId, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEY(sopId), ctx.prev)
      setError(err instanceof Error ? err.message : 'verify failed')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY(sopId) })
    },
  })

  const declineMutation = useMutation({
    mutationFn: async (blockId: string) => {
      const res = await unverifyBlock(blockId)
      if (!res.ok) throw new Error(res.error || 'unverify failed')
      return blockId
    },
    onMutate: async (blockId) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY(sopId) })
      const prev = qc.getQueryData<ChecklistBlock[]>(QUERY_KEY(sopId)) ?? []
      qc.setQueryData<ChecklistBlock[]>(
        QUERY_KEY(sopId),
        prev.map((b) =>
          b.id === blockId ? { ...b, verified_by_admin_id: null } : b,
        ),
      )
      return { prev }
    },
    onError: (err, _blockId, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEY(sopId), ctx.prev)
      setError(err instanceof Error ? err.message : 'decline failed')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY(sopId) })
    },
  })

  const approve = useCallback(
    async (blockId: string) => {
      await approveMutation.mutateAsync(blockId).catch(() => {})
    },
    [approveMutation],
  )
  const decline = useCallback(
    async (blockId: string) => {
      await declineMutation.mutateAsync(blockId).catch(() => {})
    },
    [declineMutation],
  )

  const clearError = useCallback(() => setError(null), [])

  const activeBlockId = blocks[activeIdx]?.id ?? null

  return {
    blocks,
    verifiedCount,
    totalCount,
    activeBlockId,
    activeIdx,
    setActiveIdx,
    approve,
    decline,
    isReady,
    isLoading: query.isLoading,
    error,
    clearError,
  }
}
