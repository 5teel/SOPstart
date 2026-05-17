/**
 * Phase 20 CONV-03 — ParsedSop + uploaded image refs → Puck `layout_data` PER SECTION.
 *
 * Deterministic converter (code owns layout v1 per Simon 2026-05-16). The
 * Phase 12 builder reads layout_data PER sop_sections row (not on the sops
 * row itself — see `BuilderClient.tsx`). This converter produces one
 * LayoutData per parsed section so the parse route can write each into the
 * corresponding sop_sections row's layout_data column.
 *
 * Per-step mapping:
 *   - `StepBlock`            when image_indexes.length === 0
 *   - `StepWithPhotosBlock`  otherwise (layout chosen by image count)
 *
 * Non-step content maps to:
 *   - section.content + no steps → TextBlock under heading
 *   - hazard-flavoured sections (type === 'hazards')  → HazardCardBlock per line
 *   - ppe-flavoured sections                          → PPECardBlock
 *
 * Orphan images (uploaded but not referenced by any step) accumulate in a
 * PhotoGridBlock appended to the FIRST section's content so the admin can
 * re-anchor them in the builder rather than losing them silently.
 */
import type { ParsedSop, ParsedSopSection } from '@/lib/validators/sop'
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

export interface ConvertOptions {
  /**
   * Maps image index to its public URL. When omitted, `src` is set to the
   * storage_path which the renderer signs at request time.
   */
  imageSrcResolver?: (index: number) => string | null
}

export interface PerSectionLayoutResult {
  /** sectionOrder → LayoutData ready to write to sop_sections.layout_data */
  layouts: Map<number, LayoutData>
  /** Indexes claimed by some step (so caller can compute orphans). */
  attachedImageIndexes: Set<number>
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

/**
 * Build a per-section content array for ONE parsed section.
 * The `claimedIndexes` set is mutated — caller owns it to coordinate
 * cross-section orphan detection.
 */
function buildSectionContent(
  section: ParsedSopSection,
  uploadedImages: UploadedImage[],
  resolver: ConvertOptions['imageSrcResolver'],
  claimedIndexes: Set<number>
): PuckItem[] {
  const content: PuckItem[] = []
  const sectionType = (section.type ?? '').toLowerCase()

  // Narrative content (non-step sections)
  if (section.content && (!section.steps || section.steps.length === 0)) {
    const lines = section.content
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
    if (sectionType === 'hazards' && lines.length >= 1) {
      for (const line of lines) {
        content.push({
          type: 'HazardCardBlock',
          props: { id: nextId('hz'), title: 'Hazard', body: line, severity: 'warning' },
        })
      }
      return content
    }
    if (
      (sectionType === 'ppe' || sectionType === 'personal protective equipment') &&
      lines.length >= 1
    ) {
      content.push({
        type: 'PPECardBlock',
        props: { id: nextId('ppe'), title: 'PPE Required', items: lines },
      })
      return content
    }
    content.push({
      type: 'TextBlock',
      props: { id: nextId('t'), content: section.content },
    })
    return content
  }

  // Step-bearing section
  const steps = section.steps ?? []
  for (const step of steps) {
    const indexes = (step.image_indexes ?? []).filter((n) => !claimedIndexes.has(n))
    for (const n of indexes) claimedIndexes.add(n)

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
  return content
}

/**
 * Per-section converter. Returns one LayoutData per section keyed by
 * section.order. Orphan images (any index NOT in attachedImageIndexes after
 * all sections are processed) are appended to the FIRST section's layout
 * as a labelled PhotoGridBlock so the admin can re-anchor in the builder.
 */
export function parsedSopToPerSectionLayoutData(
  parsed: ParsedSop,
  uploadedImages: UploadedImage[],
  opts: ConvertOptions = {}
): PerSectionLayoutResult {
  idSeed = 0
  const attachedIndexes = new Set<number>()
  const layouts = new Map<number, LayoutData>()

  for (const section of parsed.sections) {
    const content = buildSectionContent(
      section,
      uploadedImages,
      opts.imageSrcResolver,
      attachedIndexes
    )
    layouts.set(section.order, { root: { props: {} }, content })
  }

  // Append orphan-images PhotoGrid to the first section.
  const orphans = uploadedImages.filter((u) => !attachedIndexes.has(u.index))
  if (orphans.length > 0 && parsed.sections.length > 0) {
    const firstOrder = parsed.sections[0].order
    const firstLayout = layouts.get(firstOrder)
    if (firstLayout) {
      firstLayout.content.push({
        type: 'HeadingBlock',
        props: {
          id: nextId('h'),
          text: 'Unanchored figures (review)',
          level: 'h3',
        },
      })
      firstLayout.content.push({
        type: 'PhotoGridBlock',
        props: {
          id: nextId('og'),
          items: orphans.map((u) => ({
            src: opts.imageSrcResolver ? opts.imageSrcResolver(u.index) : u.storagePath,
            alt: `Unanchored image ${u.index}`,
            caption: null,
          })),
          columns: orphans.length >= 4 ? '4' : orphans.length === 3 ? '3' : '2',
        },
      })
    }
  }

  return { layouts, attachedImageIndexes: attachedIndexes }
}
