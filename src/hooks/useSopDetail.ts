'use client'
import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/offline/db'
import { createClient } from '@/lib/supabase/client'
import { queryPersister } from '@/lib/offline/query-persister'
import { useNetworkStore } from '@/stores/network'
import type { SopWithSections } from '@/types/sop'

export function useSopDetail(sopId: string) {
  const isOnline = useNetworkStore((s) => s.isOnline)

  return useQuery({
    queryKey: ['sop-detail', sopId],
    queryFn: async (): Promise<SopWithSections | null> => {
      // Try Dexie first (offline-capable, assigned SOPs)
      const cachedSop = await db.sops.get(sopId)
      if (cachedSop) {
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

            return { ...section, sop_steps: steps, sop_images: images }
          })
        )

        const { _cachedAt: _, ...sopData } = cachedSop
        return { ...sopData, sop_sections: sectionsWithChildren }
      }

      // Fallback: fetch from Supabase if online (non-assigned SOPs from library)
      if (!isOnline) return null

      const supabase = createClient()
      const { data: sop } = await supabase
        .from('sops')
        .select(`
          *,
          sop_sections (
            *,
            sop_steps ( * ),
            sop_images ( * )
          )
        `)
        .eq('id', sopId)
        .single()

      if (!sop) return null

      // Sort sections and nested data
      const sorted = (sop as unknown as SopWithSections)
      sorted.sop_sections = sorted.sop_sections
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((s) => ({
          ...s,
          sop_steps: (s.sop_steps ?? []).sort((a, b) => a.step_number - b.step_number),
          sop_images: (s.sop_images ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        }))

      return sorted
    },
    persister: queryPersister,
    networkMode: 'offlineFirst',
    enabled: !!sopId,
  })
}
