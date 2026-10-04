/**
 * Phase 57 -- the four rooms (D-01).
 *
 * Plain module, no directive, no React/Konva/node: imports -- importable from
 * client and server code. Rooms are FIXED hit-areas on the isometric scene,
 * stored as fractions (0-1) of the scene size so one table fits every org's
 * picture (real org 2752x1536, eval-site org 1600x900). There is no table, no
 * column and no admin UI behind them.
 */
import type { Point } from '@/lib/validators/site'

export const ROOM_IDS = ['office', 'smoko', 'workshop', 'noticeboard'] as const
export type RoomId = (typeof ROOM_IDS)[number]

export interface Room {
  id: RoomId
  name: string
  frac: ReadonlyArray<readonly [number, number]>
}

// ponytail: fixed hit-areas by owner decision (D-01) -- this table is the one
// place to tune them after reading the eval screenshots. Starting point is the
// sketch-008 placement (RESEARCH Pattern 3); Workshop sits right of Smoko and
// below the tallest machine box so no room overlaps another or a machine.
export const ROOMS: ReadonlyArray<Room> = [
  { id: 'office', name: 'Office', frac: [[0.716, 0.697], [0.82, 0.697], [0.82, 0.865], [0.716, 0.865]] },
  { id: 'smoko', name: 'Smoko room', frac: [[0.01, 0.762], [0.01, 0.699], [0.092, 0.614], [0.192, 0.717], [0.192, 0.78], [0.11, 0.865]] },
  { id: 'workshop', name: 'Workshop', frac: [[0.215, 0.905], [0.215, 0.865], [0.275, 0.825], [0.355, 0.865], [0.355, 0.905], [0.295, 0.945]] },
  { id: 'noticeboard', name: 'Noticeboard', frac: [[0.554, 0.606], [0.593, 0.606], [0.593, 0.71], [0.554, 0.71]] },
]

/** A room's polygon in scene pixels. */
export function roomPolygon(id: RoomId, sceneWidth: number, sceneHeight: number): Point[] {
  const room = ROOMS.find((r) => r.id === id)
  if (!room) return []
  return room.frac.map(([fx, fy]) => [Math.round(fx * sceneWidth), Math.round(fy * sceneHeight)] as Point)
}

/**
 * Rooms a search query lights: a room matches by name; the Noticeboard also
 * matches when any site-wide SOP title matches. Empty query matches nothing.
 */
export function roomMatches(query: string, siteSopTitles: ReadonlyArray<string>): Set<RoomId> {
  const q = query.trim().toLowerCase()
  const out = new Set<RoomId>()
  if (!q) return out
  for (const r of ROOMS) if (r.name.toLowerCase().includes(q)) out.add(r.id)
  if (siteSopTitles.some((t) => t.toLowerCase().includes(q))) out.add('noticeboard')
  return out
}
