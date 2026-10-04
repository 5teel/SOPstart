// Phase 56 D-09/D-10: where a SOP lives. Display-only — the department comes from the
// SOP's machines; access (sop_departments / all_departments / access_grants) is untouched.
// One helper for the worker page and the admin machines picker.

export interface PlacementMachine {
  name: string
  department: string | null
}

export interface PlacementSummary {
  siteWide: boolean
  machines: string[]
  departments: string[]
}

export function placementSummary(
  placement: 'machine' | 'site' | null | undefined,
  machines: PlacementMachine[],
): PlacementSummary {
  // No machines means whole site — the sop_machines trigger keeps placement aligned,
  // and a machine SOP with nothing under it is never shown.
  if (placement === 'site' || machines.length === 0) {
    return { siteWide: true, machines: [], departments: [] }
  }
  const names = machines.map((m) => m.name).sort((a, b) => a.localeCompare(b))
  const departments = [...new Set(machines.map((m) => m.department).filter((d): d is string => !!d))].sort((a, b) =>
    a.localeCompare(b),
  )
  return { siteWide: false, machines: names, departments }
}

export function placementLabel(s: PlacementSummary): string {
  if (s.siteWide) return 'Whole site'
  const where = s.machines.join(', ')
  return s.departments.length ? `${where} · ${s.departments.join(', ')}` : where
}

/** Names of standards from an embedded standard_attachments array. */
export function standardNames(
  attachments: { standards: { name: string } | null }[] | null | undefined,
): string[] {
  return (attachments ?? []).flatMap((a) => (a.standards ? [a.standards.name] : []))
}
