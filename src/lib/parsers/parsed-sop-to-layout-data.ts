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
 *
 * Phase 21 (Plan 21-04 Task 3) — every produced Puck item carries
 * `props.block_provenance = { region, parser_run_id, parser_version }` when
 * a `provenanceContext` is supplied. The region kind matches the source
 * file (`pdf` / `docx` / `scan` / `video` / `ai_prompt`). When no context
 * is supplied OR the source kind is unknown, props.block_provenance is
 * omitted — pre-Phase-21 callers see the previous behaviour exactly.
 */
import type { ParsedSop, ParsedSopSection } from '@/lib/validators/sop'
import type { UploadedImage } from './image-uploader'
import type { SourceProvenanceRegion } from './source-viewer'
import { BlockProvenanceSchema } from '@/lib/validators/sop'

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

/**
 * Phase 21 (Plan 21-04 Task 3) — provenance context for `block_provenance`.
 *
 * Provides:
 *   - `sourceKind` — drives the discriminated union of region kinds
 *   - `parser_run_id` — soft FK to parse_jobs.id
 *   - `parser_version` — semver-ish tag set by the parser at write time
 *   - `pageOfImageIndex` (PDF only) — index → page number lookup; built by
 *     the parse route from `extractPdfBlockBboxes` results
 *   - `paragraphOfImageIndex` (DOCX only) — index → paragraph anchor;
 *     built by the parse route from `extractDocxParagraphAnchors`
 *   - `fallbackRegion` — used when a block has no specific anchor (e.g. a
 *     hazards line that came from generic body text); guarantees every
 *     block produced has SOMETHING in block_provenance so the verify gate
 *     can render a row for it
 */
export interface ProvenanceContext {
  sourceKind: 'pdf' | 'docx' | 'scan' | 'video' | 'ai_prompt'
  parser_run_id: string
  parser_version: string
  /** PDF only — map image index → 1-based page number. */
  pageOfImageIndex?: Map<number, { page: number; bbox: [number, number, number, number]; pageWidth: number; pageHeight: number }>
  /** DOCX only — map image index → paragraph anchor pair. */
  paragraphOfImageIndex?: Map<number, { paragraph_id: string; run_start: number; run_end: number }>
  /** Used when a block has no specific image-index → region mapping. */
  fallbackRegion?: SourceProvenanceRegion
}

export interface ConvertOptions {
  /**
   * Maps image index to its public URL. When omitted, `src` is set to the
   * storage_path which the renderer signs at request time.
   */
  imageSrcResolver?: (index: number) => string | null
  /** Phase 21 — write block_provenance into every emitted Puck item. */
  provenanceContext?: ProvenanceContext
}

/**
 * Build a SourceProvenanceRegion for a single block. Returns null when no
 * region can be derived (so the caller can decide whether to omit the
 * block_provenance prop entirely vs use the fallback).
 */
function regionForBlock(
  ctx: ProvenanceContext,
  imageIndexes: number[],
): SourceProvenanceRegion | null {
  // PDF: prefer the first image's bbox/page.
  if (ctx.sourceKind === 'pdf' && ctx.pageOfImageIndex) {
    for (const idx of imageIndexes) {
      const hit = ctx.pageOfImageIndex.get(idx)
      if (hit) {
        return {
          kind: 'pdf',
          page: hit.page,
          bbox: hit.bbox,
          pageWidth: hit.pageWidth,
          pageHeight: hit.pageHeight,
        }
      }
    }
  }
  // DOCX: prefer the first image's paragraph anchor.
  if (ctx.sourceKind === 'docx' && ctx.paragraphOfImageIndex) {
    for (const idx of imageIndexes) {
      const hit = ctx.paragraphOfImageIndex.get(idx)
      if (hit) {
        return {
          kind: 'docx',
          paragraph_id: hit.paragraph_id,
          run_start: hit.run_start,
          run_end: hit.run_end,
        }
      }
    }
  }
  return ctx.fallbackRegion ?? null
}

function buildBlockProvenance(
  ctx: ProvenanceContext,
  imageIndexes: number[],
): Record<string, unknown> | null {
  const region = regionForBlock(ctx, imageIndexes)
  if (!region) return null
  const record = {
    region,
    parser_run_id: ctx.parser_run_id,
    parser_version: ctx.parser_version,
  }
  // Validate before stamping — guarantees we never write a malformed shape.
  const parsed = BlockProvenanceSchema.safeParse(record)
  if (!parsed.success) {
    console.warn(
      '[parsed-sop-to-layout-data] dropping invalid block_provenance',
      parsed.error.issues[0]?.message,
    )
    return null
  }
  return record as Record<string, unknown>
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
 * Stamp `block_provenance` on a Puck item's props. Mutates in place. Safe
 * when ctx is undefined (no-op).
 */
function stampProvenance(
  item: PuckItem,
  ctx: ProvenanceContext | undefined,
  imageIndexes: number[],
): PuckItem {
  if (!ctx) return item
  const prov = buildBlockProvenance(ctx, imageIndexes)
  if (prov) {
    item.props.block_provenance = prov
  }
  return item
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
  claimedIndexes: Set<number>,
  provenanceContext?: ProvenanceContext,
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
        content.push(stampProvenance({
          type: 'HazardCardBlock',
          props: { id: nextId('hz'), title: 'Hazard', body: line, severity: 'warning' },
        }, provenanceContext, []))
      }
      return content
    }
    if (
      (sectionType === 'ppe' || sectionType === 'personal protective equipment') &&
      lines.length >= 1
    ) {
      content.push(stampProvenance({
        type: 'PPECardBlock',
        props: { id: nextId('ppe'), title: 'PPE Required', items: lines },
      }, provenanceContext, []))
      return content
    }
    content.push(stampProvenance({
      type: 'TextBlock',
      props: { id: nextId('t'), content: section.content },
    }, provenanceContext, []))
    return content
  }

  // Step-bearing section
  const steps = section.steps ?? []
  for (const step of steps) {
    const indexes = (step.image_indexes ?? []).filter((n) => !claimedIndexes.has(n))
    for (const n of indexes) claimedIndexes.add(n)

    if (indexes.length === 0) {
      content.push(stampProvenance({
        type: 'StepBlock',
        props: { id: nextId('s'), number: step.order ?? 1, text: step.text ?? '' },
      }, provenanceContext, []))
    } else {
      const photos = makeImagesProp(indexes, uploadedImages, resolver)
      content.push(stampProvenance({
        type: 'StepWithPhotosBlock',
        props: {
          id: nextId('sp'),
          number: step.order ?? 1,
          text: step.text ?? '',
          photos,
          layout: chooseStepLayout(indexes.length),
        },
      }, provenanceContext, indexes))
    }

    if (step.warning) {
      content.push(stampProvenance({
        type: 'CalloutBlock',
        props: { id: nextId('cw'), title: 'Warning', body: step.warning },
      }, provenanceContext, indexes))
    }
    if (step.caution) {
      content.push(stampProvenance({
        type: 'CalloutBlock',
        props: { id: nextId('cc'), title: 'Caution', body: step.caution },
      }, provenanceContext, indexes))
    }
    if (step.tip) {
      content.push(stampProvenance({
        type: 'CalloutBlock',
        props: { id: nextId('ct'), title: 'Tip', body: step.tip },
      }, provenanceContext, indexes))
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
      attachedIndexes,
      opts.provenanceContext,
    )
    layouts.set(section.order, { root: { props: {} }, content })
  }

  // Append orphan-images PhotoGrid to the first section.
  const orphans = uploadedImages.filter((u) => !attachedIndexes.has(u.index))
  if (orphans.length > 0 && parsed.sections.length > 0) {
    const firstOrder = parsed.sections[0].order
    const firstLayout = layouts.get(firstOrder)
    if (firstLayout) {
      firstLayout.content.push(stampProvenance({
        type: 'HeadingBlock',
        props: {
          id: nextId('h'),
          text: 'Unanchored figures (review)',
          level: 'h3',
        },
      }, opts.provenanceContext, []))
      firstLayout.content.push(stampProvenance({
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
      }, opts.provenanceContext, orphans.map((u) => u.index)))
    }
  }

  return { layouts, attachedImageIndexes: attachedIndexes }
}
