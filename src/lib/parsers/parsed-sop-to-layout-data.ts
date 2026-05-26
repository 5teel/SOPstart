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
import {
  BlockContentSchema,
  type BlockContent,
} from '@/lib/validators/blocks'
import { createBlock } from '@/actions/blocks'
import { addBlockToSection } from '@/actions/sop-section-blocks'

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

// ============================================================================
// Phase 21 Plan 21-05 — parser → library junction materialization.
//
// The Phase 12 builder reads sop_sections.layout_data; the Wave 4 publish
// gate walks sop_section_blocks junction rows. Until 21-05 the two paths
// never met for parsed SOPs (zero junctions → 0/0 no-op gate). This block
// wires the parser to create one library block + one junction per Puck item
// so the verify checklist + reviewer-flags surface render correctly.
//
// Contract (T-21-05-02 partial-failure):
//   materializeJunctionsForLayout RUNS SEQUENTIALLY and THROWS on any
//   single-item failure. The caller (parse route) MUST catch and mark the
//   parse_job failed — never let the SOP land with partial junctions.
//
// Library bloat mitigation (T-21-05-01):
//   Every parser-created block has category='parsed_inline'. The picker UI
//   filters this category out by default so admins don't see 50 single-use
//   blocks per SOP.
//
// Shape-mismatch mitigation (T-21-05-03):
//   puckPropsToBlockContent below is strict — Zod-validates on the way out
//   and throws on shape mismatch (no silent skip).
// ============================================================================

const PARSER_VERSION = '21-05.1'

/** Maps Puck registry type names to the BlockContent discriminator slug. */
const PUCK_TYPE_TO_KIND: Record<string, BlockContent['kind']> = {
  TextBlock: 'text',
  HeadingBlock: 'heading',
  PhotoBlock: 'photo',
  CalloutBlock: 'callout',
  StepBlock: 'step',
  HazardCardBlock: 'hazard',
  PPECardBlock: 'ppe',
  MeasurementBlock: 'measurement',
  DecisionBlock: 'decision',
  EscalateBlock: 'escalate',
  SignOffBlock: 'signoff',
  ZoneBlock: 'zone',
  InspectBlock: 'inspect',
  VoiceNoteBlock: 'voice-note',
  ModelBlock: 'model',
  StepWithPhotosBlock: 'step_with_photos',
  PhotoGridBlock: 'photo_grid',
}

/**
 * Strip presentation fields and project a Puck item's props into the
 * corresponding BlockContent shape. Zod-validates on the way out and THROWS
 * on shape mismatch — callers must handle (parser pipeline marks parse_job
 * failed; see T-21-05-03).
 *
 * Exported for direct unit testing.
 */
export function puckPropsToBlockContent(
  itemType: string,
  props: Record<string, unknown>,
): BlockContent {
  const kind = PUCK_TYPE_TO_KIND[itemType]
  if (!kind) {
    throw new Error(
      `[puckPropsToBlockContent] unsupported Puck type '${itemType}'`,
    )
  }
  // Shape per kind — read only content fields, NOT id/block_provenance/junctionId/etc.
  let candidate: unknown
  switch (kind) {
    case 'text':
      candidate = { kind, content: String(props.content ?? '') }
      break
    case 'heading':
      candidate = {
        kind,
        text: String(props.text ?? ''),
        level: (props.level === 'h3' ? 'h3' : 'h2'),
      }
      break
    case 'photo':
      candidate = {
        kind,
        src: (props.src ?? null) as string | null,
        alt: String(props.alt ?? ''),
        caption: (props.caption ?? null) as string | null,
      }
      break
    case 'callout':
      candidate = {
        kind,
        title: String(props.title ?? 'Note'),
        body: String(props.body ?? ''),
      }
      break
    case 'step':
      candidate = {
        kind,
        text: String(props.text ?? ''),
        ...(typeof props.warning === 'string' && props.warning ? { warning: props.warning } : {}),
        ...(typeof props.tip === 'string' && props.tip ? { tip: props.tip } : {}),
      }
      break
    case 'hazard': {
      const severity =
        props.severity === 'critical' || props.severity === 'notice'
          ? props.severity
          : 'warning'
      candidate = {
        kind,
        text: String(props.body ?? props.text ?? ''),
        severity,
      }
      break
    }
    case 'ppe': {
      const rawItems = (props.items ?? []) as Array<unknown>
      const items = rawItems
        .map((x) =>
          typeof x === 'string' ? x : ((x as { item?: string })?.item ?? ''),
        )
        .filter((s) => typeof s === 'string' && s.length > 0)
      candidate = { kind, items }
      break
    }
    case 'measurement':
      candidate = {
        kind,
        label: String(props.label ?? ''),
        unit: String(props.unit ?? ''),
        voiceEnabled: props.voiceEnabled !== false,
        ...(typeof props.hint === 'string' && props.hint ? { hint: props.hint } : {}),
      }
      break
    case 'decision': {
      const rawOptions = (props.options ?? []) as Array<{
        label?: string
        isEscalation?: boolean
      }>
      const options = rawOptions
        .filter((o) => typeof o?.label === 'string' && o.label.length > 0)
        .map((o) => ({
          label: o.label as string,
          ...(o.isEscalation === true ? { isEscalation: true } : {}),
        }))
      candidate = {
        kind,
        question: String(props.question ?? ''),
        options,
      }
      break
    }
    case 'escalate': {
      const mode =
        props.escalationMode === 'alert' || props.escalationMode === 'lock'
          ? props.escalationMode
          : 'form'
      candidate = {
        kind,
        title: String(props.title ?? ''),
        escalationMode: mode,
        ...(typeof props.reason === 'string' && props.reason ? { reason: props.reason } : {}),
      }
      break
    }
    case 'signoff': {
      const role =
        props.requiredRole === 'safety_manager' || props.requiredRole === 'admin'
          ? props.requiredRole
          : 'supervisor'
      candidate = {
        kind,
        title: String(props.title ?? ''),
        requiredRole: role,
        ...(typeof props.acknowledgementText === 'string' && props.acknowledgementText
          ? { acknowledgementText: props.acknowledgementText }
          : {}),
      }
      break
    }
    case 'zone': {
      const zt =
        props.zoneType === 'danger' ||
        props.zoneType === 'safe' ||
        props.zoneType === 'pedestrian'
          ? props.zoneType
          : 'warning'
      candidate = {
        kind,
        label: String(props.label ?? ''),
        zoneType: zt,
        ...(typeof props.notes === 'string' && props.notes ? { notes: props.notes } : {}),
      }
      break
    }
    case 'inspect': {
      const rawItems = (props.items ?? []) as Array<{
        label?: string
        requirePhoto?: boolean
      }>
      const items = rawItems
        .filter((i) => typeof i?.label === 'string' && i.label.length > 0)
        .map((i) => ({
          label: i.label as string,
          requirePhoto: i.requirePhoto === true,
        }))
      candidate = {
        kind,
        title: String(props.title ?? ''),
        items,
      }
      break
    }
    case 'voice-note': {
      const lang =
        props.language === 'en-AU' || props.language === 'en-US'
          ? props.language
          : 'en-NZ'
      const dur =
        typeof props.maxDurationSec === 'number' &&
        props.maxDurationSec >= 5 &&
        props.maxDurationSec <= 300
          ? Math.round(props.maxDurationSec)
          : 60
      candidate = {
        kind,
        prompt: String(props.prompt ?? ''),
        language: lang,
        maxDurationSec: dur,
      }
      break
    }
    case 'model':
      candidate = {
        kind,
        assetUrl: String(props.assetUrl ?? ''),
        hotspots: Array.isArray(props.hotspots) ? props.hotspots : [],
        defaultLayers: Array.isArray(props.defaultLayers) ? props.defaultLayers : [],
      }
      break
    case 'step_with_photos': {
      const rawPhotos = (props.photos ?? []) as Array<{
        src?: string | null
        alt?: string
        caption?: string | null
      }>
      const photos = rawPhotos.map((p) => ({
        src: (p?.src ?? null) as string | null,
        alt: String(p?.alt ?? ''),
        caption: (p?.caption ?? null) as string | null,
      }))
      const layout =
        props.layout === 'grid-2' ||
        props.layout === 'grid-3' ||
        props.layout === 'grid-4'
          ? props.layout
          : 'right'
      candidate = {
        kind,
        number: typeof props.number === 'number' ? props.number : 1,
        text: String(props.text ?? ''),
        photos,
        layout,
      }
      break
    }
    case 'photo_grid': {
      const rawItems = (props.items ?? []) as Array<{
        src?: string | null
        alt?: string
        caption?: string | null
      }>
      const items = rawItems.map((p) => ({
        src: (p?.src ?? null) as string | null,
        alt: String(p?.alt ?? ''),
        caption: (p?.caption ?? null) as string | null,
      }))
      const cols =
        props.columns === '3' || props.columns === '4' ? props.columns : '2'
      candidate = { kind, items, columns: cols }
      break
    }
    // No default branch — PUCK_TYPE_TO_KIND only maps to the 17 cases above.
    // 'emergency' and 'custom' exist in BlockContent but no Puck type maps to
    // them (they're authored inline via the library picker, never by parser).
  }

  // Strict validation — throw on shape mismatch (T-21-05-03).
  const parsed = BlockContentSchema.safeParse(candidate)
  if (!parsed.success) {
    throw new Error(
      `[puckPropsToBlockContent] invalid content for '${itemType}': ${parsed.error.issues[0]?.message ?? 'shape mismatch'}`,
    )
  }
  return parsed.data
}

/**
 * Derive an auto-generated `blocks.name` from the BlockContent — first ~60
 * chars of a representative text field. Names are NEVER null and have to
 * fit in varchar(200); the parser-created blocks are non-reusable so the
 * name is mostly cosmetic in the admin.
 */
function deriveBlockName(itemType: string, content: BlockContent): string {
  const slug = itemType.replace(/Block$/, '')
  let snippet = ''
  switch (content.kind) {
    case 'text':
      snippet = content.content
      break
    case 'heading':
      snippet = content.text
      break
    case 'photo':
      snippet = content.alt || content.caption || 'photo'
      break
    case 'callout':
      snippet = content.body
      break
    case 'step':
    case 'step_with_photos':
      snippet = content.text
      break
    case 'hazard':
      snippet = content.text
      break
    case 'ppe':
      snippet = content.items.join(', ')
      break
    case 'measurement':
      snippet = `${content.label} (${content.unit})`
      break
    case 'decision':
      snippet = content.question
      break
    case 'escalate':
    case 'signoff':
    case 'inspect':
      snippet = content.title
      break
    case 'zone':
      snippet = content.label
      break
    case 'voice-note':
      snippet = content.prompt
      break
    case 'model':
      snippet = content.assetUrl
      break
    case 'photo_grid':
      snippet = `${content.items.length} photo(s)`
      break
    case 'emergency':
      snippet = content.text
      break
    case 'custom':
      snippet = 'custom'
      break
  }
  const truncated = snippet.trim().slice(0, 60) || slug
  return `[parsed] ${slug}: ${truncated}`
}

/**
 * Materialize sop_section_blocks junction rows for every Puck item in a
 * section's layout. Mutates each item's `props.junctionId` in place so the
 * caller writes the (now stamped) layout_data back to sop_sections.
 *
 * RUNS SEQUENTIALLY. If any single item fails, the function throws so the
 * caller can mark the parse_job failed (T-21-05-02). The plan calls for
 * `Promise.all` in the mitigation text, but sequential + early throw is
 * functionally equivalent for partial-failure detection AND it avoids
 * piling N service-role inserts in parallel — safer for a worker process.
 *
 * Inputs:
 *   - organisationId — required (passed explicitly to createBlock with scope='org')
 *   - sectionId      — sop_sections.id this layout belongs to
 *   - puckItems      — content array from parsedSopToPerSectionLayoutData; each
 *                      item's props.block_provenance (if present) is forwarded
 *                      to the junction row's block_provenance column
 *   - createdByUserId — owner stamp; can be null when no specific user owns
 *                       the parse job (system-created)
 */
export interface MaterializeOptions {
  organisationId: string
  sectionId: string
  puckItems: PuckItem[]
  createdByUserId: string | null
}

export interface MaterializeResult {
  /** Number of (block, junction) pairs created. */
  createdCount: number
  /** junctionIds created, in puckItems order. */
  junctionIds: string[]
}

export async function materializeJunctionsForLayout(
  opts: MaterializeOptions,
): Promise<MaterializeResult> {
  const { organisationId, sectionId, puckItems, createdByUserId } = opts
  const junctionIds: string[] = []

  for (let i = 0; i < puckItems.length; i++) {
    const item = puckItems[i]
    // Skip non-content placeholders that don't belong in the library.
    if (item.type === 'UnsupportedBlockPlaceholder') continue

    let content: BlockContent
    try {
      content = puckPropsToBlockContent(item.type, item.props)
    } catch (e) {
      throw new Error(
        `[materializeJunctionsForLayout] item ${i} (${item.type}): ${
          e instanceof Error ? e.message : String(e)
        }`,
      )
    }

    // 1. createBlock — org-scoped, category='parsed_inline'.
    const createRes = await createBlock({
      kindSlug: content.kind,
      name: deriveBlockName(item.type, content),
      categoryTags: [],
      freeTextTags: [],
      content,
      scope: 'org',
      category: 'parsed_inline',
      serviceRole: {
        organisationId,
        createdByUserId,
      },
    })
    if ('error' in createRes) {
      throw new Error(
        `[materializeJunctionsForLayout] createBlock failed at item ${i} (${item.type}): ${createRes.error}`,
      )
    }

    // 2. addBlockToSection — pinned mode, forward block_provenance if present.
    const provFromItem = item.props.block_provenance as
      | { region: SourceProvenanceRegion; parser_run_id: string; parser_version: string }
      | undefined
    const addRes = await addBlockToSection({
      sopSectionId: sectionId,
      blockId: createRes.block.id,
      pinMode: 'pinned',
      blockProvenance: provFromItem,
      serviceRole: true,
    })
    if ('error' in addRes) {
      throw new Error(
        `[materializeJunctionsForLayout] addBlockToSection failed at item ${i} (${item.type}): ${addRes.error}`,
      )
    }

    // 3. Stamp junctionId on the Puck item in place so the caller writes the
    //    junction-aware layout_data back to sop_sections.
    item.props.junctionId = addRes.junction.id
    junctionIds.push(addRes.junction.id)
  }

  return { createdCount: junctionIds.length, junctionIds }
}

// Re-export so external callers can stamp parser_version consistently.
export { PARSER_VERSION }
