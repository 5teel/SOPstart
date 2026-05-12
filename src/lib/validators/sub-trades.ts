import { z } from 'zod'

/**
 * Phase 15 — base sub-trade assignment validator (Wave 0/1 scaffold).
 *
 * Caps `subTradeIds` at 10 entries per T-15-01-05 DoS mitigation. The 15a seed
 * vocabulary is exactly 5 rows (operator/fitter/sparky/maintainer/other), so a
 * 10-cap leaves headroom for the 15b admin-editable vocab without unbounded growth.
 *
 * Wave 4 extends this file with `assignUserSubTradesSchema` and
 * `assignSopSubTradesSchema` — the actually-consumed server-action validators.
 * This base schema stays for scaffolding + as a documented extension point.
 */
export const subTradeAssignmentSchema = z.object({
  subTradeIds: z
    .array(z.string().uuid())
    .max(10, 'Maximum 10 sub-trades per assignment'),
})

export type SubTradeAssignmentInput = z.infer<typeof subTradeAssignmentSchema>
