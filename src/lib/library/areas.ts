/**
 * Phase 63 -- which area a SOP lives in (R8). Plain module; list, map, Read and
 * key all import this, a second copy is a future disagreement.
 *
 * Rule: the department of the SOP's first linked machine (by sort, then name),
 * else its first sop_departments tag by department name, else Site-wide.
 * Archived or missing departments fall through. Areas exist only when they
 * hold a visible SOP, and are built only from the caller's own department read.
 */
export const SITE_WIDE = 'site-wide'

export interface AreaMachine {
  name: string
  sort: number | null
  department_id: string | null
}

export interface AreaDepartment {
  id: string
  name: string
  archived: boolean
}

export interface AreaInputs {
  /** sop id -> linked machine ids (any order). */
  machinesBySop: ReadonlyMap<string, readonly string[]>
  machineById: ReadonlyMap<string, AreaMachine>
  departments: readonly AreaDepartment[]
  /** sop id -> sop_departments tag ids (any order). */
  deptsBySop: ReadonlyMap<string, readonly string[]>
}

export interface LibraryArea {
  id: string
  name: string
  colourVar: string
  /** 1-based; the phone marker number. */
  index: number
  sopIds: string[]
}

const byName = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' })

export function areaOf(sopId: string, inputs: AreaInputs): string {
  const active = new Map(inputs.departments.filter((d) => !d.archived).map((d) => [d.id, d]))

  const machines = (inputs.machinesBySop.get(sopId) ?? [])
    .map((id) => inputs.machineById.get(id))
    .filter((m): m is AreaMachine => !!m)
    .sort((a, b) => (a.sort ?? Number.MAX_SAFE_INTEGER) - (b.sort ?? Number.MAX_SAFE_INTEGER) || byName(a.name, b.name))
  for (const m of machines) {
    if (m.department_id && active.has(m.department_id)) return m.department_id
  }

  const tagged = (inputs.deptsBySop.get(sopId) ?? [])
    .map((id) => active.get(id))
    .filter((d): d is AreaDepartment => !!d)
    .sort((a, b) => byName(a.name, b.name))
  return tagged[0]?.id ?? SITE_WIDE
}

/** `visibleSopIds` is the visible published library only; empty departments never draw. */
export function buildAreas(visibleSopIds: readonly string[], inputs: AreaInputs): LibraryArea[] {
  const bySop = new Map<string, string[]>()
  for (const id of visibleSopIds) {
    const area = areaOf(id, inputs)
    bySop.set(area, [...(bySop.get(area) ?? []), id])
  }
  const names = new Map(inputs.departments.map((d) => [d.id, d.name]))
  const rows = [...bySop.entries()].map(([id, sopIds]) => ({ id, name: id === SITE_WIDE ? 'Site-wide' : (names.get(id) ?? ''), sopIds }))
  rows.sort((a, b) => (a.id === SITE_WIDE ? 1 : 0) - (b.id === SITE_WIDE ? 1 : 0) || byName(a.name, b.name))
  return rows.map((r, i) => ({ ...r, index: i + 1, colourVar: `var(--area-${(i % 8) + 1})` }))
}
