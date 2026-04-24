import { z } from 'zod'

// Permissive outer-shape schema for Puck Data. Individual block props are
// validated in their own block-file co-located schemas (D-09). This schema
// only catches structurally broken layout_data (D-15) so we can fall back.
export const LayoutDataSchema = z.object({
  content: z.array(z.unknown()),
  root: z
    .object({
      props: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
})
export type LayoutData = z.infer<typeof LayoutDataSchema>
