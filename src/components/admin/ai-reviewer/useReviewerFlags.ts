'use client'

/**
 * Phase 21 (Plan 21-03 Task 3) — TanStack Query hook for the AI reviewer
 * envelope (read + re-run).
 *
 * Read path: `useQuery` against `GET /api/sops/[sopId]/ai-reviewer`. Returns
 * the latest persisted envelope OR null when never run.
 *
 * Re-run path: `useMutation` against POST. On 429 the hook surfaces a
 * structured error so the toolbar button can render the right toast.
 *
 * Admin-only — D-21-09 isolation: this hook MUST NOT be imported by any
 * worker-side route. It lives under `src/components/admin/ai-reviewer/`
 * and is only consumed by `BuilderWithSourceViewer.tsx`.
 */

import { useCallback, useMemo, useState } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type {
  ReviewerFlag,
  ReviewerJobId,
  ReviewerRunEnvelope,
} from '@/lib/parsers/ai-reviewer'

export type ReviewerRerunErrorKind = 'per_day_cap' | 'per_org_cap' | 'other'

export type ReviewerRerunError = {
  kind: ReviewerRerunErrorKind
  message: string
  /** When kind === 'per_day_cap', the ISO timestamp the cap resets at. */
  resetAt?: string
}

export type UseReviewerFlagsResult = {
  envelope: ReviewerRunEnvelope | null
  flags: ReviewerFlag[]
  byBlockId: Map<string, ReviewerFlag[]>
  isLoading: boolean
  isError: boolean
  rerun: (jobs?: ReviewerJobId[]) => Promise<void>
  isRerunning: boolean
  rerunError: ReviewerRerunError | null
  clearRerunError: () => void
}

const QUERY_KEY = (sopId: string) => ['reviewer-flags', sopId] as const

async function fetchEnvelope(sopId: string): Promise<ReviewerRunEnvelope | null> {
  const res = await fetch(`/api/sops/${sopId}/ai-reviewer`, {
    cache: 'no-store',
  })
  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`fetchEnvelope ${res.status}`)
  }
  return (await res.json()) as ReviewerRunEnvelope
}

async function postRerun(
  sopId: string,
  jobs?: ReviewerJobId[],
): Promise<ReviewerRunEnvelope> {
  const res = await fetch(`/api/sops/${sopId}/ai-reviewer`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(jobs ? { jobs } : {}),
  })
  if (res.status === 429) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: ReviewerRerunErrorKind
      reset_at?: string
    }
    const kind = (body.error as ReviewerRerunErrorKind) || 'other'
    const err = new Error(kind) as Error & ReviewerRerunError
    err.kind = kind
    err.message = kind
    err.resetAt = body.reset_at
    throw err
  }
  if (!res.ok) {
    throw new Error(`postRerun ${res.status}`)
  }
  return (await res.json()) as ReviewerRunEnvelope
}

export function useReviewerFlags(sopId: string): UseReviewerFlagsResult {
  const qc = useQueryClient()
  const [rerunError, setRerunError] = useState<ReviewerRerunError | null>(null)

  const query = useQuery<ReviewerRunEnvelope | null>({
    queryKey: QUERY_KEY(sopId),
    queryFn: () => fetchEnvelope(sopId),
    enabled: !!sopId,
    staleTime: 30_000,
  })

  const mutation = useMutation({
    mutationFn: (jobs?: ReviewerJobId[]) => postRerun(sopId, jobs),
    onSuccess: (env) => {
      qc.setQueryData(QUERY_KEY(sopId), env)
      setRerunError(null)
    },
    onError: (err: Error & Partial<ReviewerRerunError>) => {
      const kind: ReviewerRerunErrorKind =
        err.kind === 'per_day_cap' || err.kind === 'per_org_cap'
          ? err.kind
          : 'other'
      const message =
        kind === 'per_day_cap'
          ? 'Daily limit reached, try again at midnight UTC'
          : kind === 'per_org_cap'
            ? 'Org Anthropic budget exhausted — contact platform admin'
            : err.message || 'Re-run failed'
      setRerunError({ kind, message, resetAt: err.resetAt })
    },
  })

  const envelope = query.data ?? null
  const flags = useMemo<ReviewerFlag[]>(
    () => envelope?.flags ?? [],
    [envelope],
  )

  const byBlockId = useMemo<Map<string, ReviewerFlag[]>>(() => {
    const m = new Map<string, ReviewerFlag[]>()
    for (const f of flags) {
      const key = f.block_id ?? '__sop__'
      const arr = m.get(key) ?? []
      arr.push(f)
      m.set(key, arr)
    }
    // Rank within each bucket: critical first, then by source-location-hint
    // containing multiple page references (Spike 003 finding #5).
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1
        const ahint = a.source_location_hint ?? ''
        const bhint = b.source_location_hint ?? ''
        const apages = (ahint.match(/\d+/g) ?? []).length
        const bpages = (bhint.match(/\d+/g) ?? []).length
        return bpages - apages
      })
    }
    return m
  }, [flags])

  const rerun = useCallback(
    async (jobs?: ReviewerJobId[]) => {
      await mutation.mutateAsync(jobs).catch(() => {
        // onError already routed the structured error into state.
      })
    },
    [mutation],
  )

  const clearRerunError = useCallback(() => setRerunError(null), [])

  return {
    envelope,
    flags,
    byBlockId,
    isLoading: query.isLoading,
    isError: query.isError,
    rerun,
    isRerunning: mutation.isPending,
    rerunError,
    clearRerunError,
  }
}
