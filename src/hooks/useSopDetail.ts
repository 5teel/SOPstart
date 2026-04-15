'use client'
import { useQuery } from '@tanstack/react-query'
import { db } from '@/lib/offline/db'
import { createClient } from '@/lib/supabase/client'
import type { SopWithSections } from '@/types/sop'

export function useSopDetail(sopId: string) {
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

      // Fallback: fetch from Supabase (non-assigned SOPs from library)
      // v3.0: section_kind join is cached alongside section for offline
      // walkthrough rendering. The aliased `section_kind:section_kinds!section_kind_id(*)`
      // syntax returns a single joined row (not an array) and is RLS-respected
      // by PostgREST — workers receive only global + own-org kinds per
      // migration 00019 policies.
      const supabase = createClient()
      const { data: sop, error } = await supabase
        .from('sops')
        .select(`
          *,
          sop_sections (
            *,
            section_kind:section_kinds!section_kind_id ( * ),
            sop_steps ( * ),
            sop_images ( * )
          )
        `)
        .eq('id', sopId)
        .single()

      if (error || !sop) return null

      const sorted = sop as unknown as SopWithSections
      sorted.sop_sections = (sorted.sop_sections ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((s) => ({
          ...s,
          sop_steps: (s.sop_steps ?? []).sort((a, b) => a.step_number - b.step_number),
          sop_images: (s.sop_images ?? []).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
        }))

      return sorted
    },
    // No persister — don't cache null for non-assigned SOPs
    // No offlineFirst — always try Supabase when Dexie misses
    staleTime: 1000 * 60 * 5,
    enabled: !!sopId,
  })
}
