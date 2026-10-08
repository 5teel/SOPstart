'use client'
/**
 * Phase 63 -- step and tool search over the visible SOPs. One debounced browser-client
 * query on sop_focus_steps under RLS; no server action (CLAUDE.md 2026-09-29).
 *
 * ponytail: tools match on an exact tool name (array contains) and the response caps at
 * 500 step rows; a search view if a site outgrows that.
 */
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { sanitizeSearch } from '@/lib/library/search'

const EMPTY: ReadonlySet<string> = new Set()

export function useSopSearch(query: string, visibleIds: readonly string[]) {
  const [typed, setTyped] = useState(query)
  useEffect(() => {
    const t = setTimeout(() => setTyped(query), 250)
    return () => clearTimeout(t)
  }, [query])

  const term = sanitizeSearch(typed)
  const wanted = sanitizeSearch(query)
  const ids = useMemo(() => [...visibleIds].sort(), [visibleIds])

  const { data, isFetching } = useQuery({
    queryKey: ['library-search', term, ids],
    enabled: !!term && ids.length > 0,
    queryFn: async () => {
      const { data, error } = await createClient()
        .from('sop_focus_steps')
        .select('sop_id')
        .in('sop_id', ids)
        .or(`text.ilike.%${term}%,required_tools.cs.{${term}}`)
        .limit(500)
      if (error) throw new Error(error.message)
      return new Set((data ?? []).map((r: { sop_id: string }) => r.sop_id))
    },
    staleTime: 1000 * 60,
  })

  return { ids: term && data ? data : EMPTY, pending: wanted !== term || isFetching }
}
