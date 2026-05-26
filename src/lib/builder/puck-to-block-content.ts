/**
 * Phase 13 — Puck props → BlockContent shape mapping helper.
 *
 * Puck stores block content as flat props on its registered components
 * (HazardCardBlock { title, body, severity }, PPECardBlock { title, items },
 * StepBlock { number, text }, etc.). The library schema (BlockContentSchema
 * in src/lib/validators/blocks.ts) uses a discriminated union with `kind`.
 *
 * This module bridges the two so the three-dot "Save to library" overflow
 * menu can capture a block's authored state and pass it to SaveToLibraryModal.
 *
 * Returns `null` for non-savable Puck types (TextBlock / HeadingBlock / PhotoBlock
 * / CalloutBlock / ModelBlock / UnsupportedBlockPlaceholder) — the menu's
 * "Save to library" option only renders for savable kinds.
 */
import type { BlockContent } from '@/lib/validators/blocks'

/**
 * Map Puck component types → BlockContent kind slugs.
 * Only kinds in BlockContentSchema's discriminated union can be saved to library.
 * `null` means non-savable (UI primitive, decorative, or out-of-scope for the library).
 */
export const PUCK_TYPE_TO_BLOCK_KIND: Record<string, BlockContent['kind'] | null> = {
  HazardCardBlock: 'hazard',
  PPECardBlock: 'ppe',
  StepBlock: 'step',
  MeasurementBlock: 'measurement',
  DecisionBlock: 'decision',
  EscalateBlock: 'escalate',
  SignOffBlock: 'signoff',
  ZoneBlock: 'zone',
  InspectBlock: 'inspect',
  VoiceNoteBlock: 'voice-note',
  // Plan 21-05 — the parser now creates library blocks for these kinds too,
  // so they need a non-null mapping if any Save-from-Canvas flow targets
  // them. The picker hides them by default (category='parsed_inline' filter)
  // but they are otherwise savable.
  TextBlock: 'text',
  HeadingBlock: 'heading',
  PhotoBlock: 'photo',
  CalloutBlock: 'callout',
  ModelBlock: 'model',
  StepWithPhotosBlock: 'step_with_photos',
  PhotoGridBlock: 'photo_grid',
  // Non-savable types:
  UnsupportedBlockPlaceholder: null,
}

/**
 * Given a Puck component name + its current props, build a BlockContent object
 * that can be saved to the library. Returns `null` if the type is not savable
 * or if required fields are missing — the caller should hide the
 * "Save to library" affordance in that case.
 */
export function puckPropsToBlockContent(
  puckName: string,
  props: unknown
): BlockContent | null {
  const kind = PUCK_TYPE_TO_BLOCK_KIND[puckName] ?? null
  if (!kind) return null
  const p = (props ?? {}) as Record<string, unknown>

  switch (kind) {
    case 'hazard': {
      const body = typeof p.body === 'string' ? p.body : ''
      const severityRaw = typeof p.severity === 'string' ? p.severity : 'warning'
      const severity =
        severityRaw === 'critical' || severityRaw === 'warning' || severityRaw === 'notice'
          ? severityRaw
          : 'warning'
      if (!body) return null
      return { kind: 'hazard', text: body, severity }
    }
    case 'ppe': {
      // PPECardBlock items can arrive as either string[] or { item: string }[]
      // (Puck array fields produce object-wrapped entries by default).
      const rawItems = (p.items ?? []) as Array<unknown>
      const items = rawItems
        .map((x) =>
          typeof x === 'string'
            ? x
            : ((x as { item?: string })?.item ?? '')
        )
        .filter((s): s is string => typeof s === 'string' && s.length > 0)
      if (items.length === 0) return null
      return { kind: 'ppe', items }
    }
    case 'step': {
      const text = typeof p.text === 'string' ? p.text : ''
      if (!text) return null
      const out: BlockContent = { kind: 'step', text }
      if (typeof p.warning === 'string' && p.warning) out.warning = p.warning
      if (typeof p.tip === 'string' && p.tip) out.tip = p.tip
      return out
    }
    case 'measurement': {
      const label = typeof p.label === 'string' ? p.label : ''
      const unit = typeof p.unit === 'string' ? p.unit : ''
      if (!label || !unit) return null
      return {
        kind: 'measurement',
        label,
        unit,
        voiceEnabled: p.voiceEnabled !== false,
        ...(typeof p.hint === 'string' && p.hint ? { hint: p.hint } : {}),
      }
    }
    case 'decision': {
      const question = typeof p.question === 'string' ? p.question : ''
      const rawOptions = (p.options ?? []) as Array<{ label?: string; isEscalation?: boolean }>
      const options = rawOptions
        .filter((o) => typeof o?.label === 'string' && o.label.length > 0)
        .map((o) => ({
          label: o.label as string,
          ...(o.isEscalation === true ? { isEscalation: true } : {}),
        }))
      if (!question || options.length < 2) return null
      return { kind: 'decision', question, options }
    }
    case 'escalate': {
      const title = typeof p.title === 'string' ? p.title : ''
      if (!title) return null
      const modeRaw = typeof p.escalationMode === 'string' ? p.escalationMode : 'form'
      const escalationMode =
        modeRaw === 'alert' || modeRaw === 'lock' || modeRaw === 'form' ? modeRaw : 'form'
      return {
        kind: 'escalate',
        title,
        escalationMode,
        ...(typeof p.reason === 'string' && p.reason ? { reason: p.reason } : {}),
      }
    }
    case 'signoff': {
      const title = typeof p.title === 'string' ? p.title : ''
      if (!title) return null
      const roleRaw = typeof p.requiredRole === 'string' ? p.requiredRole : 'supervisor'
      const requiredRole =
        roleRaw === 'supervisor' || roleRaw === 'safety_manager' || roleRaw === 'admin'
          ? roleRaw
          : 'supervisor'
      return {
        kind: 'signoff',
        title,
        requiredRole,
        ...(typeof p.acknowledgementText === 'string' && p.acknowledgementText
          ? { acknowledgementText: p.acknowledgementText }
          : {}),
      }
    }
    case 'zone': {
      const label = typeof p.label === 'string' ? p.label : ''
      if (!label) return null
      const ztRaw = typeof p.zoneType === 'string' ? p.zoneType : 'warning'
      const zoneType =
        ztRaw === 'danger' || ztRaw === 'warning' || ztRaw === 'safe' || ztRaw === 'pedestrian'
          ? ztRaw
          : 'warning'
      return {
        kind: 'zone',
        label,
        zoneType,
        ...(typeof p.notes === 'string' && p.notes ? { notes: p.notes } : {}),
      }
    }
    case 'inspect': {
      const title = typeof p.title === 'string' ? p.title : ''
      const rawItems = (p.items ?? []) as Array<{ label?: string; requirePhoto?: boolean }>
      const items = rawItems
        .filter((i) => typeof i?.label === 'string' && i.label.length > 0)
        .map((i) => ({
          label: i.label as string,
          requirePhoto: i.requirePhoto === true,
        }))
      if (!title || items.length === 0) return null
      return { kind: 'inspect', title, items }
    }
    case 'voice-note': {
      const prompt = typeof p.prompt === 'string' ? p.prompt : ''
      if (!prompt) return null
      const langRaw = typeof p.language === 'string' ? p.language : 'en-NZ'
      const language =
        langRaw === 'en-NZ' || langRaw === 'en-AU' || langRaw === 'en-US' ? langRaw : 'en-NZ'
      const maxDurationSec =
        typeof p.maxDurationSec === 'number' && p.maxDurationSec >= 5 && p.maxDurationSec <= 300
          ? Math.round(p.maxDurationSec)
          : 60
      return { kind: 'voice-note', prompt, language, maxDurationSec }
    }
    // Plan 21-05 — parser-emitted kinds. Strip presentation-only fields
    // (id, block_provenance, junctionId) — they live on the Puck item, not
    // the BlockContent shape.
    case 'text': {
      const content = typeof p.content === 'string' ? p.content : ''
      if (!content) return null
      return { kind: 'text', content }
    }
    case 'heading': {
      const text = typeof p.text === 'string' ? p.text : ''
      if (!text) return null
      const level = p.level === 'h3' ? 'h3' : 'h2'
      return { kind: 'heading', text, level }
    }
    case 'photo': {
      const src = typeof p.src === 'string' ? p.src : null
      const alt = typeof p.alt === 'string' ? p.alt : ''
      const caption = typeof p.caption === 'string' ? p.caption : null
      return { kind: 'photo', src, alt, caption }
    }
    case 'callout': {
      const body = typeof p.body === 'string' ? p.body : ''
      if (!body) return null
      const title = typeof p.title === 'string' ? p.title : 'Note'
      return { kind: 'callout', title, body }
    }
    case 'model': {
      const assetUrl = typeof p.assetUrl === 'string' ? p.assetUrl : ''
      if (!assetUrl) return null
      const hotspots = Array.isArray(p.hotspots)
        ? (p.hotspots as Array<{ id: string; label: string; position: { x: number; y: number; z: number } }>)
        : []
      const defaultLayers = Array.isArray(p.defaultLayers)
        ? (p.defaultLayers as string[])
        : []
      return { kind: 'model', assetUrl, hotspots, defaultLayers }
    }
    case 'step_with_photos': {
      const text = typeof p.text === 'string' ? p.text : ''
      if (!text) return null
      const number = typeof p.number === 'number' ? p.number : 1
      const rawPhotos = (p.photos ?? []) as Array<{
        src?: string | null
        alt?: string
        caption?: string | null
      }>
      const photos = rawPhotos.map((ph) => ({
        src: (ph?.src ?? null) as string | null,
        alt: typeof ph?.alt === 'string' ? ph.alt : '',
        caption: (ph?.caption ?? null) as string | null,
      }))
      if (photos.length === 0) return null
      const layout =
        p.layout === 'grid-2' || p.layout === 'grid-3' || p.layout === 'grid-4'
          ? p.layout
          : 'right'
      return { kind: 'step_with_photos', number, text, photos, layout }
    }
    case 'photo_grid': {
      const rawItems = (p.items ?? []) as Array<{
        src?: string | null
        alt?: string
        caption?: string | null
      }>
      const items = rawItems.map((ph) => ({
        src: (ph?.src ?? null) as string | null,
        alt: typeof ph?.alt === 'string' ? ph.alt : '',
        caption: (ph?.caption ?? null) as string | null,
      }))
      const columns = p.columns === '3' || p.columns === '4' ? p.columns : '2'
      return { kind: 'photo_grid', items, columns }
    }
    default:
      return null
  }
}

/**
 * Build a default empty BlockContent for a given kind. Used when the picker
 * needs a placeholder content shape for newly-created Puck items in wizard
 * submit (where library content gets stamped into Puck props post-insert).
 */
export function blockContentToPuckProps(content: BlockContent): Record<string, unknown> {
  switch (content.kind) {
    case 'hazard':
      return {
        title: 'Hazard',
        body: content.text,
        severity: content.severity,
      }
    case 'ppe':
      return {
        title: 'PPE Required',
        items: content.items,
      }
    case 'step':
      return {
        number: 1,
        text: content.text,
      }
    case 'measurement':
      return {
        label: content.label,
        unit: content.unit,
        voiceEnabled: content.voiceEnabled !== false,
        ...(content.hint ? { hint: content.hint } : {}),
      }
    case 'decision':
      return {
        question: content.question,
        options: content.options,
      }
    case 'escalate':
      return {
        title: content.title,
        escalationMode: content.escalationMode,
        ...(content.reason ? { reason: content.reason } : {}),
      }
    case 'signoff':
      return {
        title: content.title,
        requiredRole: content.requiredRole,
        ...(content.acknowledgementText ? { acknowledgementText: content.acknowledgementText } : {}),
      }
    case 'zone':
      return {
        label: content.label,
        zoneType: content.zoneType,
        ...(content.notes ? { notes: content.notes } : {}),
      }
    case 'inspect':
      return {
        title: content.title,
        items: content.items,
      }
    case 'voice-note':
      return {
        prompt: content.prompt,
        language: content.language,
        maxDurationSec: content.maxDurationSec,
      }
    case 'emergency':
      return {
        title: 'Emergency',
        body: content.text,
      }
    case 'custom':
      return content.data
    // Plan 21-05 — round-trip for parser-emitted kinds.
    case 'text':
      return { content: content.content }
    case 'heading':
      return { text: content.text, level: content.level }
    case 'photo':
      return {
        src: content.src,
        alt: content.alt,
        caption: content.caption ?? '',
      }
    case 'callout':
      return { title: content.title, body: content.body }
    case 'model':
      return {
        assetUrl: content.assetUrl,
        hotspots: content.hotspots,
        defaultLayers: content.defaultLayers,
      }
    case 'step_with_photos':
      return {
        number: content.number,
        text: content.text,
        photos: content.photos,
        layout: content.layout,
      }
    case 'photo_grid':
      return { items: content.items, columns: content.columns }
    default:
      return {}
  }
}

/**
 * Map a BlockContent kind to its corresponding Puck component type name.
 */
export function blockKindToPuckType(kind: BlockContent['kind']): string | null {
  for (const [puckType, mappedKind] of Object.entries(PUCK_TYPE_TO_BLOCK_KIND)) {
    if (mappedKind === kind) return puckType
  }
  return null
}
