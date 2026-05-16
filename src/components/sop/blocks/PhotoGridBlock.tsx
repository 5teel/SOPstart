import { z } from 'zod'
import { SopImageInline } from '@/components/sop/SopImageInline'

/**
 * Phase 20 CONV-03 — grid of photos for a single step.
 *
 * Used by the parsed-DOCX converter when a step has 2+ images attached
 * (`step.image_indexes.length >= 2`). Renders in a responsive grid that
 * mirrors how the source DOCX laid the images out next to the step text.
 */
export const PhotoGridItemSchema = z.object({
  src: z.string().nullable(),
  alt: z.string().max(200).default(''),
  caption: z.string().max(500).optional().nullable(),
})
export type PhotoGridItem = z.infer<typeof PhotoGridItemSchema>

export const PhotoGridBlockPropsSchema = z.object({
  items: z.array(PhotoGridItemSchema).default([]),
  columns: z.enum(['2', '3', '4']).default('2'),
})
export type PhotoGridBlockProps = z.infer<typeof PhotoGridBlockPropsSchema>

export function PhotoGridBlock({ items, columns }: PhotoGridBlockProps) {
  if (!items || items.length === 0) {
    return (
      <div className="bg-white border border-dashed border-[var(--ink-300)] rounded-xl p-6 text-center text-[var(--ink-500)] text-sm mb-4">
        No photos
      </div>
    )
  }
  const colClass =
    columns === '4'
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
      : columns === '3'
        ? 'grid-cols-2 sm:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2'
  return (
    <div className={`grid ${colClass} gap-3 mb-4`}>
      {items.map((it, i) => (
        <figure key={i} className="flex flex-col items-stretch">
          {it.src ? (
            <SopImageInline src={it.src} alt={it.alt || `Photo ${i + 1}`} />
          ) : (
            <div className="bg-white border border-dashed border-[var(--ink-300)] rounded-xl p-6 text-center text-[var(--ink-500)] text-xs">
              Missing
            </div>
          )}
          {it.caption && (
            <figcaption className="text-xs text-[var(--ink-500)] mt-1 text-center">
              {it.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  )
}
