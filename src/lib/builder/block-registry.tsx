/**
 * Bespoke block registry (Phase 26, D-01) — the renderer "place" off Puck.
 *
 * `layout_data` is Puck-agnostic JSON (`{ content: [{ type, props }], root }`);
 * the block components in `src/components/sop/blocks/*` (+ the 26-09 VisualBlock)
 * accept exactly those props. Replacing Puck as the RENDER engine is therefore a `type → component`
 * switch, not a rewrite. This module is the single source of that mapping,
 * consumed by both the worker read path (`LayoutRenderer`) and — later waves —
 * the admin edit host. It carries NO `@puckeditor/core` import, so pulling it
 * into `/sops/[sopId]` drops Puck from the worker bundle.
 *
 * `UnsupportedBlockPlaceholder` + `sanitizeLayoutContent` live in
 * `./sanitize-layout` (P17) and consult `BLOCK_COMPONENTS` for the known-type
 * membership check.
 *
 * Contract note: `scripts/contract-check.ts` reads the `BLOCK_COMPONENTS`
 * object literal below as place (1) of the three-place block contract. Keep the
 * keys as one-per-line `Type: Blocks.Type,` entries so the build-gate parser
 * can extract them (RESEARCH Pitfall 1).
 */
import * as Blocks from '@/components/sop/blocks'
// Phase 26 (26-09, R5): the unified Visual block. Konva-free DISPLAY component —
// admin annotation editing is code-split (26-11), so importing it into the
// worker render path keeps `/sops/[sopId]` Konva-free (R8).
import { VisualBlock } from '@/components/admin/builder-v2/visual/VisualBlock'

/**
 * The 18 registered layout_data block types → their worker component
 * (17 in `src/components/sop/blocks/*` + the 26-09 unified VisualBlock).
 * `UnsupportedBlockPlaceholder` is handled separately in `./sanitize-layout`
 * (it is a fallback, not an authorable block).
 */
export const BLOCK_COMPONENTS = {
  TextBlock: Blocks.TextBlock,
  HeadingBlock: Blocks.HeadingBlock,
  PhotoBlock: Blocks.PhotoBlock,
  CalloutBlock: Blocks.CalloutBlock,
  StepBlock: Blocks.StepBlock,
  HazardCardBlock: Blocks.HazardCardBlock,
  PPECardBlock: Blocks.PPECardBlock,
  MeasurementBlock: Blocks.MeasurementBlock,
  DecisionBlock: Blocks.DecisionBlock,
  EscalateBlock: Blocks.EscalateBlock,
  SignOffBlock: Blocks.SignOffBlock,
  ZoneBlock: Blocks.ZoneBlock,
  InspectBlock: Blocks.InspectBlock,
  VoiceNoteBlock: Blocks.VoiceNoteBlock,
  ModelBlock: Blocks.ModelBlock,
  StepWithPhotosBlock: Blocks.StepWithPhotosBlock,
  PhotoGridBlock: Blocks.PhotoGridBlock,
  VisualBlock: VisualBlock,
} as const

export type BlockType = keyof typeof BLOCK_COMPONENTS

/**
 * Default props per block type, distilled from each `puck-config.tsx`
 * `components[X].defaultProps` (the shape a freshly-inserted block starts with).
 * Used by the inserter and parity fixtures — NOT applied at render time (stored
 * layout_data is validated at the write boundary).
 */
export const BLOCK_DEFAULTS: Record<BlockType, Record<string, unknown>> = {
  TextBlock: { content: 'Text content…' },
  HeadingBlock: { text: 'Heading', level: 'h2' },
  PhotoBlock: { src: null, alt: '', caption: '' },
  CalloutBlock: { title: 'Note', body: 'Callout text…' },
  StepBlock: { number: 1, text: 'Describe this step…' },
  HazardCardBlock: { title: 'Hazard', body: 'Describe the hazard…', severity: 'warning' },
  PPECardBlock: { title: 'PPE Required', items: ['Safety equipment'] },
  MeasurementBlock: { label: 'Gap', unit: 'mm', voiceEnabled: true },
  DecisionBlock: {
    question: 'Is the guard in place?',
    options: [{ label: 'Yes — continue' }, { label: 'No — escalate', isEscalation: true }],
  },
  EscalateBlock: { title: 'Escalate', escalationMode: 'form' },
  SignOffBlock: { title: 'Supervisor sign-off', requiredRole: 'supervisor' },
  ZoneBlock: { label: 'Forklift corridor', zoneType: 'danger' },
  InspectBlock: {
    title: 'Pre-start inspection',
    items: [{ label: 'Guards in place', requirePhoto: true }],
  },
  VoiceNoteBlock: { prompt: 'Describe any unusual noise.', language: 'en-NZ', maxDurationSec: 60 },
  ModelBlock: {
    assetUrl: 'https://storage.example.com/models/pump.glb',
    hotspots: [],
    defaultLayers: [],
  },
  StepWithPhotosBlock: {
    number: 1,
    text: 'Describe this step…',
    photos: [{ src: null, alt: '', caption: null }],
    layout: 'right',
  },
  PhotoGridBlock: { items: [{ src: null, alt: '', caption: null }], columns: '2' },
  VisualBlock: { items: [] },
}

// layout_data carries frozen-contract metadata alongside component props
// (P4/P15/R7). These keys are NOT component props — strip them before spread.
const META_KEYS = new Set(['id', 'junctionId', 'block_provenance'])

/**
 * Drop layout_data metadata (`id`, `junctionId`, `block_provenance`) so only
 * real component props are spread onto the block. Round-trips everything else
 * losslessly.
 */
export function stripMeta(props: Record<string, unknown> | undefined | null): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!props) return out
  for (const k of Object.keys(props)) {
    if (!META_KEYS.has(k)) out[k] = props[k]
  }
  return out
}
