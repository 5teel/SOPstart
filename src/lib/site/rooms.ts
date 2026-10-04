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
// place to tune them. Tuned in 57-10 against the real org's scene (2752x1536,
// machine polygons overlaid): Office sits on the Office terminal, Noticeboard
// on empty floor between the IS machines and the pallets, Smoko on empty floor
// right of the pallet stack (clear of the Office room), Workshop on empty floor
// under the workbench. None overlaps a machine polygon of that scene.
export const ROOMS: ReadonlyArray<Room> = [
  { id: 'office', name: 'Office', frac: [[0.716, 0.697], [0.82, 0.697], [0.82, 0.865], [0.716, 0.865]] },
  { id: 'smoko', name: 'Smoko room', frac: [[0.676, 0.648], [0.709, 0.616], [0.75, 0.648], [0.718, 0.68]] },
  { id: 'workshop', name: 'Workshop', frac: [[0.871, 0.448], [0.9, 0.421], [0.935, 0.448], [0.906, 0.479]] },
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
