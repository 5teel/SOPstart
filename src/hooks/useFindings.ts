'use client'

/**
 * Phase 58 (58-13, WRK-04, D-02, D-17) -- the AI check as the editor sees it:
 * the findings rows of the latest run plus every one still open, "run" and
 * "clear". Clearing goes through `clearFinding`, which writes the decision
 * ledger row; running goes through the reviewer route, which spends money and
 * is capped per SOP per day. After either, the publish gate is re-read because
 * an open finding blocks Publish.
 */
import { useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

export interface Finding {
  id: string
  kind: string
  job: string
  step_id: string | null
  description: string
  cleared_at: string | null
}

interface FindingsEnvelope {
  findings: Finding[]
  lastRunAt: string | null
  hasSource: boolean
}

const RUN_ERRORS: Record<string, string> = {
  per_day_cap: "You've used today's AI checks on this SOP. Try again tomorrow.",
  per_org_cap: 'The AI check has hit its limit for now. Try again later.',
  nothing_to_review: 'Add some steps first, then run the AI check.',
}

/** `enabled` false holds the read back (a SOP still being parsed has nothing to check yet). */
export function useFindings(sopId: string, enabled = true) {
  const queryClient = useQueryClient()
  const key = ['focus-findings', sopId]

  const query = useQuery({
    queryKey: key,
    queryFn: async (): Promise<FindingsEnvelope> => {
      const res = await fetch(`/api/sops/${sopId}/ai-reviewer`)
      if (!res.ok) throw new Error('read_failed')
      return (await res.json()) as FindingsEnvelope
    },
    staleTime: 30_000,
    enabled,
  })

  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)

  const refresh = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['focus-findings', sopId] }),
        queryClient.invalidateQueries({ queryKey: ['focus-gate', sopId] }),
      ]),
    [queryClient, sopId]
  )

  const run = useCallback(async () => {
    setRunning(true)
    setRunError(null)
    try {
      const res = await fetch(`/api/sops/${sopId}/ai-reviewer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        setRunError(RUN_ERRORS[body.error ?? ''] ?? "The AI check didn't run.")
        return
      }
      await refresh()
    } catch {
      setRunError("The AI check didn't run.")
    } finally {
      setRunning(false)
    }
  }, [sopId, refresh])

  return {
    findings: query.data?.findings ?? [],
    lastRunAt: query.data?.lastRunAt ?? null,
    hasSource: query.data?.hasSource ?? true,
    loading: enabled && query.isPending,
    loadFailed: query.isError,
    running,
    runError,
    run,
    /** Re-read the findings and the publish gate (after a clear). */
    refresh,
    reload: () => void query.refetch(),
  }
}
