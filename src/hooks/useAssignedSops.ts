'use client'
import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/offline/db'
import { queryPersister } from '@/lib/offline/query-persister'
import type { CachedSop } from '@/lib/offline/db'
import { categoryLabel } from '@/lib/sop-categories'

interface UseAssignedSopsOptions {
  category_slug?: string
  search?: string
}

function matchesSearch(sop: CachedSop, searchTerm: string): boolean {
  const term = searchTerm.toLowerCase()
  return (
    (sop.title?.toLowerCase().includes(term) ?? false) ||
    (sop.sop_number?.toLowerCase().includes(term) ?? false) ||
    // Phase 40 DAT-01: match on the human LABEL, not the raw slug, so a
    // worker typing "safety" still finds Safety SOPs.
    (categoryLabel(sop.category_slug ?? null)?.toLowerCase().includes(term) ?? false) ||
    (sop.department?.toLowerCase().includes(term) ?? false)
  )
}

export function useAssignedSops(options?: UseAssignedSopsOptions) {
  const { category_slug, search } = options ?? {}

  return useQuery({
    queryKey: ['assigned-sops', category_slug, search],
    queryFn: async () => {
      let collection = db.sops.where('status').equals('published')

      const results = await collection.toArray()

      let filtered = results

      if (category_slug) {
        filtered = filtered.filter((sop) => sop.category_slug === category_slug)
      }

      if (search) {
        filtered = filtered.filter((sop) => matchesSearch(sop, search))
      }

      // Sort by title
      filtered.sort((a, b) => {
        const titleA = a.title ?? ''
        const titleB = b.title ?? ''
        return titleA.localeCompare(titleB)
      })

      return filtered
    },
    persister: queryPersister,
    networkMode: 'offlineFirst',
    staleTime: 1000 * 60 * 5, // 5 minutes
  })
}
