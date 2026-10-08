/**
 * Phase 63 -- the pure middle of loadFocusSop, shared with the home's Read view.
 *
 * Plain module: no directive, no Supabase, no members. loadFocusSop (server, with image
 * signing) and useReadSop (browser client) both put their rows through here so the order,
 * the standards grouping and the minutes cannot drift between the two readers.
 */

export interface AssembleSection {
  id: string
  sort_order: number
}

export interface AssembleStep {
  id: string
  section_id: string
  sort_order: number
  time_estimate_minutes: number | null
}

export interface AssembleStandard {
  id: string
  name: string
}

export interface AssembleAttachment {
  standard_id: string
  sop_id: string | null
  section_id: string | null
  focus_step_id: string | null
}

export interface AssembledStandards {
  sop: AssembleStandard[]
  sections: Record<string, AssembleStandard[]>
  steps: Record<string, AssembleStandard[]>
}

export function assembleFocus<Sec extends AssembleSection, Step extends AssembleStep>({
  sopId,
  sections,
  steps,
  standards,
  attachments,
}: {
  sopId: string
  sections: readonly Sec[]
  steps: readonly Step[]
  standards: readonly AssembleStandard[]
  attachments: readonly AssembleAttachment[]
}): { sections: Sec[]; steps: Step[]; standards: AssembledStandards; totalMinutes: number } {
  // Group by section order first, then step order, so the editor and the walk agree.
  const sectionRank = new Map(sections.map((s, i) => [s.id, i]))
  const sorted = [...steps].sort(
    (a, b) => (sectionRank.get(a.section_id) ?? 0) - (sectionRank.get(b.section_id) ?? 0) || a.sort_order - b.sort_order,
  )

  const names = new Map(standards.map((s) => [s.id, s]))
  const stepIds = new Set(sorted.map((s) => s.id))
  const sectionIds = new Set(sections.map((s) => s.id))
  const grouped: AssembledStandards = { sop: [], sections: {}, steps: {} }
  const push = (map: Record<string, AssembleStandard[]>, key: string, std: AssembleStandard) => {
    ;(map[key] ??= []).push(std)
  }
  for (const a of attachments) {
    const std = names.get(a.standard_id)
    if (!std) continue
    if (a.sop_id === sopId) grouped.sop.push(std)
    else if (a.section_id && sectionIds.has(a.section_id)) push(grouped.sections, a.section_id, std)
    else if (a.focus_step_id && stepIds.has(a.focus_step_id)) push(grouped.steps, a.focus_step_id, std)
  }

  const totalMinutes = sorted.reduce((sum, s) => sum + (Number(s.time_estimate_minutes) || 0), 0)
  return { sections: [...sections], steps: sorted, standards: grouped, totalMinutes }
}
