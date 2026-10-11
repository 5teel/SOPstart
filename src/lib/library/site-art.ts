/**
 * 2026-10-11 (ADR-0009) -- pictures for the site map: a cut-out isometric picture per named machine.
 * Pictures decorate only: the area plates, signs and status marks stay drawn, each picture is still
 * exactly one SOP, and a machine with no picture keeps its drawn shape. Files live in public/site-art/. Plain module.
 */
import { FOOTPRINT, HEIGHT, project } from './iso'
import type { ObjectKind } from './object-kind'

export const artSlug = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// One picture per machine name (its slug); a SOP with no machine shows the notice board.
// ponytail: a fixed list; a machine not listed keeps its drawn shape until a picture is made for it.
const MACHINES = new Set([
  'alkaline-cleaning-tank', 'annealing-lehr', 'axle-counter', 'ballast-regulator', 'battery-enclosure',
  'blow-moulder', 'capper', 'chlorine-dosing-tank', 'cold-end-inspection-line', 'filler',
  'filler-infeed-conveyor', 'forklift', 'furnace-forehearth', 'hi-rail-truck', 'hot-melt-gluer', 'inverter',
  'is-machine-1', 'is-machine-2', 'lathe', 'main-switchboard', 'motor-starter-panel', 'notice-board',
  'office-terminal', 'ohl-mast', 'palletiser', 'preform-hopper', 'racking', 'rail-grinder',
  'sand-filter-tank', 'shrink-wrapper', 'signal-location-case', 'sleeper-rack', 'sleeper-stack-rack',
  'syrup-tank-1', 'tamper', 'test-lab-bench', 'training-switchboard', 'weld-bench', 'wiring-bench',
  'work-platform-truck', 'workbench',
])

export function machineArt(machine: string | null): string | null {
  const k = machine === null ? 'notice-board' : artSlug(machine)
  return MACHINES.has(k) ? `/site-art/machine/${k}.webp` : null
}

/** Screen box of an object's footprint standing on the plate (z0), for a bottom-centred picture. */
export function objectBox(kind: ObjectKind, x: number, y: number, z0: number) {
  const [w, d] = FOOTPRINT[kind]
  const left = project(x, y + d, z0)[0]
  const right = project(x + w, y, z0)[0]
  const top = project(x, y, z0 + HEIGHT[kind])[1]
  const bottom = project(x + w, y + d, z0)[1]
  return { x: left, y: top, w: right - left, h: bottom - top }
}
