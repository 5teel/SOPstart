/**
 * Phase 20 CONV-03 — ParsedSop + uploaded image refs → Puck `layout_data` tree.
 *
 * Deterministic converter (code owns layout v1 per Simon 2026-05-16). Each
 * AI-emitted step becomes one of:
 *   - `StepBlock`            when image_indexes.length === 0
 *   - `StepWithPhotosBlock`  otherwise (layout chosen by image count)
 *
 * Non-step content maps to:
 *   - section.steps?.length === 0 + section.content  → TextBlock under heading
 *   - hazard-flavoured sections (type === 'hazards')  → HazardCardBlock per step
 *   - ppe-flavoured sections                         → PPECardBlock
 *
 * Orphan images (uploaded but not referenced by any step) accumulate in a
 * PhotoGridBlock appended to the first section so the admin can re-anchor
 * them in the builder rather than losing them silently.
 */
import type { ParsedSop } from '@/lib/validators/sop'
import type { UploadedImage } from './image-uploader'

// Minimal subset of Puck's layout_data shape. We avoid importing Puck's
// internal types so this module stays usable from server contexts.
type PuckItem = {
  type: string
  props: Record<string, unknown> & { id: string }
}
export type LayoutData = {
  root: { props: Record<string, unknown> }
  content: PuckItem[]
  zones?: Record<string, PuckItem[]>
}

interface ConvertOptions {
  /**
   * Maps image index (from ParsedSop.step.image_indexes / sectionImages) to
   * its public URL (presigned by callers or the API later). When omitted,
   * `src` is set to the storage_path which the renderer signs at request
   * time (existing review-page pattern from commit 8f227f8).
   */
  imageSrcResolver?: (index: number) => string | null
}

let idSeed = 0
function nextId(prefix: string): string {
  idSeed++
  return `${prefix}-${Date.now().toString(36)}-${idSeed.toString(36)}`
}

function srcFor(
  index: number,
  uploaded: UploadedImage[],
  resolver: ConvertOptions['imageSrcResolver']
): string | null {
  if (resolver) return resolver(index)
  const u = uploaded.find((i) => i.index === index)
  return u?.storagePath ?? null
}

function chooseStepLayout(count: number): 'right' | 'grid-2' | 'grid-3' | 'grid-4' {
  if (count <= 1) return 'right'
  if (count === 2) return 'grid-2'
  if (count === 3) return 'grid-3'
  return 'grid-4'
}

function makeImagesProp(
  indexes: number[],
  uploaded: UploadedImage[],
  resolver: ConvertOptions['imageSrcResolver']
): Array<{ src: string | null; alt: string; caption: string | null }> {
  return indexes.map((idx) => ({
    src: srcFor(idx, uploaded, resolver),
    alt: `Image ${idx}`,
    caption: null,
  }))
}

export function parsedSopToLayoutData(
  parsed: ParsedSop,
  uploadedImages: UploadedImage[],
  opts: ConvertOptions = {}
): LayoutData {
  idSeed = 0
  const content: PuckItem[] = []
  const attachedIndexes = new Set<number>()
  const resolver = opts.imageSrcResolver

  for (const section of parsed.sections) {
    const sectionType = (section.type ?? '').toLowerCase()

    // Section heading
    content.push({
      type: 'HeadingBlock',
      props: { id: nextId('h'), text: section.title || 'Untitled section', level: 'h2' },
    })

    // Narrative content (non-step sections)
    if (section.content && (!section.steps || section.steps.length === 0)) {
      // Hazards / PPE special-case: try to split content into card-shaped items
      // by line. Falls back to TextBlock on a single-line content blob.
      const lines = section.content
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      if (sectionType === 'hazards' && lines.length >= 1) {
        for (const line of lines) {
          content.push({
            type: 'HazardCardBlock',
            props: {
              id: nextId('hz'),
              title: 'Hazard',
              body: line,
              severity: 'warning',
            },
          })
        }
        continue
      }
      if ((sectionType === 'ppe' || sectionType === 'personal protective equipment') && lines.length >= 1) {
        content.push({
          type: 'PPECardBlock',
          props: {
            id: nextId('ppe'),
            title: 'PPE Required',
            items: lines,
          },
        })
        continue
      }
      content.push({
        type: 'TextBlock',
        props: { id: nextId('t'), content: section.content },
      })
      continue
    }

    // Step-bearing section
    const steps = section.steps ?? []
    for (const step of steps) {
      const indexes = (step.image_indexes ?? []).filter((n) => !attachedIndexes.has(n))
      for (const n of indexes) attachedIndexes.add(n)

      if (indexes.length === 0) {
        content.push({
          type: 'StepBlock',
          props: { id: nextId('s'), number: step.order ?? 1, text: step.text ?? '' },
        })
      } else {
        const photos = makeImagesProp(indexes, uploadedImages, resolver)
        content.push({
          type: 'StepWithPhotosBlock',
          props: {
            id: nextId('sp'),
            number: step.order ?? 1,
            text: step.text ?? '',
            photos,
            layout: chooseStepLayout(indexes.length),
          },
        })
      }

      // Step-level warning/caution/tip → adjacent CalloutBlocks for visibility.
      if (step.warning) {
        content.push({
          type: 'CalloutBlock',
          props: { id: nextId('cw'), title: 'Warning', body: step.warning },
        })
      }
      if (step.caution) {
        content.push({
          type: 'CalloutBlock',
          props: { id: nextId('cc'), title: 'Caution', body: step.caution },
        })
      }
      if (step.tip) {
        content.push({
          type: 'CalloutBlock',
          props: { id: nextId('ct'), title: 'Tip', body: step.tip },
        })
      }
    }
  }

  // Orphan images — every image that no step claimed
  const orphans = uploadedImages.filter((u) => !attachedIndexes.has(u.index))
  if (orphans.length > 0) {
    content.push({
      type: 'HeadingBlock',
      props: { id: nextId('h'), text: 'Unanchored figures (review)', level: 'h3' },
    })
    content.push({
      type: 'PhotoGridBlock',
      props: {
        id: nextId('og'),
        items: orphans.map((u) => ({
          src: resolver ? resolver(u.index) : u.storagePath,
          alt: `Unanchored image ${u.index}`,
          caption: null,
        })),
        columns: orphans.length >= 4 ? '4' : orphans.length === 3 ? '3' : '2',
      },
    })
  }

  return {
    root: { props: {} },
    content,
  }
}
