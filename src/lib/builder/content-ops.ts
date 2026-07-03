/**
 * Phase 26 (D-01, R7) — pure `content[]` reducer helpers for the bespoke edit
 * canvas. These replace Puck's internal mutations; the edit shell dispatches
 * them and feeds the result into the UNCHANGED `useBuilderAutosave`.
 *
 * FROZEN-CONTRACT RULE (RESEARCH Pitfall 7 / P15 / R7): every op that touches a
 * block's props MUST spread-merge (`{ ...prev, ...changed }`) and NEVER
 * reconstruct props from scratch — otherwise `junctionId`, `block_provenance`,
 * and any future 26.5 agent-layer keys drop on edit. Round-trip ALL unknown
 * keys losslessly.
 *
 * These are PURE functions and MUST NOT live in a `'use server'` file — a
 * sync export from an action module breaks `next build` (CLAUDE.md 2026-06-27).
 * Home is `src/lib/builder/`.
 */

/** A single `layout_data` block entry. `props.id` is the stable block id. */
export interface LayoutItem {
  type: string
  props: Record<string, unknown> & { id: string }
}

/** Pure array move (dnd-kit-compatible) — keeps the SAME item objects, so all
 *  props (incl. unknown keys) survive a reorder byte-identical. */
function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/** Insert a fresh block after `afterIndex` (-1 = prepend). New id via crypto. */
export function insertBlock(
  content: LayoutItem[],
  type: string,
  afterIndex: number,
  defaults: Record<string, unknown> = {}
): LayoutItem[] {
  const item: LayoutItem = { type, props: { id: crypto.randomUUID(), ...defaults } }
  const next = content.slice()
  next.splice(afterIndex + 1, 0, item)
  return next
}

/**
 * Update a block's props by id. Spread-merges over the PREVIOUS props so
 * `junctionId` / `block_provenance` / unknown keys are preserved (Pitfall 7).
 */
export function updateBlockProps(
  content: LayoutItem[],
  id: string,
  changed: Record<string, unknown>
): LayoutItem[] {
  return content.map((it) =>
    it.props.id === id ? { ...it, props: { ...it.props, ...changed } } : it
  )
}

/** Remove a block by id. */
export function deleteBlock(content: LayoutItem[], id: string): LayoutItem[] {
  return content.filter((it) => it.props.id !== id)
}

/**
 * Duplicate a block after itself. Deep-copies props (incl. unknown keys) via
 * structuredClone and assigns a FRESH id; the source is untouched.
 */
export function duplicateBlock(content: LayoutItem[], id: string): LayoutItem[] {
  const idx = content.findIndex((it) => it.props.id === id)
  if (idx < 0) return content
  const src = content[idx]
  const clonedProps = structuredClone(src.props)
  clonedProps.id = crypto.randomUUID()
  const copy: LayoutItem = { type: src.type, props: clonedProps }
  const next = content.slice()
  next.splice(idx + 1, 0, copy)
  return next
}

/** Reorder a block from one index to another (vertical reflow). Lossless. */
export function reorderBlocks(
  content: LayoutItem[],
  from: number,
  to: number
): LayoutItem[] {
  if (from < 0 || to < 0 || from >= content.length || to >= content.length) return content
  if (from === to) return content
  return arrayMove(content, from, to)
}

/**
 * Merge a `block_provenance` stamp onto props WITHOUT dropping existing keys
 * (P4). Returns new props; caller updates the item via updateBlockProps.
 */
export function stampProvenance(
  props: Record<string, unknown>,
  region: unknown,
  runId: string,
  ver: string | number
): Record<string, unknown> {
  return {
    ...props,
    block_provenance: { region, parser_run_id: runId, parser_version: ver },
  }
}
