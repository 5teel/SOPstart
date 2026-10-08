/**
 * Site templates: a ready-made scene picture (public/site-presets/<id>.jpg)
 * plus its departments and machine outlines, applied once to an org with no
 * site by applySitePreset(). A template gives an admin a starting picture,
 * departments and machines; it never places anything else (ADR-0005).
 *
 * Plain module, no directive -- importable from client and server code.
 * Outlines are fractions (0-1) of the picture, placed on a grid overlay of
 * each picture (CLAUDE.md 2026-10-05: geometry is judged by eye on the scene).
 */
type Frac = readonly [number, number]

const box = (x0: number, y0: number, x1: number, y1: number): Frac[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
]

// -- Template ids --------------------------------------------------------------
// A layout made from a template records its id in site_layouts.preset (data only:
// the home does not read it).
export const SITE_PRESET_IDS = ['railway', 'training', 'kitchen', 'bottling'] as const
export type SitePresetId = (typeof SITE_PRESET_IDS)[number]

export interface SitePresetMachine {
  name: string
  /** Index into the preset's departments. */
  dept: number
  frac: ReadonlyArray<Frac>
}

// ponytail: never '#3b82f6' -- zoneColour() reads it as the column default
// ("no colour set") and substitutes a theme accent.
export interface SitePreset {
  id: SitePresetId
  name: string
  blurb: string
  departments: ReadonlyArray<{ name: string; colour: string }>
  machines: ReadonlyArray<SitePresetMachine>
}

// Bottling: four identical lines, each a few pixels further left (perspective).
const LINE_Y = [
  [0.12, 0.235],
  [0.245, 0.355],
  [0.365, 0.48],
  [0.49, 0.61],
] as const
const LINE_MACHINES = [
  ['Blow moulder', 0.245, 0.3],
  ['Filler-capper', 0.39, 0.45],
  ['Labeller', 0.5, 0.555],
  ['Shrink-wrap packer', 0.605, 0.67],
  ['Palletiser', 0.705, 0.8],
] as const

export function presetImagePath(id: SitePresetId): string {
  return `/site-presets/${id}.jpg`
}

export const SITE_PRESETS: ReadonlyArray<SitePreset> = [
  {
    id: 'railway',
    name: 'Railway maintenance',
    blurb: 'Outdoor track worksite: plant, track machines, signals and a site compound.',
    departments: [
      { name: 'Track', colour: '#f97316' },
      { name: 'Plant', colour: '#fbbf24' },
      { name: 'Signals', colour: '#10b981' },
    ],
    machines: [
      { name: 'Rail grinder', dept: 0, frac: box(0.105, 0.52, 0.295, 0.8) },
      { name: 'Ballast tamper', dept: 0, frac: box(0.425, 0.33, 0.54, 0.5) },
      { name: 'Turnout', dept: 0, frac: [[0.6, 0.29], [0.7, 0.17], [0.85, 0.15], [0.85, 0.2], [0.72, 0.33]] },
      { name: 'Rail and sleeper stack', dept: 0, frac: box(0.68, 0.41, 0.9, 0.58) },
      { name: 'Hi-rail excavator', dept: 1, frac: box(0.045, 0.27, 0.245, 0.51) },
      { name: 'Lighting tower', dept: 1, frac: box(0.86, 0.07, 0.97, 0.38) },
      { name: 'Signal mast', dept: 2, frac: box(0.28, 0.07, 0.33, 0.41) },
      { name: 'Signal hut', dept: 2, frac: box(0.335, 0.23, 0.415, 0.39) },
    ],
  },
  {
    id: 'training',
    name: 'Trades training centre',
    blurb: 'Training bays where learners are signed off before they go to an employer.',
    departments: [
      { name: 'Fabrication', colour: '#f97316' },
      { name: 'Electrical', colour: '#ef4444' },
      { name: 'Plumbing', colour: '#06b6d4' },
      { name: 'Plant and heights', colour: '#fbbf24' },
      { name: 'Induction', colour: '#8b5cf6' },
    ],
    machines: [
      { name: 'Welding booth 1', dept: 0, frac: box(0.06, 0.1, 0.14, 0.34) },
      { name: 'Welding booth 2', dept: 0, frac: box(0.145, 0.1, 0.21, 0.34) },
      { name: 'Welding booth 3', dept: 0, frac: box(0.215, 0.1, 0.3, 0.34) },
      { name: 'Lathe', dept: 0, frac: box(0.335, 0.17, 0.43, 0.33) },
      { name: 'Milling machine', dept: 0, frac: box(0.44, 0.16, 0.49, 0.36) },
      { name: 'Wiring boards', dept: 1, frac: box(0.53, 0.18, 0.67, 0.42) },
      { name: 'Plumbing rig', dept: 2, frac: box(0.69, 0.24, 0.8, 0.52) },
      { name: 'Forklift circuit', dept: 3, frac: box(0.05, 0.37, 0.345, 0.59) },
      { name: 'Scaffold tower', dept: 3, frac: box(0.83, 0.14, 0.96, 0.55) },
      { name: 'Classroom', dept: 4, frac: box(0.06, 0.6, 0.27, 0.88) },
    ],
  },
  {
    id: 'kitchen',
    name: 'Food-safety training kitchen',
    blurb: 'HACCP flow left to right: receive, store, prep, cook, chill, hold, wash.',
    departments: [
      { name: 'Receiving and storage', colour: '#8b5cf6' },
      { name: 'Preparation', colour: '#10b981' },
      { name: 'Cooking and holding', colour: '#ef4444' },
      { name: 'Cleaning', colour: '#06b6d4' },
    ],
    machines: [
      { name: 'Receiving dock', dept: 0, frac: box(0.005, 0.19, 0.12, 0.5) },
      { name: 'Cool room', dept: 0, frac: box(0.125, 0.2, 0.22, 0.46) },
      { name: 'Freezer', dept: 0, frac: box(0.225, 0.21, 0.315, 0.46) },
      { name: 'Dry store', dept: 0, frac: box(0.32, 0.24, 0.405, 0.45) },
      { name: 'Raw meat prep', dept: 1, frac: box(0.41, 0.31, 0.48, 0.5) },
      { name: 'Vegetable prep', dept: 1, frac: box(0.485, 0.32, 0.555, 0.53) },
      { name: 'Cooking line', dept: 2, frac: box(0.565, 0.31, 0.705, 0.58) },
      { name: 'Blast chiller', dept: 2, frac: box(0.715, 0.41, 0.78, 0.59) },
      { name: 'Hot-hold pass', dept: 2, frac: box(0.78, 0.43, 0.85, 0.61) },
      { name: 'Dishwashing', dept: 3, frac: box(0.855, 0.45, 0.945, 0.65) },
      { name: 'Handwash station', dept: 3, frac: box(0.95, 0.47, 0.995, 0.67) },
    ],
  },
  {
    id: 'bottling',
    name: 'Soft drinks bottling factory',
    blurb: 'Four filling lines, a syrup room, water treatment and a finished-goods warehouse.',
    departments: [
      { name: 'Line 1', colour: '#f97316' },
      { name: 'Line 2', colour: '#8b5cf6' },
      { name: 'Line 3', colour: '#10b981' },
      { name: 'Line 4', colour: '#ec4899' },
      { name: 'Utilities', colour: '#06b6d4' },
      { name: 'Warehouse', colour: '#fbbf24' },
    ],
    machines: [
      ...LINE_Y.flatMap(([y0, y1], line) =>
        LINE_MACHINES.map(([name, x0, x1]) => ({
          name: `Line ${line + 1} ${name.toLowerCase()}`,
          dept: line,
          frac: box(x0 - line * 0.006, y0, x1 - line * 0.006, y1),
        }))
      ),
      { name: 'Syrup room', dept: 4, frac: box(0.07, 0.08, 0.195, 0.3) },
      { name: 'Water treatment', dept: 4, frac: box(0.03, 0.34, 0.165, 0.61) },
      { name: 'Finished-goods warehouse', dept: 5, frac: box(0.815, 0.09, 0.98, 0.67) },
    ],
  },
]
