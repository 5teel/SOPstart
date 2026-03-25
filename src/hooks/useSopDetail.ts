'use client'
import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/offline/db'
import { queryPersister } from '@/lib/offline/query-persister'
import type { SopWithSections } from '@/types/sop'

export function useSopDetail(sopId: string) {
  return useQuery({
    queryKey: ['sop-detail', sopId],
    queryFn: async (): Promise<SopWithSections | null> => {
      const sop = await db.sops.get(sopId)
      if (!sop) return null

      const sections = await db.sections
        .where('sop_id')
        .equals(sopId)
        .sortBy('sort_order')

      const sectionsWithChildren = await Promise.all(
        sections.map(async (section) => {
          const steps = await db.steps
            .where('section_id')
            .equals(section.id)
            .sortBy('step_number')

          const images = await db.images
            .where('section_id')
            .equals(section.id)
            .sortBy('sort_order')

          return {
            ...section,
            sop_steps: steps,
            sop_images: images,
          }
        })
      )

      const { _cachedAt: _, ...sopData } = sop

      return {
        ...sopData,
        sop_sections: sectionsWithChildren,
      }
    },
    persister: queryPersister,
    networkMode: 'offlineFirst',
    enabled: !!sopId,
  })
}
