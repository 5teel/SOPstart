import { z } from 'zod'
import { containsMarkdownTable, SopTable } from '@/components/sop/SopTable'
import { SopImageInline } from '@/components/sop/SopImageInline'

/**
 * Phase 20 CONV-03 — step text with one or more photos rendered alongside.
 *
 * Single self-contained Puck block (no DropZone composition). Replaces the
 * legacy "step text, then images stacked below" pattern with the alignment
 * that authors actually used in the source DOCX: instruction left, photo
 * right (single) or instruction above, photo grid below (multi).
 *
 * The converter (parsed-sop-to-layout-data.ts) emits StepBlock for steps
 * with no images, StepWithPhotosBlock otherwise.
 */
export const StepPhotoItemSchema = z.object({
  src: z.string().nullable(),
  alt: z.string().max(200).default(''),
  caption: z.string().max(500).optional().nullable(),
})
export type StepPhotoItem = z.infer<typeof StepPhotoItemSchema>

export const StepWithPhotosBlockPropsSchema = z.object({
  number: z.number().int().min(1).default(1),
  text: z.string().min(1).max(5000),
  photos: z.array(StepPhotoItemSchema).min(1).max(12),
  // Layout choice:
  //   'right'   — single photo to the right of the text (default for 1 photo)
  //   'grid-2'  — 2-col grid under (default for 2 photos on narrow / 2 wider on desktop)
  //   'grid-3'  — 3-col grid
  //   'grid-4'  — 4-col grid (default for 3-4 photos)
  layout: z.enum(['right', 'grid-2', 'grid-3', 'grid-4']).default('right'),
})
export type StepWithPhotosBlockProps = z.infer<typeof StepWithPhotosBlockPropsSchema>

export function StepWithPhotosBlock({ number, text, photos, layout }: StepWithPhotosBlockProps) {
  const hasTable = containsMarkdownTable(text)
  const photosValid = (photos ?? []).filter((p) => p.src)

  // 'right' renders a 2-column layout on lg+ screens, stacked on smaller.
  if (layout === 'right' && photosValid.length === 1) {
    const p = photosValid[0]
    return (
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(240px,360px)] gap-4 items-start p-4 bg-white rounded-xl border border-[var(--ink-100)] mb-3">
        <div className="flex items-start gap-4 min-w-0">
          <span className="text-[13px] font-bold text-[var(--ink-500)] w-6 flex-shrink-0 pt-0.5 tabular-nums">
            {number}
          </span>
          <div className="flex-1 min-w-0">
            {hasTable ? (
              <SopTable markdown={text} />
            ) : (
              <p className="text-base text-[var(--ink-900)] leading-relaxed">{text}</p>
            )}
          </div>
        </div>
        <figure className="flex flex-col">
          <SopImageInline src={p.src as string} alt={p.alt || 'Step photo'} />
          {p.caption && (
            <figcaption className="text-xs text-[var(--ink-500)] mt-1 text-center">
              {p.caption}
            </figcaption>
          )}
        </figure>
      </div>
    )
  }

  // Grid layouts: text full-width above, photo grid below.
  const colClass =
    layout === 'grid-4'
      ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
      : layout === 'grid-3'
        ? 'grid-cols-2 sm:grid-cols-3'
        : 'grid-cols-1 sm:grid-cols-2'

  return (
    <div className="p-4 bg-white rounded-xl border border-[var(--ink-100)] mb-3">
      <div className="flex items-start gap-4 min-w-0 mb-3">
        <span className="text-[13px] font-bold text-[var(--ink-500)] w-6 flex-shrink-0 pt-0.5 tabular-nums">
          {number}
        </span>
        <div className="flex-1 min-w-0">
          {hasTable ? (
            <SopTable markdown={text} />
          ) : (
            <p className="text-base text-[var(--ink-900)] leading-relaxed">{text}</p>
          )}
        </div>
      </div>
      <div className={`grid ${colClass} gap-3`}>
        {photosValid.map((p, i) => (
          <figure key={i} className="flex flex-col">
            <SopImageInline src={p.src as string} alt={p.alt || `Photo ${i + 1}`} />
            {p.caption && (
              <figcaption className="text-xs text-[var(--ink-500)] mt-1 text-center">
                {p.caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </div>
  )
}
