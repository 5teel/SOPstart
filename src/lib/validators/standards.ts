/**
 * Phase 56 (56-06) -- standards validators (D-12, T-56-21).
 *
 * Plain module, no directive -- importable from both client and server code.
 */
import { z } from 'zod'

export const standardNameSchema = z.string().trim().min(1, 'Give the standard a name').max(60, 'Keep the name under 60 characters')

export const createStandardSchema = z.object({ name: standardNameSchema })
export const renameStandardSchema = z.object({ standardId: z.string().uuid(), name: standardNameSchema })
export const removeStandardSchema = z.object({ standardId: z.string().uuid() })

export const standardTargetSchema = z.object({
  kind: z.enum(['sop', 'section', 'step']),
  id: z.string().uuid(),
})
export const setStandardAttachmentSchema = z.object({
  standardId: z.string().uuid(),
  target: standardTargetSchema,
  attached: z.boolean(),
})

export type StandardTarget = z.infer<typeof standardTargetSchema>

export interface StandardRow {
  id: string
  name: string
  uses: number
}

export interface StandardsPanelStep {
  id: string
  kind: string
  text: string
  attached: string[]
}

export interface StandardsPanelSection {
  id: string
  title: string
  attached: string[]
  steps: StandardsPanelStep[]
}

export interface StandardsPanel {
  standards: { id: string; name: string }[]
  sopAttached: string[]
  sections: StandardsPanelSection[]
}
