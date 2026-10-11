/**
 * 2026-10-11 (ADR-0009) -- pictures for the site map. A floor picture per area, keyed by the
 * area's department name, mapped onto the plate's top face; a rendered object per object kind.
 * Pictures decorate only: the plates, objects, signs and status marks stay the drawn ones, and
 * an area with no picture keeps the flat plate. Files live in public/site-art/. Plain module.
 */
import { FOOTPRINT, HEIGHT, project } from './iso'
import { SITE_WIDE } from './areas'
import type { ObjectKind } from './object-kind'

// ponytail: a fixed list of shipped pictures; per-site uploads would move this into the site model.
const FLOORS = new Set([
  'site-wide', 'general', 'forming', 'engineering',
  'track-renewal', 'signals-comms', 'overhead-line', 'welding-grinding', 'plant-fleet', 'depot-yard',
  'wiring-workshop', 'switchboards', 'solar-battery', 'testing-inspection', 'industrial-controls',
  'water-treatment', 'syrup-room', 'blow-moulding', 'filling-line', 'packing-palletising', 'warehouse',
])

export const artSlug = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export function floorArt(areaId: string, name: string): string | null {
  const k = areaId === SITE_WIDE ? 'site-wide' : artSlug(name)
  return FLOORS.has(k) ? `/site-art/floor/${k}.webp` : null
}

// Rendered objects shipped so far; a kind not listed keeps its drawn shape.
const OBJECTS = new Set<ObjectKind>([])

export const objectArt = (kind: ObjectKind): string | null => (OBJECTS.has(kind) ? `/site-art/obj/${kind}.webp` : null)

/** Screen box of an object's footprint standing on the plate (z0), for a bottom-centred picture. */
export function objectBox(kind: ObjectKind, x: number, y: number, z0: number) {
  const [w, d] = FOOTPRINT[kind]
  const left = project(x, y + d, z0)[0]
  const right = project(x + w, y, z0)[0]
  const top = project(x, y, z0 + HEIGHT[kind])[1]
  const bottom = project(x + w, y + d, z0)[1]
  return { x: left, y: top, w: right - left, h: bottom - top }
}
