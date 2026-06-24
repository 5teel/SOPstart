/**
 * Phase 22 — VDW-VOICE-01: SOP vocabulary → keyterm array for Deepgram STT.
 *
 * Extracts domain-specific vocabulary from a SOP's sections and steps
 * to inject into the Deepgram WebSocket URL as `keyterm=` params.
 * This boosts transcription accuracy for industrial terminology
 * (≥90% noise-accuracy target, VDW-VOICE-01).
 *
 * PATTERNS.md § deepgram-stream.ts lines 448-460.
 */

import type { SopWithSections } from '@/types/sop'

/**
 * Extract unique keyterms from a SOP for Deepgram STT vocabulary injection.
 *
 * Sources:
 *   - Each step's `required_tools` entries (tool names are high-value domain terms)
 *   - Each section's `title` (section headings often contain equipment/process names)
 *
 * @param sop - SOP with nested sections and steps (may be empty / partial).
 * @returns Deduplicated array of up to 100 keyterm strings. Never throws.
 */
export function extractKeyterms(sop: SopWithSections): string[] {
  const terms = new Set<string>()

  for (const section of sop.sop_sections ?? []) {
    // Section title (e.g. "Lehr Cooling Zone Inspection", "PPE Requirements")
    if (section.title) terms.add(section.title)

    // Required tools from each step (e.g. "blank side hanger", "torque wrench")
    for (const step of section.sop_steps ?? []) {
      for (const tool of step.required_tools ?? []) {
        terms.add(tool)
      }
    }
  }

  // Cap at 100 — Deepgram keyterms API limit (PATTERNS.md line 457).
  return Array.from(terms).slice(0, 100)
}
