'use client'
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { SopWithSections } from '@/types/sop'

export function useSopDetail(sopId: string) {
  return useQuery({
    queryKey: ['sop-detail', sopId],
    queryFn: async (): Promise<SopWithSections | null> => {
      // Read straight from Supabase; section_kind is the aliased single-row join
      // (RLS-scoped to global + own-org kinds, migration 00019).
      const supabase = createClient()
      const { data: sop, error } = await supabase
        .from('sops')
        .select(`
          *,
          standard_attachments ( standards ( id, name ) ),
          sop_machines ( site_machines ( name, departments ( name ) ) ),
          sop_sections (
            *,
            standard_attachments ( standards ( id, name ) ),
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
    staleTime: 1000 * 60 * 5,
    enabled: !!sopId,
  })
}
