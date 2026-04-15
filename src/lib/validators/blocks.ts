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

export const BlockContentSchema = z.discriminatedUnion('kind', [
  HazardBlockContentSchema,
  PpeBlockContentSchema,
  StepBlockContentSchema,
  EmergencyBlockContentSchema,
  CustomBlockContentSchema,
])

export type HazardBlockContent = z.infer<typeof HazardBlockContentSchema>
export type PpeBlockContent = z.infer<typeof PpeBlockContentSchema>
export type StepBlockContent = z.infer<typeof StepBlockContentSchema>
export type EmergencyBlockContent = z.infer<typeof EmergencyBlockContentSchema>
export type CustomBlockContent = z.infer<typeof CustomBlockContentSchema>
export type BlockContent = z.infer<typeof BlockContentSchema>
