/**
 * Phase 63 -- which drawn object stands for a SOP on the site map. Cosmetic
 * only: each object is exactly one SOP. Plain module.
 */
export const OBJECT_KINDS = ['tank', 'conveyor', 'forklift', 'rack', 'bench', 'machine', 'board'] as const
export type ObjectKind = (typeof OBJECT_KINDS)[number]

// Word-start anchors so "elevator" is not a vat; bench is unanchored for "workbench".
const KEYWORDS: ReadonlyArray<[ObjectKind, RegExp]> = [
  ['tank', /\b(tank|vat|silo)/i],
  ['conveyor', /\b(conveyor|lehr|line|belt)/i],
  ['forklift', /\b(forklift|truck)/i],
  ['rack', /\b(rack|shelv)/i],
  ['bench', /bench|\blab/i],
]

/** The first linked machine's name, or null when the SOP is not machine-linked (it is a noticeboard). */
export function objectKindOf(firstMachineName: string | null): ObjectKind {
  if (firstMachineName === null) return 'board'
  return KEYWORDS.find(([, re]) => re.test(firstMachineName))?.[0] ?? 'machine'
}
