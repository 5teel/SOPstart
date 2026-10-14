/**
 * Phase 63 -- which area a SOP lives in (R8). Plain module; list, map, Read and
 * key all import this, a second copy is a future disagreement.
 *
 * Rule: the department of the SOP's first linked machine (by sort, then name),
 * else its first sop_departments tag by department name, else Site-wide.
 * Archived or missing departments fall through. Areas exist only when they
 * hold a visible SOP (or, ADR-0010, are an ancestor of one), and are built only
 * from the caller's own department read.
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
  /** ADR-0010: the department this one sits inside; null or absent is top level. */
  parent_id?: string | null
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
  /** 1-based, in tree order; the phone marker number. */
  index: number
  /** SOPs whose area is this one (not its sub-areas). */
  sopIds: string[]
  /** ADR-0010: the ids from the top-level area down to this one (itself last). */
  path: string[]
  /** The area this one sits inside, or null at the top. */
  parentId: string | null
  depth: number
  /** SOPs here and in every sub-area. */
  total: number
}

const byName = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' })

/**
 * The one colour assignment: the i-th department area (0-based) in name order cycles the seven
 * colours after steel. The map, key, list and Site & departments all use it.
 */
export const areaColourVar = (i: number): string => `var(--area-${(i % 7) + 2})`
/** Site-wide is always steel (--area-1), so it never changes with the department count. */
export const SITE_WIDE_COLOUR = 'var(--area-1)'

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

/**
 * A department's ids from the top level down to itself. An archived or missing parent, or a cycle
 * (updateDepartment refuses them; this is the backstop), makes it top level.
 * `parents`: active department id -> its parent_id.
 */
export function deptPath(parents: ReadonlyMap<string, string | null | undefined>, id: string): string[] {
  const out = [id]
  for (let p = parents.get(id); p && parents.has(p); p = parents.get(p)) {
    if (out.includes(p)) return [id]
    out.unshift(p)
  }
  return out
}

/**
 * `visibleSopIds` is the visible published library only; empty departments never draw, unless they
 * hold a sub-area that does. Tree order: each level by name, Site-wide last, sub-areas under their parent.
 */
export function buildAreas(visibleSopIds: readonly string[], inputs: AreaInputs): LibraryArea[] {
  const bySop = new Map<string, string[]>()
  for (const id of visibleSopIds) {
    const area = areaOf(id, inputs)
    bySop.set(area, [...(bySop.get(area) ?? []), id])
  }
  const parents = new Map(inputs.departments.filter((d) => !d.archived).map((d) => [d.id, d.parent_id]))
  const paths = new Map<string, string[]>()
  for (const id of bySop.keys()) {
    const path = deptPath(parents, id)
    path.forEach((a, k) => paths.set(a, path.slice(0, k + 1)))
  }

  const names = new Map(inputs.departments.map((d) => [d.id, d.name]))
  const nameOf = (id: string) => (id === SITE_WIDE ? 'Site-wide' : (names.get(id) ?? ''))
  const rank = (id: string) => (id === SITE_WIDE ? 1 : 0)
  const cmp = (a: string[], b: string[]): number => {
    const i = a.findIndex((x, j) => x !== b[j])
    if (i < 0 || i >= b.length) return a.length - b.length // one path is the other's ancestor
    return rank(a[i]) - rank(b[i]) || byName(nameOf(a[i]), nameOf(b[i])) || (a[i] < b[i] ? -1 : 1)
  }
  const all = [...paths.values()].sort(cmp)
  const count = (path: string[]) => bySop.get(path[path.length - 1])?.length ?? 0
  return all.map((path, i) => {
    const id = path[path.length - 1]
    return {
      id,
      name: nameOf(id),
      sopIds: bySop.get(id) ?? [],
      path,
      parentId: path[path.length - 2] ?? null,
      depth: path.length - 1,
      total: all.reduce((s, q) => s + (q.includes(id) ? count(q) : 0), 0),
      index: i + 1,
      colourVar: id === SITE_WIDE ? SITE_WIDE_COLOUR : areaColourVar(i),
    }
  })
}

/** Whether a SOP in `areaId` shows while `open` is the open area (null: the whole site). */
export const inArea = (areas: readonly LibraryArea[], areaId: string, open: string | null) =>
  open === null || !!areas.find((a) => a.id === areaId)?.path?.includes(open)
