/**
 * Phase 26 Plan 26-09 (R5, D-03) — the pure Visual-media model + legacy adapters.
 *
 * The unified Visual block holds mixed media, each item medium-tagged
 * `visual:photo | visual:diagram | visual:video`. This module is the ONE place
 * that:
 *   - defines the item shape + `VisualBlockPropsSchema` (the /api/schema surface
 *     via introspection, and the field-commit Zod gate),
 *   - adapts the LEGACY photo blocks (PhotoBlock / PhotoGridBlock /
 *     StepWithPhotosBlock) INTO Visual items so they render + edit THROUGH the
 *     same Visual UI — WITHOUT rewriting their stored `layout_data` `kind`
 *     (A3 convert-safety: the 26-02 golden fixture stays byte-equivalent).
 *
 * PURE (zod + data only, no React / no `@/` runtime import) so the phase26
 * Playwright project — which has no `@/` alias and can't load React barrels —
 * imports it in-process, exactly like `field-map.ts` / `content-ops.ts`.
 */
import { z } from 'zod'

/** The three media a Visual item can hold. Each maps to a `visual:{medium}` tag. */
export const VISUAL_MEDIUMS = ['photo', 'diagram', 'video'] as const
export type VisualMedium = (typeof VISUAL_MEDIUMS)[number]

/** Reserved accent per medium (UI-SPEC §Color): photo cyan / diagram blue / video pink. */
export const MEDIUM_ACCENT: Record<VisualMedium, string> = {
  photo: 'var(--accent-mcu, #06b6d4)',
  diagram: 'var(--accent-step, #3b82f6)',
  video: 'var(--accent-decision, #ec4899)',
}

/** The agent-contract tag surfaced to /api/schema + the 26.5 agent layer (D-02). */
export function mediumTag(medium: VisualMedium): string {
  return `visual:${medium}`
}

/** A single medium item. `annotationId` links a diagram to its Konva overlay (26-11). */
export const VisualItemSchema = z.object({
  medium: z.enum(VISUAL_MEDIUMS),
  src: z.string().nullable(),
  alt: z.string().max(200).default(''),
  caption: z.string().max(500).nullable(),
  annotationId: z.string().uuid().optional(),
  // 26-13: the flattened baked-PNG path/URL for a published diagram — the worker
  // serves THIS <img> (Konva-free, R8). Lives on the VisualBlock props, not a
  // layout_data schema change. Raw storage paths are signed on the worker read.
  bakedSrc: z.string().nullable().optional(),
  // 26-13: the sop_images row this diagram annotates — the FK saveAnnotation writes to.
  sopImageId: z.string().uuid().optional(),
})
export type VisualItem = z.infer<typeof VisualItemSchema>

/** Props/content schema for the Visual block (mirrors `VisualBlockContentSchema`). */
export const VisualBlockPropsSchema = z.object({
  items: z.array(VisualItemSchema).default([]),
})
export type VisualBlockProps = z.infer<typeof VisualBlockPropsSchema>

/** Block types whose photos render THROUGH the Visual media grid (A3). */
export type MediaFieldType =
  | 'VisualBlock'
  | 'PhotoBlock'
  | 'PhotoGridBlock'
  | 'StepWithPhotosBlock'

type Props = Record<string, unknown>

function asStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}
function asSrc(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}
function asCaption(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

/** Does this media field hold MANY items (so `＋ add media` is offered)? */
export function supportsMultiple(type: MediaFieldType): boolean {
  return type !== 'PhotoBlock'
}

/** Does this field offer the medium sub-picker (photo/diagram/video)? Only the unified Visual block. */
export function supportsMediumPicker(type: MediaFieldType): boolean {
  return type === 'VisualBlock'
}

/**
 * Read the field-native value of a legacy/visual block INTO Visual items.
 * Does NOT mutate or read `kind` — purely a view transform (A3).
 */
export function toVisualItems(type: MediaFieldType, props: Props): VisualItem[] {
  switch (type) {
    case 'VisualBlock': {
      const items = Array.isArray(props.items) ? (props.items as Props[]) : []
      return items.map((it) => ({
        medium: (VISUAL_MEDIUMS as readonly string[]).includes(it.medium as string)
          ? (it.medium as VisualMedium)
          : 'photo',
        src: asSrc(it.src),
        alt: asStr(it.alt),
        caption: asCaption(it.caption),
        ...(typeof it.annotationId === 'string' ? { annotationId: it.annotationId } : {}),
        ...(typeof it.bakedSrc === 'string' ? { bakedSrc: it.bakedSrc } : {}),
        ...(typeof it.sopImageId === 'string' ? { sopImageId: it.sopImageId } : {}),
      }))
    }
    case 'PhotoBlock':
      // Single-photo block → one photo item.
      return [{ medium: 'photo', src: asSrc(props.src), alt: asStr(props.alt), caption: asCaption(props.caption) }]
    case 'PhotoGridBlock':
    case 'StepWithPhotosBlock': {
      const key = type === 'PhotoGridBlock' ? 'items' : 'photos'
      const arr = Array.isArray(props[key]) ? (props[key] as Props[]) : []
      return arr.map((it) => ({
        medium: 'photo' as const,
        src: asSrc(it.src),
        alt: asStr(it.alt),
        caption: asCaption(it.caption),
      }))
    }
  }
}

/**
 * Write Visual items BACK to the field-native value the block stores. The caller
 * commits this via `onCommitField(field, value)` → the lossless reducer, so
 * `kind` / `junctionId` / `block_provenance` are untouched (A3 + P4).
 *
 * Returns the value for the block's media FIELD (not the whole props):
 *   VisualBlock.items → VisualItem[]   PhotoBlock.src → string|null
 *   PhotoGridBlock.items / StepWithPhotosBlock.photos → {src,alt,caption}[]
 */
export function fromVisualItems(type: MediaFieldType, items: VisualItem[]): unknown {
  switch (type) {
    case 'VisualBlock':
      return items.map((it) => ({
        medium: it.medium,
        src: it.src,
        alt: it.alt,
        caption: it.caption,
        ...(it.annotationId ? { annotationId: it.annotationId } : {}),
        ...(it.bakedSrc ? { bakedSrc: it.bakedSrc } : {}),
        ...(it.sopImageId ? { sopImageId: it.sopImageId } : {}),
      }))
    case 'PhotoBlock':
      // Single slot — keep the first item's src (photo blocks hold one image).
      return items[0]?.src ?? null
    case 'PhotoGridBlock':
    case 'StepWithPhotosBlock':
      return items.map((it) => ({ src: it.src, alt: it.alt, caption: it.caption }))
  }
}

/** The FIELD key each media block edits through the grid. */
export function mediaFieldKey(type: MediaFieldType): 'items' | 'src' | 'photos' {
  if (type === 'PhotoBlock') return 'src'
  if (type === 'StepWithPhotosBlock') return 'photos'
  return 'items'
}

/** A fresh, empty item of the chosen medium (src filled later by upload/annotate). */
export function newVisualItem(medium: VisualMedium): VisualItem {
  return { medium, src: null, alt: '', caption: null }
}
