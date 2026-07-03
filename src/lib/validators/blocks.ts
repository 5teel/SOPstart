import { z } from 'zod'

// ---------------------------------------------------------------
// v3.0: Zod discriminated-union validators for block_versions.content
// Mirrors the `BlockContent` TypeScript type in src/types/sop.ts.
// Any server action that writes to `block_versions` MUST call
// `BlockContentSchema.parse(content)` before insert.
// ---------------------------------------------------------------

export const HazardBlockContentSchema = z.object({
  kind: z.literal('hazard'),
  text: z.string().min(1),
  severity: z.enum(['critical', 'warning', 'notice']),
})

export const PpeBlockContentSchema = z.object({
  kind: z.literal('ppe'),
  items: z.array(z.string().min(1)).min(1),
})

export const StepBlockContentSchema = z.object({
  kind: z.literal('step'),
  text: z.string().min(1),
  warning: z.string().optional(),
  tip: z.string().optional(),
})

export const EmergencyBlockContentSchema = z.object({
  kind: z.literal('emergency'),
  text: z.string().min(1),
  contacts: z.array(z.string()).optional(),
})

export const CustomBlockContentSchema = z.object({
  kind: z.literal('custom'),
  data: z.record(z.string(), z.unknown()),
})

export const MeasurementBlockContentSchema = z.object({
  kind: z.literal('measurement'),
  label: z.string().min(1),
  unit: z.string().min(1),
  tolerance: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      target: z.number().optional(),
    })
    .optional(),
  voiceEnabled: z.boolean().default(true),
  hint: z.string().optional(),
})

export const DecisionBlockContentSchema = z.object({
  kind: z.literal('decision'),
  question: z.string().min(1),
  options: z
    .array(
      z.object({
        label: z.string().min(1),
        nextStepId: z.string().uuid().optional(),
        isEscalation: z.boolean().optional(),
      })
    )
    .min(2),
})

export const EscalateBlockContentSchema = z.object({
  kind: z.literal('escalate'),
  title: z.string().min(1),
  reason: z.string().optional(),
  escalationMode: z.enum(['alert', 'lock', 'form']).default('form'),
  recipients: z
    .array(z.enum(['supervisor', 'safety_manager', 'admin']))
    .optional(),
})

export const SignOffBlockContentSchema = z.object({
  kind: z.literal('signoff'),
  title: z.string().min(1),
  requiredRole: z
    .enum(['supervisor', 'safety_manager', 'admin'])
    .default('supervisor'),
  acknowledgementText: z.string().optional(),
})

export const ZoneBlockContentSchema = z.object({
  kind: z.literal('zone'),
  label: z.string().min(1),
  zoneType: z.enum(['danger', 'warning', 'safe', 'pedestrian']),
  notes: z.string().optional(),
})

export const InspectBlockContentSchema = z.object({
  kind: z.literal('inspect'),
  title: z.string().min(1),
  items: z
    .array(
      z.object({
        label: z.string().min(1),
        requirePhoto: z.boolean().default(false),
      })
    )
    .min(1),
})

export const VoiceNoteBlockContentSchema = z.object({
  kind: z.literal('voice-note'),
  prompt: z.string().min(1),
  language: z.enum(['en-NZ', 'en-AU', 'en-US']).default('en-NZ'),
  maxDurationSec: z.number().int().min(5).max(300).default(60),
})

// ---------------------------------------------------------------
// Phase 21 Plan 21-05 — Parser-emitted Puck kinds added to the
// discriminated union. Until 21-05 the parser only wrote Puck items
// into sop_sections.layout_data; the publish-gate verify checklist
// (Wave 4) walks sop_section_blocks junction rows, so every parsed
// SOP had 0/0 → no-op gate. 21-05 wires the parser to also create
// library blocks + junctions for each Puck item, requiring these
// 7 kinds to be valid BlockContent shapes.
//
// .nullable() (not .optional()) per Phase 02 OpenAI structured-output
// pattern — keeps the schema GPT-compatible if these are ever used
// as response_format targets.
// ---------------------------------------------------------------

export const TextBlockContentSchema = z.object({
  kind: z.literal('text'),
  content: z.string().min(1).max(10_000),
})

export const HeadingBlockContentSchema = z.object({
  kind: z.literal('heading'),
  text: z.string().min(1).max(200),
  level: z.enum(['h2', 'h3']).default('h2'),
})

export const PhotoBlockContentSchema = z.object({
  kind: z.literal('photo'),
  src: z.string().min(1).nullable(),
  alt: z.string().max(200).default(''),
  caption: z.string().max(500).nullable(),
})

export const CalloutBlockContentSchema = z.object({
  kind: z.literal('callout'),
  title: z.string().max(120).default('Note'),
  body: z.string().min(1).max(2000),
})

export const ModelBlockContentSchema = z.object({
  kind: z.literal('model'),
  assetUrl: z.string().url(),
  hotspots: z
    .array(
      z.object({
        id: z.string(),
        label: z.string().min(1).max(120),
        position: z.object({ x: z.number(), y: z.number(), z: z.number() }),
      })
    )
    .default([]),
  defaultLayers: z.array(z.string()).default([]),
})

export const StepPhotoItemContentSchema = z.object({
  src: z.string().nullable(),
  alt: z.string().max(200).default(''),
  caption: z.string().max(500).nullable(),
})

export const StepWithPhotosBlockContentSchema = z.object({
  kind: z.literal('step_with_photos'),
  number: z.number().int().min(1).default(1),
  text: z.string().min(1).max(5000),
  photos: z.array(StepPhotoItemContentSchema).min(1).max(12),
  layout: z.enum(['right', 'grid-2', 'grid-3', 'grid-4']).default('right'),
})

export const PhotoGridItemContentSchema = z.object({
  src: z.string().nullable(),
  alt: z.string().max(200).default(''),
  caption: z.string().max(500).nullable(),
})

export const PhotoGridBlockContentSchema = z.object({
  kind: z.literal('photo_grid'),
  items: z.array(PhotoGridItemContentSchema).default([]),
  columns: z.enum(['2', '3', '4']).default('2'),
})

// ---------------------------------------------------------------
// Phase 26 Plan 26-09 (R5, D-03) — the unified Visual block. One
// junction-stored block holding mixed media, each item medium-tagged
// (visual:photo | visual:diagram | visual:video). `annotationId` links a
// diagram item to its Konva overlay (26-11). Mirrors VisualBlockPropsSchema
// in src/components/admin/builder-v2/visual/media-adapter.ts.
// ---------------------------------------------------------------
export const VisualItemContentSchema = z.object({
  medium: z.enum(['photo', 'diagram', 'video']),
  src: z.string().nullable(),
  alt: z.string().max(200).default(''),
  caption: z.string().max(500).nullable(),
  annotationId: z.string().uuid().optional(),
  // Plan 26-13 — baked diagram PNG path/URL + the annotated sop_images FK.
  bakedSrc: z.string().nullable().optional(),
  sopImageId: z.string().uuid().optional(),
})

export const VisualBlockContentSchema = z.object({
  kind: z.literal('visual'),
  items: z.array(VisualItemContentSchema).default([]),
})

export const BlockContentSchema = z.discriminatedUnion('kind', [
  HazardBlockContentSchema,
  PpeBlockContentSchema,
  StepBlockContentSchema,
  EmergencyBlockContentSchema,
  CustomBlockContentSchema,
  MeasurementBlockContentSchema,
  DecisionBlockContentSchema,
  EscalateBlockContentSchema,
  SignOffBlockContentSchema,
  ZoneBlockContentSchema,
  InspectBlockContentSchema,
  VoiceNoteBlockContentSchema,
  // Plan 21-05 — parser-emitted kinds (mirror Puck registry shapes):
  TextBlockContentSchema,
  HeadingBlockContentSchema,
  PhotoBlockContentSchema,
  CalloutBlockContentSchema,
  ModelBlockContentSchema,
  StepWithPhotosBlockContentSchema,
  PhotoGridBlockContentSchema,
  // Plan 26-09 — unified Visual block (junction-stored, medium-tagged):
  VisualBlockContentSchema,
])

export type HazardBlockContent = z.infer<typeof HazardBlockContentSchema>
export type PpeBlockContent = z.infer<typeof PpeBlockContentSchema>
export type StepBlockContent = z.infer<typeof StepBlockContentSchema>
export type EmergencyBlockContent = z.infer<typeof EmergencyBlockContentSchema>
export type CustomBlockContent = z.infer<typeof CustomBlockContentSchema>
export type MeasurementBlockContent = z.infer<typeof MeasurementBlockContentSchema>
export type DecisionBlockContent = z.infer<typeof DecisionBlockContentSchema>
export type EscalateBlockContent = z.infer<typeof EscalateBlockContentSchema>
export type SignOffBlockContent = z.infer<typeof SignOffBlockContentSchema>
export type ZoneBlockContent = z.infer<typeof ZoneBlockContentSchema>
export type InspectBlockContent = z.infer<typeof InspectBlockContentSchema>
export type VoiceNoteBlockContent = z.infer<typeof VoiceNoteBlockContentSchema>
// Plan 21-05 — parser-emitted content types
export type TextBlockContent = z.infer<typeof TextBlockContentSchema>
export type HeadingBlockContent = z.infer<typeof HeadingBlockContentSchema>
export type PhotoBlockContent = z.infer<typeof PhotoBlockContentSchema>
export type CalloutBlockContent = z.infer<typeof CalloutBlockContentSchema>
export type ModelBlockContent = z.infer<typeof ModelBlockContentSchema>
export type StepWithPhotosBlockContent = z.infer<typeof StepWithPhotosBlockContentSchema>
export type PhotoGridBlockContent = z.infer<typeof PhotoGridBlockContentSchema>
export type VisualItemContent = z.infer<typeof VisualItemContentSchema>
export type VisualBlockContent = z.infer<typeof VisualBlockContentSchema>
export type BlockContent = z.infer<typeof BlockContentSchema>
