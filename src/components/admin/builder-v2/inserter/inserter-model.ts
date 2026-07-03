/**
 * Phase 26 (R3) — the tiered inserter's data + pure navigation model.
 *
 * Ported verbatim (shape-for-shape) from `sketches/sop-builder-redesign/index.html`
 * (`LANE` / `SMART` / `GROUPS`), retyped to the real `BlockType` catalog and
 * keyed to `SectionRenderFamily` (introspection `SECTION_RENDER_FAMILIES`).
 *
 * This module is PURE (no React, no `@/` runtime imports — only `import type`)
 * so the row/keyboard/filter behaviour is unit-testable directly, exactly like
 * `content-ops.ts`. `InserterMenu` is a thin React shell over these functions.
 */
import { humanizeBlockType } from '@/lib/builder/block-type-labels'
import type { BlockType } from '@/lib/builder/block-registry'
import type { SectionRenderFamily } from '@/types/sop'

/** TIER 1 — "Fits here": block types relevant to each section render-family.
 *  Opening ＋ in a `hazard` section yields a DIFFERENT list than in `steps`. */
export const LANE: Record<SectionRenderFamily, BlockType[]> = {
  hazard: ['HazardCardBlock', 'PPECardBlock', 'EscalateBlock', 'TextBlock'],
  ppe: ['PPECardBlock', 'HazardCardBlock', 'TextBlock'],
  steps: ['StepBlock', 'MeasurementBlock', 'DecisionBlock', 'StepWithPhotosBlock', 'PhotoBlock'],
  content: ['TextBlock', 'HeadingBlock', 'CalloutBlock', 'PhotoBlock'],
  signoff: ['SignOffBlock', 'TextBlock'],
  emergency: ['EscalateBlock', 'HazardCardBlock', 'ZoneBlock', 'TextBlock'],
  custom: ['StepBlock', 'TextBlock', 'MeasurementBlock', 'DecisionBlock'],
}

/** TIER 0 — "smart next": predicted from the block ABOVE the cursor. Also the
 *  source the 26-10 ghosts read (do NOT implement ghosts here). */
export const SMART: Partial<Record<BlockType, { type: BlockType; why: string }>> = {
  MeasurementBlock: { type: 'DecisionBlock', why: 'branch on the result' },
  HazardCardBlock: { type: 'PPECardBlock', why: 'the gear this needs' },
  StepBlock: { type: 'MeasurementBlock', why: 'capture a value' },
}

/** TIER 2 — the full catalog, grouped (the "More block types" page). */
export const GROUPS: [string, BlockType[]][] = [
  ['Actions & flow', ['StepBlock', 'StepWithPhotosBlock', 'DecisionBlock']],
  ['Safety', ['HazardCardBlock', 'PPECardBlock', 'EscalateBlock', 'ZoneBlock']],
  ['Data capture', ['MeasurementBlock', 'InspectBlock', 'VisualBlock', 'PhotoBlock', 'PhotoGridBlock', 'VoiceNoteBlock', 'ModelBlock']],
  ['Guidance & gates', ['TextBlock', 'HeadingBlock', 'CalloutBlock', 'SignOffBlock']],
]

/** TIER 3 (reuse) is delegated to the existing Phase 13 `BlockPicker`; its
 *  dept-scope toggle maps to the picker's `sopCategory` soft-filter. */
export type ReuseScope = 'dept' | 'all'

/** dept → the SOP's category (boosts + narrows to this department);
 *  all → null (Phase 13 picker shows every department). */
export function reuseSopCategory(scope: ReuseScope, categoryTag: string | null): string | null {
  return scope === 'dept' ? categoryTag : null
}

/** A single navigable row: either inserts a block type, or drills to a page. */
export type InserterRow =
  | { kind: 'insert'; type: BlockType; label: string; smart?: boolean; why?: string }
  | { kind: 'nav'; page: 'all' | 'reuse' | 'ai'; label: string }

/** HOME page rows: smart row (if the preceding block predicts one) → "Fits here"
 *  LANE list → drill rows (More / Reuse / AI). Reuse/AI included only when the
 *  host wires a handler (no dead buttons). */
export function homeRows(
  ctx: SectionRenderFamily,
  prevType: BlockType | null,
  opts: { hasReuse?: boolean; hasAI?: boolean } = {}
): InserterRow[] {
  const rows: InserterRow[] = []
  const smart = prevType ? SMART[prevType] : undefined
  if (smart) {
    rows.push({ kind: 'insert', type: smart.type, label: humanizeBlockType(smart.type), smart: true, why: smart.why })
  }
  for (const t of LANE[ctx] ?? LANE.steps) {
    rows.push({ kind: 'insert', type: t, label: humanizeBlockType(t) })
  }
  rows.push({ kind: 'nav', page: 'all', label: 'More block types' })
  if (opts.hasReuse) rows.push({ kind: 'nav', page: 'reuse', label: 'Reuse a block or snippet' })
  if (opts.hasAI) rows.push({ kind: 'nav', page: 'ai', label: 'Describe with AI' })
  return rows
}

/** ALL page rows: the full grouped catalog flattened to navigable insert rows. */
export function allRows(): InserterRow[] {
  return GROUPS.flatMap(([, types]) =>
    types.map((t): InserterRow => ({ kind: 'insert', type: t, label: humanizeBlockType(t) }))
  )
}

/** Type-to-filter: keep rows whose (humanised) label contains the query. */
export function filterRows(rows: InserterRow[], query: string): InserterRow[] {
  const q = query.toLowerCase().trim()
  if (!q) return rows
  return rows.filter((r) => r.label.toLowerCase().includes(q))
}

/** Clamped ↑/↓ highlight move over a list of `len` rows. */
export function moveHighlight(len: number, hi: number, dir: 1 | -1): number {
  if (len <= 0) return 0
  return Math.min(Math.max(hi + dir, 0), len - 1)
}
