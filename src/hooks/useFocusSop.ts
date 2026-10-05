'use client'
import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getFocusSop } from '@/actions/focus-steps'
import { listLineageVersions, type LineageVersion } from '@/actions/versions'
import type { FocusSop } from '@/lib/sop/focus-read'

/**
 * Phase 58 (58-12) -- the editor's read of one SOP. The server page hands in the
 * first read; every structural action then calls `invalidate()` and the whole SOP
 * (steps, sections, standards, counts) is read again. The publish gate and the
 * approval line are re-read with it so the bottom bar never lags the document.
 */
export function useFocusSop(sopId: string, initial: FocusSop) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['focus-sop', sopId],
    queryFn: async () => {
      const res = await getFocusSop(sopId)
      if ('error' in res) throw new Error(res.error)
      return res.focus
    },
    initialData: initial,
    staleTime: 30_000,
  })

  const invalidate = useCallback(
    () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['focus-sop', sopId] }),
        queryClient.invalidateQueries({ queryKey: ['focus-gate', sopId] }),
        queryClient.invalidateQueries({ queryKey: ['focus-approval', sopId] }),
      ]),
    [queryClient, sopId]
  )

  return { focus: query.data, invalidate, isFetching: query.isFetching }
}

/** The versions of this SOP, newest first (admin only). Empty until it loads, or if the read is refused. */
export function useFocusLineage(sopId: string): LineageVersion[] {
  const query = useQuery({
    queryKey: ['focus-lineage', sopId],
    queryFn: async () => {
      const res = await listLineageVersions({ sopId })
      return 'error' in res ? [] : res.versions
    },
    staleTime: 30_000,
  })
  return query.data ?? []
}
