import { z } from 'zod'

/**
 * Phase 22 — TTS request schema for POST /api/voice/tts.
 *
 * - text: trimmed, must be non-empty (min 1) and at most 500 chars.
 *   Lower bound = prevents empty TTS call (no-op cost). Upper bound = DoS mitigation
 *   per T-22-02-01 (50 workers × 500-char loops). Mirrors voiceQuerySchema structure.
 *
 * Note: NO admin-role check in the route — workers are allowed (D-15, per voice/query
 * pattern). Auth via Supabase session is the gate; org-scoping is implicit (session RLS).
 */
export const voiceTtsSchema = z.object({
  text: z
    .string()
    .min(1, 'Text must not be empty')
    .max(500, 'Text must be under 500 characters'),
})

export type VoiceTtsInput = z.infer<typeof voiceTtsSchema>
