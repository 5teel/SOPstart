/**
 * Phase 58 -- which version of a SOP is the current one, and which version a
 * given person should land on (D-12, D-13, D-18).
 *
 * Plain module. Same doctrine as src/lib/competency/lineage.ts: a lineage is
 * flat (a version's parent_sop_id points at the original row), and currency is
 * the highest `version` among PUBLISHED members -- never the superseded pointer
 * column, which publishing does not maintain.
 */

export interface LineageRow {
  id: string
  version: number | null
  parent_sop_id: string | null
  status: string
}

export type FocusTarget =
  | { kind: 'open'; id: string; superseded: boolean }
  | { kind: 'redirect'; id: string }
  | { kind: 'not_found' }

const v = (r: Pick<LineageRow, 'version'>) => r.version ?? 0

export const lineageRoot = (r: Pick<LineageRow, 'id' | 'parent_sop_id'>): string => r.parent_sop_id ?? r.id

/** One row per lineage: the highest published version. */
export function latestPublished<T extends LineageRow>(rows: readonly T[]): T[] {
  const best = new Map<string, T>()
  for (const r of rows) {
    if (r.status !== 'published') continue
    const root = lineageRoot(r)
    const cur = best.get(root)
    if (!cur || v(r) > v(cur)) best.set(root, r)
  }
  return [...best.values()]
}

/** The latest published row of the lineage that `sopId` belongs to, or null. */
export function latestPublishedOf<T extends LineageRow>(rows: readonly T[], sopId: string): T | null {
  const root = lineageRoot(rows.find((r) => r.id === sopId) ?? { id: sopId, parent_sop_id: null })
  return latestPublished(rows.filter((r) => lineageRoot(r) === root))[0] ?? null
}

const ADMIN_ROLES = ['admin', 'safety_manager']

/**
 * Admins open the exact row asked for. Everyone else only ever sees published
 * content: the in-progress walk's version if they have one (D-12), otherwise
 * the latest published version; a lineage with no published row is not found (D-13).
 */
export function resolveFocusTarget(input: {
  role: string
  requestedId: string
  lineage: readonly LineageRow[]
  inProgressSopId?: string | null
}): FocusTarget {
  const { role, requestedId, lineage, inProgressSopId } = input
  const requested = lineage.find((r) => r.id === requestedId)
  if (!requested) return { kind: 'not_found' }

  const latest = latestPublishedOf(lineage, requestedId)
  const superseded = (row: LineageRow) => !!latest && v(latest) > v(row)

  if (ADMIN_ROLES.includes(role)) return { kind: 'open', id: requested.id, superseded: superseded(requested) }

  const walking = inProgressSopId ? lineage.find((r) => r.id === inProgressSopId) : undefined
  const target = walking ?? latest
  if (!target) return { kind: 'not_found' }
  return target.id === requestedId
    ? { kind: 'open', id: target.id, superseded: superseded(target) }
    : { kind: 'redirect', id: target.id }
}
