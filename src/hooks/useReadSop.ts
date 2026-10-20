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
import type { ClearVersion } from '@/lib/parsers/enhance-sop'
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
  allow_forward_jump: boolean
  /** ADR-0015: the read-only clear version; workers see it only once clear_approved_at is set. */
  clear_version: ClearVersion | null
  clear_approved_at: string | null
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
  tip: string | null
  photo_required: boolean
  image_paths: string[] | null
  /** Signed under the reader's own session (storage RLS); an unsignable path is left out. */
  image_urls: string[]
  time_estimate_minutes: number | null
  sort_order: number
}

type Fail = { message: string } | null
const rows = <T,>(r: { data: T[] | null; error: Fail }): T[] => {
  if (r.error) throw new Error(r.error.message)
  return r.data ?? []
}

/** One SOP as Read shows it. Also used to warm the cache when a row is pointed at. */
export const readSopQuery = (sopId: string | null) => ({
  queryKey: ['read-sop', sopId],
  enabled: !!sopId,
  staleTime: 1000 * 60 * 2,
  queryFn: async () => {
    const supabase = createClient()
    // The SOP and its steps are read together; standards need the SOP's org, so they follow.
    const [{ data: sop, error }, sec, st] = await Promise.all([
      supabase
        .from('sops')
        .select('id, title, version, status, parent_sop_id, placement, category_slug, organisation_id, allow_forward_jump, clear_version, clear_approved_at')
        .eq('id', sopId!)
        .maybeSingle(),
      supabase.from('sop_sections').select('id, title, sort_order').eq('sop_id', sopId!).order('sort_order', { ascending: true }),
      supabase
        .from('sop_focus_steps')
        .select('id, section_id, kind, text, tip, photo_required, image_paths, time_estimate_minutes, sort_order')
        .eq('sop_id', sopId!)
        .order('sort_order', { ascending: true }),
    ])
    if (error) throw new Error(error.message)
    if (!sop) return null
    const row = sop as ReadSopMeta

    // Step pictures: one batched signing call, under the reader's session, alongside the standards.
    const rawSteps = rows(st as { data: Omit<ReadStep, 'image_urls'>[] | null; error: Fail })
    const clearPaths = (row.clear_version?.sections ?? []).flatMap((s) => [...(s.image_paths ?? []), ...s.steps.flatMap((t) => [...t.image_paths, ...(t.signs ?? []).map((g) => g.path)])])
    const paths = [...new Set([...rawSteps.flatMap((s) => s.image_paths ?? []), ...clearPaths])]
    const [std, att, urls] = await Promise.all([
      supabase.from('standards').select('id, name').eq('organisation_id', row.organisation_id),
      supabase.from('standard_attachments').select('standard_id, sop_id, section_id, focus_step_id').eq('organisation_id', row.organisation_id),
      paths.length > 0 ? supabase.storage.from('sop-images').createSignedUrls(paths, 3600).then((r) => r.data) : Promise.resolve(null),
    ])
    const signed = new Map<string, string>()
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl)
    const assembled = assembleFocus({
      sopId: row.id,
      sections: rows(sec as { data: ReadSection[] | null; error: Fail }),
      steps: rawSteps.map((s) => ({ ...s, image_urls: (s.image_paths ?? []).flatMap((p) => (signed.has(p) ? [signed.get(p)!] : [])) })),
      standards: rows(std as { data: AssembleStandard[] | null; error: Fail }),
      attachments: rows(att as { data: AssembleAttachment[] | null; error: Fail }),
    })
    return { sop: row, ...assembled, signed }
  },
})

export function useReadSop(sopId: string | null) {
  return useQuery(readSopQuery(sopId))
}
