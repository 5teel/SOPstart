/**
 * P17 — layout_data render-time guard (relocated from puck-config.tsx).
 *
 * `UnsupportedBlockPlaceholder` is the visible fallback for a layout_data entry
 * that references a block type this app version doesn't know. `sanitizeLayoutContent`
 * rewrites any unknown-type entry to that placeholder BEFORE the renderer iterates
 * children, so an unknown/malformed type never crashes the read path (T-26-03-01).
 *
 * Known-type membership is checked against `BLOCK_COMPONENTS` (the bespoke
 * registry) — no `@puckeditor/core` dependency. Both the worker read path
 * (`LayoutRenderer`) and the later admin edit host import from here.
 *
 * `UnsupportedBlockPlaceholder` is written with `createElement` (no JSX) so this
 * stays a `.ts` module per the plan's artifact contract.
 */
import { createElement, type ReactElement } from 'react'
import { BLOCK_COMPONENTS } from '@/lib/builder/block-registry'

// Module-level warn-once flag (D-13/D-14: "once per page load")
let warnedUnsupportedBlock = false

function warnUnsupportedBlockOnce(type: string): void {
  if (!warnedUnsupportedBlock) {
    console.warn('[layout] unsupported block type', type)
    warnedUnsupportedBlock = true
  }
}

/**
 * D-13: visible placeholder when a layout_data entry references an unknown block
 * type. `sanitizeLayoutContent` rewrites unknown-type entries to this before the
 * renderer iterates children.
 */
export function UnsupportedBlockPlaceholder({ type }: { type?: string }): ReactElement {
  return createElement(
    'div',
    {
      'data-layout-placeholder': 'unsupported-block',
      className:
        'bg-white border border-dashed border-[var(--ink-500)] rounded-xl p-4 text-[var(--ink-500)] text-sm mb-4',
    },
    `This item isn't supported in your app version - update required${type ? ` (${type})` : ''}.`
  )
}

/**
 * D-13 render-time guard. Given the raw `layout_data.content[]` children,
 * replace any entry whose `type` is not a registered `BLOCK_COMPONENTS` key with
 * an `UnsupportedBlockPlaceholder` entry (carrying the original type in
 * `props.type`) and warn-once. Callable from BOTH the worker read path and the
 * admin edit host before the renderer iterates children.
 */
export function sanitizeLayoutContent(content: unknown[]): unknown[] {
  return content.map((entry) => {
    if (!entry || typeof entry !== 'object') return entry
    const type = (entry as { type?: string }).type
    if (!type || !(type in BLOCK_COMPONENTS)) {
      if (type) warnUnsupportedBlockOnce(type)
      const existingId = (entry as { props?: { id?: string } }).props?.id
      const id = existingId ?? `unsup-${Math.random().toString(36).slice(2, 8)}`
      return {
        type: 'UnsupportedBlockPlaceholder',
        props: { type: type ?? 'unknown', id },
      }
    }
    return entry
  })
}
