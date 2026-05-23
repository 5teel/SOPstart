// Validates seed JSON content fields against BlockContentSchema.
// Usage: node .planning/phases/13-reusable-block-library/seed-source/validate-zod.mjs
import { readFileSync } from 'node:fs'
import { z } from 'zod'

const HazardBlockContentSchema = z.object({
  kind: z.literal('hazard'),
  text: z.string().min(1),
  severity: z.enum(['critical', 'warning', 'notice']),
})
const PpeBlockContentSchema = z.object({
  kind: z.literal('ppe'),
  items: z.array(z.string().min(1)).min(1),
})
const StepBlockContentSchema = z.object({
  kind: z.literal('step'),
  text: z.string().min(1),
  warning: z.string().optional(),
  tip: z.string().optional(),
})
const BlockContentSchema = z.discriminatedUnion('kind', [
  HazardBlockContentSchema,
  PpeBlockContentSchema,
  StepBlockContentSchema,
])

const file = '.planning/phases/13-reusable-block-library/seed-source/global-blocks.json'
const data = JSON.parse(readFileSync(file, 'utf8'))
let failed = 0
for (const b of data.blocks) {
  const r = BlockContentSchema.safeParse(b.content)
  if (!r.success) {
    console.error('FAIL:', b.name, JSON.stringify(r.error.issues))
    failed++
  }
}
console.log(`Validated ${data.blocks.length} entries; ${failed} failures`)
process.exit(failed === 0 ? 0 : 1)
