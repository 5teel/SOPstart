'use client'
/**
 * Phase 63 (HOME-03) -- one SOP's outline for the home's Read view.
 *
 * Browser Supabase client under RLS only: no server action may fire when a SOP is
 * opened on the home (Next 16.2.1 action-queue hazard, CLAUDE.md 2026-09-29). A SOP
 * that is not in the person's library comes back as null, never as data (T-63-17).
 */
import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { FocusKind } from '@/lib/sop/focus'
import { assembleFocus, type AssembleAttachment, type AssembleStandard } from '@/lib/sop/focus-assemble'

export interface ReadSopMeta {
  id: string
  title: string | null
  version: number | null
  status: string
  parent_sop_id: string | null
  placement: string | null
  category_slug: string | null
  organisation_id: string
}

export interface ReadSection {
  id: string
  title: string
  sort_order: number
}

export interface ReadStep {
  id: string
  section_id: string
  kind: FocusKind
  text: string
  photo_required: boolean
  time_estimate_minutes: number | null
  sort_order: number
}

type Fail = { message: string } | null
const rows = <T,>(r: { data: T[] | null; error: Fail }): T[] => {
  if (r.error) throw new Error(r.error.message)
  return r.data ?? []
}

export function useReadSop(sopId: string | null) {
  return useQuery({
    queryKey: ['read-sop', sopId],
    enabled: !!sopId,
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const supabase = createClient()
      const { data: sop, error } = await supabase
        .from('sops')
        .select('id, title, version, status, parent_sop_id, placement, category_slug, organisation_id')
        .eq('id', sopId!)
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!sop) return null
      const row = sop as ReadSopMeta

      const [sec, st, std, att] = await Promise.all([
        supabase.from('sop_sections').select('id, title, sort_order').eq('sop_id', row.id).order('sort_order', { ascending: true }),
        supabase
          .from('sop_focus_steps')
          .select('id, section_id, kind, text, photo_required, time_estimate_minutes, sort_order')
          .eq('sop_id', row.id)
          .order('sort_order', { ascending: true }),
        supabase.from('standards').select('id, name').eq('organisation_id', row.organisation_id),
        supabase.from('standard_attachments').select('standard_id, sop_id, section_id, focus_step_id').eq('organisation_id', row.organisation_id),
      ])
      const assembled = assembleFocus({
        sopId: row.id,
        sections: rows(sec as { data: ReadSection[] | null; error: Fail }),
        steps: rows(st as { data: ReadStep[] | null; error: Fail }),
        standards: rows(std as { data: AssembleStandard[] | null; error: Fail }),
        attachments: rows(att as { data: AssembleAttachment[] | null; error: Fail }),
      })
      return { sop: row, ...assembled }
    },
  })
}
