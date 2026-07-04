import { VoyageAIClient } from 'voyageai'

/**
 * Phase 26.5 — lazy VoyageAIClient singleton (D-03).
 *
 * Mirrors getAnthropic() in src/lib/parsers/verify-sop.ts: lazy-initialized to
 * avoid constructing (and reading VOYAGE_API_KEY) at module load time during
 * Next.js static analysis — safe to import when the key is unset locally.
 */
let voyage: VoyageAIClient | null = null

export function getVoyageClient(): VoyageAIClient {
  if (!voyage) {
    voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY })
  }
  return voyage
}
