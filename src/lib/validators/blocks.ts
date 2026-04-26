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

// ModelBlock is intentionally excluded from BlockContentSchema —
// it lives only in layout_data (Puck JSON), never in sop_section_blocks.
// It IS registered in puckConfig.components + BLOCK_REGISTRY.

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
export type BlockContent = z.infer<typeof BlockContentSchema>
